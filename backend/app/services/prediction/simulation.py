"""Reproducible hierarchical logistic-normal / categorical election draws.

Exactly 10,000 primary draws per product run, split over four independent
SeedSequence streams. Conditional expectations (Rao-Blackwellization) compare
static and fused models under the *same* shocks, without another winner draw.
"""
import hashlib
from app.services.prediction.parties import PARTIES

DEFAULT_DRAWS = 10_000
VERSION = 'hierarchical-mc-v3-10000'


def fit_shock_policy(bundle, rows):
    """Estimate cross-party correlation SHAPE, not future shock magnitudes.

    District-held-out categorical residuals support cross-sectional shape.
    One election transition cannot identify statewide inter-election variance.
    Ledoit-Wolf shrinkage keeps noisy covariance positive definite; log-score
    scales remain explicitly labelled engineering assumptions.
    """
    import numpy as np
    from sklearn.covariance import LedoitWolf
    residual = np.eye(len(PARTIES))[bundle['hindcast_targets']] - bundle['hindcast_probabilities']
    by_code = {str(row['code']): row for row in rows}
    districts = np.array([by_code[code]['district'] for code in bundle['hindcast_codes']])
    grouped = np.array([residual[districts == group].mean(axis=0) for group in sorted(set(districts))])
    estimator = LedoitWolf().fit(grouped)
    cov = estimator.covariance_
    sd = np.sqrt(np.maximum(np.diag(cov), 1e-12))
    correlation = cov / np.outer(sd, sd)
    np.fill_diagonal(correlation, 1)
    return {'version': 'shrunk-residual-shape-v1', 'party_correlation': correlation.tolist(),
            'shape_estimator': 'LedoitWolf_district_mean_held_out_categorical_residuals',
            'shrinkage': float(estimator.shrinkage_), 'district_samples': len(grouped),
            'historical_transition': '2017_to_2022', 'state_sd': .045, 'region_sd': .025, 'local_sd': .06,
            'correlation_shape_fitted': True, 'covariance_fitted': False,
            'scale_basis': 'engineering_priors_not_identifiable_from_one_transition'}


def _probabilities(rows, key):
    import numpy as np
    values = np.array([[row.get(key, row['final_probabilities'])[p] for p in PARTIES] for row in rows], dtype=float)
    if not np.isfinite(values).all() or (values < 0).any() or (values > 1).any() or not np.allclose(values.sum(axis=1), 1, atol=1e-6):
        raise ValueError('Every seat requires finite normalized probabilities')
    return values / values.sum(axis=1, keepdims=True)


