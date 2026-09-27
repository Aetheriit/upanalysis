# Prediction evidence layer

Prediction and Forecasting share the same explicitly requested, immutable run.

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
# Supplement selected seats while preserving the parent corpus:
python -m app.services.prediction.evidence_worker --derive-from SNAPSHOT_UUID --refresh-code 58
python -m unittest app.services.prediction.test_evidence -v
python -m unittest app.services.prediction.test_vote_support -v
python -u -m app.services.prediction.run_worker
# Explicit model-only rerun from the completed ECI-reconciled v4 features:
python -u -m app.services.prediction.run_worker --reuse-features
python -m app.services.prediction.verify_live
```

Snapshots live in the existing persistent uploads volume at
`/app/uploads/prediction/evidence.sqlite3`. Completed corpora have SHA-256 digests.
New scans create new snapshots; they do not edit completed ones. Model runs pin
a completed snapshot, never a moving live corpus. Latest discovery evidence is
labelled separately in the UI. Source freshness is recomputed from publication
dates, not refresh dates. Dedupe is conservative headline/URL clustering; it
does not establish publisher independence or catch all syndication.

## Run-button-only OpenAI research

The Prediction Run form is the only web-app trigger for paid research. It sends
an authenticated POST with a UUID `request_id`, `dynamic_research` and
`confirm_api_usage`. No GET, page reload, filter change or status poll starts
research. Duplicate request IDs replay the same job; only one job may be active.
Progress and per-seat results persist in `jobs.sqlite3`. Failed runs retain the
last review snapshot, and interrupted work is not automatically retried.
The Run form can explicitly resume an interrupted/failed research batch via
`resume_job_id`. Completed checkpoints are copied into a new lineage-linked
job; no completed or failed request is repeated. An uncheckpointed in-flight
request is marked unresolved rather than risking a duplicate charge. The
original publication cut-off is retained. Resume still requires paid consent.

Set `OPENAI_API_KEY` and `PREDICTION_ADMIN_TOKEN` in the root-only VPS `.env`,
then recreate the backend. The form asks for the **operator run-access token**,
not the OpenAI key. It holds that token only in memory and clears it on submit.
Never put the OpenAI key in public settings, `NEXT_PUBLIC_*`, git or frontend
code. Rotate keys disclosed in chat. Without a key, research is bypassed and
the statistical model still runs. There is no scheduled or startup research.

All new provider calls use exactly `gpt-6-luna` through the Responses API,
with web search and strict structured output. There is no fallback model.
Each of 403 seats receives at most one generation request, bounded to four
tool calls and 12,000 output tokens. This is potentially substantial paid work;
the UI requires confirmation. Actual usage is persisted, not a promised price
ceiling. Authentication/access/model/quota failures stop the job; timeouts are
not automatically retried because they may already have been billed.

Claims must cite URLs returned by the web-search tool. Exact AC code, dates,
schema and numeric limits are validated. Facts show year, geography, caveats
and clickable sources and remain **AI-extracted, review required**. They do
not replace official election inputs. Recent source-linked event
interpretations may contribute conservatively capped atmosphere scores;
schema checks and URLs do not constitute human verification or polling.
An extra quality discount applies to AI extraction. No party preference is
inferred from caste/religion. Missing, conflicting and unverifiable data stay
explicit instead of being invented by AI.

### Analysis of the stored source corpus

The former eight-headline limit has been removed. Every valid stored source
for a constituency now reaches the analyst, with ID, title, URL, publisher,
date, duplicate cluster and geographic hint. The same request receives official
2017/2022 winners, party shares, margin and vote totals. These historical values
provide context for interpreting new developments; the separately trained
ensemble remains the calibrated statistical prior.

The analyst's task is to derive party-impact interpretations from reported
facts. The article does not need to state an electoral conclusion. Each event
separates `reported_facts` from `electoral_reasoning` and records party-specific
direction/rationale, citations and links back to the stored discovery IDs.
Incumbent accountability, local economic or service grievances, party
organisation, candidates, alliances and defections are valid analytical
mechanisms. A political claim of certain victory does not itself establish a
positive signal. Statewide events retain state scope and a .10 geography
factor, compared with .35 for district and 1.0 for constituency events.

Every supplied source ID is classified as event evidence, historical context,
duplicate, irrelevant or unresolved. Only an accepted event with retrieved
article citations can count a discovery link as used evidence. Missing,
conflicting or invented ID assignments cannot inflate coverage. Counts of
submitted records, assessed records, event-linked records and cited article
URLs remain separate, deduplicated across constituencies, and persisted in
the research manifest. Passing an RSS record to the model is not a claim that
its full article was retrieved. Original articles are investigated using the
Responses web-search tool; tool-returned source URLs and opened pages are
checked against event citations.

At the September 25 audit the 23,919 unique links included 7,945 published
within 90 days and 15,974 older records. Older records can supply background;
the model investigates current reporting to establish continuing developments.
Current events feed the existing bounded fusion and 10,000 simulations.
Historical calibration of the ensemble does not establish empirical
calibration of new news-effect coefficients; fitting those coefficients would
require comparable evidence from before historical election cut-offs.

GET `/research/{code}?run_id=UUID` reads the research pinned to that model run.
CLI model-only runs do not call OpenAI, even when the key is configured.
Official district-portal supplements cover gaps for Amethi, Sambhal, Shamli
and Hapur without pretending to provide AC-level current demographics.

## Legacy atmosphere adapter (not called by the current pipeline)

The older adapter accepts server-side `PREDICTION_ATMOSPHERE_API_URL` and optional
`PREDICTION_ATMOSPHERE_API_KEY` in the VPS compose `.env`, then recreate backend.
It is retained for compatibility/testing only, not an automatic fallback.
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
Fusion v3 uses a **prior-anchored** log-opinion pool with lambda at most
`0.35 * evidence_quality`. A softmax of event scores is relative evidence,
not an independent representative poll. Set `P_atmo = normalize(P_stat * exp(z))`,
then `P_final = softmax(log(P_stat) + lambda*z)`. This refines TRD section 9's
pooling policy: the previous uniform-centered atmosphere flattened historical
probabilities even for neutral news. Zero/equal scores now leave the prior
unchanged. Log-evidence spread is capped at six before quality weighting.
Zero quality means exactly zero atmosphere influence. Source-independence
uncertainty conservatively caps quality. A headline/protest/group composition
alone never assigns a winner. A configured provider's assertions still require
human source review; schema validation is not fact verification.

## APIs and operations

GET endpoints never trigger training or live searches:

- `/api/v1/predictions/statewide`, `/list?page=1&page_size=50`, `/{code}`
- `/api/v1/predictions/evidence/status`, `/evidence/{code}?snapshot_id=UUID`
- `/api/v1/predictions/run/status`
- `/api/v1/predictions/export.csv?run_id=UUID` (all 403 seats, attachment response)

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
valid AC crosswalks exist. Name/spelling aliases do not establish a boundary
crosswalk. Amethi, Hapur, Sambhal and Shamli remain unavailable rather than
being assigned their parent districts' historical population.

ECI's official detailed-result PDFs for 2017 and 2022 have now been downloaded
and parsed for all 403 seats each. The importer checks candidate rank sequences,
general + postal = total for every candidate, printed constituency totals,
electors and NOTA presence. There are 5,256 rows in 2017 and 4,845 in 2022,
including NOTA. Official winner counts match BJP 312/SP 47 in 2017 and BJP
255/SP 111 in 2022. Source URLs are in `official_results.py` and each run's
manifest; the source PDF hashes are:

- 2017: `a3f66ba101d397528d41ac8e8c84f2e9594a86d5fb3c28398241f6f95295285a`
- 2022: `ae648d06232ef1b58f614cf2f11b0adb0edd6128fb086682433676b77b0a89e4`

Use `pdftotext -layout SOURCE.pdf SOURCE.txt`, then run:

```sh
python -m app.services.prediction.official_results --year 2022 --text SOURCE.txt --pdf SOURCE.pdf --output uploads/prediction/eci-up-2022.json
```

Repeat for 2017. Import refuses an existing output and never changes election
tables. The two versioned source snapshots are required before model training.
Party identity reconciliation uses exact names or exact votes plus a close
name within the same AC/year. Unknown/ambiguous identities and conflicting
duplicate booth votes stay unusable. Matching thresholds require manual QA.
The observed audit found 374 (2017) and 612 (2022) class-label conflicts.
Only 46,755 of 168,036 current-election booths had fully resolved identities.
Raw coverage must not be described as fully validated booth coverage.

## Statistical corrections and release gaps

Party classes do not silently merge AD(S), NISHAD or SBSP into BJP/SP.
Historical winner comes from the actual winning candidate, not summed Others.
Booths match only within canonical ACs, using bounded candidates, one-to-one
assignment, ambiguity exclusion and explicit structural-change flags.
Matching thresholds still require validation on labelled booth pairs.

Official vote-weighted constituency shares replace unweighted booth means.
Historical turnout, NOTA and normalized margin also come from ECI. Booth
dispersion features require at least 98% resolved booth coverage in that seat;
missing inputs have explicit missingness indicators. This is a conservative
engineering threshold, not a validated coverage guarantee.

The model uses 2017-only historical features for the 2022 hindcast and 2022-only
features for 2027 scoring. District-held-out folds contain nested blend and
temperature selection; logistic scaling is fitted on training folds only.
One historical transition is not independent future-cycle validation.
2017–2022 booth deltas are context, not trained extrapolation.

Win probability is **not** vote share. A separate review-only vote-support
bundle now estimates six party-class shares, top-two candidate contest margin
rate and growth in valid candidate votes. Targets come from the ECI overlay,
not winner probabilities. Independent random-forest and standardized ridge
heads are compared with previous-election persistence. Blend selection happens
inside three inner district folds; five outer folds measure historical error.
The IPT reference share is dropped from linear inputs. The fitted bundle,
out-of-fold predictions/targets and district assignments are persisted with
the winner model. Live verification replays both bundles for all 403 seats.

Version 3 first checks the top-two share gap times estimated valid votes.
That share-implied margin requires its historical error gate, leader agreement,
no pooled IPT top class and no unmatched atmosphere adjustment. Otherwise, the
table may use the independent candidate-contest margin head when **both** its
margin and valid-vote historical gates pass. It is labelled approximate
contest size, not conditional on a named winner, and can differ from the
party-share gap. `margin_basis`, the original `share_implied_status`, separate
errors and bands are exposed in the API/UI/exports. If neither estimator
qualifies, the margin remains withheld. No gate is relaxed to populate a cell.

Shares sum to 100% of candidate votes, excluding NOTA. IPT's pooled share is
not one candidate's support. The growth factor is bounded to 0.5–2 for numerical
safety, not as a learned turnout constraint. No candidate list, alliance
allocation or future electorate has been confirmed. The model does not infer
support from caste/religion, headlines or protests. Historical-error bands use
90th-percentile absolute outer-fold errors; these are **not calibrated future
prediction intervals** or simultaneous coverage guarantees. Aggregate error
improvements do not imply each party improved. These outputs remain review
estimates, not validated production forecasts.

The first coherent-margin review (`b05f818c-5c88-46ad-89b8-0422e1d7b2e6`)
has share MAE 5.885 percentage points versus 7.890 for persistence. Per-party
improvements are mixed: BJP, RLD and IPT share MAE did not improve. The separate
contest-margin diagnostic has MAE 14,063 votes, but the share-implied table
margin has MAE 16,111 versus 15,499 for the actual-margin persistence baseline.
That older run withheld all table margins. New v3 runs can use the independent
contest head (14,063 vs 15,499 baseline MAE), explicitly labelled and subject
to the same historical checks. Valid-vote total MAE is 6,347 versus
13,928 for persistence. These are nested historical hindcast errors, not an
independent future-cycle accuracy claim. Thirty-five unit tests and all-403
artifact replay/invariant checks accompany this implementation.

Every completed Run now executes **exactly 10,000** correlated Monte Carlo
elections (user override of the TRD's 20k–100k engineering target), one winner
per seat per draw. Four independent PCG64/SeedSequence streams each execute
2,500 draws; increasing-prefix checks and inter-stream means/quantiles are
reported without silently exceeding the budget. Mean standard errors, majority
standard errors, party histograms, seat-total covariance and a SHA-256 digest
of the actual integer draw totals are saved. Replaying the saved model and seed
must reproduce the draw digest exactly. Worst-case binomial Monte Carlo SE at
10,000 draws is 0.5 percentage points, **not forecast error**.

Cross-party shock correlation shape uses Ledoit-Wolf shrinkage of district
means of nested held-out categorical residuals. State/region/local log-score
standard deviations remain .045/.025/.06 engineering priors: a single election
transition cannot identify statewide future-cycle shock variance. Shape
estimation is not presented as a fully fitted/validated covariance model.
See [the estimator documentation](https://scikit-learn.org/stable/modules/generated/sklearn.covariance.LedoitWolf.html).
The calibrated RF/logistic/XGBoost winner ensemble is unchanged; this upgrade
does not claim a new measured accuracy improvement from simulation count alone.

Each draw also integrates conditional seat probabilities for static and fused
models using the identical shocks (Rao-Blackwellized paired comparison). This
uses no additional winner draws. The UI exposes the measured web contribution,
its Monte Carlo SE, scored-seat counts, changed leaders and per-seat probability
deltas. Discovery URLs alone never label a model “web included”. The legacy
Forecasting predict/backtest endpoints now read the same saved run, without
their former unrelated momentum/BSP-decay calculations or GET-time simulation.

Run with research disabled reuses the most recent completed, hash-verified
research batch and rescores publication-age gates. It does not discard research
or call OpenAI. Failed/pending batches cannot overwrite that batch. No-key
bypass also retains eligible saved research. Legacy checkpoints without raw
source-item provenance are identified as unreplayable, not silently rescored.
Fresh research fixes one publication cut-off before requests, and separately
records response retrieval timestamps. GET never changes either snapshot.

The initial September 25 audit found **no OpenAI research jobs or checkpoints on
the VPS**, despite the completed RSS discovery corpus. A subsequent user-started
research job overlapped deployment and was interrupted after two checkpoints;
these were preserved and explicit checkpoint-based resume was added.
A static review recalculation
cannot turn those links into verified directional evidence. An explicitly
authorized Run with research enabled is still required for fresh paid research.

Each new run stores immutable content-addressed features, a trained estimator
and calibration bundle, library versions, module hashes and artifact hashes.
Live acceptance checks replay all 403 statistical predictions from the saved
bundle, test all nine pages and verify probability and seat-total invariants.
Only trusted, internally produced joblib files may be loaded; never accept
arbitrary uploaded model bundles. This is not yet a complete artifact registry
with retention, RBAC and publication governance.

The complete PRD is **not yet satisfied**: approved publication/RBAC workflow,
governed artifact registry, full scenario lab, SHAP attribution, boundary-mapped
demographics, independent future-cycle vote-support calibration, full map and report builder,
interval coverage validation and release/load tests remain outstanding.
No new run automatically publishes. These gaps must not be hidden by a
“complete” or “production validated” label.
