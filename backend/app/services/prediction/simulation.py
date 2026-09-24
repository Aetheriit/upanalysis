"""Batched correlated seat draws; shock priors explicitly unvalidated."""
from app.services.prediction.parties import PARTIES


def simulate(rows, draws=20000, seed=202709):
    import numpy as np
    if draws < 20000 or not rows:
        raise ValueError("At least 20,000 draws and one constituency are required")
    rng = np.random.default_rng(seed)
    regions = sorted({row.get("region", "Unknown") for row in rows})
    region_index = np.array([regions.index(row.get("region", "Unknown")) for row in rows])
    base = np.log(np.clip([[row["final_probabilities"][p] for p in PARTIES] for row in rows], 1e-8, 1))
    totals, hits = [], np.zeros((len(rows), 6))
    for start in range(0, draws, 250):
        size = min(250, draws - start)
        state = rng.normal(0, 0.045, (size, 1, 6))
        regional = rng.normal(0, 0.025, (size, len(regions), 6))[:, region_index]
        local = rng.normal(0, 0.06, (size, len(rows), 6))
        winners = (base + state + regional + local + rng.gumbel(size=(size, len(rows), 6))).argmax(axis=2)
        counts = np.array([(winners == index).sum(axis=1) for index in range(6)]).T
        assert (counts.sum(axis=1) == len(rows)).all()
        totals.append(counts)
        hits += np.array([(winners == index).sum(axis=0) for index in range(6)]).T
    totals = np.concatenate(totals)
    means = totals.mean(axis=0)
    central = np.floor(means).astype(int)
    for index in np.argsort(-(means - central))[:len(rows) - int(central.sum())]:
        central[index] += 1
    parties = [{"party": p, "predicted": int(central[i]), "mean": float(means[i]),
                "low": int(np.quantile(totals[:, i], .05)), "high": int(np.quantile(totals[:, i], .95))} for i, p in enumerate(PARTIES)]
    for i, row in enumerate(rows):
        row["seat_win_probability"] = float(hits[i, PARTIES.index(row["final_predicted_party"])] / draws)
    split = draws // 2
    delta = float(np.abs(totals[:split].mean(axis=0) - totals[split:].mean(axis=0)).max())
    majority = len(rows) // 2 + 1
    return {"draws": draws, "seed": seed, "parties": parties, "majority_threshold": majority,
            "majority_frequency": {p: float((totals[:, i] >= majority).mean()) for i, p in enumerate(PARTIES)},
            "convergence": {"status": "split_half_diagnostic_only", "max_mean_seat_delta": delta},
            "limitations": ["Shock variances are engineering priors, not fitted residual covariance.",
                            "Independent-seed quantile convergence and covariance validation remain release requirements."]}
