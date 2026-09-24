"""Booth reconciliation and feature materialization.

The feature engine operates on normalized Python records so it can run from
the API worker without requiring a separate dataframe service. It preserves
the booth-level audit counts and marks unmatched/ambiguous polling stations.
"""
from __future__ import annotations

import math
import re
import logging
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from statistics import mean, pstdev
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booth import Booth, VoteRecord
from app.models.candidate import Candidate
from app.models.constituency import Constituency
from app.models.election import Election
from app.services.prediction.parties import PARTIES, normalize_party
from app.services.prediction.evidence import artifact_dir, search_name
from app.services.prediction.official_results import load_sources, candidate_crosswalk, summary as official_summary

FEATURE_SCHEMA_VERSION = "booth-features-v4-eci-reconciled"


def _clean(value: str | None) -> str:
    return " ".join(re.findall(r"\w+", unicodedata.normalize("NFKC", value or "").casefold()))


def _booth_key(booth: Booth) -> str:
    number = re.sub(r"[^0-9a-z]", "", (booth.booth_number or "").lower())
    name = re.sub(r"\s+", " ", _clean(booth.booth_name or booth.location))
    return f"{number}|{name}"


def _party_shares(booth: Booth, crosswalk=None) -> dict[str, float]:
    totals: dict[str, int] = defaultdict(int)
    seen = {}
    for record in booth.vote_records:
        candidate = record.candidate
        if candidate and (candidate.name or "").strip().upper() in {"NOTA", "TOTAL VOTES", "TOTAL VOTES POLLED"}:
            continue
        if crosswalk is not None:
            official = crosswalk.get(str(record.candidate_id))
            if not official:
                if record.votes:
                    return dict.fromkeys(PARTIES, float('nan'))
                continue
            if official['party'] == 'NOTA':
                continue
            identity = official['rank']
            if identity in seen:
                if seen[identity] != record.votes:
                    return dict.fromkeys(PARTIES, float('nan'))
                continue
            seen[identity] = record.votes
            label = normalize_party(official['party'])
        else:
            label = normalize_party(candidate.party.abbreviation) if candidate and candidate.party else None
            if label is None:
                return dict.fromkeys(PARTIES, float('nan'))
        totals[label] += max(0, int(record.votes or 0))
    total = sum(totals.values())
    if not total:
        return dict.fromkeys(PARTIES, float('nan'))
    return {party: totals.get(party, 0) / total for party in PARTIES}


def _booth_record(booth: Booth, crosswalk=None) -> dict[str, Any]:
    return {
        "key": _booth_key(booth),
        "number": booth.booth_number or "",
        "name": booth.booth_name or booth.location or "",
        "shares": _party_shares(booth, crosswalk),
        "turnout": booth.total_votes_polled / booth.total_electors if booth.total_electors and booth.total_votes_polled is not None else float('nan'),
        "nota": booth.nota_votes / booth.total_votes_polled if booth.total_votes_polled and booth.nota_votes is not None else float('nan'),
        "margin": float(booth.winning_margin) if booth.winning_margin is not None else float('nan'),
        "electors": int(booth.total_electors or 0),
        "gender_ratio": booth.female_electors / booth.male_electors if booth.male_electors and booth.female_electors is not None else float('nan'),
        "classification": (booth.classification or "unknown").lower(),
    }


def _match_score(left: dict[str, Any], right: dict[str, Any]) -> float:
    number_match = bool(left["number"] and right["number"] and _clean(left["number"]) == _clean(right["number"]))
    left_name, right_name = _clean(left["name"]), _clean(right["name"])
    name_score = SequenceMatcher(None, left_name[:160], right_name[:160]).ratio() if left_name and right_name else 0
    elector_score = math.exp(-abs(math.log(left["electors"] / right["electors"]))) if left['electors'] > 0 and right['electors'] > 0 else 0
    return (0.55 if number_match else 0) + 0.3 * name_score + 0.15 * elector_score


