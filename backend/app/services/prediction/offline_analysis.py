"""Network-free corpus screening plus a versioned source-inspected event registry.

Screening every headline is NOT full-article analysis. Unreviewed records do not
receive directional scores. No provider SDK, credential or HTTP client is used.
"""
import hashlib
import json
import math
import unicodedata
from collections import Counter
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlsplit

from app.services.prediction.atmosphere import score_events
from app.services.prediction.corpus_analysis import audit_review, corpus_summary, source_records
from app.services.prediction.evidence import dump, safe_url, timestamp
from app.services.prediction.parties import PARTIES

MODEL = 'offline-source-reviewed-v1'


def load_reviews():
    return json.loads(Path(__file__).with_name('offline_reviews.json').read_text(encoding='utf-8'))


def title_key(title):
    # Preserve Devanagari combining marks; ASCII-only tokenizers lose vowels.
    text = unicodedata.normalize('NFKC', title).casefold()
    return ' '.join(''.join(c if unicodedata.category(c)[0] in 'LMN' else ' ' for c in text).split())


def validate_reviews(registry, rows, index, cutoff):
    codes, districts = {str(r['code']) for r in rows}, {r['district'] for r in rows}
    checked = timestamp(registry['checked_at'])
    if not checked or checked > cutoff:
        raise ValueError('Review timestamp is later than the analysis cutoff')
    seen = set()
    for event in registry['events']:
        if event['id'] in seen:
            raise ValueError('Duplicate reviewed event')
        seen.add(event['id'])
        if not event['discovery_ids'] or not set(event['discovery_ids']) <= index.keys():
            raise ValueError('Reviewed event must trace to the pinned corpus')
        if not set(event['codes']) <= codes or not set(event['districts']) <= districts:
            raise ValueError('Unknown reviewed geography')
        if event['geo_scope'] == 'constituency':
            if not event['codes'] or event['districts']:
                raise ValueError('Constituency scope needs explicit AC codes')
        elif event['geo_scope'] == 'district':
            if not event['districts'] or event['codes']:
                raise ValueError('District evidence cannot be relabelled as constituency evidence')
        else:
            raise ValueError('Only explicitly inspected local/district evidence is supported')
        if not event['sources']:
            raise ValueError('Inspected article citation required')
        for source in event['sources']:
            date = timestamp(source['published_at'])
            if not safe_url(source['url']) or not date or date > checked:
                raise ValueError('Invalid or future reviewed source')
        if len(event['facts']) < 20 or not 20 <= len(event['reasoning']) <= 800:
            raise ValueError('Reported facts and reasoning must be separate')
        for value in (event['confidence'], event['importance']):
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
                raise ValueError('Invalid reviewed confidence/importance')
        if not event['impacts'] or not set(event['impacts']) <= set(PARTIES):
            raise ValueError('Unknown or absent reviewed party impact')
        for value in event['impacts'].values():
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not -1 <= value <= 1:
                raise ValueError('Invalid reviewed direction')


