"""Offline computation and durable, read-only serving of review snapshots."""
import asyncio
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.prediction import Prediction, PredictionRun
from app.services.prediction.atmosphere import load_atmosphere
from app.services.prediction.evidence import artifact_dir, scan_info
from app.services.prediction.feature_engine import build_constituency_features
from app.services.prediction.fusion import fuse
from app.services.prediction.parties import PARTY_MAPPING_VERSION
from app.services.prediction.simulation import simulate
from app.services.prediction.statistical import train_and_predict


def save_artifact(name, value):
    directory = artifact_dir()
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / name
    temp = destination.with_suffix(f".{uuid.uuid4().hex}.tmp")
    temp.write_text(json.dumps(value, default=str, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    os.replace(temp, destination)


def _public_row(row, audit=None):
    probabilities = row["final_probabilities"]
    ordered = sorted(probabilities.values(), reverse=True)
    actual = row.get("historical_actual_winner_2022") or row["historical_winner_2022"]
    return {
        "code": row["code"], "name": row["name"], "district": row["district"], "region": row["region"],
        "predicted_party": row["final_predicted_party"], "winning_margin": None, "predicted_margin": None,
        "vote_share": None, "predicted_vote_share": None,
        "vote_estimate_status": "unavailable_separate_vote_share_model_required",
        "change": "No Change" if not row["is_flip"] else f"{actual} to {row['final_predicted_party']}",
        "is_flip": row["is_flip"], "historical_winner_2022": actual,
        "historical_winner_class_2022": row["historical_winner_2022"],
        "confidence": row["final_confidence"], "confidence_label": row["final_confidence_label"],
        "probability_gap": ordered[0] - ordered[1],
        "statistical": {"predicted_party": row["stat_predicted_party"], "probabilities": row["stat_probabilities"],
                        "confidence": row["stat_confidence"], "key_factors": row["stat_key_factors"], "model": row["stat_model_version"]},
        "atmosphere": {"predicted_party": row["atmo_predicted_party"], "probabilities": row["atmo_probabilities"],
                       "confidence": row["atmo_confidence"], "issues": row["atmo_issues"], "events": row["atmo_events"],
                       "sources_count": row["atmo_sources_count"], "quality": row["atmo_quality"],
                       "scoring_status": row.get("atmo_scoring_status", "not_scored")},
        "final": {"predicted_party": row["final_predicted_party"], "probabilities": probabilities,
                  "weights": {"statistical": row["stat_weight_used"], "atmosphere": row["atmo_weight_used"]}},
        "uncertainty": {"seat_win_probability": row.get("seat_win_probability"),
                        "quality_flags": row["explanation"].get("quality_flags", [])},
        "explanation": row["explanation"], "booth_audit": audit or {}, "features": row.get("features", {}),
        "missing_features": row.get("missing_features", []),
    }


async def _persist(db, result, rows):
    run = PredictionRun(id=uuid.UUID(result["run_id"]), target_year=2027, status="review",
                        model_version=result["model_version"], feature_schema_version=result["feature_schema_version"],
                        manifest=result["manifest"], backtest=result["backtest"])
    db.add(run)
    await db.flush()
    for row in rows:
        db.add(Prediction(run_id=run.id, constituency_id=uuid.UUID(str(row["constituency_id"])),
                         target_year=2027, stat_predicted_party=row["stat_predicted_party"],
                         stat_confidence=row["stat_confidence"], stat_probabilities=row["stat_probabilities"],
                         stat_key_factors=row["stat_key_factors"], atmo_predicted_party=row["atmo_predicted_party"],
                         atmo_confidence=row["atmo_confidence"], atmo_sentiment_scores=row["atmo_probabilities"],
                         atmo_dominant_issues=row["atmo_issues"], atmo_major_events=row["atmo_events"],
                         atmo_sources_count=row["atmo_sources_count"], final_predicted_party=row["final_predicted_party"],
                         final_confidence=row["final_confidence"], final_probabilities=row["final_probabilities"],
                         final_confidence_label=row["final_confidence_label"], stat_weight_used=row["stat_weight_used"],
                         atmo_weight_used=row["atmo_weight_used"], is_flip=row["is_flip"], flip_from=row["flip_from"],
                         explanation=row["explanation"]))
    await db.commit()


async def run_pipeline(db, force=False, run_id=None, reuse_features=False):
    if not force:
        if run_id:
            try:
                run_id = str(uuid.UUID(run_id))
            except ValueError:
                from fastapi import HTTPException
                raise HTTPException(400, "Invalid prediction run ID")
        path = artifact_dir() / (f"run-{run_id}.json" if run_id else "latest-review.json")
        if not path.exists():
            from fastapi import HTTPException
            raise HTTPException(404 if run_id else 503, "Prediction run not found" if run_id else "No review snapshot yet. A background run is required.")
        return json.loads(await asyncio.to_thread(path.read_text, encoding="utf-8"))
    if reuse_features:
        snapshot = json.loads((artifact_dir() / "features-v3.json").read_text(encoding="utf-8"))
        if snapshot.get("schema_version") != "booth-features-v3-canonical":
            raise ValueError("Cannot reuse incompatible feature schema")
    else:
        snapshot = await build_constituency_features(db)
    if {str(row["code"]) for row in snapshot["rows"]} != {str(i) for i in range(1, 404)}:
        raise ValueError("Feature snapshot must contain every canonical assembly code")
    save_artifact("features-v3.json", snapshot)
    digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode()).hexdigest()
    statistical = await asyncio.to_thread(train_and_predict, snapshot["rows"])
    evidence = await asyncio.to_thread(scan_info)
    # Pin a completed snapshot; never consume a corpus still being modified.
    evidence_id = evidence.get("snapshot_id") if evidence["status"] in {"completed", "completed_with_errors"} else None
    atmosphere = await load_atmosphere(statistical.predictions, evidence_id) if evidence_id else {}
    fused = []
    for row in statistical.predictions:
        atmo = atmosphere.get(str(row["code"]))
        result = fuse(row, atmo)
        result["atmo_scoring_status"] = atmo.get("scoring_status") if atmo else "api_not_configured_or_no_verified_evidence"
        fused.append(result)
    simulation = await asyncio.to_thread(simulate, fused, int(os.getenv("PREDICTION_MC_DRAWS", "20000")), 202709)
    audits = {str(audit["code"]): audit for audit in snapshot["audits"]}
    public = [_public_row(row, audits.get(str(row["code"]))) for row in fused]
    public.sort(key=lambda row: int(row["code"]))
    run_id = str(uuid.uuid4())
    created = datetime.now(timezone.utc).isoformat()
    result = {"run_id": run_id, "status": "review", "forecast_year": 2027, "created_at": created,
              "model_version": statistical.model_version, "feature_schema_version": snapshot["schema_version"],
              "manifest": {"run_id": run_id, "feature_snapshot_sha256": digest,
                           "party_mapping_version": PARTY_MAPPING_VERSION, "evidence_snapshot_id": evidence_id,
                           "evidence_cutoff": evidence.get("cutoff") if evidence_id else None,
                           "seed": simulation["seed"], "draws": simulation["draws"], "created_at": created},
              "backtest": statistical.backtest, "simulation": simulation,
              "quality_flags": ["human_release_review_required", "vote_share_and_margin_model_unavailable",
                                "demographic_model_inputs_unavailable", "shock_covariance_unvalidated"],
              "feature_audit": {"constituencies": len(public), "booths": sum(a["current"] for a in snapshot["audits"]),
                                "matched_booths": sum(a["matched"] for a in snapshot["audits"])},
              "summary": {"parties": simulation["parties"], "total_seats": len(public),
                          "majority": simulation["majority_threshold"], "model": statistical.model_version,
                          "total_flips": sum(row["is_flip"] for row in public),
                          "quality": "evidence-scored" if any(row["atmo_weight_used"] for row in fused) else "statistical-only"},
              "predictions": public}
    await _persist(db, result, fused)
    save_artifact(f"run-{run_id}.json", result)
    save_artifact("latest-review.json", result)
    return result
