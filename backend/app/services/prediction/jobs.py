"""Atomic, idempotent run requests and per-seat research checkpoints."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from app.services.prediction.evidence import artifact_dir, utcnow, dump

ACTIVE = {'queued', 'running'}


@contextmanager
def connect():
    artifact_dir().mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(artifact_dir() / 'jobs.sqlite3', timeout=15)
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript('''
        CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, request_id TEXT UNIQUE, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS research (job_id TEXT NOT NULL, code TEXT NOT NULL, payload TEXT NOT NULL,
                                           PRIMARY KEY(job_id,code));
    ''')
    try:
        with db:
            yield db
    finally:
        db.close()


def _alive(job):
    if job['status'] not in ACTIVE:
        return False
    pid = job.get('pid')
    if not pid:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(job['created_at'])).total_seconds() < 60
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def reserve(request_id, dynamic):
    request_id = str(uuid.UUID(request_id))
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        existing = db.execute('SELECT payload FROM jobs WHERE request_id=?', (request_id,)).fetchone()
        if existing:
            return json.loads(existing[0]), False
        for (payload,) in db.execute('SELECT payload FROM jobs').fetchall():
            previous = json.loads(payload)
            if _alive(previous):
                raise ValueError('A prediction run is already active')
            if previous['status'] in ACTIVE:
                previous.update(status='interrupted', error_code='worker_interrupted')
                db.execute('UPDATE jobs SET payload=? WHERE id=?', (dump(previous), previous['job_id']))
        job = {'job_id': str(uuid.uuid4()), 'request_id': request_id, 'status': 'queued', 'phase': 'queued',
               'created_at': utcnow(), 'dynamic_research': dynamic, 'model': 'gpt-6-luna',
               'expected': 403, 'completed': 0, 'researched': 0, 'failed': 0, 'pid': None}
        db.execute('INSERT INTO jobs VALUES (?,?,?)', (job['job_id'], request_id, dump(job)))
    return job, True


def update(job_id, **values):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT payload FROM jobs WHERE id=?', (job_id,)).fetchone()
        if not row:
            raise ValueError('Unknown job')
        payload = {**json.loads(row[0]), **values, 'updated_at': utcnow()}
        db.execute('UPDATE jobs SET payload=? WHERE id=?', (dump(payload), job_id))
    return payload


def status(job_id=None):
    with connect() as db:
        row = db.execute('SELECT payload FROM jobs WHERE id=?', (job_id,)).fetchone() if job_id else db.execute('SELECT payload FROM jobs ORDER BY rowid DESC LIMIT 1').fetchone()
    if not row:
        return {'status': 'not_started', 'completed': 0, 'expected': 403}
    value = json.loads(row[0])
    if value['status'] in ACTIVE and not _alive(value):
        value = {**value, 'status': 'interrupted', 'error_code': 'worker_interrupted'}
    return {key: item for key, item in value.items() if key not in {'pid', 'request_id'}}


def checkpoint(job_id, result):
    with connect() as db:
        db.execute('INSERT INTO research VALUES (?,?,?)', (job_id, str(result['code']), dump(result)))


def research(job_id, code):
    with connect() as db:
        row = db.execute('SELECT payload FROM research WHERE job_id=? AND code=?', (job_id, str(code))).fetchone()
    return json.loads(row[0]) if row else None


def corpus(job_id):
    with connect() as db:
        return [json.loads(row[0]) for row in db.execute('SELECT payload FROM research WHERE job_id=? ORDER BY CAST(code AS INTEGER)', (job_id,))]
