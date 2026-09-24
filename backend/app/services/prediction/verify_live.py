"""Read-only live API acceptance checks; no training or election-data writes."""
import json
import math
import time
import hashlib
import re
import csv
import io
from collections import Counter
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen


def main():
    base = "http://localhost:8000/api/v1/predictions"
    timings = []

    def get(path):
        started = time.perf_counter()
        with urlopen(base + path, timeout=15) as response:
            payload = json.load(response)
        timings.append({'path': path.split('?')[0], 'ms': round((time.perf_counter() - started) * 1000, 2)})
        return payload

    state = get("/statewide")
    run_id = state["run_id"]
    all_rows = []
    for page in range(1, 10):
        result = get("/list?" + urlencode({"page": page, "page_size": 50, "run_id": run_id}))
        assert result["total"] == 403 and result["run_id"] == run_id
        assert len(result["predictions"]) == (3 if page == 9 else 50)
        all_rows.extend(result["predictions"])
    assert [int(row["code"]) for row in all_rows] == list(range(1, 404))
    for row in all_rows:
        values = row["final"]["probabilities"]
        assert all(math.isfinite(value) and 0 <= value <= 1 for value in values.values())
        assert abs(sum(values.values()) - 1) < 1e-5
        assert row["predicted_vote_share"] is None and row["predicted_margin"] is None
        assert row["final"]["weights"]["atmosphere"] == 0
        assert row["final"]["weights"]["statistical"] == 1
    assert sum(party["predicted"] for party in state["summary"]["parties"]) == 403
    assert state["status"] == "review"
    historical = Counter(row['historical_winner_class_2022'] for row in all_rows)
    assert historical == {'BJP': 255, 'SP': 111, 'IPT': 26, 'RLD': 8, 'INC': 2, 'BSP': 1}
    assert all('[' not in row['name'] for row in all_rows)
    assert get("/list?" + urlencode({"search": "Behat", "run_id": run_id}))["predictions"][0]["code"] == "1"
    assert get("/list?" + urlencode({"search": "403", "run_id": run_id}))["predictions"][0]["code"] == "403"
    filtered = get("/list?" + urlencode({"party": "BJP", "page_size": 403, "run_id": run_id}))
    assert all(row["predicted_party"] == "BJP" for row in filtered["predictions"])
    evidence = get("/evidence/status")
    assert evidence["completed"] == 403 and evidence["queries_ok"] + evidence["queries_failed"] == 1209
    seat = get("/evidence/1")
    assert seat["snapshot_id"] == evidence["snapshot_id"] and seat["items"]
    assert seat["context"]["demographics"]["year"] == 2011
    try:
        get("/evidence/404")
        raise AssertionError("Invalid code accepted")
    except HTTPError as error:
        assert error.code == 404
    from app.services.prediction.evidence import artifact_dir
    from app.services.prediction.statistical import predict_bundle
    import joblib
    import numpy as np
    artifacts = state['manifest']
    model = artifacts['model_artifact']
    features = artifacts['feature_artifact']
    assert re.fullmatch(r'model-[a-f0-9-]{36}\.joblib', model['filename'])
    assert re.fullmatch(r'features-[a-f0-9]{64}\.json', features['filename'])
    for artifact in (model, features):
        assert hashlib.sha256((artifact_dir() / artifact['filename']).read_bytes()).hexdigest() == artifact['sha256']
    # Only load the internally produced bundle after checking its pinned hash.
    bundle = joblib.load(artifact_dir() / model['filename'])
    feature_snapshot = json.loads((artifact_dir() / features['filename']).read_text())
    replay = predict_bundle(bundle, feature_snapshot['rows'])
    stored = {str(row['code']): row for row in all_rows}
    for row, vector in zip(feature_snapshot['rows'], replay):
        np.testing.assert_allclose(vector, list(stored[str(row['code'])]['statistical']['probabilities'].values()), atol=1e-12)
    assert state['simulation']['convergence']['status'] == 'independent_seed_numerical_diagnostic'
    with urlopen(base + '/export.csv?' + urlencode({'run_id': run_id}), timeout=15) as response:
        assert 'attachment;' in response.headers['Content-Disposition']
        exported = list(csv.DictReader(io.StringIO(response.read().decode('utf-8-sig'))))
    assert len(exported) == 403 and len({row['constituency_code'] for row in exported}) == 403
    assert all(row['run_id'] == run_id and row['Vote_share'] == '' for row in exported)
    # Exercise warm snapshot-cache reads separately from evidence scans.
    for _ in range(5):
        get('/list?page=1&page_size=50&run_id=' + run_id)
    print(json.dumps({"status": "passed", "run_id": run_id, "constituencies": len(all_rows),
                      "pages": 9, "page_size": 50, "probability_invariants": "passed",
                      "simulation_seat_total": 403, "missing_vote_estimates_explicit": True,
                      "unconfigured_atmosphere_bypassed": True, "evidence_snapshot_id": evidence["snapshot_id"],
                      "queries": evidence["queries_ok"], "max_local_api_ms": max(item['ms'] for item in timings),
                      'model_artifact_replay': 'passed_403_seats', 'historical_eci_winner_counts': dict(historical),
                      'csv_export_rows': len(exported),
                      'warm_list_ms': [item['ms'] for item in timings[-5:]],
                      "checks_do_not_certify_model_accuracy": True}))


if __name__ == "__main__":
    main()
