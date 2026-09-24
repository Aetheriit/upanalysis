"""Separate, review-only vote-support estimates; never reuse win probabilities.

2017 features -> 2022 ECI targets, nested district-held-out selection. The
targets are six *party-class* vote shares, the actual top-two candidate margin
rate, and log growth in valid candidate votes. Only one transition exists.
Historical residual bands are diagnostics, not calibrated 2027 intervals.
"""
import math

from app.services.prediction.parties import PARTIES
from app.services.prediction.statistical import vectorize, feature_keys

VERSION = 'vote-support-v2-coherent-margin-nested-hindcast'
HEADS = {'shares': slice(0, 6), 'margin_rate': slice(6, 7), 'vote_growth': slice(7, 8)}
BLENDS = ((1, 0, 0), (0, 1, 0), (0, 0, 1), (0, .5, .5),
          (.5, .5, 0), (.5, 0, .5), (.25, .5, .25), (.25, .25, .5))


def design(rows, period):
    import numpy as np
    # Drop the IPT reference share and its indicator for the linear baseline.
    width = len(feature_keys(period))
    values = np.array([vectorize(row, str(period)) for row in rows], dtype=float)
    values = np.delete(values, [5, width + 5], axis=1)
    totals = np.array([row[f'summary_{period}']['total'] for row in rows], dtype=float)
    if not np.isfinite(totals).all() or (totals <= 0).any():
        raise ValueError('Positive official prior-election vote totals required')
    return np.column_stack((values, np.log(totals)))


def historical_targets(rows):
    import numpy as np
    targets = []
    for row in rows:
        old, current = row['summary_2017'], row['summary_2022']
        targets.append([current['shares'][party] for party in PARTIES] +
                       [current['margin'] / current['total'], math.log(current['total'] / old['total'])])
    values = np.array(targets, dtype=float)
    if not np.isfinite(values).all() or (values[:, :7] < 0).any() or (values[:, :7] > 1).any():
        raise ValueError('Invalid official vote-support targets')
    if not np.allclose(values[:, :6].sum(axis=1), 1, atol=1e-8):
        raise ValueError('Party shares must sum to one')
    return values


def persistence(rows, period):
    import numpy as np
    return np.array([[row[f'summary_{period}']['shares'][p] for p in PARTIES] +
                     [row[f'summary_{period}']['margin'] / row[f'summary_{period}']['total'], 0]
                     for row in rows], dtype=float)


def constrain(values):
    import numpy as np
    result = np.array(values, dtype=float, copy=True)
    if result.ndim != 2 or result.shape[1] != 8 or not np.isfinite(result).all():
        raise ValueError('Invalid vote-support output')
    shares = np.clip(result[:, :6], 0, 1)
    sums = shares.sum(axis=1, keepdims=True)
    if (sums <= 0).any():
        raise ValueError('No finite positive support')
    result[:, :6] = shares / sums
    result[:, 6] = np.clip(result[:, 6], 0, 1)
    # Numerical/engineering guard only, not a learned turnout constraint.
    result[:, 7] = np.clip(result[:, 7], math.log(.5), math.log(2))
    return result


def _fit(x, targets):
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import Ridge
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    fitted = []
    # Fit heads separately so scale differences cannot dominate tree splits.
    for indexes in HEADS.values():
        target = targets[:, indexes]
        if target.shape[1] == 1:
            target = target[:, 0]
        forest = RandomForestRegressor(n_estimators=120, max_depth=6, min_samples_leaf=5,
                                       random_state=202709, n_jobs=1)
        linear = make_pipeline(StandardScaler(), Ridge(alpha=10))
        fitted.append((forest.fit(x, target), linear.fit(x, target)))
    return fitted


def _raw(fitted, x, baseline):
    import numpy as np
    outputs = [baseline]
    for model_index in range(2):
        prediction = np.column_stack([pair[model_index].predict(x) for pair in fitted])
        outputs.append(constrain(prediction))
    return np.stack(outputs)