def simulate(rows, draws=DEFAULT_DRAWS, seed=202709, shock_policy=None):
    import numpy as np
    from scipy.special import softmax
    if not isinstance(draws, int) or isinstance(draws, bool) or draws < 1000 or not rows:
        raise ValueError('At least 1,000 draws and one constituency are required')
    policy = shock_policy or {'version': 'engineering-prior-v1', 'state_sd': .045, 'region_sd': .025,
                             'local_sd': .06, 'covariance_fitted': False, 'correlation_shape_fitted': False}
    correlation = np.asarray(policy.get('party_correlation', np.eye(6)), dtype=float)
    if correlation.shape != (6, 6) or not np.isfinite(correlation).all() or not np.allclose(correlation, correlation.T) or not np.allclose(np.diag(correlation), 1):
        raise ValueError('Invalid party shock correlation')
    eig, vectors = np.linalg.eigh(correlation)
    if eig.min() < -1e-8:
        raise ValueError('Party shock correlation must be positive semidefinite')
    factor = vectors @ np.diag(np.sqrt(np.maximum(eig, 0)))
    scales = [policy[key] for key in ('state_sd', 'region_sd', 'local_sd')]
    if not all(np.isfinite(v) and 0 <= v <= 3 for v in scales):
        raise ValueError('Invalid shock scale')
    regions = sorted({row.get('region', 'Unknown') for row in rows})
    region_index = np.array([regions.index(row.get('region', 'Unknown')) for row in rows])
    with np.errstate(divide='ignore'):
        base = np.log(_probabilities(rows, 'final_probabilities'))
        static = np.log(_probabilities(rows, 'stat_probabilities'))
    totals, conditional_static, conditional_final = [], [], []
    hits = np.zeros((len(rows), 6), dtype=int)
    streams = np.random.SeedSequence(seed).spawn(4)
    replicas = []
    for chain, stream in enumerate(streams):
        rng = np.random.default_rng(stream)
        count = draws // 4 + int(chain < draws % 4)
        chain_totals = []
        for start in range(0, count, 250):
            size = min(250, count - start)
            state = (rng.normal(size=(size, 1, 6)) @ factor.T) * scales[0]
            regional = (rng.normal(size=(size, len(regions), 6)) @ factor.T)[:, region_index] * scales[1]
            local = (rng.normal(size=(size, len(rows), 6)) @ factor.T) * scales[2]
            shock = state + regional + local
            # Paired integration over the identical shocks. These are expected
            # seats, not a second set of stochastic election outcomes.
            conditional_static.append(softmax(static + shock, axis=2).sum(axis=1))
            conditional_final.append(softmax(base + shock, axis=2).sum(axis=1))
            winners = (base + shock + rng.gumbel(size=(size, len(rows), 6))).argmax(axis=2)
            counts = np.array([(winners == index).sum(axis=1) for index in range(6)]).T
            if not (counts.sum(axis=1) == len(rows)).all():
                raise ValueError('Simulation lost a constituency')
            chain_totals.append(counts)
            hits += np.array([(winners == index).sum(axis=0) for index in range(6)]).T
        values = np.concatenate(chain_totals)
        totals.append(values)
        replicas.append({'stream': chain, 'spawn_key': list(stream.spawn_key), 'draws': count,
                         'means': values.mean(axis=0).tolist(),
                         'low': np.quantile(values, .05, axis=0, method='inverted_cdf').tolist(),
                         'high': np.quantile(values, .95, axis=0, method='inverted_cdf').tolist()})
    prefix_diagnostics = []
    for limit in sorted({min(len(part) for part in totals), 500, 1000}):
        if limit > min(len(part) for part in totals):
            continue
        sample = np.concatenate([part[:limit] for part in totals])
        prefix_diagnostics.append({'draws': len(sample), 'means': sample.mean(axis=0).tolist(),
                                   'low': np.quantile(sample, .05, axis=0, method='inverted_cdf').tolist(),
                                   'high': np.quantile(sample, .95, axis=0, method='inverted_cdf').tolist()})
    totals = np.concatenate(totals)
    means = totals.mean(axis=0)
    se = totals.std(axis=0, ddof=1) / np.sqrt(draws)
    central = np.floor(means).astype(int)
    for index in np.argsort(-(means - central))[:len(rows) - int(central.sum())]:
        central[index] += 1
    parties = [{'party': p, 'predicted': int(central[i]), 'mean': float(means[i]),
                'mean_mc_se': float(se[i]),
                'low': int(np.quantile(totals[:, i], .05, method='inverted_cdf')),
                'high': int(np.quantile(totals[:, i], .95, method='inverted_cdf'))} for i, p in enumerate(PARTIES)]
    for i, row in enumerate(rows):
        probabilities = hits[i] / draws
        row['simulated_probabilities'] = dict(zip(PARTIES, probabilities.tolist()))
        row['seat_win_probability'] = float(probabilities[PARTIES.index(row['final_predicted_party'])])
        row['seat_probability_mc_se'] = float(np.sqrt(row['seat_win_probability'] * (1-row['seat_win_probability']) / draws))
    mean_spread = float(np.ptp([r['means'] for r in replicas], axis=0).max())
    quantile_spread = float(max(np.ptp([r[key] for r in replicas], axis=0).max() for key in ('low', 'high')))
    integrated_static, integrated_final = np.concatenate(conditional_static), np.concatenate(conditional_final)
    difference = integrated_final - integrated_static
    majority = len(rows) // 2 + 1
    frequency = {p: float((totals[:, i] >= majority).mean()) for i, p in enumerate(PARTIES)}
    digest = hashlib.sha256(totals.astype('<i2').tobytes()).hexdigest()
    return {'version': VERSION, 'draws': draws, 'seed': seed, 'rng': 'PCG64_SeedSequence_4_independent_streams',
            'parties': parties, 'majority_threshold': majority, 'seat_total_covariance': np.cov(totals, rowvar=False).tolist(),
            'shock_policy': policy, 'majority_frequency': frequency,
            'majority_mc_se': {p: float(np.sqrt(value * (1-value) / draws)) for p, value in frequency.items()},
            'max_mean_mc_se': float(se.max()), 'max_probability_mc_se_bound': .5 / np.sqrt(draws),
            'draw_digest_sha256': digest,
            'draw_histograms': {p: np.bincount(totals[:, i], minlength=len(rows)+1).tolist() for i, p in enumerate(PARTIES)},
            'evidence_sensitivity': {'method': 'paired_conditional_expectations_same_10000_shocks_no_extra_winner_draws',
                                    'parties': [{'party': p, 'static': float(integrated_static[:, i].mean()),
                                                 'combined': float(integrated_final[:, i].mean()),
                                                 'change': float(difference[:, i].mean()),
                                                 'change_mc_se': float(difference[:, i].std(ddof=1) / np.sqrt(draws))}
                                                for i, p in enumerate(PARTIES)]},
            'convergence': {'status': 'independent_stream_numerical_diagnostic', 'draws_used_once': draws,
                            'max_mean_seat_delta': mean_spread, 'max_quantile_seat_delta': quantile_spread,
                            'thresholds': {'replicate_mean_range_seats': 1.5, 'replicate_quantile_range_seats': 3},
                            'within_diagnostic_tolerances': mean_spread <= 1.5 and quantile_spread <= 3,
                            'replicates': replicas, 'increasing_draw_checks': prefix_diagnostics},
            'limitations': ['Cross-sectional residual correlation is not calibrated future-cycle covariance.',
                            'Shock magnitudes and news impact scale remain unvalidated engineering assumptions.',
                            'Monte Carlo standard errors measure numerical precision, not electoral forecast error.',
                            'Zero observed majority outcomes do not prove zero probability.']}


def simulate_validated(rows, draws=DEFAULT_DRAWS, seed=202709, shock_policy=None):
    return simulate(rows, draws, seed, shock_policy)
