"""Optional atmosphere/evidence adapter.

No web or LLM call is made when the API URL is empty. The adapter accepts a
JSON endpoint that returns either a list of constituency records or a mapping
keyed by constituency code. Raw source text is never sent to clients.
"""
from __future__ import annotations

import asyncio
import json
import os
from urllib.parse import quote
from urllib.request import Request, urlopen
from typing import Any

from app.services.prediction_engine import PARTIES, normalize_party


def _endpoint(template: str, row: dict[str, Any]) -> str:
    values = {"code": quote(str(row["code"])), "name": quote(str(row["name"])), "district": quote(str(row["district"]))}
    if any(token in template for token in ("{code}", "{name}", "{district}")):
        return template.format(**values)
    joiner = "&" if "?" in template else "?"
    return f"{template}{joiner}code={values['code']}&name={values['name']}&district={values['district']}"


def _fetch(url: str) -> Any:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "ElectionIntel-Prediction/1.0"})
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def _record(payload: Any, row: dict[str, Any]) -> dict[str, Any] | None:
    if isinstance(payload, dict):
        if "data" in payload: payload = payload["data"]
        elif "predictions" in payload: payload = payload["predictions"]
        elif str(row["code"]) in payload: payload = payload[str(row["code"])]
    if isinstance(payload, list):
        payload = next((item for item in payload if str(item.get("code", item.get("constituency_code", ""))) == str(row["code"])), payload[0] if payload else None)
    if not isinstance(payload, dict): return None
    raw_scores = payload.get("sentiment_scores", payload.get("scores", payload.get("probabilities", {}))) or {}
    scores = {party: float(raw_scores.get(party, 0) or 0) for party in PARTIES}
    if payload.get("probabilities"):
        total = sum(max(value, 0) for value in scores.values()) or 1
        probabilities = {party: max(scores[party], 0) / total for party in PARTIES}
    else:
        minimum = min(scores.values()) if scores else 0
        shifted = {party: scores[party] - minimum + 0.01 for party in PARTIES}
        total = sum(shifted.values()) or 1
        probabilities = {party: shifted[party] / total for party in PARTIES}
    predicted = normalize_party(payload.get("atmosphere_prediction", payload.get("predicted_party"))) if payload.get("atmosphere_prediction", payload.get("predicted_party")) else max(PARTIES, key=probabilities.get)
    sources_count = int(payload.get("sources_count", payload.get("source_count", len(payload.get("sources", [])) or 0)) or 0)
    quality = float(payload.get("data_quality_score", payload.get("quality", min(sources_count / 10, 1))) or 0)
    return {"predicted_party": predicted, "probabilities": probabilities, "confidence": float(payload.get("confidence", max(probabilities.values()))) * (100 if float(payload.get("confidence", 0)) <= 1 else 1), "issues": list(payload.get("dominant_issues", payload.get("issues", [])) or [])[:5], "events": list(payload.get("major_events", payload.get("events", [])) or [])[:5], "sources_count": sources_count, "quality": max(0, min(quality, 1))}


async def load_atmosphere(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    template = os.getenv("PREDICTION_ATMOSPHERE_API_URL", "").strip()
    if not template:
        return {}
    async def load(row: dict[str, Any]):
        try:
            payload = await asyncio.to_thread(_fetch, _endpoint(template, row))
            value = _record(payload, row)
            return str(row["code"]), value
        except Exception:
            return str(row["code"]), None
    results = await asyncio.gather(*(load(row) for row in rows))
    return {code: value for code, value in results if value}
