"""Corpus coverage, source provenance and no-network offline inference tests."""
import unittest
from copy import deepcopy
from unittest.mock import patch

from app.services.prediction.offline_analysis import compile_corpus, title_key
from app.services.prediction.fusion import fuse
from app.services.prediction.parties import PARTIES


class OfflineAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.cutoff = '2026-09-28T12:00:00+00:00'
        self.rows = [{'code': str(i), 'name': f'Seat {i}', 'district': 'A' if i < 3 else 'B'} for i in range(1, 404)]
        self.seats = [{'code': str(i), 'snapshot_id': 'discovery', 'items': [
            {'id': f'link-{i}', 'headline': f'Local headline {i}', 'url': f'https://example.com/{i}',
             'published_at': '2026-09-25T00:00:00Z'}]} for i in range(1, 404)]
        self.registry = {'version': 'test-v1', 'checked_at': '2026-09-27T00:00:00Z', 'events': [{
            'id': 'event-1', 'discovery_ids': ['link-1'], 'codes': [], 'districts': ['A'], 'geo_scope': 'district',
            'sources': [{'url': 'https://example.org/report', 'title': 'Verified local report', 'published_at': '2026-09-25T00:00:00Z'}],
            'facts': 'An identified local organiser has changed party.',
            'reasoning': 'An organisational loss may modestly weaken the former party; votes are not assumed to transfer.',
            'confidence': .8, 'importance': .6, 'issue_tags': ['party_change'], 'impacts': {'BJP': -.2, 'SP': .2}}]}

    def compile(self):
        return compile_corpus(self.rows, self.seats, self.registry, self.cutoff, 'discovery', 'test-job')

    def test_complete_coverage_without_network_or_provider(self):
        with patch('urllib.request.urlopen', side_effect=AssertionError('No network')):
            records, atmosphere, manifest = self.compile()
        self.assertEqual(len(records), 403)
        self.assertEqual(manifest['screened_unique_links'], 403)
        self.assertEqual(manifest['provider_calls'], 0)
        self.assertEqual(set(atmosphere), {'1', '2'})
        self.assertEqual(manifest['coverage_status'], 'metadata_complete_article_review_partial')
        self.assertEqual(manifest['corpus_analysis']['unique_links_metadata_screened'], 403)
        self.assertEqual(manifest['corpus_analysis']['unique_links_source_reviewed'], 1)
        self.assertEqual(manifest['corpus_analysis']['unique_links_unresolved'], 402)
        self.assertEqual(records[1]['events'][0]['geo_scope'], 'district')

    def test_geography_not_search_attachment_controls_impact(self):
        self.registry['events'][0].update(codes=['3'], districts=[], geo_scope='constituency')
        records, atmosphere, _ = self.compile()
        self.assertEqual(set(atmosphere), {'3'})
        self.assertFalse(records[0]['events'])
        self.assertEqual(records[2]['events'][0]['discovery_ids'], ['link-1'])

    def test_unreviewed_headlines_never_change_probabilities(self):
        self.registry['events'] = []
        records, atmosphere, manifest = self.compile()
        self.assertFalse(atmosphere)
        self.assertEqual(manifest['scored_seats'], 0)
        self.assertEqual(records[0]['corpus_analysis']['unresolved_count'], 1)

    def test_reviewed_evidence_changes_prior_without_forcing_a_flip(self):
        _, atmosphere, _ = self.compile()
        prior = dict(zip(PARTIES, [.55, .35, .025, .025, .025, .025]))
        result = fuse({'stat_probabilities': prior, 'stat_predicted_party': 'BJP', 'historical_winner_2022': 'BJP'}, atmosphere['1'])
        self.assertLess(result['final_probabilities']['BJP'], .55)
        self.assertGreater(result['final_probabilities']['SP'], .35)
        self.assertEqual(result['final_predicted_party'], 'BJP')

    def test_old_articles_classified_but_do_not_score(self):
        self.registry['events'][0]['sources'][0]['published_at'] = '2026-01-01T00:00:00Z'
        self.seats[0]['items'][0]['published_at'] = '2026-01-01T00:00:00Z'
        records, atmosphere, _ = self.compile()
        self.assertFalse(atmosphere)
        self.assertEqual(records[0]['corpus_analysis']['groups']['historical_context'], ['link-1'])

    def test_duplicate_discovery_links_do_not_multiply_event(self):
        self.seats[0]['items'] *= 4
        records, atmosphere, _ = self.compile()
        self.assertEqual(records[0]['corpus_analysis']['submitted_count'], 1)
        self.assertEqual(atmosphere['1']['sources_count'], 1)

    def test_registry_cannot_invent_anchor_geography_date_or_direction(self):
        original = deepcopy(self.registry)
        changes = [{'discovery_ids': ['invented']}, {'districts': ['Unknown']},
                   {'confidence': float('nan')}, {'impacts': {'BJP': True}},
                   {'impacts': {'unknown': .3}}, {'geo_scope': 'state'}]
        for values in changes:
            with self.subTest(values=values):
                self.registry = deepcopy(original)
                self.registry['events'][0].update(values)
                with self.assertRaises(ValueError):
                    self.compile()
        self.registry = original
        self.registry['checked_at'] = '2027-01-01T00:00:00Z'
        with self.assertRaises(ValueError):
            self.compile()

    def test_duplicate_or_missing_constituencies_fail_closed(self):
        self.rows.append(deepcopy(self.rows[0]))
        with self.assertRaises(ValueError):
            self.compile()
        self.rows.pop()
        self.seats.pop()
        with self.assertRaises(ValueError):
            self.compile()

    def test_hindi_normalisation_keeps_vowels(self):
        self.assertNotEqual(title_key('किसान'), title_key('कसन'))


if __name__ == '__main__':
    unittest.main()
