"""Booth reconciliation and feature materialization.

The feature engine operates on normalized Python records so it can run from
the API worker without requiring a separate dataframe service. It preserves
the booth-level audit counts and marks unmatched/ambiguous polling stations.
"""
from __future__ import annotations

import math
import re
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
from app.models.demographic import Demographic
from app.services.prediction_engine import PARTIES, normalize_party


def _clean(value: str | None) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", (value or "").lower()).strip()


def _booth_key(booth: Booth) -> str:
    number = re.sub(r"[^0-9a-z]", "", (booth.booth_number or "").lower())
    name = re.sub(r"\s+", " ", _clean(booth.booth_name or booth.location))
    return f"{number}|{name}"


def _party_shares(booth: Booth) -> dict[str, float]:
    totals: dict[str, int] = defaultdict(int)
    for record in booth.vote_records:
        candidate = record.candidate
        label = normalize_party(candidate.party.abbreviation if candidate and candidate.party else booth.winner_party)
        totals[label] += max(0, int(record.votes or 0))
    total = sum(totals.values()) or max(int(booth.valid_votes or booth.total_votes_polled or 0), 1)
    return {party: totals.get(party, 0) / total for party in PARTIES}


def _booth_record(booth: Booth) -> dict[str, Any]:
    return {
        "key": _booth_key(booth),
        "number": booth.booth_number or "",
        "name": booth.booth_name or booth.location or "",
        "shares": _party_shares(booth),
        "turnout": float(booth.turnout_pct or 0) / (100 if float(booth.turnout_pct or 0) > 1 else 1),
        "nota": (booth.nota_votes or 0) / max(booth.total_votes_polled or booth.valid_votes or 1, 1),
        "margin": int(booth.winning_margin or 0),
        "electors": int(booth.total_electors or 0),
        "gender_ratio": (float(booth.female_electors or 0) / max(float(booth.male_electors or 0), 1)),
        "classification": (booth.classification or "unknown").lower(),
    }


def _match_score(left: dict[str, Any], right: dict[str, Any]) -> float:
    number_match = bool(left["number"] and right["number"] and re.sub(r"\D", "", left["number"]) == re.sub(r"\D", "", right["number"]))
    name_score = SequenceMatcher(None, _clean(left["name"]), _clean(right["name"])).ratio()
    elector_score = math.exp(-abs(math.log(max(left["electors"], 1) / max(right["electors"], 1))))
    return (0.55 if number_match else 0) + 0.3 * name_score + 0.15 * elector_score


def reconcile_booths(previous: list[dict[str, Any]], current: list[dict[str, Any]]) -> tuple[list[tuple[dict[str, Any], dict[str, Any], float]], dict[str, int]]:
    """Greedy high-confidence one-to-one matching within a constituency.

    Exact normalized keys are accepted first. Remaining booths are matched by
    composite number/name/elector similarity; low-score and duplicate matches
    stay explicitly unmatched.
    """
    by_key: dict[str, list[int]] = defaultdict(list)
    by_number: dict[str, list[int]] = defaultdict(list)
    for index, item in enumerate(previous):
        by_key[item["key"]].append(index)
        number = re.sub(r"\D", "", item["number"])
        if number: by_number[number].append(index)
    used: set[int] = set()
    matches: list[tuple[dict[str, Any], dict[str, Any], float]] = []
    exact = 0
    ambiguous = 0
    for current_item in current:
        exact_candidates = [index for index in by_key.get(current_item["key"], []) if index not in used]
        number = re.sub(r"\D", "", current_item["number"])
        indexed_candidates = [index for index in by_number.get(number, []) if index not in used] if number else []
        candidate_indexes = exact_candidates or indexed_candidates
        # Fuzzy matching is a last resort for renamed/renumbered booths only.
        if not candidate_indexes:
            candidate_indexes = [index for index in range(len(previous)) if index not in used]
        candidates = [(idx, previous[idx], _match_score(previous[idx], current_item)) for idx in candidate_indexes]
        candidates.sort(key=lambda item: item[2], reverse=True)
        if not candidates:
            continue
        idx, previous_item, score = candidates[0]
        second = candidates[1][2] if len(candidates) > 1 else 0
        threshold = 0.62 if current_item["key"] in by_key else 0.72
        if score >= threshold and score - second >= (0.03 if second else 0):
            used.add(idx)
            exact += int(current_item["key"] in by_key)
            matches.append((previous_item, current_item, round(score, 4)))
        else:
            ambiguous += 1
    return matches, {"previous": len(previous), "current": len(current), "matched": len(matches), "exact": exact, "ambiguous": ambiguous, "unmatched": len(current) - len(matches)}