def reconcile_booths(previous: list[dict[str, Any]], current: list[dict[str, Any]]) -> tuple[list[tuple[dict[str, Any], dict[str, Any], float]], dict[str, int]]:
    """Bounded candidates and maximum-weight one-to-one assignment.

    Non-unique, unsupported, or structurally changed pairs stay incomparable.
    Thresholds are engineering defaults, not a fitted match-quality claim.
    """
    import numpy as np
    from scipy.optimize import linear_sum_assignment

    previous = sorted(previous, key=lambda item: (item["key"], item["electors"]))
    current = sorted(current, key=lambda item: (item["key"], item["electors"]))
    by_number: dict[str, list[int]] = defaultdict(list)
    by_token: dict[str, set[int]] = defaultdict(set)
    for index, item in enumerate(previous):
        number = _clean(item["number"])
        if number: by_number[number].append(index)
        for token in set(_clean(item["name"]).split()):
            if len(token) >= 4:
                by_token[token].add(index)
    matrix = np.zeros((len(current), len(previous)))
    structural = set()
    for i, item in enumerate(current):
        candidates = set(by_number.get(_clean(item["number"]), []))
        token_candidates = set()
        for token in set(_clean(item["name"]).split()):
            indexes = by_token.get(token, set())
            if len(indexes) <= 24:
                token_candidates.update(indexes)
        candidates.update(sorted(token_candidates)[:24])
        for j in candidates:
            old = previous[j]
            if item["electors"] > 0 and old["electors"] > 0 and not 0.5 < item["electors"] / old["electors"] < 2:
                structural.add(i)
                continue
            score = _match_score(old, item)
            if _clean(old["name"]) and _clean(old["name"]) == _clean(item["name"]):
                score = max(score, 0.8)
            matrix[i, j] = score
    matches: list[tuple[dict[str, Any], dict[str, Any], float]] = []
    exact = ambiguous = 0
    if matrix.size:
        left, right = linear_sum_assignment(matrix, maximize=True)
        for i, j in zip(left, right):
            score = matrix[i, j]
            second_row = max(np.delete(matrix[i], j), default=0)
            second_col = max(np.delete(matrix[:, j], i), default=0)
            if score >= 0.72 and score - max(second_row, second_col) >= 0.03:
                matches.append((previous[j], current[i], round(float(score), 4)))
                exact += int(previous[j]["key"] == current[i]["key"])
            elif score > 0:
                ambiguous += 1
    return matches, {"previous": len(previous), "current": len(current), "matched": len(matches), "exact": exact, "ambiguous": ambiguous, "structural_candidates": len(structural), "unmatched": len(current) - len(matches)}


def _values(items: list[dict[str, Any]], key: str) -> list[float]:
    return [float(item[key]) for item in items if item.get(key) is not None and math.isfinite(float(item[key]))]


def _mean(items: list[dict[str, Any]], key: str) -> float:
    values = _values(items, key)
    return mean(values) if values else float("nan")


def _std(items: list[dict[str, Any]], key: str) -> float:
    values = _values(items, key)
    return pstdev(values) if len(values) > 1 else 0.0


def _enp(shares: list[float]) -> float:
    denominator = sum(max(share, 0) ** 2 for share in shares)
    return 1 / denominator if denominator else 0.0


def _candidate_summary(constituency: Constituency) -> dict[str, Any]:
    candidates = [candidate for candidate in constituency.candidates if (candidate.name or "").strip().upper() not in {"NOTA", "TOTAL VOTES", "TOTAL VOTES POLLED"}]
    totals: dict[str, int] = defaultdict(int)
    for candidate in candidates:
        label = normalize_party(candidate.party.abbreviation if candidate.party else constituency.winner_party)
        totals[label] += max(0, int(candidate.votes_received or 0))
    total = sum(totals.values())
    shares = {party: totals.get(party, 0) / total if total else None for party in PARTIES}
    winner = max(candidates, key=lambda candidate: candidate.votes_received or 0) if candidates else None
    winning_party = winner.party.abbreviation if winner and winner.party else constituency.winner_party
    return {"shares": shares, "winner": normalize_party(winning_party), "actual_winner": winning_party, "margin": int(constituency.winning_margin or 0), "total": total}


