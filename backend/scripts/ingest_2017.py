import os
import sys
import json
import asyncio
import pandas as pd
from pathlib import Path

# Add the backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import Base
from app.models.project import Project
from app.models.election import Election
from app.models.constituency import Constituency
from app.models.booth import Booth, VoteRecord
from app.models.candidate import Candidate
from app.models.party import Party

DATA_DIR = Path("/2017 data") if Path("/2017 data").exists() else Path("../../2017 data")
EXCEL_DIR = DATA_DIR / "excel_outputs"
CONSTITUENCIES_JSON = DATA_DIR / "constituencies.json"

async def ingest():
    print("Connecting to database...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)

    with open(CONSTITUENCIES_JSON, "r", encoding="utf-8") as f:
        constituencies_map = json.load(f)

    async with async_session() as session:
        # Create Project
        result = await session.execute(select(Project).filter_by(name="UP Elections"))
        project = result.scalars().first()
        if not project:
            project = Project(name="UP Elections", description="Uttar Pradesh Election Intelligence")
            session.add(project)
            await session.flush()
        
        # Create Election
        result = await session.execute(select(Election).filter_by(name="UP Assembly 2017"))
        election = result.scalars().first()
        if not election:
            election = Election(
                project_id=project.id,
                name="UP Assembly 2017",
                year=2017,
                election_type="assembly",
                state="Uttar Pradesh",
                total_constituencies=403
            )
            session.add(election)
            await session.flush()

        for ac_num in range(1, 404):
            ac_name = constituencies_map.get(str(ac_num), f"AC {ac_num}")
            excel_path = EXCEL_DIR / f"{ac_num}_boothwise_data.xlsx"
            
            if not excel_path.exists():
                print(f"Skipping AC {ac_num}, file not found.")
                continue

            print(f"Processing AC {ac_num}: {ac_name}")
            
            # Read excel, skip first two rows (header is in 3rd row)
            df = pd.read_excel(excel_path, header=2)
            
            # Identify columns
            cols = list(df.columns)
            if 'NOTA' not in cols or 'BOOTH ID' not in cols:
                print(f"Unexpected format in AC {ac_num}. Skipping.")
                continue
            
            nota_idx = cols.index('NOTA')
            candidate_names = cols[10:nota_idx]
            
            # Create Constituency
            result = await session.execute(select(Constituency).filter_by(election_id=election.id, code=str(ac_num)))
            constituency = result.scalars().first()
            if not constituency:
                constituency = Constituency(
                    election_id=election.id,
                    name=ac_name,
                    code=str(ac_num),
                    state="Uttar Pradesh",
                    constituency_type="assembly"
                )
                session.add(constituency)
                await session.flush()

            # Create Candidates
            cand_objects = {}
            for cand_name in candidate_names:
                result = await session.execute(select(Candidate).filter_by(constituency_id=constituency.id, name=str(cand_name)))
                cand = result.scalars().first()
                if not cand:
                    cand = Candidate(
                        constituency_id=constituency.id,
                        election_id=election.id,
                        name=str(cand_name)
                    )
                    session.add(cand)
                    await session.flush()
                cand_objects[cand_name] = cand

            # Add NOTA as candidate
            result = await session.execute(select(Candidate).filter_by(constituency_id=constituency.id, name="NOTA"))
            nota_cand = result.scalars().first()
            if not nota_cand:
                nota_cand = Candidate(constituency_id=constituency.id, election_id=election.id, name="NOTA")
                session.add(nota_cand)
                await session.flush()
            cand_objects["NOTA"] = nota_cand

            booth_count = 0
            for idx, row in df.iterrows():
                booth_id_val = row.get('BOOTH ID')
                if pd.isna(booth_id_val) or "Total" in str(booth_id_val):
                    continue 
                
                booth_count += 1
                try:
                    total_electors = int(row.get('TOTAL ELECTORS', 0))
                except:
                    total_electors = 0
                    
                try:
                    total_votes = int(row.get('TOTAL VOTES POLLED', 0))
                except:
                    total_votes = 0

                turnout = 0.0
                if total_electors > 0:
                    turnout = (total_votes / total_electors) * 100

                booth_name_raw = str(row.get('POLLING STATION NAME', ''))
                if len(booth_name_raw) > 250:
                    booth_name_raw = booth_name_raw[:250]

                booth = Booth(
                    constituency_id=constituency.id,
                    booth_number=str(booth_id_val),
                    booth_name=booth_name_raw,
                    total_electors=total_electors,
                    male_electors=int(row.get('MALE VOTERS', 0)) if not pd.isna(row.get('MALE VOTERS')) else 0,
                    female_electors=int(row.get('FEMALE VOTERS', 0)) if not pd.isna(row.get('FEMALE VOTERS')) else 0,
                    total_votes_polled=total_votes,
                    turnout_pct=turnout,
                    nota_votes=int(row.get('NOTA', 0)) if not pd.isna(row.get('NOTA')) else 0
                )
                session.add(booth)
                await session.flush()

                # Vote records
                for c_name in candidate_names + ['NOTA']:
                    votes = row.get(c_name, 0)
                    if pd.isna(votes):
                        votes = 0
                    else:
                        votes = int(votes)
                    
                    share = (votes / total_votes * 100) if total_votes > 0 else 0.0
                    
                    vr = VoteRecord(
                        booth_id=booth.id,
                        candidate_id=cand_objects[c_name].id,
                        votes=votes,
                        vote_share_pct=share
                    )
                    session.add(vr)

            await session.commit()
            print(f"Added {booth_count} booths for AC {ac_num}.")

    print("Data ingestion complete!")

if __name__ == "__main__":
    asyncio.run(ingest())
