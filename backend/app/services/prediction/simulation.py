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
            'seat_total_covariance': np.cov(totals, rowvar=False).tolist(),
            'shock_policy': {'version': 'engineering-prior-v1', 'state_sd': .045, 'region_sd': .025, 'local_sd': .06, 'covariance_fitted': False},
            "majority_frequency": {p: float((totals[:, i] >= majority).mean()) for i, p in enumerate(PARTIES)},
            "convergence": {"status": "split_half_diagnostic_only", "max_mean_seat_delta": delta},
            "limitations": ["Shock variances are engineering priors, not fitted residual covariance.",
                            "Independent-seed quantile convergence and covariance validation remain release requirements."]}


def simulate_validated(rows, draws=20000, seed=202709):
    """Independent-seed numerical check, not validation of shock assumptions."""
    baseline = simulate(rows, draws, seed)
    check = simulate([dict(row) for row in rows], draws, seed + 1)
    mean_delta = max(abs(a['mean'] - b['mean']) for a, b in zip(baseline['parties'], check['parties']))
    interval_delta = max(abs(a[key] - b[key]) for a, b in zip(baseline['parties'], check['parties']) for key in ('low', 'high'))
    majority_delta = max(abs(baseline['majority_frequency'][p] - check['majority_frequency'][p]) for p in PARTIES)
    baseline['convergence'].update(independent_seed=seed + 1, independent_draws=draws,
                                   max_independent_mean_delta=mean_delta, max_independent_quantile_delta=interval_delta,
                                   max_independent_majority_frequency_delta=majority_delta,
                                   numerical_check='pass' if mean_delta <= .5 and interval_delta <= 2 and majority_delta <= .02 else 'warn',
                                   thresholds={'mean_seats': .5, 'quantile_seats': 2, 'majority_frequency': .02})
    baseline['convergence']['status'] = 'independent_seed_numerical_diagnostic'
    baseline['limitations'] = ['Shock variances are engineering priors, not fitted residual covariance.',
                               'Numerical convergence does not validate interval coverage or forecast accuracy.']
    return baseline
