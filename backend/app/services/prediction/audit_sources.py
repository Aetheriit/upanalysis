"""Read-only consistency audit of historical constituency/candidate results."""
import asyncio
import json
from collections import Counter
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import async_session
from app.models.candidate import Candidate
from app.models.constituency import Constituency
from app.models.election import Election
from app.services.prediction.feature_engine import _candidate_summary
from app.services.prediction.feature_engine import _clean


async def main():
    async with async_session() as db:
        rows = (await db.execute(select(Constituency, Election.year).join(Election)
                                .where(Election.year.in_((2017, 2022)))
                                .options(selectinload(Constituency.candidates).selectinload(Candidate.party)))).all()
        conflicts, counts, duplicates, missing = [], {}, [], []
        for seat, year in rows:
            summary = _candidate_summary(seat)
            counts.setdefault(year, Counter())[summary['actual_winner']] += 1
            identities = defaultdict(list)
            for candidate in seat.candidates:
                identities[(_clean(candidate.name), candidate.votes_received)].append(candidate)
            repeated = [group for group in identities.values() if len(group) > 1]
            if repeated:
                duplicates.append({'year': year, 'code': seat.code,
                                   'groups': [[{'name': c.name, 'party': c.party.abbreviation if c.party else None,
                                               'votes': c.votes_received, 'id': str(c.id)} for c in group] for group in repeated]})
            if not any(c.votes_received for c in seat.candidates):
                missing.append({'year': year, 'code': seat.code})
            if summary['actual_winner'] != seat.winner_party:
                conflicts.append({'year': year, 'code': seat.code, 'name': seat.name,
                                  'stored_winner': seat.winner_party, 'candidate_winner': summary['actual_winner'],
                                  'candidates': [{'name': c.name, 'party': c.party.abbreviation if c.party else None,
                                                  'votes': c.votes_received} for c in
                                                 sorted(seat.candidates, key=lambda c: c.votes_received or 0, reverse=True)[:4]]})
        print(json.dumps({'candidate_winner_counts': counts, 'conflicts': conflicts,
                          'duplicate_identities': duplicates, 'missing_candidate_results': missing}, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
