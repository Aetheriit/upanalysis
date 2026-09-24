"""Explicit, isolated model job. GET requests never train models."""
import asyncio
import argparse
import json
import os

from app.core.database import async_session
from app.services.prediction.evidence import artifact_dir, utcnow
from app.services.prediction.pipeline import run_pipeline, save_artifact


async def run(reuse_features=False, job_id=None):
    save_artifact("model-job.json", {"status": "running", "started_at": utcnow()})
    try:
        atmosphere, research_manifest = {}, None
        if job_id:
            from app.services.prediction import jobs
            from app.services.prediction.evidence import scan_info
            from app.services.prediction.research_worker import collect
            jobs.update(job_id, status='running', phase='preparing', pid=os.getpid())
            job = jobs.status(job_id)
            if job['dynamic_research']:
                features = json.loads((artifact_dir() / 'features-v4.json').read_text())
                evidence = scan_info()
                atmosphere, research_manifest = await asyncio.to_thread(collect, job_id, features['rows'], evidence.get('snapshot_id'))
            jobs.update(job_id, phase='model_training')
        async with async_session() as db:
            result = await run_pipeline(db, force=True, reuse_features=reuse_features, atmosphere_override=atmosphere,
                                        research_manifest=research_manifest)
        status = {"status": "review", "run_id": result["run_id"], "completed_at": utcnow()}
        save_artifact("model-job.json", status)
        if job_id:
            jobs.update(job_id, **{**status, 'status': 'review_completed'}, phase='completed')
        print(json.dumps(status), flush=True)
    except Exception as error:
        save_artifact("model-job.json", {"status": "failed", "error_type": type(error).__name__, "completed_at": utcnow()})
        if job_id:
            from app.services.prediction.research import ResearchError
            jobs.update(job_id, status='failed', phase='failed', completed_at=utcnow(),
                        error_code=str(error) if isinstance(error, ResearchError) else type(error).__name__)
        # No provider payloads, authorization headers or keys in worker logs.
        print(json.dumps({'status': 'failed', 'error_type': type(error).__name__}), flush=True)
        raise


if __name__ == "__main__":
    import fcntl
    parser = argparse.ArgumentParser()
    parser.add_argument("--reuse-features", action="store_true", help="Explicitly reuse the completed v4 feature snapshot; do not ingest updated election data")
    parser.add_argument('--job-id', help='Explicit authenticated Run-button job; only this path may research dynamically')
    args = parser.parse_args()
    artifact_dir().mkdir(parents=True, exist_ok=True)
    with (artifact_dir() / "model.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        asyncio.run(run(args.reuse_features, args.job_id))
