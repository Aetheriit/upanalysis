"""Calibrated statistical layer: XGBoost + random forest + logistic baseline."""
from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from typing import Any

from app.services.prediction_engine import PARTIES


BASE_FEATURES = (
    "share", "swing", "swing_std", "turnout", "nota", "margin", "enp",
    "gender_ratio", "booth_count", "match_rate", "strong_booth_ratio",
    "weak_booth_ratio", "swing_booth_ratio",
)


def _feature_value(row: dict[str, Any], party: str, period: str, metric: str) -> float:
    features = row["features"]
    if metric == "share":
        return float(features.get(f"{party.lower()}_share_{period}", 0))
    if metric == "swing":
        return float(features.get(f"{party.lower()}_swing", 0)) if period == "2022" else 0.0
    if metric == "swing_std":
        return float(features.get(f"{party.lower()}_swing_std", 0)) if period == "2022" else 0.0
    if metric == "turnout": return float(features.get(f"turnout_{period}", 0))
    if metric == "nota": return float(features.get(f"nota_{period}", 0))
    if metric == "margin": return float(features.get(f"margin_{period}", 0)) / 100000
    if metric == "enp": return float(features.get(f"enp_{period}", 0))
    return float(features.get(metric, 0))


def vectorize(row: dict[str, Any], period: str = "2022") -> list[float]:
    vector: list[float] = []
    for party in PARTIES:
        for metric in ("share", "swing", "swing_std"):
            vector.append(_feature_value(row, party, period, metric))
    for metric in BASE_FEATURES[3:]:
        vector.append(_feature_value(row, "", period, metric))
    return vector


def feature_names() -> list[str]:
    return [f"{party.lower()}_{metric}" for party in PARTIES for metric in ("share", "swing", "swing_std")] + list(BASE_FEATURES[3:])


def _aligned_probabilities(model: Any, matrix: list[list[float]], classes: list[str]) -> list[list[float]]:
    raw = model.predict_proba(matrix)
    result = []
    model_classes = [int(value) for value in getattr(model, "classes_", range(len(classes)))]
    for row in raw:
        aligned = [0.0] * len(classes)
        for index, probability in zip(model_classes, row):
            if 0 <= index < len(classes): aligned[index] = float(probability)
        total = sum(aligned) or 1
        result.append([value / total for value in aligned])
    return result


def _normalise(matrix: list[list[float]]) -> list[list[float]]:
    if not matrix: return []
    columns = list(zip(*matrix))
    means = [sum(column) / len(column) for column in columns]
    scales = [math.sqrt(sum((value - mean) ** 2 for value in column) / max(len(column) - 1, 1)) or 1 for column, mean in zip(columns, means)]
    return [[(value - means[index]) / scales[index] for index, value in enumerate(row)] for row in matrix]


@dataclass
class StatisticalResult:
    predictions: list[dict[str, Any]]
    backtest: dict[str, Any]
    feature_importance: dict[str, float]
    model_version: str


def _metrics(probabilities: list[list[float]], labels: list[int]) -> dict[str, Any]:
    if not labels: return {"accuracy": None, "log_loss": None, "brier": None, "sample_size": 0}
    eps = 1e-9
    predicted = [max(range(len(row)), key=row.__getitem__) for row in probabilities]
    log_loss = -sum(math.log(max(probabilities[i][label], eps)) for i, label in enumerate(labels)) / len(labels)
    brier = sum(sum((probability - (1 if index == label else 0)) ** 2 for index, probability in enumerate(probabilities[i])) for i, label in enumerate(labels)) / len(labels)
    return {"accuracy": round(sum(a == b for a, b in zip(predicted, labels)) / len(labels) * 100, 2), "log_loss": round(log_loss, 5), "brier": round(brier, 5), "sample_size": len(labels), "predicted_class_counts": dict(Counter(predicted))}


def _temperature_scale(probabilities: list[list[float]], temperature: float) -> list[list[float]]:
    scaled = []
    for row in probabilities:
        logits = [math.log(max(value, 1e-8)) / temperature for value in row]
        maximum = max(logits)
        values = [math.exp(value - maximum) for value in logits]
        total = sum(values) or 1
        scaled.append([value / total for value in values])
    return scaled


