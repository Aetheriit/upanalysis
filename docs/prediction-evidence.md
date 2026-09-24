# Prediction evidence layer

Only `/ai/prediction` is changed. Forecasting is independent.

## Data and search

The standalone worker reads all 403 canonical AC codes from the VPS 2022
constituency master. It performs three dated public Google News RSS searches
per seat: political developments, local issues/events, and Hindi reporting.
Only headline metadata, links, publisher and publication/retrieval timestamps
are stored. It does not scrape full articles or bypass publisher restrictions.
RSS results are discovery leads, not verified reports or representative polling.
The query audit records empty results, failures and accepted item counts.

Run inside the backend container:

```sh
python -u -m app.services.prediction.evidence_worker --workers 2
# Resume an interrupted, incomplete snapshot without repeating completed seats:
python -u -m app.services.prediction.evidence_worker --resume SNAPSHOT_UUID
python -m unittest app.services.prediction.test_evidence -v
python -u -m app.services.prediction.run_worker
```

Snapshots live in the existing persistent uploads volume at
`/app/uploads/prediction/evidence.sqlite3`. Completed corpora have SHA-256 digests.
New scans create new snapshots; they do not edit completed ones. Model runs pin
a completed snapshot, never a moving live corpus. Latest discovery evidence is
labelled separately in the UI. Source freshness is recomputed from publication
dates, not refresh dates. Dedupe is conservative headline/URL clustering; it
does not establish publisher independence or catch all syndication.

## Optional atmosphere API

Set server-side `PREDICTION_ATMOSPHERE_API_URL` and optional
`PREDICTION_ATMOSPHERE_API_KEY` in the VPS compose `.env`, then recreate backend.
Empty URL bypasses scoring. Never use NEXT_PUBLIC variables for secrets.
The service POSTs `{code,name,district,evidence_snapshot_id,cutoff,items}`.
Implement an authorized extractor that opens permitted publisher sources and
returns this structured contract, with actual source checking:

```json
{
  "code": "1",
  "events": [{
    "summary": "A source-supported event summary",
    "geo_scope": "constituency",
    "citation_ids": ["an-item-id-in-the-request"],
    "verification_status": "source_checked",
    "checked_source_url": "https://publisher.example/article",
    "source_checked_at": "2026-09-24T00:00:00Z",
    "extraction_confidence": 0.8,
    "event_importance": 0.5,
    "party_impacts": {
      "BJP": {"direction": -0.1, "rationale": "Explicit source-supported interpretation, not a demographic stereotype."}
    }
  }]
}
```

The example is schema documentation, not evidence of a real event. Unknown or
mismatched AC codes, missing citations, unsupported metadata and non-finite
scores are rejected. Scores are interpretations pending release review.
Deduplicated impacts are recency/geography weighted then softmax-normalized.
Fusion uses a log-opinion pool with lambda at most `0.35 * evidence_quality`.
Zero quality means exactly zero atmosphere influence. Source-independence
uncertainty conservatively caps quality. A headline/protest/group composition
alone never assigns a winner. A configured provider's assertions still require
human source review; schema validation is not fact verification.

## APIs and operations

GET endpoints never trigger training or live searches:

- `/api/v1/predictions/statewide`, `/list?page=1&page_size=50`, `/{code}`
- `/api/v1/predictions/evidence/status`, `/evidence/{code}?snapshot_id=UUID`
- `/api/v1/predictions/run/status`

POST `/run` and `/evidence/scan` require a server-configured
`PREDICTION_ADMIN_TOKEN` as a Bearer token. Unconfigured write endpoints are
disabled. Model jobs use an OS lock and a separate process; results survive
API restarts. A failed job retains the last readable snapshot. The service
currently exposes clearly labelled **review** artifacts, not approved releases.

## Official context and unresolved data

Census C-01 and PCA-SD 2011 imports retain source URLs, hashes, year and district
codes. Counts must sum correctly and district populations must agree across
the two tables. SC/ST percentages are population categories, not detailed caste
composition. Worker participation is not income or unemployment. Census
district context is not an AC population estimate or a current demographic
projection. Missing districts/boundary crosswalks remain missing; no invented
allocation. These demographics are not used as model inputs until temporally
valid AC crosswalks exist. ECI's report portal is referenced; row-level
reconciliation against downloaded ECI results remains separate work.

## Statistical corrections and release gaps

Party classes do not silently merge AD(S), NISHAD or SBSP into BJP/SP.
Historical winner comes from the actual winning candidate, not summed Others.
Booths match only within canonical ACs, using bounded candidates, one-to-one
assignment, ambiguity exclusion and explicit structural-change flags.
Matching thresholds still require validation on labelled booth pairs.

The model uses 2017-only historical features for the 2022 hindcast and 2022-only
features for 2027 scoring. District-held-out folds contain nested blend and
temperature selection; logistic scaling is fitted on training folds only.
One historical transition is not independent future-cycle validation.
2017–2022 booth deltas are context, not trained extrapolation.

Win probability is **not** vote share. The former code's probability-derived
vote-share/margin values were removed. Those two columns now state unavailable;
a separate validated vote-support model is still required.

20,000 correlated Monte Carlo draws preserve one winner per seat and seat-total
invariants, with a measured split-half diagnostic. Shock covariance remains an
engineering prior, not an estimated covariance or validated interval model.

The complete PRD is **not yet satisfied**: approved publication/RBAC workflow,
model artifact registry, full scenario lab, SHAP attribution, boundary-mapped
demographics, calibrated vote-support estimates, full map and report builder,
independent-seed interval validation and release/load tests remain outstanding.
No new run automatically publishes. These gaps must not be hidden by a
“complete” or “production validated” label.
