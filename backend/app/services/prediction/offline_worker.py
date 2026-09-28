"""Explicitly authorized offline corpus run; never calls an LLM/search provider."""
import argparse
import asyncio
import fcntl
import json
import os
import uuid
from app.services.prediction import jobs
from app.services.prediction.evidence import artifact_dir, connect, scan_info, utcnow
from app.services.prediction.offline_analysis import compile_corpus, load_reviews


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Save the reviewed analysis and run 10,000 simulations')
    args = parser.parse_args()
    # Defensive isolation: even accidental later use of an ambient provider
    # credential cannot make this an authorized paid-research worker.
    os.environ.pop('OPENAI_API_KEY', None)
    os.environ.pop('PREDICTION_ATMOSPHERE_API_KEY', None)
    os.environ.pop('PREDICTION_ATMOSPHERE_API_URL', None)
    with (artifact_dir() / 'model.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        info = scan_info()
        if info.get('status') not in {'completed', 'completed_with_errors'}:
            raise ValueError('A complete saved source snapshot is required')
        with connect() as db:
            seats = [json.loads(r[0]) for r in db.execute('SELECT payload FROM seat_evidence WHERE snapshot_id=?', (info['snapshot_id'],))]
        features = json.loads((artifact_dir() / 'features-v4.json').read_text())
        job = None
        if args.apply:
            job, _ = jobs.reserve(str(uuid.uuid4()), False)
            jobs.update(job['job_id'], status='running', phase='offline_corpus_analysis', pid=os.getpid())
        try:
            records, _, manifest = compile_corpus(features['rows'], seats, load_reviews(), utcnow(), info['snapshot_id'], job['job_id'] if job else 'dry-run')
            print(json.dumps(manifest), flush=True)
            if job:
                for record in records:
                    jobs.checkpoint(job['job_id'], record)
                jobs.update(job['job_id'], research_manifest=manifest, research_status='completed', model=manifest['model'],
                            completed=403, researched=403, failed=0, scored_seats=manifest['scored_seats'],
                            corpus_analysis=manifest['corpus_analysis'], cutoff=manifest['cutoff'])
                from app.services.prediction.run_worker import run
                asyncio.run(run(reuse_features=True, job_id=job['job_id']))
        except Exception:
            if job:
                jobs.update(job['job_id'], status='failed', phase='failed', error_code='offline_analysis_failed')
            raise


if __name__ == '__main__':
    main()