def _choose(raw, target):
    import numpy as np
    weights = {}
    for name, indexes in HEADS.items():
        def error(candidate):
            residual = np.tensordot(candidate, raw[:, :, indexes], axes=(0, 0)) - target[:, indexes]
            return float(np.square(residual).mean() if name == 'shares' else np.abs(residual).mean())
        weights[name] = min(BLENDS, key=error)
    return weights


def _blend(raw, weights):
    import numpy as np
    return constrain(np.column_stack([np.tensordot(weights[name], raw[:, :, indexes], axes=(0, 0))
                                     for name, indexes in HEADS.items()]))


def _metrics(predicted, targets, previous_totals):
    import numpy as np
    predicted_totals = previous_totals * np.exp(predicted[:, 7])
    actual_totals = previous_totals * np.exp(targets[:, 7])
    share_errors = np.abs(predicted[:, :6] - targets[:, :6]) * 100
    margin_errors = np.abs(predicted_totals * predicted[:, 6] - actual_totals * targets[:, 6])
    sorted_shares = np.sort(predicted[:, :6], axis=1)
    implied_margins = (sorted_shares[:, -1] - sorted_shares[:, -2]) * predicted_totals
    implied_errors = np.abs(implied_margins - actual_totals * targets[:, 6])
    return {'share_mae_pp': float(share_errors.mean()),
            'share_rmse_pp': float(np.sqrt(np.square(share_errors).mean())),
            'per_party_mae_pp': {p: float(share_errors[:, i].mean()) for i, p in enumerate(PARTIES)},
            'margin_rate_mae_pp': float(np.abs(predicted[:, 6] - targets[:, 6]).mean() * 100),
            'margin_votes_mae': float(margin_errors.mean()),
            'share_implied_margin_votes_mae': float(implied_errors.mean()),
            'valid_votes_mae': float(np.abs(predicted_totals - actual_totals).mean()),
            'residual_p90': {
                'share_pp': {p: float(np.quantile(share_errors[:, i], .9, method='higher')) for i, p in enumerate(PARTIES)},
                'margin_votes': float(np.quantile(margin_errors, .9, method='higher')),
                'share_implied_margin_votes': float(np.quantile(implied_errors, .9, method='higher')),
                'valid_votes': float(np.quantile(np.abs(predicted_totals - actual_totals), .9, method='higher'))}}


def train_vote_support(rows):
    import numpy as np
    from sklearn.model_selection import GroupKFold
    if len(rows) < 30 or len({row['district'] for row in rows}) < 5:
        raise ValueError('Insufficient district groups for vote-support hindcast')
    x, y = design(rows, 2017), historical_targets(rows)
    baseline = persistence(rows, 2017)
    groups = np.array([row['district'] for row in rows])
    evaluated, raw = np.zeros_like(y), np.zeros((3, *y.shape))
    fold_audit = []
    for fit, held in GroupKFold(n_splits=5).split(x, y, groups):
        inner = np.zeros((3, len(fit), y.shape[1]))
        for train, test in GroupKFold(n_splits=3).split(x[fit], y[fit], groups[fit]):
            inner[:, test, :] = _raw(_fit(x[fit][train], y[fit][train]), x[fit][test], baseline[fit][test])
        selected = _choose(inner, y[fit])
        raw[:, held, :] = _raw(_fit(x[fit], y[fit]), x[held], baseline[held])
        evaluated[held] = _blend(raw[:, held, :], selected)
        fold_audit.append({'train_districts': sorted(set(groups[fit])), 'held_out_districts': sorted(set(groups[held])),
                           'held_out_codes': [str(rows[i]['code']) for i in held], 'weights': selected})
    previous_totals = np.array([row['summary_2017']['total'] for row in rows])
    metrics = _metrics(evaluated, y, previous_totals)
    benchmark = _metrics(baseline, y, previous_totals)
    gates = {'shares': metrics['share_mae_pp'] <= benchmark['share_mae_pp'],
             'margin': metrics['margin_votes_mae'] <= benchmark['margin_votes_mae'],
             'share_implied_margin': metrics['share_implied_margin_votes_mae'] <= benchmark['margin_votes_mae'],
             'valid_votes': metrics['valid_votes_mae'] <= benchmark['valid_votes_mae']}
    weights = _choose(raw, y)
    backtest = {'model_version': VERSION, 'status': 'review_nested_grouped_hindcast',
                'feature_year': 2017, 'target_year': 2022, 'sample_size': len(rows), 'folds': 5,
                'inner_folds': 3, 'group_key': 'district', **metrics, 'persistence_baseline': benchmark,
                'beats_or_matches_persistence': gates, 'weights': weights,
                'limitations': ['One historical transition; no independent future-cycle validation.',
                                'Historical residual bands are not calibrated 2027 prediction intervals.',
                                'IPT share pools minor parties and independents; not one candidate.',
                                'The separately estimated contest margin is not conditional on a named winner.',
                                'News, candidate nominations, alliance changes and demographics are not vote-support inputs.',
                                'Vote-growth factor bounded to 0.5–2 for numerical safety, not a validated forecast bound.']}
    bundle = {'version': VERSION, 'models': _fit(x, y), 'weights': weights, 'backtest': backtest,
              'fold_audit': fold_audit, 'hindcast_predictions': evaluated, 'hindcast_targets': y,
              'hindcast_codes': [str(row['code']) for row in rows],
              'target_order': [*PARTIES, 'top_two_margin_rate', 'log_valid_vote_growth'],
              'feature_policy': 'statistical_period_features_drop_ipt_reference_plus_log_prior_valid_votes'}
    return bundle


