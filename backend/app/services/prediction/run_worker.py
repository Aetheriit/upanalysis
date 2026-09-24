"""Explicit, isolated model job. GET requests never train models."""
import asyncio
import argparse
import json
import traceback

from app.core.database import async_session
from app.services.prediction.evidence import artifact_dir, utcnow
from app.services.prediction.pipeline import run_pipeline, save_artifact


async def run(reuse_features=False):
    save_artifact("model-job.json", {"status": "running", "started_at": utcnow()})
    try:
        async with async_session() as db:
            result = await run_pipeline(db, force=True, reuse_features=reuse_features)
        status = {"status": "review", "run_id": result["run_id"], "completed_at": utcnow()}
        save_artifact("model-job.json", status)
        print(json.dumps(status), flush=True)
    except Exception as error:
        save_artifact("model-job.json", {"status": "failed", "error_type": type(error).__name__, "completed_at": utcnow()})
        traceback.print_exc()
        raise


if __name__ == "__main__":
    import fcntl
    parser = argparse.ArgumentParser()
    parser.add_argument("--reuse-features", action="store_true", help="Explicitly reuse the completed v3 feature snapshot; do not ingest updated election data")
    args = parser.parse_args()
    artifact_dir().mkdir(parents=True, exist_ok=True)
    with (artifact_dir() / "model.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        asyncio.run(run(args.reuse_features))
