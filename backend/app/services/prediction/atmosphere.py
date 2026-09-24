"""Optional source-checked extraction API; fail closed to statistical-only.

Provider contract: docs/prediction-evidence.md. Uncited probabilities are never
accepted. Search headlines alone do not establish party impact.
"""
import asyncio
import json
import math
import os
from datetime import datetime, timezone
from urllib.request import Request, urlopen

from app.services.prediction.evidence import get_seat_evidence, safe_url, timestamp
from app.services.prediction.parties import PARTIES


def score_events(payload, evidence, now=None):
    now = now or datetime.now(timezone.utc)
    if not isinstance(payload, dict) or str(payload.get("code")) != str(evidence["code"]):
        raise ValueError("Constituency code mismatch")
    items = {item["id"]: item for item in evidence["items"]}
    scores = dict.fromkeys(PARTIES, 0.0)
    used_clusters, publishers, events, qualities = set(), set(), [], []
    for event in payload.get("events", [])[:30]:
        if event.get("verification_status") != "source_checked" or event.get("geo_scope") not in {"constituency", "district"}:
            continue
        refs = event.get("citation_ids", [])
        sources = [items[ref] for ref in refs if ref in items]
        if not sources or len(sources) != len(refs):
            continue
        if not safe_url(event.get("checked_source_url", "")) or not event.get("source_checked_at"):
            continue
        checked = timestamp(event["source_checked_at"])
        if not checked or checked > now:
            continue
        clusters = {source["cluster_id"] for source in sources}
        if clusters & used_clusters:
            continue
        confidence = event.get("extraction_confidence", 0)
        importance = event.get("event_importance", 0)
        if any(not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1 for v in (confidence, importance)):
            continue
        ages = [(now - timestamp(source["published_at"])).total_seconds() / 86400 for source in sources]
        if min(ages) < 0 or min(ages) > 90:
            continue
        recency = math.exp(-min(ages) / 30)
        geo = 1.0 if event["geo_scope"] == "constituency" else 0.35
        weight = 0.6 * recency * geo * confidence * importance
        accepted = {}
        for party, impact in event.get("party_impacts", {}).items():
            if party not in PARTIES or not isinstance(impact, dict):
                continue
            value, rationale = impact.get("direction"), impact.get("rationale", "")
            if isinstance(value, (int, float)) and math.isfinite(value) and -1 <= value <= 1 and isinstance(rationale, str) and 20 <= len(rationale) <= 800:
                accepted[party] = {"direction": value, "rationale": rationale}
        if not accepted:
            continue
        for party, impact in accepted.items():
            scores[party] += weight * impact["direction"]
        used_clusters.update(clusters)
        publishers.update(source.get("publisher_url") or source["publisher"] for source in sources)
        qualities.append(recency * geo * confidence)
        events.append({"summary": str(event.get("summary", ""))[:600], "citation_ids": refs,
                       "geo_scope": event["geo_scope"], "party_impacts": accepted,
                       "interpretation": "provider_interpretation_pending_release_review", "weight": weight})
    # Publisher domains do not prove independence; use a conservative cap.
    quality = min(len(used_clusters) / 5, 1) * min(len(publishers) / 3, 1) * (sum(qualities) / len(qualities) if qualities else 0) * 0.5
    if not events:
        return None
    exp = {party: math.exp(value - max(scores.values())) for party, value in scores.items()}
    probabilities = {party: value / sum(exp.values()) for party, value in exp.items()}
    leading = max(probabilities, key=probabilities.get)
    return {"predicted_party": leading, "probabilities": probabilities, "confidence": 100 * probabilities[leading],
            "quality": quality, "sources_count": len(used_clusters), "events": events, "issues": [],
            "snapshot_id": evidence["snapshot_id"], "scoring_status": "scored",
            "quality_components": {"unique_clusters": len(used_clusters), "publisher_domains": len(publishers),
                                   "independence": "unverified_conservative_cap", "policy_version": "atmo-v2"}}


def _request(endpoint, row, evidence):
    headers = {"Content-Type": "application/json"}
    key = os.getenv("PREDICTION_ATMOSPHERE_API_KEY", "")
    if key:
        headers["Authorization"] = f"Bearer {key}"
    body = json.dumps({"code": str(row["code"]), "name": row["name"], "district": row["district"],
                       "evidence_snapshot_id": evidence["snapshot_id"], "cutoff": evidence["cutoff"],
                       "items": evidence["items"][:60]}).encode()
    request = Request(endpoint, data=body, headers=headers, method="POST")
    with urlopen(request, timeout=25) as response:
        content = response.read(1_000_001)
    if len(content) > 1_000_000:
        raise ValueError("Oversized extraction response")
    return json.loads(content)


async def load_atmosphere(rows, snapshot_id=None):
    endpoint = os.getenv("PREDICTION_ATMOSPHERE_API_URL", "").strip()
    if not endpoint:
        return {}
    if not safe_url(endpoint):
        raise ValueError("Atmosphere API must be an administrator-configured HTTPS URL")
    semaphore = asyncio.Semaphore(3)

    async def one(row):
        evidence = await asyncio.to_thread(get_seat_evidence, str(row["code"]), snapshot_id)
        if not evidence["items"]:
            return str(row["code"]), None
        async with semaphore:
            try:
                payload = await asyncio.to_thread(_request, endpoint, row, evidence)
                return str(row["code"]), score_events(payload, evidence)
            except Exception:
                return str(row["code"]), {"quality": 0, "sources_count": 0, "scoring_status": "provider_failed_or_invalid"}

    return {code: result for code, result in await asyncio.gather(*(one(row) for row in rows)) if result}
