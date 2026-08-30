import sys
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.models.constituency import Constituency
from app.models.booth import Booth, VoteRecord
from app.models.candidate import Candidate
from app.models.election import Election

async def update_aggregates():
    print("Connecting to database...")
    # Fix the DB URL just in case
    db_url = "postgresql+asyncpg://postgres:postgres@db:5432/election_intel"
    engine = create_async_engine(db_url, echo=False)
    
    async with AsyncSession(engine) as session:
        # Process all elections
        result = await session.execute(select(Election))
        elections = result.scalars().all()
        
        for election in elections:
            print(f"Processing Election {election.year}...")
            
            result = await session.execute(select(Constituency).filter_by(election_id=election.id))
            constituencies = result.scalars().all()
            
            for c in constituencies:
                print(f"Processing {c.name} ({c.code})...")
                # Do not overwrite total_electors, total_votes_polled, or turnout_pct 
                # using booth data, because booth data may be missing (e.g. 2022) 
                # or incomplete, leading to corrupted constituency totals (e.g. 0% or >100% turnout).
                # These fields are populated from the source-of-truth CSVs directly.
                
                # Compute candidate votes
                cand_res = await session.execute(
                    select(
                        Candidate.id,
                        Candidate.name,
                        func.sum(VoteRecord.votes).label('total_votes')
                    )
                    .join(VoteRecord, VoteRecord.candidate_id == Candidate.id)
                    .filter(Candidate.constituency_id == c.id)
                    .group_by(Candidate.id)
                    .order_by(func.sum(VoteRecord.votes).desc())
                )
                candidates = cand_res.all()
                
                if len(candidates) > 0:
                    # Find winner (exclude NOTA)
                    valid_cands = [cand for cand in candidates if cand.name != 'NOTA']
                    if valid_cands:
                        c.winner_name = valid_cands[0].name
                        # Only set to Unknown if not already set by other scripts
                        if not c.winner_party:
                            c.winner_party = "Unknown"  
                        if len(valid_cands) > 1:
                            c.winning_margin = valid_cands[0].total_votes - valid_cands[1].total_votes
                        else:
                            c.winning_margin = valid_cands[0].total_votes
                            
                session.add(c)
            
        await session.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(update_aggregates())
