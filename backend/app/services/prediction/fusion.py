"""Quality-gated probability fusion for statistical and atmosphere layers."""
from __future__ import annotations

import math
from typing import Any

from app.services.prediction_engine import PARTIES


def confidence_label(value: float) -> str:
    if value >= 75: return "High"
    if value >= 55: return "Moderate"
    if value >= 40: return "Lean"
    return "Toss-up"


def weights(stat_probabilities: dict[str, float], atmo: dict[str, Any] | None, disruption: bool = False) -> tuple[float, float]:
    if not atmo or atmo.get("quality", 0) <= 0 or atmo.get("sources_count", 0) <= 0:
        return 1.0, 0.0
    ordered = sorted(stat_probabilities.values(), reverse=True)
    close = len(ordered) > 1 and ordered[0] - ordered[1] < 0.03
    stat_weight = 0.55 if close else 0.65
    if atmo.get("quality", 0) < 0.35: stat_weight = 0.80
    if disruption: stat_weight = 0.40
    atmo_weight = (1 - stat_weight) * float(atmo.get("quality", 0))
    total = stat_weight + atmo_weight
    return stat_weight / total, atmo_weight / total


def fuse(stat: dict[str, Any], atmo: dict[str, Any] | None) -> dict[str, Any]:
    stat_probabilities = stat["stat_probabilities"]
    stat_weight, atmo_weight = weights(stat_probabilities, atmo)
    if atmo and atmo_weight:
        # Log-opinion-pool fusion is stable for probabilities close to zero.
        fused = {party: math.exp(stat_weight * math.log(max(stat_probabilities.get(party, 0), 1e-8)) + atmo_weight * math.log(max(atmo["probabilities"].get(party, 0), 1e-8))) for party in PARTIES}
    else:
        fused = {party: float(stat_probabilities.get(party, 0)) for party in PARTIES}
    total = sum(fused.values()) or 1
    fused = {party: fused[party] / total for party in PARTIES}
    predicted = max(PARTIES, key=fused.get)
    ordered = sorted(fused.values(), reverse=True)
    agreement = 1 if not atmo or atmo.get("predicted_party") == stat["stat_predicted_party"] else 0
    confidence = max(ordered[0] * 100 * (0.9 + 0.1 * agreement), 0)
    return {**stat, "atmo_predicted_party": atmo.get("predicted_party") if atmo else None, "atmo_confidence": atmo.get("confidence", 0) if atmo else 0, "atmo_probabilities": atmo.get("probabilities") if atmo else None, "atmo_issues": atmo.get("issues", []) if atmo else [], "atmo_events": atmo.get("events", []) if atmo else [], "atmo_sources_count": atmo.get("sources_count", 0) if atmo else 0, "atmo_quality": atmo.get("quality", 0) if atmo else 0, "final_predicted_party": predicted, "final_probabilities": {party: round(value, 6) for party, value in fused.items()}, "final_confidence": round(confidence, 2), "final_confidence_label": confidence_label(confidence), "stat_weight_used": round(stat_weight, 4), "atmo_weight_used": round(atmo_weight, 4), "is_flip": predicted != stat["historical_winner_2022"], "flip_from": stat["historical_winner_2022"] if predicted != stat["historical_winner_2022"] else None, "explanation": {"statistical_factors": stat.get("stat_key_factors", []), "atmosphere_issues": atmo.get("issues", []) if atmo else [], "layer_agreement": bool(agreement), "quality_flags": ["atmosphere_unavailable"] if not atmo else []}}