def _values(items: list[dict[str, Any]], key: str) -> list[float]:
    return [float(item[key]) for item in items] if items else [0.0]


def _mean(items: list[dict[str, Any]], key: str) -> float:
    return mean(_values(items, key)) if items else 0.0


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
    total = sum(totals.values()) or 1
    shares = {party: totals.get(party, 0) / total for party in PARTIES}
    ordered = sorted(shares.items(), key=lambda item: item[1], reverse=True)
    return {"shares": shares, "winner": ordered[0][0] if ordered else normalize_party(constituency.winner_party), "margin": int(constituency.winning_margin or 0), "total": total}


async def build_constituency_features(db: AsyncSession, year_pair: tuple[int, int] = (2017, 2022)) -> dict[str, Any]:
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
        grouped[re.sub(r"\s+", " ", (constituency.name or "").strip().upper())][year] = constituency

    feature_rows: list[dict[str, Any]] = []
    audits: list[dict[str, Any]] = []
    previous_year, current_year = year_pair
    for years in grouped.values():
        if current_year not in years:
            continue
        current = years[current_year]
        previous = years.get(previous_year)
        constituency_ids = [current.id] + ([previous.id] if previous else [])
        booth_query = (
            select(Booth)
            .where(Booth.constituency_id.in_(constituency_ids))
            .options(selectinload(Booth.vote_records).selectinload(VoteRecord.candidate).selectinload(Candidate.party))
        )
        booths = (await db.execute(booth_query)).scalars().all()
        current_booths = [_booth_record(booth) for booth in booths if booth.constituency_id == current.id]
        previous_booths = [_booth_record(booth) for booth in booths if previous and booth.constituency_id == previous.id]
        matches, audit = reconcile_booths(previous_booths, current_booths)
        audits.append({"code": current.code, "name": current.name, **audit})
        pairs = [(left, right) for left, right, _score in matches]
        matched_previous = [pair[0] for pair in pairs]
        matched_current = [pair[1] for pair in pairs]
        features: dict[str, float] = {}
        for party in PARTIES:
            current_shares = [item["shares"][party] for item in matched_current or current_booths]
            previous_shares = [item["shares"][party] for item in matched_previous] if matched_previous else [0.0]
            swings = [right["shares"][party] - left["shares"][party] for left, right in pairs] if pairs else [0.0]
            features[f"{party.lower()}_share_2022"] = mean(current_shares) if current_shares else 0.0
            features[f"{party.lower()}_share_2017"] = mean(previous_shares) if previous_shares else 0.0
            features[f"{party.lower()}_swing"] = mean(swings) if swings else 0.0
            features[f"{party.lower()}_swing_std"] = pstdev(swings) if len(swings) > 1 else 0.0
        current_turnout = matched_current or current_booths
        previous_turnout = matched_previous
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
            "booth_count_2022": float(len(current_booths)),
            "match_rate": len(matches) / max(len(current_booths), 1),
            "strong_booth_ratio": sum(item["classification"] == "strong" for item in current_booths) / max(len(current_booths), 1),
            "weak_booth_ratio": sum(item["classification"] == "weak" for item in current_booths) / max(len(current_booths), 1),
            "swing_booth_ratio": sum(item["classification"] == "swing" for item in current_booths) / max(len(current_booths), 1),
            "enp_2022": _enp([features[f"{party.lower()}_share_2022"] for party in PARTIES]),
            "enp_2017": _enp([features[f"{party.lower()}_share_2017"] for party in PARTIES]),
        })
        summary_2017 = _candidate_summary(previous) if previous else {"shares": {party: 0.0 for party in PARTIES}, "winner": "IPT", "margin": 0, "total": 0}
        summary_2022 = _candidate_summary(current)
        demographic = defaultdict(float)
        for item in current.demographics:
            demographic[f"demographic_{(item.category or 'unknown').lower()}_share"] = max(demographic[f"demographic_{(item.category or 'unknown').lower()}_share"], float(item.population_pct or item.support_pct or 0) / (100 if float(item.population_pct or item.support_pct or 0) > 1 else 1))
        features.update(demographic)
        feature_rows.append({
            "id": current.id,
            "code": current.code or current.name,
            "name": current.name,
            "district": current.district or "Unknown",
            "region": current.region or current.district or "Unknown",
            "constituency_type": current.constituency_type or "assembly",
            "is_urban": current.is_urban or "unknown",
            "features": features,
            "summary_2017": summary_2017,
            "summary_2022": summary_2022,
        })
    feature_names = sorted({name for row in feature_rows for name in row["features"]})
    return {"rows": feature_rows, "audits": audits, "feature_names": feature_names, "schema_version": "booth-features-v2"}
