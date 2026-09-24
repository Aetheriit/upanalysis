"""Run-button-only research; sequential bounded requests with durable progress."""
import hashlib
import json

from app.services.prediction import jobs
from app.services.prediction.evidence import get_seat_evidence, utcnow, dump
from app.services.prediction.research import configured, research_seat, ResearchError, MODEL


def collect(job_id, rows, evidence_id):
    cutoff = utcnow()
    jobs.update(job_id, phase='web_research', cutoff=cutoff)
    if not configured():
        jobs.update(job_id, phase='research_bypassed', research_status='openai_not_configured')
        return {}, {'job_id': job_id, 'model': MODEL, 'status': 'bypassed_not_configured', 'cutoff': cutoff}
    if len(rows) != 403:
        raise ValueError('All 403 constituency records required')
    completed, failed, atmosphere = 0, 0, {}
    for row in rows:
        evidence = get_seat_evidence(str(row['code']), evidence_id)
        try:
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
        completed += 1
        failed += result['status'] == 'failed'
        jobs.update(job_id, completed=completed, researched=completed-failed, failed=failed,
                    current_code=str(row['code']), current_name=row['name'])
        # Do not repeat an authentication/quota/model failure 403 times.
        if result.get('error_code') in {'openai_authentication_failed', 'openai_access_denied', 'gpt_6_luna_unavailable', 'openai_rate_or_quota_limit'}:
            raise ResearchError(result['error_code'])
        if failed >= 5 and failed == completed:
            raise ResearchError('research_circuit_breaker')
    records = jobs.corpus(job_id)
    manifest = {'job_id': job_id, 'model': MODEL, 'cutoff': cutoff, 'completed': completed, 'failed': failed,
                'status': 'completed_with_errors' if failed else 'completed', 'scored_seats': len(atmosphere),
                'content_sha256': hashlib.sha256(dump(records).encode()).hexdigest(),
                'usage': {key: sum(record.get('usage', {}).get(key, 0) for record in records) for key in ('input_tokens', 'output_tokens', 'total_tokens')}}
    jobs.update(job_id, research_status=manifest['status'], research_manifest=manifest)
    return atmosphere, manifest
