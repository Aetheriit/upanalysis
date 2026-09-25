"""Offline regressions for the full cited-event -> fusion -> simulation path."""
import hashlib
import json
import os
import tempfile
import unittest
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import patch

from app.services.prediction import jobs, research_worker
from app.services.prediction.evidence import dump
from app.services.prediction.fusion import fuse, fusion_audit
from app.services.prediction.parties import PARTIES
from app.services.prediction.research import parse_response
from app.services.prediction.simulation import simulate, fit_shock_policy


def stat():
    return {'stat_probabilities': dict(zip(PARTIES, [.50, .40, .025, .025, .025, .025])),
            'stat_predicted_party': 'BJP', 'historical_winner_2022': 'BJP', 'region': 'West'}


def source_response(direction=-1):
    url = 'https://example.com/local-event'
    result = {'code': '1', 'summary': 'Synthetic offline test of a dated and cited local event.', 'facts': [], 'missing_data': [],
              'events': [{'summary': 'Synthetic fixture: local defection with a source-supported party interpretation.',
                          'published_at': '2026-09-23T00:00:00Z', 'geo_scope': 'constituency', 'source_urls': [url],
                          'issue_tags': ['defection'], 'extraction_confidence': .9, 'event_importance': .8,
                          'party_impacts': [{'party': 'BJP', 'direction': direction,
                                             'rationale': 'Synthetic test rationale linked to the cited local defection.'}]}]}
    return {'status': 'completed', 'output': [
        {'type': 'web_search_call', 'status': 'completed', 'action': {'sources': [{'url': url, 'title': 'Local defection report'}]}},
        {'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(result)}]}]}


class FusionSimulationTests(unittest.TestCase):
    def research(self, direction=-1):
        with patch('app.services.prediction.research.utcnow', return_value='2026-09-24T12:00:00Z'):
            return parse_response(source_response(direction), {'code': '1'}, '2026-09-24T00:00:00Z')

    def test_source_to_fusion_to_ten_thousand_real_draws(self):
        evidence = self.research()
        self.assertIsNotNone(evidence['atmosphere'])
        row = fuse(stat(), evidence['atmosphere'])
        self.assertLess(row['final_probabilities']['BJP'], .50)
        self.assertGreater(row['final_probabilities']['SP'], .40)
        # Unmentioned parties retain their relative odds, not uniform dilution.
        self.assertAlmostEqual(row['final_probabilities']['SP'] / row['final_probabilities']['BSP'], 16)
        result = simulate([deepcopy(row) for _ in range(403)])
        self.assertEqual(result['draws'], 10000)
        self.assertEqual(sum(p['predicted'] for p in result['parties']), 403)
        effect = result['evidence_sensitivity']['parties'][0]
        self.assertLess(effect['change'], 0)
        self.assertGreater(abs(effect['change']), 5 * effect['change_mc_se'])
        self.assertEqual(sum(r['draws'] for r in result['convergence']['replicates']), 10000)
        for histogram in result['draw_histograms'].values():
            self.assertEqual(sum(histogram), 10000)
        self.assertEqual(fusion_audit([row])['scored_seats'], 1)

    def test_missing_zero_uniform_and_equal_evidence_are_identity(self):
        for evidence in (None, {'quality': 1, 'sources_count': 5, 'probabilities': dict.fromkeys(PARTIES, 1/6)},
                         {'quality': 1, 'sources_count': 5, 'log_evidence': dict.fromkeys(PARTIES, 3)}):
            row = fuse(stat(), evidence)
            self.assertEqual(row['final_probabilities'], stat()['stat_probabilities'])
            self.assertEqual(row['atmo_weight_used'], 0)
        self.assertIsNone(self.research(0)['atmosphere'])

    def test_polarity_and_quality_ceiling(self):
        negative = fuse(stat(), self.research(-1)['atmosphere'])
        positive = fuse(stat(), self.research(1)['atmosphere'])
        self.assertLess(negative['final_probabilities']['BJP'], .5)
        self.assertGreater(positive['final_probabilities']['BJP'], .5)
        self.assertLessEqual(positive['atmo_weight_used'], .35)
        bad = {'quality': 1, 'sources_count': 5, 'log_evidence': {'SP': float('nan')}}
        self.assertEqual(fuse(stat(), bad)['atmo_weight_used'], 0)

    def test_cutoff_is_fixed_not_response_completion_time(self):
        a = self.research()
        with patch('app.services.prediction.research.utcnow', return_value='2026-09-26T12:00:00Z'):
            b = parse_response(source_response(), {'code': '1'}, '2026-09-24T00:00:00Z')
        self.assertEqual(a['atmosphere'], b['atmosphere'])

    def test_invalid_simulation_inputs_fail_closed(self):
        for value in (float('nan'), -.1, 2):
            row = fuse(stat(), None)
            row['final_probabilities']['BJP'] = value
            with self.assertRaises(ValueError):
                simulate([row])
        with self.assertRaises(ValueError):
            simulate([fuse(stat(), None)], draws=999)

    def test_static_paired_effect_is_exactly_zero_and_replay_is_exact(self):
        rows = [fuse(stat(), None) for _ in range(3)]
        a, b = simulate(rows), simulate(rows)
        self.assertEqual(a, b)
        self.assertTrue(all(p['change'] == 0 and p['change_mc_se'] == 0 for p in a['evidence_sensitivity']['parties']))
        self.assertEqual(a['max_probability_mc_se_bound'], .005)
        covariance = a['seat_total_covariance']
        self.assertTrue(all(abs(sum(row)) < 1e-8 for row in covariance))

    def test_residual_correlation_shrinkage_is_psd_and_not_claimed_calibrated(self):
        import numpy as np
        rows = [{'code': str(i), 'district': str(i // 4)} for i in range(40)]
        bundle = {'hindcast_targets': np.arange(40) % 6, 'hindcast_probabilities': np.full((40, 6), 1/6),
                  'hindcast_codes': [r['code'] for r in rows]}
        policy = fit_shock_policy(bundle, rows)
        self.assertGreaterEqual(np.linalg.eigvalsh(policy['party_correlation']).min(), -1e-8)
        self.assertTrue(policy['correlation_shape_fitted'])
        self.assertFalse(policy['covariance_fitted'])

    def test_reuse_rescores_expiry_and_ignores_new_failed_job(self):
        record = self.research()
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'PREDICTION_ARTIFACT_DIR': directory}):
            job, _ = jobs.reserve(str(uuid.uuid4()), True)
            jobs.checkpoint(job['job_id'], record)
            manifest = {'job_id': job['job_id'], 'completed': 1, 'failed': 0, 'status': 'completed',
                        'cutoff': record['cutoff'], 'content_sha256': hashlib.sha256(dump([record]).encode()).hexdigest()}
            jobs.update(job['job_id'], status='review_completed', research_manifest=manifest)
            failed, _ = jobs.reserve(str(uuid.uuid4()), True)
            jobs.update(failed['job_id'], status='failed')
            with patch('app.services.prediction.research._post') as post:
                atmosphere, reused = research_worker.reuse_completed('2026-09-25T00:00:00Z')
                stale, expired = research_worker.reuse_completed('2027-01-01T00:00:00Z')
                post.assert_not_called()
            self.assertEqual(reused['job_id'], job['job_id'])
            self.assertIn('1', atmosphere)
            self.assertEqual(stale, {})
            self.assertEqual(expired['scored_seats'], 0)


if __name__ == '__main__':
    unittest.main()
