"""Run: python -m unittest app.services.prediction.test_evidence -v."""
import json
import math
import os
import tempfile
import unittest
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from unittest.mock import patch
from types import SimpleNamespace

from app.services.prediction.evidence import cluster_items, create_scan, get_seat_evidence, parse_item, queries, safe_url, freshness
from app.services.prediction.atmosphere import score_events
from app.services.prediction.fusion import weights
from app.services.prediction.parties import normalize_party, PARTIES


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.seat = {"code": "1", "name": "Behat", "district": "Saharanpur"}
        self.cutoff = "2026-09-24T01:00:00+00:00"

    def item(self, title="Behat assembly election news", link="https://news.google.com/rss/articles/1"):
        xml = f"<item><title>{title}</title><link>{link}</link><pubDate>Wed, 23 Sep 2026 12:00:00 GMT</pubDate><source url='https://example.com'>Example</source></item>"
        return parse_item(ET.fromstring(xml), self.seat, self.cutoff, "political")

    def test_queries_cover_languages_and_issues(self):
        plan = queries(self.seat, self.cutoff)
        self.assertEqual(len(plan), 3)
        self.assertEqual({item[1] for item in plan}, {"en", "hi"})
        self.assertTrue(all('"Saharanpur"' in item[2] for item in plan))

    def test_imported_footnotes_do_not_break_search(self):
        plan = queries({**self.seat, "name": "Dhaulana[b]"}, self.cutoff)
        self.assertTrue(all('"Dhaulana"' in item[2] and '[b]' not in item[2] for item in plan))

    def test_query_does_not_grant_constituency_attribution(self):
        self.assertEqual(self.item("UP election 2027")["geo_scope"], "unknown")
        self.assertEqual(self.item("Behat protest")["geo_scope"], "unknown")
        self.assertEqual(self.item("Saharanpur protest")["geo_scope"], "district")
        self.assertEqual(self.item()["geo_scope"], "constituency")

    def test_future_dates_excluded(self):
        xml = ET.fromstring("<item><title>Future</title><link>https://example.com/a</link><pubDate>Fri, 25 Sep 2026 12:00:00 GMT</pubDate></item>")
        self.assertIsNone(parse_item(xml, self.seat, self.cutoff, "political"))

    def test_duplicates_do_not_multiply_clusters(self):
        first, second = self.item(), self.item(link="https://news.google.com/rss/articles/2")
        results = cluster_items([first, first, second])
        self.assertEqual(len(results), 2)
        self.assertEqual(len({row["cluster_id"] for row in results}), 1)

    def test_unscored_headlines_do_not_change_probabilities(self):
        self.assertEqual(weights({}, {"quality": 0, "sources_count": 10000}), (1, 0))
        self.assertIsNone(score_events({"code": "1", "events": []}, {"code": "1", "items": []}))

    def test_wrong_constituency_rejected(self):
        with self.assertRaises(ValueError):
            score_events({"code": "2", "events": []}, {"code": "1", "items": []})

    def test_fusion_obeys_quality_ceiling(self):
        for quality in (0, .1, .5, 1):
            stat, atmo = weights({}, {"quality": quality, "sources_count": 20, "probabilities": dict.fromkeys(PARTIES, 1/6)}, True)
            self.assertLessEqual(atmo, .35 * quality)
            self.assertAlmostEqual(stat + atmo, 1)

    def test_allies_are_not_major_party_wins(self):
        for label in ("AD(S)", "NISHAD", "SBSP", "JDL"):
            self.assertEqual(normalize_party(label), "IPT")

    def test_urls_are_not_executable(self):
        for url in ("javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "https://localhost/a"):
            self.assertIsNone(safe_url(url))

    def test_scan_requires_canonical_403_and_survives_restart(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"PREDICTION_ARTIFACT_DIR": directory}):
            with self.assertRaises(ValueError):
                create_scan([self.seat])
            scan_id, _ = create_scan([{**self.seat, "code": str(code)} for code in range(1, 404)])
            result = get_seat_evidence("1", scan_id)
            self.assertEqual(result["status"], "pending")
            self.assertEqual(result["snapshot_id"], scan_id)
            with self.assertRaises(ValueError):
                create_scan([{**self.seat, "code": str(code)} for code in range(1, 404)])

    def test_context_aliases_do_not_invent_new_district_boundaries(self):
        from app.services.prediction.context import ALIASES
        self.assertEqual(ALIASES["hathras"], "mahamaya nagar")
        self.assertEqual(ALIASES["barabanki"], "bara banki")
        for district in ("amethi", "hapur", "sambhal", "shamli"):
            self.assertNotIn(district, ALIASES)

    def test_freshness_uses_publication_not_retrieval(self):
        item = self.item()
        item["published_at"] = "2026-01-01T00:00:00Z"
        self.assertEqual(freshness([item], datetime(2026, 9, 24, tzinfo=timezone.utc)), "stale")


