from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.prediction.pipeline import run_pipeline

router = APIRouter()


@router.get("/statewide")
async def get_statewide_prediction(db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db)
    return {key: result[key] for key in ("run_id", "forecast_year", "created_at", "model_version", "summary", "simulation", "backtest", "feature_audit")}


@router.get("")
@router.get("/list")
async def list_predictions(
    party: Optional[str] = None, district: Optional[str] = None, confidence_min: Optional[float] = Query(None, ge=0, le=100), is_flip: Optional[bool] = None,
    search: Optional[str] = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=403), db: AsyncSession = Depends(get_db),
):
    result = await run_pipeline(db)
    rows = result["predictions"]
    if party and party != "All Parties": rows = [row for row in rows if row["predicted_party"] == party]
    if district: rows = [row for row in rows if row["district"] == district]
    if confidence_min is not None: rows = [row for row in rows if row["confidence"] >= confidence_min]
    if is_flip is not None: rows = [row for row in rows if row["is_flip"] is is_flip]
    if search:
        needle = search.casefold(); rows = [row for row in rows if needle in row["name"].casefold() or needle in row["district"].casefold()]
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


@router.post("/run")
async def trigger_prediction_pipeline(db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db, force=True)
    return {"run_id": result["run_id"], "status": "published", "summary": result["summary"], "backtest": result["backtest"]}


@router.get("/{constituency_code}")
async def get_constituency_prediction(constituency_code: str, db: AsyncSession = Depends(get_db)):
    result = await run_pipeline(db)
    for row in result["predictions"]:
        if str(row["code"]).casefold() == constituency_code.casefold() or str(row["name"]).casefold() == constituency_code.casefold():
            return {"run_id": result["run_id"], "forecast_year": 2027, "prediction": row}
    raise HTTPException(status_code=404, detail="Prediction not found")
