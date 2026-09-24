"""District-isolated hindcast with nested calibration and no 2022 feature leakage.

Only one historical transition is available. Metrics are grouped hindcasts,
not proof of out-of-cycle 2027 accuracy. Booth deltas are explanatory context;
they cannot be trained without an earlier, comparable transition.
"""
import math
from dataclasses import dataclass

from app.services.prediction.parties import PARTIES

METRICS = ("turnout", "nota", "margin", "enp", "gender_ratio", "booth_count")


def vectorize(row, period="2022"):
    features = row["features"]
    keys = [f"{p.lower()}_share_{period}" for p in PARTIES] + [f"{m}_{period}" for m in METRICS]
    values = [float(features[key]) if features.get(key) is not None else float("nan") for key in keys]
    # Fixed-width missingness flags prevent silent missing=zero interpretation.
    return [value if math.isfinite(value) else 0 for value in values] + [int(not math.isfinite(value)) for value in values]


@dataclass
class StatisticalResult:
    predictions: list
    backtest: dict
    feature_importance: dict
    model_version: str


def _fit(x, y):
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from xgboost import XGBClassifier
    labels = np.unique(y)
    if len(labels) < 2:
        raise ValueError("Insufficient classes in training fold")
    encoded = np.searchsorted(labels, y)
    models = [
        RandomForestClassifier(n_estimators=120, max_depth=5, min_samples_leaf=4, random_state=42, n_jobs=1),
        make_pipeline(StandardScaler(), LogisticRegression(max_iter=1500, C=0.5, random_state=42)),
        XGBClassifier(objective="multi:softprob", num_class=len(labels), n_estimators=120, max_depth=3,
                      learning_rate=0.05, subsample=0.85, colsample_bytree=0.85, random_state=42,
                      n_jobs=1, eval_metric="mlogloss"),
    ]
    for model in models:
        model.fit(x, encoded)
    return models, labels


def _predict(fitted, x):
    import numpy as np
    models, labels = fitted
    results = []
    for model in models:
        values = np.full((len(x), len(PARTIES)), 1e-8)
        values[:, labels] = model.predict_proba(x)
        results.append(values / values.sum(axis=1, keepdims=True))
    return np.stack(results)


def _scale(probabilities, temperature):
    import numpy as np
    logits = np.log(np.clip(probabilities, 1e-8, 1)) / temperature
    exp = np.exp(logits - logits.max(axis=1, keepdims=True))
    return exp / exp.sum(axis=1, keepdims=True)


def _metrics(p, labels):
    import numpy as np
    from sklearn.metrics import log_loss, f1_score, precision_recall_fscore_support
    winners = p.argmax(axis=1)
    confidence = p.max(axis=1)
    ece = 0
    for low in np.arange(0, 1, 0.1):
        mask = (confidence >= low) & (confidence < low + 0.1 + (1e-8 if low >= 0.9 else 0))
        if mask.any():
            ece += mask.mean() * abs((winners[mask] == labels[mask]).mean() - confidence[mask].mean())
    precision, recall, f1, support = precision_recall_fscore_support(labels, winners, labels=range(6), zero_division=0)
    return {"accuracy": round(float((winners == labels).mean() * 100), 2),
            "log_loss": float(log_loss(labels, p, labels=range(6))),
            "brier": float(np.square(p - np.eye(6)[labels]).sum(axis=1).mean()),
            "macro_f1": float(f1_score(labels, winners, average="macro", labels=range(6), zero_division=0)),
            "ece": float(ece), "sample_size": len(labels),
            "per_party": {party: {"precision": float(precision[i]), "recall": float(recall[i]),
                                   "f1": float(f1[i]), "support": int(support[i])} for i, party in enumerate(PARTIES)}}


def _choose(raw, y):
    import numpy as np
    candidates = [(1/3, 1/3, 1/3), (0.3, 0.2, 0.5), (0.5, 0.25, 0.25), (0.25, 0.5, 0.25)]
    best = None
    for weights in candidates:
        blended = np.tensordot(weights, raw, axes=(0, 0))
        for temperature in (0.8, 1.0, 1.2, 1.5, 2.0):
            values = _scale(blended, temperature)
            loss = -np.log(values[np.arange(len(y)), y]).mean()
            if best is None or loss < best[0]:
                best = (loss, weights, temperature)
    return best[1], best[2]


def train_and_predict(rows):
    import numpy as np
    from sklearn.model_selection import GroupKFold
    train = [row for row in rows if row["summary_2017"]["total"] > 0]
    if len(train) < 30:
        raise ValueError("Insufficient paired historical constituencies for model validation")
    x = np.array([vectorize(row, "2017") for row in train])
    y = np.array([PARTIES.index(row["summary_2022"]["winner"]) for row in train])
    groups = np.array([row["district"] for row in train])
    if len(set(groups)) < 5:
        raise ValueError("At least five independent district groups are required")
    raw = np.zeros((3, len(train), len(PARTIES)))
    evaluated = np.zeros((len(train), len(PARTIES)))
    for outer_train, test in GroupKFold(n_splits=5).split(x, y, groups):
        inner = np.zeros((3, len(outer_train), len(PARTIES)))
        for fit, held in GroupKFold(n_splits=3).split(x[outer_train], y[outer_train], groups[outer_train]):
            model = _fit(x[outer_train][fit], y[outer_train][fit])
            inner[:, held, :] = _predict(model, x[outer_train][held])
        weights, temperature = _choose(inner, y[outer_train])
        model = _fit(x[outer_train], y[outer_train])
        raw[:, test, :] = _predict(model, x[test])
        evaluated[test] = _scale(np.tensordot(weights, raw[:, test, :], axes=(0, 0)), temperature)
    final_weights, temperature = _choose(raw, y)
    fitted = _fit(x, y)
    predictions = _scale(np.tensordot(final_weights, _predict(fitted, np.array([vectorize(row) for row in rows])), axes=(0, 0)), temperature)
    version = "ensemble-v2-nested-grouped-hindcast"
    outputs = []
    for row, values in zip(rows, predictions):
        probabilities = {party: float(values[index]) for index, party in enumerate(PARTIES)}
        leader = max(probabilities, key=probabilities.get)
        outputs.append({"constituency_id": row.get("id"), "code": row["code"], "name": row["name"],
                        "district": row["district"], "region": row["region"], "features": row["features"],
                        "missing_features": row.get("missing_features", []),
                        "stat_predicted_party": leader, "stat_probabilities": probabilities,
                        "stat_confidence": probabilities[leader] * 100, "stat_model_version": version,
                        "stat_key_factors": ["Historical single-cycle booth shares, turnout and competition.",
                                             "2017–2022 booth deltas are context, not a trained 2027 swing estimate."],
                        "historical_winner_2022": row["summary_2022"]["winner"],
                        "historical_actual_winner_2022": row["summary_2022"].get("actual_winner"),
                        "historical_margin_2022": row["summary_2022"]["margin"]})
    metrics = {"status": "nested_grouped_hindcast", **_metrics(evaluated, y), "folds": 5,
               "group_key": "district", "feature_year": 2017, "target_year": 2022,
               "temperature": temperature, "weights": list(final_weights),
               "models": ["random_forest", "standardized_logistic", "xgboost"],
               "limitations": ["One historical transition; no independent future-cycle validation.",
                               "Hyperparameter grid and calibration evaluated inside district-held-out folds.",
                               "Demographics excluded until sourced and time-bounded.",
                               "Vote-share and margin models are not fitted."]}
    return StatisticalResult(outputs, metrics, {}, version)
