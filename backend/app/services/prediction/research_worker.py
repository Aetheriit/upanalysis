"""Explicit research runs with bounded parallel requests and durable progress."""
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

from app.services.prediction import jobs
from app.services.prediction.evidence import get_seat_evidence, utcnow, dump
from app.services.prediction.research import configured, research_seat, ResearchError, MODEL
from app.services.prediction.atmosphere import score_events
from app.services.prediction.evidence import timestamp
from app.services.prediction.corpus_analysis import corpus_summary


def _research(row, evidence, cutoff, api_key=None):
    try:
        return research_seat(row, evidence, cutoff, api_key=api_key)
    except ResearchError as error:
        code = str(error)
    except Exception:
        code = 'invalid_provider_response'
    return {'code': str(row['code']), 'status': 'failed', 'error_code': code, 'model': MODEL,
            'facts': [], 'events': [], 'sources': [], 'missing_data': ['Research could not finish; previous official data retained.']}


def collect(job_id, rows, evidence_id, api_key=None):
    job = jobs.status(job_id)
    cutoff = job.get('cutoff') or utcnow()
    evidence_id = job.get('evidence_snapshot_id') or evidence_id
    jobs.update(job_id, phase='web_research', cutoff=cutoff, evidence_snapshot_id=evidence_id)
    if not configured(api_key):
        jobs.update(job_id, phase='research_bypassed', research_status='openai_not_configured')
        return {}, {'job_id': job_id, 'model': MODEL, 'status': 'bypassed_not_configured', 'cutoff': cutoff}
    if len(rows) != 403:
        raise ValueError('All 403 constituency records required')
    saved = {record['code']: record for record in jobs.corpus(job_id)}
    collected = list(saved.values())
    completed = len(saved)
    failed = sum(record['status'] == 'failed' for record in saved.values())
    atmosphere = {code: {**record['atmosphere'], 'snapshot_id': job_id} for code, record in saved.items() if record.get('atmosphere')}
    uncertain = set(job.get('resume_inflight_codes') or [])
    if job.get('resume_inflight_code'):
        uncertain.add(str(job['resume_inflight_code']))
    pending_rows = sorted((row for row in rows if str(row['code']) not in saved), key=lambda row: int(row['code']))
    if job.get('resume_unknown_inflight') and pending_rows:
        uncertain.add(str(pending_rows[0]['code']))
    concurrency = max(1, min(8, int(os.getenv('PREDICTION_RESEARCH_CONCURRENCY', '2'))))
    pending = iter(pending_rows)
    active, inflight = {}, set()
    exhausted, stop_reason = False, None
    fatal = {'openai_authentication_failed', 'openai_access_denied', 'gpt_6_luna_unavailable',
             'openai_rate_or_quota_limit', 'openai_rate_limited', 'openai_quota_exhausted'}

    def persist(row, result):
        nonlocal completed, failed, stop_reason
        result['job_id'] = job_id
        if result.get('atmosphere'):
            result['atmosphere']['snapshot_id'] = job_id
            atmosphere[str(row['code'])] = result['atmosphere']
        jobs.checkpoint(job_id, result)
        collected.append(result)
        completed += 1
        failed += result['status'] == 'failed'
        jobs.update(job_id, completed=completed, researched=completed-failed, failed=failed,
                    current_request_code=None, inflight_codes=sorted(inflight),
                    research_concurrency=concurrency, scored_seats=len(atmosphere),
                    corpus_analysis=corpus_summary(collected),
                    current_code=str(row['code']), current_name=row['name'])
        if result.get('error_code') in fatal:
            stop_reason = result['error_code']
        if failed >= 5 and failed == completed:
            stop_reason = stop_reason or 'research_circuit_breaker'

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        while active or (not exhausted and not stop_reason):
            # Validate one real response before opening the parallel window.
            capacity = concurrency if completed > failed else 1
            while not exhausted and not stop_reason and len(active) < capacity:
                row = next(pending, None)
                if row is None:
                    exhausted = True
                    break
                code = str(row['code'])
                if code in uncertain:
                    persist(row, {'code': code, 'status': 'failed', 'model': MODEL,
                                  'error_code': 'interrupted_request_outcome_unknown_not_retried',
                                  'facts': [], 'events': [], 'sources': [], 'missing_data': ['Interrupted request outcome is unknown.']})
                    continue
                evidence = get_seat_evidence(code, evidence_id)
                inflight.add(code)
                jobs.update(job_id, inflight_codes=sorted(inflight), current_request_code=None)
                active[executor.submit(_research, row, evidence, cutoff, api_key)] = row
            if not active:
                break
            done, _ = wait(active, return_when=FIRST_COMPLETED)
            for future in done:
                row = active.pop(future)
                inflight.discard(str(row['code']))
                persist(row, future.result())
            # On a provider failure, drain and checkpoint already paid requests
            # before ending the job; do not launch further requests.
    if stop_reason:
        raise ResearchError(stop_reason)
    records = jobs.corpus(job_id)
    manifest = {'job_id': job_id, 'model': MODEL, 'cutoff': cutoff, 'completed': completed, 'failed': failed,
                'reused_checkpoints': len(saved), 'parent_job_id': job.get('parent_job_id'),
                'status': 'completed_with_errors' if failed else 'completed', 'scored_seats': len(atmosphere),
                'content_sha256': hashlib.sha256(dump(records).encode()).hexdigest(),
                'corpus_analysis': corpus_summary(records), 'evidence_snapshot_id': evidence_id,
                'research_concurrency': concurrency,
                'usage': {key: sum(record.get('usage', {}).get(key, 0) for record in records) for key in ('input_tokens', 'output_tokens', 'total_tokens')}}
    jobs.update(job_id, research_status=manifest['status'], research_manifest=manifest)
    return atmosphere, manifest


def reuse_completed(cutoff=None):
    """Rescore saved evidence without network calls. Expired events receive zero.

    Legacy checkpoints without raw evidence items are not silently trusted:
    they require a fresh explicit research run to restore scoring provenance.
    """
    manifest = jobs.latest_research_manifest()
    if not manifest:
        return {}, None
    cutoff = cutoff or utcnow()
    now = timestamp(cutoff)
    records = jobs.corpus(manifest['job_id'])
    digest = hashlib.sha256(dump(records).encode()).hexdigest()
    if digest != manifest['content_sha256']:
        raise ValueError('Saved research corpus hash mismatch')
    atmosphere, unavailable = {}, 0
    for record in records:
        if record.get('status') != 'completed':
            continue
        if 'evidence_items' not in record:
            unavailable += 1
            continue
        scored = score_events(record, {'code': record['code'], 'snapshot_id': manifest['job_id'],
                                      'items': record['evidence_items']}, now=now)
        if scored:
            scored['quality'] *= .5
            scored['scoring_status'] = ('cached_offline_source_inspected_review'
                                        if record.get('analysis_mode') == 'offline_no_provider_calls'
                                        else 'cached_openai_source_linked_review')
            atmosphere[str(record['code'])] = scored
    return atmosphere, {**manifest, 'reused': True, 'scoring_cutoff': cutoff,
                        'scored_seats': len(atmosphere), 'unreplayable_legacy_seats': unavailable}
