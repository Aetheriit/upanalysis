import asyncio
import json
import os
import sys
import time
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.booth import Booth
from app.models.constituency import Constituency
from app.models.election import Election

async def patch_booths():
    print("Loading clean booth names...")
    json_path = 'backend/scripts/clean_booth_names_2022.json'
    if not os.path.exists(json_path):
        json_path = 'clean_booth_names_2022.json'
        if not os.path.exists(json_path):
            json_path = 'scratch/clean_booth_names_2022.json'
        
    with open(json_path, 'r', encoding='utf-8') as f:
        clean_names = json.load(f)

    db_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@db:5432/election_intel')
    print(f"Connecting to database {db_url}...")
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    t0 = time.time()
    total_updated = 0

    async with async_session() as session:
        res = await session.execute(select(Election).filter_by(year=2022))
        election = res.scalars().first()
        if not election:
            print("2022 election not found!")
            return

        res = await session.execute(select(Constituency).filter_by(election_id=election.id))
        constituencies = res.scalars().all()
        print(f"Found {len(constituencies)} constituencies for 2022.")

        for c in constituencies:
            c_code = str(c.code).strip()
            if c_code not in clean_names:
                continue

            booth_dict = clean_names[c_code]
            b_res = await session.execute(select(Booth).filter_by(constituency_id=c.id))
            booths = b_res.scalars().all()

            updated_in_ac = 0
            for b in booths:
                b_num = str(b.booth_number).strip()
                if b_num in booth_dict:
                    new_name = booth_dict[b_num]
                    if b.booth_name != new_name:
                        b.booth_name = new_name
                        updated_in_ac += 1
                        total_updated += 1

            if updated_in_ac > 0:
                await session.commit()
                print(f"AC {c_code} ({c.name}): Updated {updated_in_ac} booth names.")

    print(f"\nALL DONE! Updated {total_updated} booth names in {time.time()-t0:.2f}s.")

if __name__ == '__main__':
    asyncio.run(patch_booths())