async def build_constituency_features(db: AsyncSession, year_pair: tuple[int, int] = (2017, 2022)) -> dict[str, Any]:
    sources = load_sources(artifact_dir())
    query = (
        select(Constituency, Election.year)
        .join(Election)
        .where(Election.year.in_(year_pair))
        .options(
            selectinload(Constituency.candidates).selectinload(Candidate.party),
            selectinload(Constituency.demographics),
        )
    )
    rows = (await db.execute(query)).all()
    grouped: dict[str, dict[int, Constituency]] = defaultdict(dict)
    for constituency, year in rows:
        if not constituency.code:
            raise ValueError("Missing canonical constituency code")
        if year in grouped[str(constituency.code)]:
            raise ValueError("Duplicate constituency code/year")
        grouped[str(constituency.code)][year] = constituency

    feature_rows: list[dict[str, Any]] = []
    audits: list[dict[str, Any]] = []
    previous_year, current_year = year_pair
    for years in grouped.values():
        if current_year not in years:
            continue
        current = years[current_year]
        previous = years.get(previous_year)
        current_official = sources[current_year]['seats'][str(current.code)]
        previous_official = sources[previous_year]['seats'][str(current.code)]
        current_map, current_candidate_audit = candidate_crosswalk(current.candidates, current_official)
        previous_map, previous_candidate_audit = candidate_crosswalk(previous.candidates if previous else [], previous_official)
        constituency_ids = [current.id] + ([previous.id] if previous else [])
        booth_query = (
            select(Booth)
            .where(Booth.constituency_id.in_(constituency_ids))
            .options(selectinload(Booth.vote_records).selectinload(VoteRecord.candidate).selectinload(Candidate.party))
        )
        booths = (await db.execute(booth_query)).scalars().all()
        current_booths = [_booth_record(booth, current_map) for booth in booths if booth.constituency_id == current.id]
        previous_booths = [_booth_record(booth, previous_map) for booth in booths if previous and booth.constituency_id == previous.id]
        matches, audit = reconcile_booths(previous_booths, current_booths)
        audits.append({"code": current.code, "name": current.name, **audit,
                       'candidate_2017': previous_candidate_audit, 'candidate_2022': current_candidate_audit,
                       'party_resolved_booths_2017': sum(all(math.isfinite(v) for v in b['shares'].values()) for b in previous_booths),
                       'party_resolved_booths_2022': sum(all(math.isfinite(v) for v in b['shares'].values()) for b in current_booths)})
        pairs = [(left, right) for left, right, _score in matches]
        features: dict[str, float] = {}
        for party in PARTIES:
            current_shares = [item["shares"][party] for item in current_booths if math.isfinite(item['shares'][party])]
            previous_shares = [item["shares"][party] for item in previous_booths if math.isfinite(item['shares'][party])]
            swings = [right["shares"][party] - left["shares"][party] for left, right in pairs
                      if math.isfinite(right['shares'][party]) and math.isfinite(left['shares'][party])]
            features[f"{party.lower()}_share_2022"] = mean(current_shares) if current_shares else float('nan')
            features[f"{party.lower()}_share_2017"] = mean(previous_shares) if previous_shares else float('nan')
            features[f"{party.lower()}_swing"] = mean(swings) if swings else float('nan')
            features[f"{party.lower()}_swing_std"] = pstdev(swings) if len(swings) > 1 else float('nan')
            for period, values, total_booths in ((2017, previous_shares, len(previous_booths)), (2022, current_shares, len(current_booths))):
                features[f'{party.lower()}_booth_dispersion_{period}'] = pstdev(values) if len(values) > 1 and len(values) >= .98 * total_booths else float('nan')
        current_turnout = current_booths
        previous_turnout = previous_booths
        features.update({
            "turnout_2022": _mean(current_turnout, "turnout"),
            "turnout_2017": _mean(previous_turnout, "turnout"),
            "turnout_change": _mean(current_turnout, "turnout") - _mean(previous_turnout, "turnout"),
            "nota_2022": _mean(current_turnout, "nota"),
            "nota_2017": _mean(previous_turnout, "nota"),
            "nota_change": _mean(current_turnout, "nota") - _mean(previous_turnout, "nota"),
            "margin_2022": _mean(current_turnout, "margin"),
            "margin_2017": _mean(previous_turnout, "margin"),
            "margin_change": _mean(current_turnout, "margin") - _mean(previous_turnout, "margin"),
            "gender_ratio_2022": _mean(current_turnout, "gender_ratio"),
            "gender_ratio_2017": _mean(previous_turnout, "gender_ratio"),
            "booth_count_2017": float(len(previous_booths)),
            "booth_count_2022": float(len(current_booths)),
            "match_rate": len(matches) / max(len(current_booths), 1),
            "strong_booth_ratio": sum(item["classification"] == "strong" for item in current_booths) / max(len(current_booths), 1),
            "weak_booth_ratio": sum(item["classification"] == "weak" for item in current_booths) / max(len(current_booths), 1),
            "swing_booth_ratio": sum(item["classification"] == "swing" for item in current_booths) / max(len(current_booths), 1),
            "enp_2022": _enp([features[f"{party.lower()}_share_2022"] for party in PARTIES]),
            "enp_2017": _enp([features[f"{party.lower()}_share_2017"] for party in PARTIES]),
        })
        summary_2017 = official_summary(previous_official)
        summary_2022 = official_summary(current_official)
        # Official vote-weighted AC results supply level features, never the
        # unweighted mean of booths. Validated booth dispersion remains a feature.
        for period, summary in ((2017, summary_2017), (2022, summary_2022)):
            for party in PARTIES:
                features[f'{party.lower()}_share_{period}'] = summary['shares'][party]
            features[f'turnout_{period}'] = summary['turnout']
            features[f'nota_{period}'] = summary['nota_share']
            features[f'margin_{period}'] = summary['margin'] / summary['total']
            features[f'enp_{period}'] = _enp(list(summary['shares'].values()))
        for metric in ('turnout', 'nota', 'margin'):
            features[f'{metric}_change'] = features[f'{metric}_2022'] - features[f'{metric}_2017']
        # Existing demographic rows have no source/date/geography provenance.
        # Never use support_pct as population or turn unsourced group shares
        # into party-support assumptions. Context ingestion is separate.
        missing_features = [key for key, value in features.items() if value is None or not math.isfinite(value)]
        features = {key: value if key not in missing_features else None for key, value in features.items()}
        feature_rows.append({
            "id": current.id,
            "code": current.code or current.name,
            "name": search_name(current.name),
            "district": current.district or "Unknown",
            "region": current.region or current.district or "Unknown",
            "constituency_type": current.constituency_type or "assembly",
            "is_urban": current.is_urban or "unknown",
            "features": features,
            "missing_features": missing_features,
            "summary_2017": summary_2017,
            "summary_2022": summary_2022,
        })
        logging.getLogger(__name__).warning("prediction_features completed=%s code=%s booths=%s matched=%s", len(feature_rows), current.code, len(current_booths), len(matches))
    feature_names = sorted({name for row in feature_rows for name in row["features"]})
    return {"rows": feature_rows, "audits": audits, "feature_names": feature_names, "schema_version": FEATURE_SCHEMA_VERSION,
            'official_sources': {str(year): {k: v for k, v in payload.items() if k != 'seats'} for year, payload in sources.items()}}
