"""Offline acceptance tests: no billable API requests in this suite."""
import json
import io
import os
import sqlite3
import tempfile
import threading
import unittest
import uuid
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.error import HTTPError

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
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'saved-key-must-not-be-used'}), patch.object(jobs, 'status', return_value={}), patch.object(jobs, 'update'), patch.object(research_worker, 'research_seat') as request:
            result, manifest = research_worker.collect('test', [], None)
        request.assert_not_called()
        self.assertEqual(result, {})
        self.assertEqual(manifest['status'], 'bypassed_not_configured')

    def test_transport_never_falls_back_to_server_key(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'saved-key-must-not-be-used'}), patch.object(research, 'urlopen') as post:
            self.assertFalse(research.configured())
            with self.assertRaisesRegex(research.ResearchError, 'run_api_key_required'):
                research._post({})
            post.assert_not_called()

    def test_temporary_rate_rejection_obeys_retry_after(self):
        error = HTTPError(research.API_URL, 429, 'rate limit', {'Retry-After': '7'},
                          io.BytesIO(json.dumps({'error': {'code': 'rate_limit_exceeded'}}).encode()))
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = b'{"status":"completed"}'
        response.headers = {}
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}), patch.object(research, 'urlopen', side_effect=[error, response]) as post, patch.object(research.time, 'sleep') as sleep, patch.object(research.random, 'uniform', return_value=0):
            result = research._post({}, api_key='explicit-test-key')
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(post.call_count, 2)
        sleep.assert_called_once_with(7)

    def test_quota_rejection_is_not_retried(self):
        error = HTTPError(research.API_URL, 429, 'quota', {},
                          io.BytesIO(json.dumps({'error': {'code': 'project_spend_limit_exceeded', 'type': 'insufficient_quota'}}).encode()))
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}), patch.object(research, 'urlopen', side_effect=error) as post, patch.object(research.time, 'sleep') as sleep:
            with self.assertRaisesRegex(research.ResearchError, 'openai_quota_exhausted'):
                research._post({}, api_key='explicit-test-key')
        self.assertEqual(post.call_count, 1)
        sleep.assert_not_called()

    def test_long_server_delay_is_not_shortened(self):
        error = HTTPError(research.API_URL, 429, 'rate limit', {'Retry-After': '600'},
                          io.BytesIO(json.dumps({'error': {'code': 'slow_down'}}).encode()))
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}), patch.object(research, 'urlopen', side_effect=error), patch.object(research.time, 'sleep') as sleep:
            with self.assertRaisesRegex(research.ResearchError, 'openai_rate_limited'):
                research._post({}, api_key='explicit-test-key')
        sleep.assert_not_called()

    def test_ambiguous_timeout_is_not_retried(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only'}), patch.object(research, 'urlopen', side_effect=TimeoutError) as post:
            with self.assertRaisesRegex(research.ResearchError, 'openai_network_or_timeout'):
                research._post({}, api_key='explicit-test-key')
        self.assertEqual(post.call_count, 1)


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

    def test_resume_skips_checkpoint_and_uncertain_inflight_charge(self):
        job, _ = jobs.reserve(str(uuid.uuid4()), True)
        jobs.checkpoint(job['job_id'], {'code': '1', 'status': 'completed', 'events': [], 'sources': []})
        jobs.update(job['job_id'], status='interrupted', current_request_code='2', cutoff='2026-09-24T00:00:00Z')
        resumed, created = jobs.reserve(str(uuid.uuid4()), True, job['job_id'])
        self.assertTrue(created)
        self.assertEqual(len(jobs.corpus(resumed['job_id'])), 1)
        rows = [{'code': str(i), 'name': 'Test', 'district': 'Test'} for i in range(1, 404)]
        def response(row, evidence, cutoff, api_key=None):
            return {'code': row['code'], 'status': 'completed', 'events': [], 'sources': []}
        with patch.object(research_worker, 'configured', return_value=True), patch.object(research_worker, 'get_seat_evidence', return_value={}), patch.object(research_worker, 'research_seat', side_effect=response) as request:
            _, manifest = research_worker.collect(resumed['job_id'], rows, None)
        self.assertEqual(request.call_count, 401)
        self.assertEqual(manifest['completed'], 403)
        self.assertEqual(manifest['failed'], 1)
        self.assertEqual(manifest['cutoff'], '2026-09-24T00:00:00Z')
        self.assertEqual(jobs.research(resumed['job_id'], '2')['error_code'], 'interrupted_request_outcome_unknown_not_retried')
        self.assertEqual(len(jobs.corpus(job['job_id'])), 1)

    def test_resume_requires_dynamic_and_valid_parent(self):
        with self.assertRaises(ValueError):
            jobs.reserve(str(uuid.uuid4()), True, str(uuid.uuid4()))
        job, _ = jobs.reserve(str(uuid.uuid4()), False)
        jobs.update(job['job_id'], status='failed')
        with self.assertRaises(ValueError):
            jobs.reserve(str(uuid.uuid4()), True, job['job_id'])

    def test_parallel_window_is_bounded_and_each_seat_is_checkpointed_once(self):
        job, _ = jobs.reserve(str(uuid.uuid4()), True)
        rows = [{'code': str(i), 'name': 'Test', 'district': 'Test'} for i in range(1, 404)]
        barrier, lock = threading.Barrier(3), threading.Lock()
        active, maximum, seen = 0, 0, set()
        def response(row, evidence, cutoff, api_key=None):
            nonlocal active, maximum
            with lock:
                active += 1
                maximum = max(maximum, active)
                self.assertNotIn(row['code'], seen)
                seen.add(row['code'])
            if row['code'] in {'2', '3', '4'}:
                barrier.wait(timeout=10)
            with lock:
                active -= 1
            return {'code': row['code'], 'status': 'completed', 'events': [], 'sources': []}
        with patch.dict(os.environ, {'PREDICTION_RESEARCH_CONCURRENCY': '3'}), patch.object(research_worker, 'configured', return_value=True), patch.object(research_worker, 'get_seat_evidence', return_value={}), patch.object(research_worker, 'research_seat', side_effect=response):
            _, manifest = research_worker.collect(job['job_id'], rows, None)
        self.assertEqual(maximum, 3)
        self.assertEqual(len(seen), 403)
        self.assertEqual(manifest['failed'], 0)
        self.assertEqual(len(jobs.corpus(job['job_id'])), 403)
        self.assertEqual(jobs.status()['inflight_codes'], [])

    def test_parallel_provider_failure_drains_paid_requests_and_stops_scheduling(self):
        job, _ = jobs.reserve(str(uuid.uuid4()), True)
        rows = [{'code': str(i), 'name': 'Test', 'district': 'Test'} for i in range(1, 404)]
        def response(row, evidence, cutoff, api_key=None):
            if row['code'] == '2':
                raise research.ResearchError('openai_rate_or_quota_limit')
            return {'code': row['code'], 'status': 'completed', 'events': [], 'sources': []}
        with patch.dict(os.environ, {'PREDICTION_RESEARCH_CONCURRENCY': '3'}), patch.object(research_worker, 'configured', return_value=True), patch.object(research_worker, 'get_seat_evidence', return_value={}), patch.object(research_worker, 'research_seat', side_effect=response) as request:
            with self.assertRaisesRegex(research.ResearchError, 'openai_rate_or_quota_limit'):
                research_worker.collect(job['job_id'], rows, None)
        self.assertEqual(request.call_count, 4)
        self.assertEqual(len(jobs.corpus(job['job_id'])), 4)
        self.assertEqual(jobs.status()['inflight_codes'], [])

    def test_resume_preserves_all_uncertain_parallel_requests(self):
        job, _ = jobs.reserve(str(uuid.uuid4()), True)
        jobs.checkpoint(job['job_id'], {'code': '1', 'status': 'completed', 'events': [], 'sources': []})
        jobs.update(job['job_id'], status='interrupted', current_request_code=None, inflight_codes=['2', '3'])
        resumed, _ = jobs.reserve(str(uuid.uuid4()), True, job['job_id'])
        rows = [{'code': str(i), 'name': 'Test', 'district': 'Test'} for i in range(1, 404)]
        def response(row, evidence, cutoff, api_key=None):
            return {'code': row['code'], 'status': 'completed', 'events': [], 'sources': []}
        with patch.object(research_worker, 'configured', return_value=True), patch.object(research_worker, 'get_seat_evidence', return_value={}), patch.object(research_worker, 'research_seat', side_effect=response) as request:
            _, manifest = research_worker.collect(resumed['job_id'], rows, None)
        self.assertEqual(request.call_count, 400)
        self.assertEqual(manifest['completed'], 403)
        self.assertEqual(manifest['failed'], 2)
        self.assertEqual({call.args[0]['code'] for call in request.call_args_list}, {str(i) for i in range(4, 404)})

    def test_resume_retries_rejections_but_retains_success_and_unknown_outcomes(self):
        job, _ = jobs.reserve(str(uuid.uuid4()), True)
        for code, error in (('1', None), ('2', 'openai_rate_or_quota_limit'), ('3', 'openai_network_or_timeout')):
            jobs.checkpoint(job['job_id'], {'code': code, 'status': 'failed' if error else 'completed', 'error_code': error})
        jobs.update(job['job_id'], status='failed')
        resumed, _ = jobs.reserve(str(uuid.uuid4()), True, job['job_id'])
        self.assertEqual({row['code'] for row in jobs.corpus(resumed['job_id'])}, {'1', '3'})
        self.assertEqual(len(jobs.corpus(job['job_id'])), 3)


class RunApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_forecast_endpoints_read_the_same_saved_model(self):
        from app.api.v1.analytics import get_forecast_predict, get_forecast_backtest
        saved = {'run_id': 'saved', 'simulation': {'parties': [], 'draws': 10000},
                 'model_version': 'tested', 'manifest': {}, 'summary': {'quality': 'statistical-only'},
                 'backtest': {'accuracy': 72, 'feature_year': 2017, 'target_year': 2022, 'sample_size': 403}}
        with patch('app.services.prediction.pipeline.run_pipeline', AsyncMock(return_value=saved)) as read:
            forecast = await get_forecast_predict(None)
            backtest = await get_forecast_backtest(None)
        self.assertEqual(forecast['run_id'], backtest['run_id'])
        self.assertEqual(forecast['iterations'], 10000)
        self.assertEqual(backtest['validation']['winner_accuracy'], 72)
        self.assertTrue(all(call.kwargs == {} for call in read.call_args_list))

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

    async def test_server_key_without_explicit_consent_cannot_start_research(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'saved-key-must-not-be-used'}), patch.object(api.subprocess, 'Popen') as spawn, patch.object(jobs, 'reserve') as reserve:
            request = api.RunRequest(request_id=uuid.uuid4(), dynamic_research=True, confirm_api_usage=False)
            with self.assertRaises(HTTPException) as error:
                await api.trigger_prediction_pipeline(request)
            self.assertEqual(error.exception.status_code, 400)
            spawn.assert_not_called()
            reserve.assert_not_called()

    async def test_server_key_is_only_passed_to_explicitly_authorized_worker(self):
        process = SimpleNamespace(pid=os.getpid(), stdin=MagicMock())
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'PREDICTION_ARTIFACT_DIR': directory, 'OPENAI_API_KEY': 'server-test-key'}), patch.object(api.subprocess, 'Popen', return_value=process) as spawn:
            Path(directory, 'features-v4.json').touch()
            request = api.RunRequest(request_id=uuid.uuid4(), dynamic_research=True, confirm_api_usage=False)
            with self.assertRaises(HTTPException):
                await api.trigger_prediction_pipeline(request)
            spawn.assert_not_called()
            request.confirm_api_usage = True
            first = await api.trigger_prediction_pipeline(request)
            second = await api.trigger_prediction_pipeline(request)
            self.assertEqual(first['job_id'], second['job_id'])
            self.assertEqual(spawn.call_count, 1)
            self.assertIn('--api-key-stdin', spawn.call_args.args[0])
            self.assertNotIn('server-test-key', repr(spawn.call_args))
            self.assertNotIn('OPENAI_API_KEY', spawn.call_args.kwargs['env'])
            process.stdin.write.assert_called_once_with(b'server-test-key')
            process.stdin.close.assert_called_once()
            self.assertNotIn('server-test-key', repr(request))
            self.assertNotIn('server-test-key', json.dumps(jobs.status()))
            self.assertNotIn(b'server-test-key', Path(directory, 'jobs.sqlite3').read_bytes())

    async def test_stored_data_request_rejects_paid_consent(self):
        with patch.object(api.subprocess, 'Popen') as spawn:
            with self.assertRaises(HTTPException) as error:
                await api.trigger_prediction_pipeline(api.RunRequest(request_id=uuid.uuid4(), dynamic_research=False, confirm_api_usage=True))
            self.assertEqual(error.exception.status_code, 400)
            spawn.assert_not_called()

    async def test_stored_data_worker_never_receives_server_key(self):
        process = SimpleNamespace(pid=os.getpid())
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'PREDICTION_ARTIFACT_DIR': directory, 'OPENAI_API_KEY': 'server-test-key'}), patch.object(api.subprocess, 'Popen', return_value=process) as spawn:
            Path(directory, 'features-v4.json').touch()
            await api.trigger_prediction_pipeline(api.RunRequest(request_id=uuid.uuid4(), dynamic_research=False, confirm_api_usage=False))
            self.assertNotIn('--api-key-stdin', spawn.call_args.args[0])
            self.assertNotIn('OPENAI_API_KEY', spawn.call_args.kwargs['env'])
            self.assertEqual(spawn.call_args.kwargs['stdin'], api.subprocess.DEVNULL)

    async def test_missing_server_key_cannot_start_paid_research(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}), patch.object(api.subprocess, 'Popen') as spawn:
            with self.assertRaises(HTTPException) as error:
                await api.trigger_prediction_pipeline(api.RunRequest(request_id=uuid.uuid4(), dynamic_research=True, confirm_api_usage=True))
            self.assertEqual(error.exception.status_code, 400)
            spawn.assert_not_called()


if __name__ == '__main__':
    unittest.main()
