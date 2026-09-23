"""End-to-end prediction orchestration and immutable in-process cache."""
from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prediction import Prediction, PredictionRun
from app.services.prediction.atmosphere import load_atmosphere
from app.services.prediction.feature_engine import build_constituency_features
from app.services.prediction.fusion import fuse
from app.services.prediction.simulation import simulate
from app.services.prediction.statistical import train_and_predict


_CACHE: dict[str, Any] = {}
_CACHE_TTL_SECONDS = int(os.getenv("PREDICTION_CACHE_TTL_SECONDS", "900"))


def _public_row(row: dict[str, Any], audit: dict[str, Any] | None = None) -> dict[str, Any]:
    probabilities = row["final_probabilities"]
    ordered = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
    total_votes = max(int(row.get("historical_total_votes_2022", 0)), 1)
    predicted_margin = round((ordered[0][1] - (ordered[1][1] if len(ordered) > 1 else 0)) * total_votes)
    predicted_share = ordered[0][1] * 100
    return {
        "code": row["code"], "name": row["name"], "district": row["district"], "region": row["region"],
        "predicted_party": row["final_predicted_party"], "winning_margin": predicted_margin, "predicted_margin": predicted_margin,
        "vote_share": round(predicted_share, 2), "predicted_vote_share": round(predicted_share, 2),
        "change": "No Change" if not row["is_flip"] else f"{row['flip_from']} to {row['final_predicted_party']}",
        "is_flip": row["is_flip"], "historical_winner_2022": row["historical_winner_2022"],
        "confidence": row["final_confidence"], "confidence_label": row["final_confidence_label"],
        "statistical": {"predicted_party": row["stat_predicted_party"], "probabilities": row["stat_probabilities"], "confidence": row["stat_confidence"], "key_factors": row["stat_key_factors"], "model": row["stat_model_version"]},
        "atmosphere": {"predicted_party": row["atmo_predicted_party"], "probabilities": row["atmo_probabilities"], "confidence": row["atmo_confidence"], "issues": row["atmo_issues"], "events": row["atmo_events"], "sources_count": row["atmo_sources_count"], "quality": row["atmo_quality"]},
        "final": {"predicted_party": row["final_predicted_party"], "probabilities": row["final_probabilities"], "confidence": row["final_confidence"], "weights": {"statistical": row["stat_weight_used"], "atmosphere": row["atmo_weight_used"]}, "is_flip": row["is_flip"]},
        "uncertainty": {"seat_win_probability": row.get("seat_win_probability", 0), "quality_flags": row["explanation"].get("quality_flags", [])},
        "explanation": row["explanation"], "booth_audit": audit or {}, "features": row.get("features", {}),
    }


async def _persist(db: AsyncSession, result: dict[str, Any]) -> None:
    run = PredictionRun(id=uuid.UUID(result["run_id"]), target_year=2027, status="published", model_version=result["model_version"], feature_schema_version=result["feature_schema_version"], manifest=result["manifest"], backtest=result["backtest"])
    db.add(run)
    await db.flush()
    for row in result["raw_rows"]:
        if not row.get("constituency_id"):
            continue
        db.add(Prediction(run_id=run.id, constituency_id=row["constituency_id"], target_year=2027, stat_predicted_party=row["stat_predicted_party"], stat_confidence=row["stat_confidence"], stat_probabilities=row["stat_probabilities"], stat_key_factors=row["stat_key_factors"], atmo_predicted_party=row["atmo_predicted_party"], atmo_confidence=row["atmo_confidence"], atmo_sentiment_scores=row["atmo_probabilities"], atmo_dominant_issues=row["atmo_issues"], atmo_major_events=row["atmo_events"], atmo_sources_count=row["atmo_sources_count"], final_predicted_party=row["final_predicted_party"], final_confidence=row["final_confidence"], final_probabilities=row["final_probabilities"], final_confidence_label=row["final_confidence_label"], stat_weight_used=row["stat_weight_used"], atmo_weight_used=row["atmo_weight_used"], is_flip=row["is_flip"], flip_from=row["flip_from"], explanation=row["explanation"]))


async def run_pipeline(db: AsyncSession, force: bool = False) -> dict[str, Any]:
    now = time.time()
    if not force and _CACHE.get("result") and now - _CACHE.get("created", 0) < _CACHE_TTL_SECONDS:
        return _CACHE["result"]
    snapshot = await build_constituency_features(db)
    statistical = train_and_predict(snapshot["rows"])
    atmosphere = await load_atmosphere(statistical.predictions)
    fused_rows = [fuse(row, atmosphere.get(str(row["code"]))) for row in statistical.predictions]
    simulation = simulate(fused_rows, draws=int(os.getenv("PREDICTION_MC_DRAWS", "2000")), seed=202709)
    audits = {str(audit["code"]): audit for audit in snapshot["audits"]}
    for row in fused_rows:
        source = next((item for item in snapshot["rows"] if str(item["code"]) == str(row["code"])), {})
        row["historical_total_votes_2022"] = source.get("summary_2022", {}).get("total", 0)
    public_rows = [_public_row(row, audits.get(str(row["code"]))) for row in fused_rows]
    digest = hashlib.sha256(json.dumps({"rows": len(public_rows), "features": snapshot["feature_names"], "model": statistical.model_version}, sort_keys=True).encode()).hexdigest()[:16]
    run_id = str(uuid.uuid4())
    result = {"run_id": run_id, "forecast_year": 2027, "created_at": datetime.now(timezone.utc).isoformat(), "model_version": statistical.model_version, "feature_schema_version": snapshot["schema_version"], "manifest": {"run_id": run_id, "data_snapshot_ids": ["2017", "2022"], "feature_schema_version": snapshot["schema_version"], "model_artifact_hashes": {"ensemble": digest}, "party_mapping_version": "party-map-v1", "rng_seed": simulation["seed"]}, "backtest": statistical.backtest, "feature_audit": {"constituencies": len(snapshot["rows"]), "booths": sum(audit["current"] for audit in snapshot["audits"]), "matched_booths": sum(audit["matched"] for audit in snapshot["audits"]), "match_rate": sum(audit["matched"] for audit in snapshot["audits"]) / max(sum(audit["current"] for audit in snapshot["audits"]), 1), "schema_version": snapshot["schema_version"]}, "simulation": simulation, "summary": {"parties": simulation["parties"], "total_seats": len(public_rows), "majority": simulation["majority_threshold"], "majority_frequency": simulation["majority_frequency"], "total_flips": sum(row["is_flip"] for row in public_rows), "battlegrounds": sum(row["confidence"] < 55 for row in public_rows), "model": statistical.model_version, "backtest_accuracy": statistical.backtest.get("accuracy"), "quality": "atmosphere-enabled" if atmosphere else "statistical-only"}, "predictions": public_rows, "raw_rows": fused_rows}
    try:
        await _persist(db, result)
    except Exception:
        await db.rollback()
    result.pop("raw_rows", None)
    _CACHE.update({"created": now, "result": result})
    return result
