import os
import sys
import asyncio
import pandas as pd
from pathlib import Path

# Add the backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.future import select
from app.models.election import Election
from app.models.constituency import Constituency

async def update_data():
    print("Connecting to database...")
    db_url = "postgresql+asyncpg://postgres:postgres@db:5432/election_intel"
    engine = create_async_engine(db_url, echo=False)
    
    csv_path = Path("/app/up_2017_results.csv")
    if not csv_path.exists():
        print("CSV not found at /app/up_2017_results.csv")
        return
    
    df = pd.read_csv(csv_path)
    
    # Columns in the CSV:
    # District District,Constituency #,Constituency Name,Winner Candidate,Winner Party,Winner Party.1,Winner Votes,...
    
    async with AsyncSession(engine) as session:
        result = await session.execute(select(Election).filter_by(year=2017))
        election = result.scalars().first()
        
        if not election:
            print("2017 election not found")
            return
            
        result = await session.execute(select(Constituency).filter_by(election_id=election.id))
        constituencies = result.scalars().all()
        const_dict = {c.code: c for c in constituencies}
        
        updates = 0
        for _, row in df.iterrows():
            code = str(row.get("Constituency #", ""))
            district = str(row.get("District District", "")).strip()
            winner_party = str(row.get("Winner Party.1", "")).strip()
            
            if code in const_dict:
                c = const_dict[code]
                c.district = district
                
                # Winner party in the CSV is INC, BJP, SP, BSP etc.
                # In 2022 mock we use BJP, SP, BSP, INC, RLD. This is good!
                c.winner_party = winner_party
                session.add(c)
                updates += 1
                
        # Copy district to 2022 constituencies
        result = await session.execute(select(Constituency).filter(Constituency.election_id != election.id))
        other_consts = result.scalars().all()
        for oc in other_consts:
            if oc.code in const_dict:
                oc.district = const_dict[oc.code].district
                session.add(oc)
                
        await session.commit()
        print(f"Updated {updates} constituencies with District and Winner Party for 2017, and copied districts to 2022.")

if __name__ == "__main__":
    asyncio.run(update_data())