def predict_vote_support(bundle, rows):
    return _blend(_raw(bundle['models'], design(rows, 2022), persistence(rows, 2022)), bundle['weights'])


def public_estimate(values, previous_total, winning_party, atmo_weight, backtest):
    """Withhold headline margins when they cannot coherently describe the winner."""
    shares = {p: float(values[i]) * 100 for i, p in enumerate(PARTIES)}
    total = round(previous_total * math.exp(float(values[7])))
    contest_margin = round(float(values[6]) * total)
    leader = max(shares, key=shares.get)
    gates = backtest['beats_or_matches_persistence']
    runner = max((party for party in PARTIES if party != winning_party), key=shares.get)
    margin_status = ('withheld_failed_hindcast_gate' if not all(gates[key] for key in ('shares', 'share_implied_margin', 'valid_votes')) else
                     'withheld_ipt_candidate_unresolved' if winning_party == 'IPT' else
                     'withheld_support_winner_disagreement' if leader != winning_party else
                     'withheld_ipt_opponent_unresolved' if runner == 'IPT' else
                     'withheld_atmosphere_not_in_vote_model' if atmo_weight > 0 else
                     'review_share_implied_margin')
    share_status = 'review_party_class_estimate' if gates['shares'] else 'withheld_failed_hindcast_gate'
    residual = backtest['residual_p90']
    implied_margin = round((shares[leader] - max(value for party, value in shares.items() if party != leader)) / 100 * total)
    return {'model_version': VERSION, 'status': 'review', 'basis': 'candidate_votes_excluding_nota',
            'party_shares_pct': shares, 'share_leader': leader,
            'share_winner_disagreement': leader != winning_party,
            'predicted_valid_votes': total, 'contest_margin_votes': contest_margin,
            'share_implied_margin_votes': implied_margin,
            'contest_margin_pct_points': float(values[6]) * 100,
            'table_vote_share': shares[winning_party] if gates['shares'] else None,
            'table_margin': implied_margin if margin_status.startswith('review_') else None,
            'share_status': share_status, 'margin_status': margin_status,
            'historical_error_bands': {
                'basis': 'p90_absolute_nested_hindcast_error_not_future_coverage_guarantee',
                'party_shares_pct': {p: [max(0, shares[p] - residual['share_pp'][p]), min(100, shares[p] + residual['share_pp'][p])] for p in PARTIES},
                'contest_margin_votes': [max(0, round(contest_margin - residual['margin_votes'])), round(contest_margin + residual['margin_votes'])],
                'share_implied_margin_votes': [max(0, round(implied_margin - residual['share_implied_margin_votes'])), round(implied_margin + residual['share_implied_margin_votes'])],
                'valid_votes': [max(0, round(total - residual['valid_votes'])), round(total + residual['valid_votes'])]},
            'limitations': backtest['limitations']}
