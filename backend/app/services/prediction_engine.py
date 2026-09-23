"""Constituency-level 2027 prediction engine.

The local engine is deliberately deterministic and transparent. It uses the
latest available constituency results as a baseline and adds a restrained
historical momentum adjustment when 2017 data is available. A configured
external model can replace this payload at the client boundary without
changing the UI contract.
"""
from __future__ import annotations

import math
import random
import re
from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.candidate import Candidate
from app.models.constituency import Constituency
from app.models.election import Election

PARTIES = ("BJP", "SP", "BSP", "RLD", "INC", "IPT")


def normalize_party(value: str | None) -> str:
    party = (value or "IPT").upper().strip()
    if party in PARTIES:
        return party
    if party in {"IND", "INDEPENDENT", "OTHERS", "OTHER", "NOTA"}:
        return "IPT"
    if "AD(S" in party or "APNA DAL" in party or "NISHAD" in party:
        return "BJP"
    if "SBSP" in party or "SUHELDEV" in party or "MAHAN DAL" in party or "PSPL" in party:
        return "SP"
    return "IPT"


def _key(name: str | None) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().upper())


def _candidate_party(candidate: Candidate, fallback: str | None = None) -> str:
    return normalize_party(candidate.party.abbreviation if candidate.party else fallback)


def _snapshot(constituency: Constituency) -> dict[str, Any]:
    excluded = {"NOTA", "TOTAL VOTES", "TOTAL VOTES POLLED"}
    candidates = [
        candidate for candidate in constituency.candidates
        if (candidate.name or "").strip().upper() not in excluded
    ]
    candidates.sort(key=lambda candidate: candidate.votes_received or 0, reverse=True)
    total_votes = sum(max(0, candidate.votes_received or 0) for candidate in candidates)
    shares: dict[str, float] = defaultdict(float)
    for candidate in candidates:
        shares[_candidate_party(candidate, constituency.winner_party)] += max(0, candidate.votes_received or 0)
    if total_votes:
        shares = defaultdict(float, {party: value / total_votes for party, value in shares.items()})
    ordered = sorted(shares.items(), key=lambda item: item[1], reverse=True)
    winner = ordered[0][0] if ordered else normalize_party(constituency.winner_party)
    runner = ordered[1][0] if len(ordered) > 1 else "IPT"
    winner_share = ordered[0][1] if ordered else 0.0
    runner_share = ordered[1][1] if len(ordered) > 1 else 0.0
    return {
        "code": constituency.code or "",
        "name": constituency.name,
        "district": constituency.district or "Unknown",
        "region": constituency.region or constituency.district or "Unknown",
        "winner": winner,
        "winner_share": winner_share,
        "runner": runner,
        "runner_share": runner_share,
        "margin": max(0, int(constituency.winning_margin or 0)),
        "total_votes": total_votes or int(constituency.valid_votes or constituency.total_votes_polled or 0),
        "shares": dict(shares),
    }


def _forecast(snapshot: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    scores = {party: float(snapshot["shares"].get(party, 0.0)) for party in PARTIES}
    if previous:
        for party in PARTIES:
            scores[party] += 0.18 * (scores[party] - float(previous["shares"].get(party, 0.0)))
    # A small uncertainty penalty for the incumbent winner makes close seats
    # contestable while preserving the observed baseline in safe seats.
    scores[snapshot["winner"]] -= min(0.025, 3000 / max(snapshot["total_votes"], 1))
    total = sum(max(value, 0.0001) for value in scores.values())
    probabilities = {party: max(scores[party], 0.0001) / total for party in PARTIES}
    predicted = max(PARTIES, key=lambda party: probabilities[party])
    predicted_share = probabilities[predicted]
    second_share = sorted(probabilities.values(), reverse=True)[1]
    margin = round(abs(predicted_share - second_share) * max(snapshot["total_votes"], 1))
    return {
        **snapshot,
        "predicted_party": predicted,
        "predicted_margin": margin,
        "predicted_vote_share": round(predicted_share * 100, 2),
        "probabilities": {party: round(value, 6) for party, value in probabilities.items()},
        "confidence": round(max(probabilities.values()) * 100, 1),
        "change": "No Change" if snapshot["winner"] == predicted else f"{snapshot['winner']} to {predicted}",
        "is_flip": snapshot["winner"] != predicted,
    }


async def build_predictions(db: AsyncSession) -> list[dict[str, Any]]:
    query = (
        select(Constituency, Election.year)
        .join(Election)
        .where(Election.year.in_([2017, 2022]))
        .options(selectinload(Constituency.candidates).selectinload(Candidate.party))
    )
    rows = (await db.execute(query)).all()
    by_key: dict[str, dict[int, dict[str, Any]]] = defaultdict(dict)
    for constituency, year in rows:
        item = _snapshot(constituency)
        by_key[_key(constituency.name)][year] = item

    predictions = []
    for years in by_key.values():
        if 2022 not in years:
            continue
        predictions.append(_forecast(years[2022], years.get(2017)))
    predictions.sort(key=lambda row: int(re.sub(r"\D", "", row["code"]) or "9999"))
    return predictions


def statewide_summary(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    seats = {party: sum(row["predicted_party"] == party for row in predictions) for party in PARTIES}
    # Deterministic seat bands communicate uncertainty without pretending that
    # the fallback baseline is a calibrated probability model.
    bands = {
        party: {"predicted": seats[party], "low": max(0, seats[party] - 8), "high": min(len(predictions), seats[party] + 8)}
        for party in PARTIES
    }
    return {
        "parties": [{"party": party, **bands[party]} for party in PARTIES],
        "total_seats": len(predictions),
        "majority": math.floor(len(predictions) / 2) + 1,
        "model": "Local historical baseline",
        "model_version": "local-v1",
        "quality": "baseline",
    }
