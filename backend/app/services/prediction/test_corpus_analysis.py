"""The complete saved corpus reaches analysis, and only traced inferences score."""
import json
import unittest
from copy import deepcopy
from unittest.mock import patch

from app.services.prediction.corpus_analysis import audit_review, corpus_summary, source_records
from app.services.prediction.research import request_body, parse_response
from app.services.prediction.fusion import fuse
from app.services.prediction.pipeline import evidence_for_run
from app.services.prediction.test_fusion_simulation import source_response, stat


class CorpusAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.evidence = {'snapshot_id': 'saved-corpus', 'items': [
            {'id': f'link-{i}', 'headline': f'Historical or local event {i}', 'url': f'https://example.com/article-{i}',
             'publisher': 'Example', 'published_at': '2026-09-23T00:00:00Z', 'cluster_id': f'cluster-{i}',
             'geo_scope': 'unknown', 'issue_tags': ['infrastructure']} for i in range(294)]}
        self.row = {'code': '1', 'name': 'Test seat', 'district': 'Test district',
                    'summary_2017': {'winner': 'BJP', 'shares': {'BJP': .5}, 'margin': 1000, 'total': 100000},
                    'summary_2022': {'winner': 'SP', 'shares': {'SP': .51}, 'margin': 2000, 'total': 110000}}

    def response(self):
        result = source_response()
        data = json.loads(result['output'][1]['content'][0]['text'])
        data['events'][0].update(discovery_ids=['link-293'],
                                  reported_facts='The article reports a named local party official changing affiliation.',
                                  electoral_reasoning='A loss of local organisational support may weaken the party in this close contest.')
        data['source_review'] = {'event_evidence': ['link-293'], 'historical_context': [f'link-{i}' for i in range(293)],
                                 'duplicate': [], 'irrelevant': [], 'unresolved': []}
        result['output'][1]['content'][0]['text'] = json.dumps(data)
        return result

    def parse(self, response=None):
        with patch('app.services.prediction.research.utcnow', return_value='2026-09-24T12:00:00Z'):
            return parse_response(response or self.response(), self.row, '2026-09-24T00:00:00Z', self.evidence)

    def test_all_294_sources_and_election_history_reach_model(self):
        body = request_body(self.row, self.evidence, '2026-09-24T00:00:00Z')
        content = json.loads(body['input'])
        self.assertEqual(content['source_corpus_count'], 294)
        self.assertEqual({r['id'] for r in content['source_corpus']}, {f'link-{i}' for i in range(294)})
        self.assertEqual(content['historical_election_context']['2022']['winner'], 'SP')
        self.assertEqual(body['model'], 'gpt-6-luna')

    def test_inference_from_last_record_affects_calibrated_prior(self):
        result = self.parse()
        self.assertEqual(result['corpus_analysis']['submitted_count'], 294)
        self.assertEqual(result['corpus_analysis']['assessed_count'], 294)
        self.assertEqual(result['corpus_analysis']['event_link_count'], 1)
        self.assertIn('organisational', result['events'][0]['electoral_reasoning'])
        self.assertLess(fuse(stat(), result['atmosphere'])['final_probabilities']['BJP'], .5)

    def test_omitted_conflicting_or_invented_ids_cannot_claim_coverage(self):
        review = {'event_evidence': ['link-1'], 'historical_context': ['link-2', 'invented'],
                  'irrelevant': ['link-2']}
        audit = audit_review(self.evidence, review, [])
        self.assertEqual(audit['assessed_count'], 0)
        self.assertEqual(audit['unresolved_count'], 294)
        self.assertEqual(audit['invalid_references'], 1)
        self.assertEqual(audit['conflicting_references'], 1)

    def test_rejected_event_cannot_count_as_used_evidence(self):
        response = self.response()
        data = json.loads(response['output'][1]['content'][0]['text'])
        data['events'][0]['source_urls'] = ['https://invented.example/unsupported']
        response['output'][1]['content'][0]['text'] = json.dumps(data)
        result = self.parse(response)
        self.assertIsNone(result['atmosphere'])
        self.assertEqual(result['corpus_analysis']['event_link_count'], 0)
        self.assertEqual(result['corpus_analysis']['unresolved_count'], 1)

    def test_shared_sources_are_counted_once_across_constituencies(self):
        result = self.parse()
        audit = corpus_summary([result, deepcopy(result)])
        self.assertEqual(audit['unique_links_submitted'], 294)
        self.assertEqual(audit['unique_links_used_in_events'], 1)
        self.assertEqual(audit['constituencies_with_corpus_analysis'], 2)

    def test_state_event_is_retained_with_lower_geographic_influence(self):
        local = self.parse()
        response = self.response()
        data = json.loads(response['output'][1]['content'][0]['text'])
        data['events'][0]['geo_scope'] = 'state'
        response['output'][1]['content'][0]['text'] = json.dumps(data)
        state = self.parse(response)
        self.assertIsNotNone(state['atmosphere'])
        self.assertLess(state['atmosphere']['quality'], local['atmosphere']['quality'])
        self.assertLess(abs(state['atmosphere']['log_evidence']['BJP']), abs(local['atmosphere']['log_evidence']['BJP']))

    def test_duplicate_records_do_not_multiply_input(self):
        records = source_records({'items': self.evidence['items'] * 2})
        self.assertEqual(len(records), 294)

    def test_forecast_uses_research_snapshot_not_newer_discovery(self):
        with patch('app.services.prediction.pipeline.scan_info', return_value={'snapshot_id': 'pinned'}) as scan:
            self.assertEqual(evidence_for_run({'evidence_snapshot_id': 'pinned'})['snapshot_id'], 'pinned')
            scan.assert_called_once_with('pinned')

    def test_missing_pinned_snapshot_cannot_be_relabelled_as_latest(self):
        with patch('app.services.prediction.pipeline.scan_info', return_value={'status': 'not_started'}):
            with self.assertRaises(ValueError):
                evidence_for_run({'evidence_snapshot_id': 'missing'})


if __name__ == '__main__':
    unittest.main()
