"""Vote-share and win-probability outputs must never be conflated."""
import math
import unittest
from copy import deepcopy

import numpy as np

from app.services.prediction.parties import PARTIES
from app.services.prediction.vote_support import (constrain, design, historical_targets, persistence,
                                                  _choose, _blend, _metrics, public_estimate)


class VoteSupportTests(unittest.TestCase):
    def setUp(self):
        shares = dict(zip(PARTIES, [.5, .3, .08, .02, .02, .08]))
        self.row = {'code': '1', 'district': 'A', 'features': {'bjp_share_2017': .5, 'bjp_share_2022': .6},
                    'summary_2017': {'shares': shares, 'margin': 20000, 'total': 100000},
                    'summary_2022': {'shares': shares, 'margin': 22000, 'total': 110000}}
        self.values = np.array([.5, .3, .08, .02, .02, .08, .2, math.log(1.1)])
        self.backtest = {'beats_or_matches_persistence': {'shares': True, 'margin': True, 'share_implied_margin': True, 'valid_votes': True},
                         'residual_p90': {'share_pp': dict.fromkeys(PARTIES, 10), 'margin_votes': 30000, 'share_implied_margin_votes': 30000, 'valid_votes': 20000},
                         'limitations': ['Review only']}

    def test_composition_and_positive_growth_are_bounded(self):
        result = constrain([[1.2, -.1, .3, 0, 0, .1, 1.5, 5]])[0]
        self.assertAlmostEqual(sum(result[:6]), 1)
        self.assertTrue(all(0 <= value <= 1 for value in result[:7]))
        self.assertAlmostEqual(math.exp(result[7]), 2)
        for values in ([[0] * 8], [[float('nan')] * 8], [[1, 2]]):
            with self.assertRaises(ValueError):
                constrain(values)

    def test_future_feature_and_total_do_not_leak_into_hindcast(self):
        baseline = design([self.row], 2017)
        changed = deepcopy(self.row)
        changed['features']['bjp_share_2022'] = .99
        changed['summary_2022']['total'] = 999999
        np.testing.assert_array_equal(baseline, design([changed], 2017))

    def test_targets_use_vote_counts_not_winner_probability(self):
        target = historical_targets([self.row])[0]
        self.assertAlmostEqual(target[0], .5)
        self.assertAlmostEqual(target[6], .2)
        self.assertAlmostEqual(math.exp(target[7]), 1.1)
        self.assertEqual(persistence([self.row], 2017)[0, 7], 0)
        self.row['summary_2022']['shares']['BJP'] = .99
        with self.assertRaises(ValueError):
            historical_targets([self.row])

    def test_blend_selection_can_keep_persistence(self):
        target = historical_targets([self.row])
        wrong = target.copy()
        wrong[:, 0], wrong[:, 1], wrong[:, 6], wrong[:, 7] = .1, .7, .8, .5
        raw = np.stack([target, wrong, wrong])
        weights = _choose(raw, target)
        self.assertTrue(all(value == (1, 0, 0) for value in weights.values()))
        np.testing.assert_allclose(_blend(raw, weights), target)

    def test_margin_counts_include_projected_valid_votes(self):
        result = public_estimate(self.values, 100000, 'BJP', 0, self.backtest)
        self.assertEqual(result['table_vote_share'], 50)
        self.assertEqual(result['predicted_valid_votes'], 110000)
        self.assertEqual(result['table_margin'], 22000)
        self.assertEqual(result['historical_error_bands']['contest_margin_votes'], [0, 52000])

    def test_margin_falls_back_on_disagreement_or_ipt_or_atmosphere(self):
        for party, atmo, status in [('SP', 0, 'withheld_support_winner_disagreement'),
                                    ('IPT', 0, 'withheld_ipt_candidate_unresolved'),
                                    ('BJP', .1, 'withheld_atmosphere_not_in_vote_model')]:
            result = public_estimate(self.values, 100000, party, atmo, self.backtest)
            self.assertEqual(result['table_margin'], result['contest_margin_votes'])
            self.assertEqual(result['share_implied_status'], status)
            self.assertEqual(result['margin_basis'], 'candidate_contest_regression')
            self.assertIsNotNone(result['table_vote_share'])

    def test_table_margin_matches_vote_shares_not_independent_contest_head(self):
        self.values[6] = .9
        result = public_estimate(self.values, 100000, 'BJP', 0, self.backtest)
        self.assertEqual(result['table_margin'], 22000)
        self.assertEqual(result['contest_margin_votes'], 99000)

    def test_pooled_ipt_runner_up_cannot_supply_candidate_margin(self):
        self.values[:6] = [.5, .1, .03, .03, .04, .3]
        result = public_estimate(self.values, 100000, 'BJP', 0, self.backtest)
        self.assertEqual(result['table_margin'], result['contest_margin_votes'])
        self.assertEqual(result['share_implied_status'], 'withheld_ipt_opponent_unresolved')

    def test_failed_hindcast_does_not_fill_headline_columns(self):
        self.backtest['beats_or_matches_persistence']['shares'] = False
        self.backtest['beats_or_matches_persistence']['margin'] = False
        result = public_estimate(self.values, 100000, 'BJP', 0, self.backtest)
        self.assertIsNone(result['table_vote_share'])
        self.assertIsNone(result['table_margin'])
        self.assertEqual(result['share_status'], 'withheld_failed_hindcast_gate')

    def test_exact_hindcast_has_zero_error(self):
        target = historical_targets([self.row])
        metric = _metrics(target, target, np.array([100000]))
        for name in ('share_mae_pp', 'margin_votes_mae', 'valid_votes_mae'):
            self.assertEqual(metric[name], 0)


if __name__ == '__main__':
    unittest.main()
