from __future__ import annotations

from typing import Optional
import asyncio
import json
import os
import secrets
import subprocess
import sys

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.prediction.pipeline import run_pipeline
from app.services.prediction.evidence import artifact_dir, scan_info, get_seat_evidence, create_scan

router = APIRouter()


def require_prediction_admin(authorization: str = Header(default="")):
    token = os.getenv("PREDICTION_ADMIN_TOKEN", "")
    if not token or not secrets.compare_digest(authorization, f"Bearer {token}"):
        raise HTTPException(403, "Prediction administrator token required")


@router.get("/evidence/status")
async def evidence_status():
    return await asyncio.to_thread(scan_info)


@router.get("/evidence/{code}")
async def evidence_for_seat(code: str, snapshot_id: Optional[str] = None):
    if not code.isdigit() or not 1 <= int(code) <= 403:
        raise HTTPException(404, "Unknown constituency code")
    from app.services.prediction.context import context_for_seat
    evidence = await asyncio.to_thread(get_seat_evidence, str(int(code)), snapshot_id)
    evidence["context"] = await asyncio.to_thread(context_for_seat, evidence.get("district", ""))
    return evidence


@router.post("/evidence/scan", dependencies=[Depends(require_prediction_admin)], status_code=202)
async def start_evidence_scan():
    from app.services.prediction.evidence_worker import constituencies
    current = await asyncio.to_thread(scan_info)
    if current["status"] == "running":
        raise HTTPException(409, "An evidence snapshot is already being collected")
    try:
        snapshot_id, _manifest = await asyncio.to_thread(create_scan, await constituencies())
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    with (artifact_dir() / "evidence-job.log").open("ab") as log:
        subprocess.Popen([sys.executable, "-u", "-m", "app.services.prediction.evidence_worker", "--resume", snapshot_id], stdout=log, stderr=log, start_new_session=True)
    return {"snapshot_id": snapshot_id, "status": "running"}


@router.get("/run/status")
async def model_job_status():
    path = artifact_dir() / "model-job.json"
    return json.loads(path.read_text()) if path.exists() else {"status": "not_started"}


@router.get("/statewide")
async def get_statewide_prediction(run_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db, run_id=run_id)
    return {key: result[key] for key in ("run_id", "status", "forecast_year", "created_at", "model_version", "summary", "simulation", "backtest", "feature_audit", "manifest", "quality_flags")}


@router.get("")
@router.get("/list")
async def list_predictions(
    party: Optional[str] = None, district: Optional[str] = None, confidence_min: Optional[float] = Query(None, ge=0, le=100), is_flip: Optional[bool] = None,
    search: Optional[str] = None, run_id: Optional[str] = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=403), db: AsyncSession = Depends(get_db),
):
    result = await run_pipeline(db, run_id=run_id)
    rows = result["predictions"]
    if party and party != "All Parties": rows = [row for row in rows if row["predicted_party"] == party]
    if district: rows = [row for row in rows if row["district"] == district]
    if confidence_min is not None: rows = [row for row in rows if row["confidence"] >= confidence_min]
    if is_flip is not None: rows = [row for row in rows if row["is_flip"] is is_flip]
    if search:
        needle = search.casefold(); rows = [row for row in rows if needle in row["name"].casefold() or needle in row["district"].casefold() or needle == str(row["code"])]
    start = (page - 1) * page_size
    return {"run_id": result["run_id"], "forecast_year": 2027, "page": page, "page_size": page_size, "total": len(rows), "predictions": rows[start:start + page_size]}


@router.get("/battleground")
async def battleground_predictions(db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db)
    return {"run_id": result["run_id"], "predictions": [row for row in result["predictions"] if row["confidence"] < 55]}


@router.get("/flips")
async def flip_predictions(db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db)
    return {"run_id": result["run_id"], "predictions": [row for row in result["predictions"] if row["is_flip"]]}


@router.get("/backtest")
async def prediction_backtest(db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db)
    return {"run_id": result["run_id"], "backtest": result["backtest"], "feature_audit": result["feature_audit"], "model_version": result["model_version"]}


@router.post("/run", dependencies=[Depends(require_prediction_admin)], status_code=202)
async def trigger_prediction_pipeline():
    from app.services.prediction.pipeline import save_artifact
    path = artifact_dir() / "model-job.json"
    if path.exists() and json.loads(path.read_text()).get("status") in {"queued", "running"}:
        raise HTTPException(409, "A model job is already active")
    save_artifact("model-job.json", {"status": "queued"})
    with (artifact_dir() / "model-job.log").open("ab") as log:
        subprocess.Popen([sys.executable, "-u", "-m", "app.services.prediction.run_worker"], stdout=log, stderr=log, start_new_session=True)
    return {"status": "queued", "status_url": "/api/v1/predictions/run/status"}


@router.get("/{constituency_code}")
async def get_constituency_prediction(constituency_code: str, run_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db, run_id=run_id)
    for row in result["predictions"]:
        if str(row["code"]).casefold() == constituency_code.casefold() or str(row["name"]).casefold() == constituency_code.casefold():
            return {"run_id": result["run_id"], "forecast_year": 2027, "prediction": row}
    raise HTTPException(status_code=404, detail="Prediction not found")
