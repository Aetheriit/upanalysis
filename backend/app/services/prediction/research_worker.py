"""Run-button-only research; sequential bounded requests with durable progress."""
import hashlib
import json

from app.services.prediction import jobs
from app.services.prediction.evidence import get_seat_evidence, utcnow, dump
from app.services.prediction.research import configured, research_seat, ResearchError, MODEL
from app.services.prediction.atmosphere import score_events
from app.services.prediction.evidence import timestamp
from app.services.prediction.corpus_analysis import corpus_summary


def collect(job_id, rows, evidence_id):
    job = jobs.status(job_id)
    cutoff = job.get('cutoff') or utcnow()
    evidence_id = job.get('evidence_snapshot_id') or evidence_id
    jobs.update(job_id, phase='web_research', cutoff=cutoff, evidence_snapshot_id=evidence_id)
    if not configured():
        jobs.update(job_id, phase='research_bypassed', research_status='openai_not_configured')
        return {}, {'job_id': job_id, 'model': MODEL, 'status': 'bypassed_not_configured', 'cutoff': cutoff}
    if len(rows) != 403:
        raise ValueError('All 403 constituency records required')
    saved = {record['code']: record for record in jobs.corpus(job_id)}
    collected = list(saved.values())
    completed = len(saved)
    failed = sum(record['status'] == 'failed' for record in saved.values())
    atmosphere = {code: {**record['atmosphere'], 'snapshot_id': job_id} for code, record in saved.items() if record.get('atmosphere')}
    unknown_inflight = job.get('resume_unknown_inflight', False)
    for row in rows:
        if str(row['code']) in saved:
            continue
        evidence = get_seat_evidence(str(row['code']), evidence_id)
        try:
            if unknown_inflight or str(row['code']) == job.get('resume_inflight_code'):
                unknown_inflight = False
                # A killed request may already be billed. Do not retry it.
                raise ResearchError('interrupted_request_outcome_unknown_not_retried')
            jobs.update(job_id, current_request_code=str(row['code']))
            result = research_seat(row, evidence, cutoff)
        except ResearchError as error:
            result = {'code': str(row['code']), 'status': 'failed', 'error_code': str(error), 'model': MODEL,
                      'facts': [], 'events': [], 'sources': [], 'missing_data': ['Provider failed; previous official data retained.']}
        except Exception:
            result = {'code': str(row['code']), 'status': 'failed', 'error_code': 'invalid_provider_response',
                      'model': MODEL, 'facts': [], 'events': [], 'sources': [], 'missing_data': ['Response did not pass validation.']}
        result['job_id'] = job_id
        if result.get('atmosphere'):
            result['atmosphere']['snapshot_id'] = job_id
            atmosphere[str(row['code'])] = result['atmosphere']
        jobs.checkpoint(job_id, result)
        collected.append(result)
        completed += 1
        failed += result['status'] == 'failed'
        jobs.update(job_id, completed=completed, researched=completed-failed, failed=failed,
                    current_request_code=None,
                    corpus_analysis=corpus_summary(collected),
                    current_code=str(row['code']), current_name=row['name'])
        # Do not repeat an authentication/quota/model failure 403 times.
        if result.get('error_code') in {'openai_authentication_failed', 'openai_access_denied', 'gpt_6_luna_unavailable', 'openai_rate_or_quota_limit'}:
            raise ResearchError(result['error_code'])
        if failed >= 5 and failed == completed:
            raise ResearchError('research_circuit_breaker')
    records = jobs.corpus(job_id)
    manifest = {'job_id': job_id, 'model': MODEL, 'cutoff': cutoff, 'completed': completed, 'failed': failed,
                'reused_checkpoints': len(saved), 'parent_job_id': job.get('parent_job_id'),
                'status': 'completed_with_errors' if failed else 'completed', 'scored_seats': len(atmosphere),
                'content_sha256': hashlib.sha256(dump(records).encode()).hexdigest(),
                'corpus_analysis': corpus_summary(records), 'evidence_snapshot_id': evidence_id,
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
            scored['scoring_status'] = 'cached_openai_source_linked_review'
            atmosphere[str(record['code'])] = scored
    return atmosphere, {**manifest, 'reused': True, 'scoring_cutoff': cutoff,
                        'scored_seats': len(atmosphere), 'unreplayable_legacy_seats': unavailable}
