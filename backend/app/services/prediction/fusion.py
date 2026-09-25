"""Prior-anchored log pooling; news is a likelihood tilt, not a new poll.

P_atmo = normalize(P_stat * exp(z)); log-pooling then gives
P_final = softmax(log(P_stat) + lambda*z). Neutral evidence is an identity.
Impact scale and quality ceiling are review policies, not learned causal effects.
"""
from __future__ import annotations

import math
from typing import Any

from app.services.prediction.parties import PARTIES

VERSION = 'prior-anchored-log-pool-v3'


def confidence_label(value: float) -> str:
    if value >= 75: return "High"
    if value >= 55: return "Moderate"
    if value >= 40: return "Lean"
    return "Toss-up"


def _signal(atmo):
    if not atmo:
        return None
    # Old scored checkpoints store softmax(z). This is relative evidence,
    # not an independent opinion poll with a uniform prior.
    if atmo.get('log_evidence') is not None:
        scores = [float(atmo['log_evidence'].get(p, 0)) for p in PARTIES]
    elif atmo.get('probabilities'):
        values = [float(atmo['probabilities'].get(p, 0)) for p in PARTIES]
        if any(not math.isfinite(v) or v <= 0 or v > 1 for v in values):
            return None
        scores = [math.log(v) for v in values]
    else:
        return None
    if not all(math.isfinite(v) for v in scores) or max(scores) - min(scores) < 1e-12:
        return None
    # Bound the maximum log-evidence spread to six before quality weighting.
    midpoint = (max(scores) + min(scores)) / 2
    span = max(1, (max(scores) - min(scores)) / 6)
    return {p: (v - midpoint) / span for p, v in zip(PARTIES, scores)}


def weights(stat_probabilities: dict[str, float], atmo: dict[str, Any] | None, disruption: bool = False) -> tuple[float, float]:
    if not atmo or atmo.get('sources_count', 0) <= 0 or _signal(atmo) is None:
        return 1.0, 0.0
    quality = float(atmo.get("quality", 0))
    if not math.isfinite(quality) or quality <= 0:
        return 1.0, 0.0
    atmo_weight = 0.35 * max(0, min(quality, 1))
    return 1 - atmo_weight, atmo_weight


def _tilt(prior, signal, weight):
    scores = {p: weight * signal[p] for p in PARTIES}
    high = max(scores.values())
    values = {p: prior[p] * math.exp(scores[p] - high) for p in PARTIES}
    total = sum(values.values())
    return {p: v / total for p, v in values.items()}


def fuse(stat: dict[str, Any], atmo: dict[str, Any] | None) -> dict[str, Any]:
    prior = {p: float(stat['stat_probabilities'].get(p, 0)) for p in PARTIES}
    if any(not math.isfinite(v) or v < 0 or v > 1 for v in prior.values()) or abs(sum(prior.values()) - 1) > 1e-5:
        raise ValueError('Invalid statistical probability vector')
    stat_weight, atmo_weight = weights(prior, atmo)
    signal = _signal(atmo) if atmo_weight else None
    anchored = _tilt(prior, signal, 1) if signal else None
    fused = _tilt(prior, signal, atmo_weight) if signal else prior.copy()
    predicted = max(PARTIES, key=fused.get)
    atmo_leader = max(anchored, key=anchored.get) if anchored else None
    delta = {p: 100 * (fused[p] - prior[p]) for p in PARTIES}
    confidence = fused[predicted] * 100
    return {**stat, 'atmo_predicted_party': atmo_leader,
            'atmo_confidence': 100 * anchored[atmo_leader] if anchored else 0,
            'atmo_probabilities': anchored, 'atmo_issues': atmo.get('issues', []) if atmo else [],
            'atmo_events': atmo.get('events', []) if atmo else [],
            'atmo_sources_count': atmo.get('sources_count', 0) if atmo else 0,
            'atmo_quality': atmo.get('quality', 0) if atmo else 0,
            'final_predicted_party': predicted, 'final_probabilities': fused,
            'final_confidence': round(confidence, 2), 'final_confidence_label': confidence_label(confidence),
            'stat_weight_used': stat_weight, 'atmo_weight_used': atmo_weight,
            'is_flip': predicted != stat['historical_winner_2022'],
            'flip_from': stat['historical_winner_2022'] if predicted != stat['historical_winner_2022'] else None,
            'explanation': {'statistical_factors': stat.get('stat_key_factors', []),
                            'atmosphere_issues': atmo.get('issues', []) if atmo else [],
                            'layer_agreement': not atmo_weight or atmo_leader == stat['stat_predicted_party'],
                            'fusion_version': VERSION, 'probability_change_pp': delta,
                            'quality_flags': [] if atmo_weight else ['no_eligible_directional_evidence']}}


def fusion_audit(rows):
    return {'version': VERSION, 'scored_seats': sum(row['atmo_weight_used'] > 0 for row in rows),
            'changed_probability_seats': sum(max(abs(v) for v in row['explanation']['probability_change_pp'].values()) > 1e-8 for row in rows),
            'changed_leaders': sum(row['final_predicted_party'] != row['stat_predicted_party'] for row in rows),
            'max_probability_change_pp': max(max(abs(v) for v in row['explanation']['probability_change_pp'].values()) for row in rows),
            'expected_seats_before_shocks': [
                {'party': p, 'static': sum(row['stat_probabilities'][p] for row in rows),
                 'combined': sum(row['final_probabilities'][p] for row in rows),
                 'change': sum(row['final_probabilities'][p] - row['stat_probabilities'][p] for row in rows)} for p in PARTIES],
            'limitation': 'Source-linked interpretations are not polling or historically calibrated electoral effects.'}
