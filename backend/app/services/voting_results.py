"""Final ECI election results, kept separate from incomplete booth imports.

These versioned records are extracted from the ECI detailed-results reports.
Margins always use TOTAL votes (general/EVM + postal), not booth subtotals.
"""
import json
from functools import lru_cache
from pathlib import Path

RESULTS_PATH = Path(__file__).resolve().parents[1] / "data" / "voting_results.json"
BUCKETS = ((1000, "0-1K"), (5000, "1K-5K"), (10000, "5K-10K"),
           (25000, "10K-25K"), (50000, "25K-50K"), (float("inf"), "50K+"))


@lru_cache(maxsize=1)
def load_results():
    payload = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    for year in (2017, 2022):
        records = [r for r in payload["results"] if r["year"] == year]
        if len(records) != 403 or {r["code"] for r in records} != set(range(1, 404)):
            raise ValueError(f"Incomplete or duplicate ECI results for {year}")
        for row in records:
            if row["margin"] != row["winner_votes"] - row["runner_up_votes"] or row["margin"] <= 0:
                raise ValueError(f"Invalid final margin: {year}/{row['code']}")
            if not row["winner_name"] or not row["runner_up_name"]:
                raise ValueError(f"Missing candidate: {year}/{row['code']}")
    return payload


def results_for_year(year):
    return {r["code"]: dict(r) for r in load_results()["results"] if r["year"] == year}


def summarize_results(year, constituency_ids):
    """One consistent population for cards, chart, close races and exports."""
    verified = results_for_year(year)
    records = [{**verified[code], "constituency_id": cid}
               for code, cid in constituency_ids.items() if code in verified]
    records.sort(key=lambda r: (r["margin"], r["constituency"], r["code"]))
    distribution = [{"range": label, "count": 0} for _, label in BUCKETS]
    for row in records:
        for index, (upper, _) in enumerate(BUCKETS):
            if row["margin"] < upper:
                distribution[index]["count"] += 1
                break
    close = [r for r in records if r["margin"] < 5000]
    source = next(s for s in load_results()["sources"] if s["year"] == year)
    return {
        "election_year": year,
        "total_constituencies": len(records),
        "expected_constituencies": 403,
        "smallest_margin": records[0] if records else None,
        "largest_margin": records[-1] if records else None,
        "close_contests_count": len(close),
        "avg_margin": round(sum(r["margin"] for r in records) / len(records)) if records else None,
        "distribution": distribution,
        "closest_contests": close,
        "contests": records,
        "source": source,
        "methodology": "Final winner total votes minus runner-up total votes, including postal votes. Close contests have a margin strictly below 5,000 votes.",
    }