class ModelTests(unittest.TestCase):
    def test_candidate_mapping_corrects_only_evidence_supported_matches(self):
        from app.services.prediction.official_results import candidate_crosswalk
        official = {'candidates': [{'rank': 1, 'name': 'SIDHARTH NATH SINGH', 'party': 'BJP', 'total': 118759}]}
        local = [SimpleNamespace(id='a', name='Sidharth Nath Singh', party=SimpleNamespace(abbreviation='IPT'), votes_received=118759),
                 SimpleNamespace(id='b', name='Different Candidate', party=SimpleNamespace(abbreviation='BJP'), votes_received=118759)]
        mapping, audit = candidate_crosswalk(local, official)
        self.assertEqual(mapping['a']['party'], 'BJP')
        self.assertNotIn('b', mapping)
        self.assertEqual(audit['party_conflicts'], 1)

    def test_booth_duplicate_candidate_votes_not_counted_twice(self):
        from app.services.prediction.feature_engine import _party_shares
        candidate = SimpleNamespace(name='Example')
        records = [SimpleNamespace(candidate_id=key, candidate=candidate, votes=100) for key in ('a', 'b')]
        booth = SimpleNamespace(vote_records=records)
        mapping = {key: {'rank': 1, 'party': 'BJP'} for key in ('a', 'b')}
        self.assertEqual(_party_shares(booth, mapping)['BJP'], 1)
        records[1].votes = 101
        self.assertTrue(math.isnan(_party_shares(booth, mapping)['BJP']))
        self.assertTrue(math.isnan(_party_shares(booth, {})['BJP']))

    def test_empty_candidate_data_does_not_create_training_sample(self):
        from app.services.prediction.feature_engine import _candidate_summary
        result = _candidate_summary(SimpleNamespace(candidates=[], winner_party=None, winning_margin=None))
        self.assertEqual(result['total'], 0)
        self.assertTrue(all(value is None for value in result['shares'].values()))

    def test_official_summary_uses_winning_candidate_not_sum_of_others(self):
        from app.services.prediction.official_results import summary
        seat = {'page': 1, 'votes_total': 410, 'electors': 500,
                'candidates': [{'party': 'BJP', 'total': 180}, {'party': 'IND', 'total': 120},
                               {'party': 'ADAL', 'total': 100}, {'party': 'NOTA', 'total': 10}]}
        result = summary(seat)
        self.assertEqual(result['winner'], 'BJP')
        self.assertEqual(result['margin'], 60)
        self.assertAlmostEqual(sum(result['shares'].values()), 1)

    def test_official_validation_rejects_wrong_totals_and_identity(self):
        from app.services.prediction.official_results import validate_seats
        from copy import deepcopy
        base = {'name': 'Example', 'electors': 100, 'votes_total': 81, 'general_total': 80, 'postal_total': 1,
                'candidates': [{'rank': 1, 'name': 'A', 'party': 'BJP', 'general': 79, 'postal': 1, 'total': 80},
                               {'rank': 2, 'name': 'NOTA', 'party': 'NOTA', 'general': 1, 'postal': 0, 'total': 1}]}
        rows = {str(code): {**deepcopy(base), 'code': str(code)} for code in range(1, 404)}
        validate_seats(rows)
        rows['1']['votes_total'] = 82
        with self.assertRaises(ValueError):
            validate_seats(rows)
        rows['1']['votes_total'] = 81
        rows['1']['code'] = '2'
        with self.assertRaises(ValueError):
            validate_seats(rows)

    def test_non_finite_features_have_missing_indicators(self):
        from app.services.prediction.statistical import vectorize
        values = vectorize({"features": {"bjp_share_2022": float("nan"), "turnout_2022": None}})
        self.assertTrue(all(math.isfinite(value) for value in values))
        self.assertEqual(values[len(values) // 2], 1)

    def test_missing_booth_measurement_is_not_zero(self):
        from app.services.prediction.feature_engine import _mean
        self.assertTrue(math.isnan(_mean([{"turnout": float("nan")}], "turnout")))
        self.assertEqual(_mean([{"turnout": float("nan")}, {"turnout": .6}], "turnout"), .6)

    def test_future_features_do_not_enter_hindcast(self):
        from app.services.prediction.statistical import vectorize
        row = {"features": {"bjp_share_2017": .4}}
        baseline = vectorize(row, "2017")
        row["features"].update(bjp_share_2022=.99, bjp_swing=.5, match_rate=1, strong_booth_ratio=1)
        self.assertEqual(vectorize(row, "2017"), baseline)

    def test_simulation_totals_and_seed(self):
        from app.services.prediction.simulation import simulate
        rows = [{"region": "a", "final_probabilities": dict.fromkeys(PARTIES, 1/6), "final_predicted_party": "BJP"} for _ in range(3)]
        result = simulate(rows)
        self.assertEqual(sum(party["predicted"] for party in result["parties"]), 3)
        self.assertEqual(result, simulate(rows))

    def test_independent_simulation_check_preserves_main_draw(self):
        from app.services.prediction.simulation import simulate, simulate_validated
        rows = [{'region': 'a', 'final_probabilities': dict.fromkeys(PARTIES, 1/6), 'final_predicted_party': 'BJP'} for _ in range(3)]
        baseline = simulate(rows)
        result = simulate_validated(rows)
        self.assertEqual(result['parties'], baseline['parties'])
        self.assertEqual(result['convergence']['independent_seed'], result['seed'] + 1)

    def test_immutable_feature_artifact_roundtrip(self):
        from app.services.prediction.artifacts import write_features
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'PREDICTION_ARTIFACT_DIR': directory}):
            original = {'rows': [{'code': '1', 'value': None}]}
            first = write_features(original)
            self.assertEqual(first, write_features(original))
            original['rows'][0]['value'] = 1
            second = write_features(original)
            self.assertNotEqual(first['sha256'], second['sha256'])
            self.assertEqual(json.loads((Path(directory) / first['filename']).read_text())['rows'][0]['value'], None)

    def test_booth_mapping_is_permutation_invariant(self):
        from app.services.prediction.feature_engine import reconcile_booths
        rows = [{"key": f"{i}|school {i}", "name": f"school {i}", "number": str(i), "electors": 1000} for i in range(3)]
        pairs, audit = reconcile_booths(rows, rows)
        reverse, _ = reconcile_booths(list(reversed(rows)), rows)
        self.assertEqual(pairs, reverse)
        self.assertEqual(audit["matched"], 3)


if __name__ == "__main__":
    unittest.main()
