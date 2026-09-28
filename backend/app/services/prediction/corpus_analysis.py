"""Complete source-corpus inputs and auditable inference coverage.

All stored records are presented for relevance assessment. Article retrieval
and event inference are performed by the explicit Run's web-enabled analyst.
Submitted headlines, assessed records and cited articles are counted separately.
"""
import hashlib
from app.services.prediction.evidence import dump, safe_url

VERSION = 'corpus-analysis-v1'
REVIEW_GROUPS = ('event_evidence', 'historical_context', 'duplicate', 'irrelevant', 'unresolved')


def source_records(evidence):
    records = {}
    for item in evidence.get('items', []):
        url = safe_url(item.get('url', ''))
        if not url:
            continue
        identity = item.get('id') or hashlib.sha256(url.encode()).hexdigest()[:24]
        records.setdefault(identity, {'id': identity, 'title': item.get('headline', ''), 'url': url,
                                     'publisher': item.get('publisher', ''), 'published_at': item.get('published_at'),
                                     'cluster_id': item.get('cluster_id', identity),
                                     'geography_hint': item.get('geo_scope', 'unknown'),
                                     'topics': item.get('issue_tags', [])})
    return sorted(records.values(), key=lambda record: record['id'])


def historical_context(row):
    result = {}
    for year in (2017, 2022):
        summary = row.get(f'summary_{year}', {})
        if summary:
            result[str(year)] = {key: summary.get(key) for key in ('winner', 'actual_winner', 'shares', 'total', 'margin', 'turnout')}
    return result


def audit_review(evidence, review, events):
    records = source_records(evidence)
    ids = {record['id'] for record in records}
    proposed = review or {}
    assigned = {}
    invalid = 0
    conflicts = set()
    for group in REVIEW_GROUPS:
        for identity in proposed.get(group, []):
            if identity not in ids:
                invalid += 1
                continue
            if identity in assigned:
                conflicts.add(identity)
            assigned[identity] = group
    supported = {identity for event in events for identity in event.get('discovery_ids', []) if identity in ids}
    # A source classified as evidence only counts as used if an accepted,
    # retrieved-source-linked event actually traces back to that source.
    for identity in ids:
        if identity not in assigned or identity in conflicts or (assigned[identity] == 'event_evidence' and identity not in supported):
            assigned[identity] = 'unresolved'
    groups = {group: sorted(identity for identity, value in assigned.items() if value == group) for group in REVIEW_GROUPS}
    return {'version': VERSION, 'evidence_snapshot_id': evidence.get('snapshot_id'),
            'input_sha256': hashlib.sha256(dump(records).encode()).hexdigest(),
            'submitted_count': len(ids), 'submitted_ids': sorted(ids),
            'assessed_count': len(ids) - len(groups['unresolved']),
            'event_link_count': len(groups['event_evidence']), 'unresolved_count': len(groups['unresolved']),
            'groups': groups, 'invalid_references': invalid, 'conflicting_references': len(conflicts),
            'reported_facts_and_inferences_separated': True}


def corpus_summary(records):
    submitted, assessed, used, cited = set(), set(), set(), set()
    screened, inspected, historical, duplicate = set(), set(), set(), set()
    for record in records:
        audit = record.get('corpus_analysis') or {}
        submitted.update(audit.get('submitted_ids', []))
        groups = audit.get('groups', {})
        for group in REVIEW_GROUPS[:-1]:
            assessed.update(groups.get(group, []))
        used.update(groups.get('event_evidence', []))
        cited.update(url for event in record.get('events', []) for url in event.get('source_urls', []))
        if audit.get('screening_method'):
            screened.update(audit.get('submitted_ids', []))
            inspected.update(audit.get('article_reviewed_ids', []))
        historical.update(groups.get('historical_context', []))
        duplicate.update(groups.get('duplicate', []))
    return {'version': VERSION, 'unique_links_submitted': len(submitted),
            'unique_links_assessed': len(assessed), 'unique_links_used_in_events': len(used),
            'unique_articles_cited': len(cited),
            'unique_links_metadata_screened': len(screened),
            'unique_links_source_reviewed': len(inspected),
            'unique_links_historical_context': len(historical),
            'unique_links_duplicate': len(duplicate),
            'unique_links_unresolved': len(submitted - assessed),
            'constituencies_with_corpus_analysis': sum(bool(record.get('corpus_analysis')) for record in records)}
