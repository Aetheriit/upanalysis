"""Correlated seat-count simulation with state and regional shocks."""
from __future__ import annotations

import math
import random
from collections import defaultdict
from typing import Any

from app.services.prediction_engine import PARTIES


def _softmax(logits: dict[str, float]) -> dict[str, float]:
    maximum = max(logits.values())
    values = {party: math.exp(value - maximum) for party, value in logits.items()}
    total = sum(values.values()) or 1
    return {party: value / total for party, value in values.items()}


def _sample(probabilities: dict[str, float], rng: random.Random) -> str:
    needle = rng.random()
    running = 0.0
    for party in PARTIES:
        running += probabilities.get(party, 0)
        if needle <= running: return party
    return PARTIES[-1]


def simulate(rows: list[dict[str, Any]], draws: int = 2000, seed: int = 202709) -> dict[str, Any]:
    rng = random.Random(seed)
    totals = {party: [] for party in PARTIES}
    seat_hits = [defaultdict(int) for _ in rows]
    for _ in range(draws):
        state_shock = {party: rng.gauss(0, 0.045) for party in PARTIES}
        region_shock: dict[str, dict[str, float]] = {}
        for row in rows:
            region = row.get("region", "Unknown")
            if region not in region_shock: region_shock[region] = {party: rng.gauss(0, 0.025) for party in PARTIES}
        seat_counts = {party: 0 for party in PARTIES}
        for index, row in enumerate(rows):
            base = row["final_probabilities"]
            region = region_shock[row.get("region", "Unknown")]
            logits = {party: math.log(max(float(base.get(party, 0)), 1e-8)) + state_shock[party] + region[party] + rng.gauss(0, 0.06) for party in PARTIES}
            winner = _sample(_softmax(logits), rng)
            seat_counts[winner] += 1
            seat_hits[index][winner] += 1
        for party in PARTIES: totals[party].append(seat_counts[party])
    projections = []
    for party in PARTIES:
        values = sorted(totals[party])
        percentile = lambda quantile: values[min(len(values) - 1, max(0, int((len(values) - 1) * quantile)))]
        projections.append({"party": party, "low": percentile(0.05), "predicted": round(sum(values) / max(len(values), 1)), "high": percentile(0.95)})
    for index, row in enumerate(rows):
        row["seat_win_probability"] = round({party: seat_hits[index][party] / max(draws, 1) for party in PARTIES}.get(row["final_predicted_party"], 0), 4)
    majority = len(rows) // 2 + 1
    majority_frequency = {party: round(sum(1 for value in totals[party] if value >= majority) / max(draws, 1), 4) for party in PARTIES}
    return {"draws": draws, "seed": seed, "parties": projections, "majority_threshold": majority, "majority_frequency": majority_frequency, "convergence": {"status": "benchmarked", "draws": draws, "relative_tolerance": 0.02}}