def compile_corpus(rows, seats, registry, cutoff, snapshot_id, job_id):
    """Pure replayable analysis; no filesystem writes or network requests."""
    now = timestamp(cutoff)
    if not now or len(rows) != 403 or {str(r['code']) for r in rows} != {str(i) for i in range(1, 404)}:
        raise ValueError('All 403 canonical constituency rows and a valid cutoff are required')
    seat_map = {str(s['code']): s for s in seats}
    if len(seats) != 403 or seat_map.keys() != {str(r['code']) for r in rows}:
        raise ValueError('Evidence snapshot must contain all 403 constituencies')
    index = {item['id']: item for seat in seats for item in source_records(seat)}
    validate_reviews(registry, rows, index, now)
    inspected_ids = {i for e in registry['events'] for i in e['discovery_ids']}
    # Exact normalized title + publication day only. Do not pretend this proves
    # independence or catches cross-language syndication.
    title_first, duplicates = {}, set()
    for identity, item in sorted(index.items()):
        date = timestamp(item['published_at'])
        key = (title_key(item['title']), date.date().isoformat() if date else None)
        if key[0] and key in title_first:
            duplicates.add(identity)
        else:
            title_first[key] = identity
    records, atmosphere = [], {}
    for row in sorted(rows, key=lambda r: int(r['code'])):
        code = str(row['code'])
        evidence = seat_map[code]
        items = source_records(evidence)
        events, source_items, sources = [], {}, {}
        for review in registry['events']:
            if code not in review['codes'] and row['district'] not in review['districts']:
                continue
            if any((now - timestamp(s['published_at'])).total_seconds() > 90 * 86400 for s in review['sources']):
                continue
            refs = []
            for source in review['sources']:
                url = safe_url(source['url'])
                digest = hashlib.sha256(url.encode()).hexdigest()
                identity = digest[:24]
                refs.append(identity)
                source_items[identity] = {
                    'id': identity, 'canonical_url_hash': digest, 'cluster_id': review['id'],
                    'url': url, 'headline': source['title'], 'publisher': urlsplit(url).hostname,
                    'publisher_url': 'https://' + urlsplit(url).hostname,
                    'published_at': source['published_at'], 'retrieved_at': registry['checked_at'],
                    'content_basis': 'assistant_inspected_publisher_report', 'geo_scope': review['geo_scope']}
                sources[url] = {'url': url, 'title': source['title']}
            events.append({
                'event_id': review['id'], 'summary': review['facts'], 'reported_facts': review['facts'],
                'electoral_reasoning': review['reasoning'], 'published_at': review['sources'][0]['published_at'],
                'geo_scope': review['geo_scope'], 'geography_basis': 'explicit_source_review_not_search_attachment',
                'citation_ids': refs, 'source_urls': [safe_url(s['url']) for s in review['sources']],
                'discovery_ids': review['discovery_ids'], 'issue_tags': review['issue_tags'],
                'verification_status': 'source_checked', 'checked_source_url': safe_url(review['sources'][0]['url']),
                'source_checked_at': registry['checked_at'], 'extraction_confidence': review['confidence'],
                'event_importance': review['importance'],
                'party_impacts': {p: {'direction': value, 'rationale': review['reasoning']} for p, value in review['impacts'].items()},
                'review_status': 'assistant_source_inspection_not_human_approved'})
        used_ids = {i for e in events for i in e['discovery_ids']}
        groups = {name: [] for name in ('event_evidence', 'historical_context', 'duplicate', 'irrelevant', 'unresolved')}
        decisions, reasons = {}, Counter()
        for item in items:
            identity, date = item['id'], timestamp(item['published_at'])
            if identity in used_ids:
                group, reason = 'event_evidence', 'source_reviewed_event'
            elif not date or date > now:
                group, reason = 'unresolved', 'invalid_or_future_publication'
            elif (now - date).total_seconds() > 90 * 86400:
                group, reason = 'historical_context', 'outside_90_day_directional_window'
            elif identity in duplicates:
                group, reason = 'duplicate', 'same_title_and_publication_day'
            else:
                group, reason = 'unresolved', 'article_review_pending'
            groups[group].append(identity)
            decisions[identity] = reason
            reasons[reason] += 1
        audit = audit_review(evidence, groups, events)
        audit.update(screened_count=len(items), screening_method='metadata_triage_not_full_article_reading',
                     article_reviewed_ids=sorted(set(i['id'] for i in items) & inspected_ids))
        scored = score_events({'code': code, 'events': events},
                              {'code': code, 'snapshot_id': job_id, 'items': list(source_items.values())}, now=now)
        if scored:
            scored['quality'] *= .5  # Same non-human-review discount as API extraction.
            scored['scoring_status'] = 'offline_source_inspected_review'
            atmosphere[code] = scored
        unresolved = len(groups['unresolved'])
        records.append({
            'code': code, 'job_id': job_id, 'status': 'completed', 'model': MODEL, 'cutoff': cutoff,
            'retrieved_at': registry['checked_at'], 'analysis_mode': 'offline_no_provider_calls',
            'summary': f"{row['name']}: {len(items)} stored records screened; {len(events)} geographically matched reviewed events. "
                       + ("Supported interpretations enter the probability model." if scored else "No reviewed directional event was applied; this does not establish absence of an electoral effect."),
            'facts': [], 'events': events, 'sources': list(sources.values()),
            'evidence_items': list(source_items.values()), 'atmosphere': scored, 'corpus_analysis': audit,
            'screening': {'coverage_status': 'metadata_complete_article_review_partial',
                          'decisions': decisions, 'decision_counts': dict(reasons),
                          'issue_record_counts': dict(Counter(tag for item in items for tag in item['topics'])),
                          'historical_context': {str(y): deepcopy(row.get(f'summary_{y}', {})) for y in (2017, 2022)}},
            'missing_data': [f'{unresolved} stored records remain unresolved at article level. Unreviewed headlines have no model impact.',
                             'Impact strengths are declared modelling assumptions, not calibrated causal vote effects.'],
            'usage': {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0},
            'review_status': 'Metadata screening complete; source/article review partial; human approval pending.'})
    summary = corpus_summary(records)
    manifest = {'job_id': job_id, 'model': MODEL, 'analysis_mode': 'offline_no_provider_calls',
                'status': 'completed', 'cutoff': cutoff, 'completed': 403, 'failed': 0, 'scored_seats': len(atmosphere),
                'coverage_status': 'metadata_complete_article_review_partial',
                'content_sha256': hashlib.sha256(dump(records).encode()).hexdigest(),
                'corpus_analysis': summary, 'evidence_snapshot_id': snapshot_id,
                'review_registry_version': registry['version'],
                'review_registry_sha256': hashlib.sha256(dump(registry).encode()).hexdigest(),
                'reviewed_event_count': len(registry['events']),
                'screened_unique_links': len(index), 'inspected_discovery_links': len(inspected_ids),
                'provider_calls': 0, 'usage': {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}}
    return records, atmosphere, manifest