def _grouped_oof(train_rows: list[dict[str, Any]], x_train: list[list[float]], y_train: list[int]) -> tuple[dict[str, Any], float]:
    """District-grouped OOF ensemble and temperature calibration."""
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import GroupKFold
        groups = [row["district"] for row in train_rows]
        split_count = min(5, len(set(groups)))
        if split_count < 2: return {**_metrics([], []), "status": "insufficient_groups"}, 1.0
        oof: list[list[float] | None] = [None] * len(train_rows)
        for training, testing in GroupKFold(n_splits=split_count).split(x_train, y_train, groups):
            rf = RandomForestClassifier(n_estimators=160, max_depth=6, min_samples_leaf=3, class_weight="balanced", random_state=42, n_jobs=1)
            rf.fit([x_train[i] for i in training], [y_train[i] for i in training])
            logistic = LogisticRegression(max_iter=1000, C=0.5, class_weight="balanced", random_state=42)
            logistic.fit(_normalise([x_train[i] for i in training]), [y_train[i] for i in training])
            rf_probabilities = _aligned_probabilities(rf, [x_train[i] for i in testing], list(PARTIES))
            logistic_probabilities = _aligned_probabilities(logistic, _normalise([x_train[i] for i in testing]), list(PARTIES))
            for offset, index in enumerate(testing):
                oof[index] = [(0.65 * left + 0.35 * right) for left, right in zip(rf_probabilities[offset], logistic_probabilities[offset])]
        raw = [row or [1 / len(PARTIES)] * len(PARTIES) for row in oof]
        candidates = [0.65, 0.8, 1.0, 1.2, 1.4, 1.7]
        temperature = min(candidates, key=lambda value: _metrics(_temperature_scale(raw, value), y_train)["log_loss"])
        calibrated = _temperature_scale(raw, temperature)
        return {"status": "grouped_oof_calibrated", **_metrics(calibrated, y_train), "folds": split_count, "group_key": "district", "temperature": temperature}, temperature
    except Exception as error:
        return {"status": "calibration_unavailable", "reason": f"{type(error).__name__}: {error}", **_metrics([], [])}, 1.0


