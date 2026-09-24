"""Offline acceptance tests: no billable API requests in this suite."""
import json
import os
import sqlite3
import tempfile
import unittest
import uuid
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from app.services.prediction import jobs, research, research_worker
from app.api.v1 import predictions as api


class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.row = {'code': '1', 'name': 'Behat', 'district': 'Saharanpur'}
        self.cutoff = '2026-09-24T01:00:00+00:00'
        self.url = 'https://saharanpur.nic.in/demography/'
        self.claim = {'code': '1', 'summary': 'Historical district context; no measured constituency voting effect.',
                      'events': [], 'facts': [{'label': 'District context', 'value': 'Historical example', 'year': 2011,
                      'geography': 'district', 'source_urls': [self.url], 'caveat': 'Not constituency data.'}],
                      'missing_data': ['Current constituency income distribution is not established.']}

    def response(self, claim=None):
        return {'status': 'completed', 'output': [
            {'type': 'web_search_call', 'status': 'completed', 'action': {'sources': [{'url': self.url, 'title': 'District source'}]}},
            {'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(claim or self.claim), 'annotations': []}]}]}

    def test_model_and_cost_bounds_are_explicit(self):
        body = research.request_body(self.row, {'items': []}, self.cutoff)
        self.assertEqual(body['model'], 'gpt-6-luna')
        self.assertEqual(body['tools'][0]['type'], 'web_search')
        self.assertEqual(body['max_tool_calls'], 4)
        self.assertFalse(body['store'])
        self.assertTrue(body['text']['format']['strict'])
        self.assertNotIn('api_key', json.dumps(body))

    def test_source_linked_facts_are_not_model_features(self):
        result = research.parse_response(self.response(), self.row, self.cutoff)
        self.assertEqual(len(result['facts']), 1)
        self.assertFalse(result['facts'][0]['used_as_model_feature'])
        self.assertIsNone(result['atmosphere'])

    def test_unobserved_citation_or_future_year_is_rejected(self):
        for changes in ({'source_urls': ['https://invented.example/']}, {'year': 2027}, {'geography': 'unknown'}):
            claim = deepcopy(self.claim)
            claim['facts'][0].update(changes)
            result = research.parse_response(self.response(claim), self.row, self.cutoff)
            self.assertEqual(result['facts'], [])
            self.assertEqual(result['rejected_claims'], 1)

    def test_wrong_constituency_and_missing_search_rejected(self):
        claim = {**self.claim, 'code': '2'}
        with self.assertRaisesRegex(research.ResearchError, 'constituency_mismatch'):
            research.parse_response(self.response(claim), self.row, self.cutoff)
        response = self.response()
        response['output'].pop(0)
        with self.assertRaisesRegex(research.ResearchError, 'web_search_sources_missing'):
            research.parse_response(response, self.row, self.cutoff)

    def test_future_event_and_uncited_event_cannot_affect_model(self):
        claim = deepcopy(self.claim)
        claim['events'] = [{'summary': 'An illustrative local development requiring verification.', 'published_at': '2027-01-01T00:00:00Z',
                            'geo_scope': 'constituency', 'source_urls': [self.url], 'issue_tags': ['infrastructure'],
                            'extraction_confidence': .8, 'event_importance': .5, 'party_impacts': []}]
        result = research.parse_response(self.response(claim), self.row, self.cutoff)
        self.assertEqual(result['events'], [])
        self.assertIsNone(result['atmosphere'])

    def test_no_key_bypasses_without_a_request(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}), patch.object(jobs, 'update'), patch.object(research_worker, 'research_seat') as request:
            result, manifest = research_worker.collect('test', [], None)
        request.assert_not_called()
        self.assertEqual(result, {})
        self.assertEqual(manifest['status'], 'bypassed_not_configured')


class JobTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'PREDICTION_ARTIFACT_DIR': self.tmp.name})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_idempotency_and_single_active_job(self):
        request = str(uuid.uuid4())
        first, created = jobs.reserve(request, True)
        second, repeated = jobs.reserve(request, True)
        self.assertTrue(created)
        self.assertFalse(repeated)
        self.assertEqual(first['job_id'], second['job_id'])
        with self.assertRaisesRegex(ValueError, 'already active'):
            jobs.reserve(str(uuid.uuid4()), True)
        jobs.update(first['job_id'], status='failed')
        self.assertTrue(jobs.reserve(str(uuid.uuid4()), False)[1])

    def test_checkpoints_cannot_be_silently_overwritten(self):
        job, _ = jobs.reserve(str(uuid.uuid4()), True)
        jobs.checkpoint(job['job_id'], {'code': '1', 'status': 'completed'})
        with self.assertRaises(sqlite3.IntegrityError):
            jobs.checkpoint(job['job_id'], {'code': '1', 'status': 'failed'})
        self.assertEqual(jobs.research(job['job_id'], '1')['status'], 'completed')
        self.assertNotIn('request_id', jobs.status())
        self.assertNotIn('pid', jobs.status())

    def test_provider_auth_error_stops_after_one_seat(self):
        job, _ = jobs.reserve(str(uuid.uuid4()), True)
        rows = [{'code': str(i), 'name': 'Test', 'district': 'Test'} for i in range(1, 404)]
        with patch.object(research_worker, 'configured', return_value=True), patch.object(research_worker, 'get_seat_evidence', return_value={}), patch.object(research_worker, 'research_seat', side_effect=research.ResearchError('openai_authentication_failed')) as request:
            with self.assertRaises(research.ResearchError):
                research_worker.collect(job['job_id'], rows, None)
        self.assertEqual(request.call_count, 1)
        self.assertEqual(jobs.status()['failed'], 1)


class RunApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_gets_never_call_provider_or_spawn(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'PREDICTION_ARTIFACT_DIR': directory, 'OPENAI_API_KEY': 'unit-test-only'}), patch.object(research, '_post') as post, patch.object(api.subprocess, 'Popen') as spawn, patch.object(api, 'run_pipeline', AsyncMock(return_value={'run_id': 'saved', 'manifest': {}})):
            status = await api.model_job_status()
            seat = await api.research_for_seat('1', 'saved', None)
            self.assertTrue(status['provider_configured'])
            self.assertIsNone(seat['research'])
            post.assert_not_called()
            spawn.assert_not_called()

    async def test_run_requires_access_and_paid_consent(self):
        with patch.dict(os.environ, {'PREDICTION_ADMIN_TOKEN': 'test-operator', 'OPENAI_API_KEY': 'unit-test-only'}):
            with self.assertRaises(HTTPException) as error:
                api.require_prediction_admin('Bearer wrong')
            self.assertEqual(error.exception.status_code, 403)
            api.require_prediction_admin('Bearer test-operator')
            with self.assertRaises(HTTPException) as error:
                await api.trigger_prediction_pipeline(api.RunRequest(request_id=uuid.uuid4(), dynamic_research=True, confirm_api_usage=False))
            self.assertEqual(error.exception.status_code, 400)

    async def test_post_retry_does_not_launch_two_workers(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'PREDICTION_ARTIFACT_DIR': directory}), patch.object(api.subprocess, 'Popen', return_value=SimpleNamespace(pid=os.getpid())) as spawn:
            Path(directory, 'features-v4.json').touch()
            request = api.RunRequest(request_id=uuid.uuid4(), dynamic_research=False, confirm_api_usage=False)
            first = await api.trigger_prediction_pipeline(request)
            second = await api.trigger_prediction_pipeline(request)
            self.assertEqual(first['job_id'], second['job_id'])
            self.assertTrue(second['idempotent_replay'])
            self.assertEqual(spawn.call_count, 1)


if __name__ == '__main__':
    unittest.main()