def train_and_predict(rows: list[dict[str, Any]]) -> StatisticalResult:
    """Train on the 2017 snapshot, backtest against 2022, score 2027 from 2022."""
    if not rows:
        return StatisticalResult([], {"status": "no_data", "sample_size": 0}, {}, "ensemble-v1-fallback")
    class_to_index = {party: index for index, party in enumerate(PARTIES)}
    train_rows = [row for row in rows if row["summary_2017"]["total"] > 0]
    if len(train_rows) < 12:
        # A transparent fallback is retained for development datasets that do
        # not contain enough historical records to fit six classes.
        outputs = []
        for row in rows:
            probabilities = {party: max(0.0001, row["summary_2022"]["shares"].get(party, 0.0)) for party in PARTIES}
            total = sum(probabilities.values())
            probabilities = {party: value / total for party, value in probabilities.items()}
            outputs.append(_prediction_payload(row, probabilities, "historical-fallback"))
        return StatisticalResult(outputs, {"status": "fallback", "sample_size": len(train_rows), "reason": "insufficient training rows"}, {}, "historical-fallback")

    x_train = [vectorize(row, "2017") for row in train_rows]
    y_train = [class_to_index[row["summary_2022"]["winner"]] for row in train_rows]
    x_score = [vectorize(row, "2022") for row in rows]
    x_train_scaled = _normalise(x_train)
    x_score_scaled = _normalise(x_score)
    models: list[tuple[str, Any, list[list[float]]]] = []
    try:
        from sklearn.ensemble import RandomForestClassifier
        rf = RandomForestClassifier(n_estimators=240, max_depth=6, min_samples_leaf=3, class_weight="balanced", random_state=42, n_jobs=1)
        rf.fit(x_train, y_train)
        models.append(("random_forest", rf, _aligned_probabilities(rf, x_score, list(PARTIES))))
    except Exception:
        pass
    try:
        from sklearn.linear_model import LogisticRegression
        logistic = LogisticRegression(max_iter=1200, C=0.5, class_weight="balanced", random_state=42)
        logistic.fit(x_train_scaled, y_train)
        models.append(("logistic", logistic, _aligned_probabilities(logistic, x_score_scaled, list(PARTIES))))
    except Exception:
        pass
    try:
        from xgboost import XGBClassifier
        xgb = XGBClassifier(objective="multi:softprob", num_class=len(PARTIES), max_depth=4, learning_rate=0.06, n_estimators=180, subsample=0.85, colsample_bytree=0.85, eval_metric="mlogloss", random_state=42, n_jobs=1)
        xgb.fit(x_train, y_train)
        models.append(("xgboost", xgb, _aligned_probabilities(xgb, x_score, list(PARTIES))))
    except Exception:
        pass
    if not models:
        return _fallback_result(rows, "ml-dependencies-unavailable")
    weights = {"xgboost": 0.5, "random_forest": 0.3, "logistic": 0.2}
    total_weight = sum(weights.get(name, 0.2) for name, _model, _probabilities in models)
    ensemble: list[list[float]] = []
    for row_index in range(len(rows)):
        values = [0.0] * len(PARTIES)
        for name, _model, probabilities in models:
            weight = weights.get(name, 0.2) / total_weight
            values = [current + weight * probability for current, probability in zip(values, probabilities[row_index])]
        normalizer = sum(values) or 1
        ensemble.append([value / normalizer for value in values])

    backtest_probabilities = []
    for _name, model, _score_probabilities in models:
        try:
            backtest_probabilities.append((weights.get(_name, 0.2), _aligned_probabilities(model, x_train, list(PARTIES))))
        except Exception:
            pass
    backtest = []
    for row_index in range(len(train_rows)):
        values = [0.0] * len(PARTIES)
        for weight, probabilities in backtest_probabilities:
            values = [current + weight * probability for current, probability in zip(values, probabilities[row_index])]
        total = sum(values) or 1
        backtest.append([value / total for value in values])
    importance: dict[str, float] = {}
    for name, model, _probabilities in models:
        if hasattr(model, "feature_importances_"):
            for feature, value in zip(feature_names(), model.feature_importances_): importance[feature] = importance.get(feature, 0) + float(value) / len(models)
    backtest_metrics, temperature = _grouped_oof(train_rows, x_train, y_train)
    ensemble = _temperature_scale(ensemble, temperature)
    outputs = [_prediction_payload(row, {party: ensemble[index][party_index] for party_index, party in enumerate(PARTIES)}, "ensemble-v1-calibrated", importance) for index, row in enumerate(rows)]
    return StatisticalResult(outputs, {**backtest_metrics, "train_year": 2017, "test_year": 2022, "models": [name for name, _model, _probs in models]}, importance, "ensemble-v1-calibrated")


def _prediction_payload(row: dict[str, Any], probabilities: dict[str, float], model_version: str, importance: dict[str, float] | None = None) -> dict[str, Any]:
    predicted = max(PARTIES, key=lambda party: probabilities[party])
    ordered = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
    factors = []
    swings = sorted(((party, float(row["features"].get(f"{party.lower()}_swing", 0))) for party in PARTIES), key=lambda item: abs(item[1]), reverse=True)
    if swings and abs(swings[0][1]) >= 0.01: factors.append(f"{swings[0][0]} swing {swings[0][1] * 100:+.1f}pp")
    if row["features"].get("match_rate", 0) < 0.7: factors.append("limited booth comparability")
    if row["features"].get("turnout_change", 0) >= 0.02: factors.append("turnout increase")
    if not factors: factors.append("historical booth vote pattern")
    return {"constituency_id": row.get("id"), "code": row["code"], "name": row["name"], "district": row["district"], "region": row["region"], "stat_predicted_party": predicted, "stat_probabilities": {party: round(probabilities[party], 6) for party in PARTIES}, "stat_confidence": round(ordered[0][1] * 100, 2), "stat_key_factors": factors, "stat_model_version": model_version, "historical_winner_2022": row["summary_2022"]["winner"], "historical_margin_2022": row["summary_2022"]["margin"], "features": row["features"], "feature_importance": importance or {}}


def _fallback_result(rows: list[dict[str, Any]], reason: str) -> StatisticalResult:
    outputs = []
    for row in rows:
        probabilities = {party: max(0.0001, float(row["features"].get(f"{party.lower()}_share_2022", 0))) for party in PARTIES}
        total = sum(probabilities.values()) or 1
        outputs.append(_prediction_payload(row, {party: value / total for party, value in probabilities.items()}, "historical-fallback"))
    return StatisticalResult(outputs, {"status": "fallback", "reason": reason, "sample_size": len(rows)}, {}, "historical-fallback")
