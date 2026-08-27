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
from sqlalchemy import delete

from app.core.config import settings
from app.core.database import Base, database_url
from app.models.project import Project
from app.models.election import Election
from app.models.constituency import Constituency
from app.models.booth import Booth, VoteRecord
from app.models.candidate import Candidate

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path("/2022 data") if Path("/2022 data").exists() else PROJECT_ROOT / "2022 data"
EXCEL_DIR = DATA_DIR / "excel_outputs"
CONSTITUENCIES_JSON = Path("/2017 data/constituencies.json") if Path("/2017 data").exists() else PROJECT_ROOT / "2017 data" / "constituencies.json"

async def ingest():
    print("Connecting to database...")
    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Create Project
        result = await session.execute(select(Project).filter_by(name="UP Elections"))
        project = result.scalars().first()
        if not project:
            project = Project(name="UP Elections", description="Uttar Pradesh Election Intelligence")
            session.add(project)
            await session.flush()
        
        # Check Election
        result = await session.execute(select(Election).filter_by(name="UP Assembly 2022"))
        election = result.scalars().first()
        if election:
            print("Election already exists! Clearing old data for 2022 to avoid duplicates...")
            # We must delete in order: VoteRecord, Booth, Candidate, Constituency
            await session.execute(delete(VoteRecord).where(VoteRecord.candidate_id.in_(
                select(Candidate.id).where(Candidate.election_id == election.id)
            )))
            await session.execute(delete(Booth).where(Booth.constituency_id.in_(
                select(Constituency.id).where(Constituency.election_id == election.id)
            )))
            await session.execute(delete(Candidate).where(Candidate.election_id == election.id))
            await session.execute(delete(Constituency).where(Constituency.election_id == election.id))
            await session.commit()
            print("Old data cleared.")
        else:
            election = Election(
                project_id=project.id,
                name="UP Assembly 2022",
                year=2022,
                election_type="assembly",
                state="Uttar Pradesh",
                total_constituencies=403
            )
            session.add(election)
            await session.commit()

        with open(CONSTITUENCIES_JSON, "r", encoding="utf-8") as f:
            constituencies_map = json.load(f)

        for ac_num in range(1, 404):
            ac_name = constituencies_map.get(str(ac_num), f"AC {ac_num}")
            excel_path = EXCEL_DIR / f"{ac_num}_boothwise_data.xlsx"
            
            if not excel_path.exists():
                print(f"Skipping AC {ac_num}, file not found.")
                continue

            print(f"Processing AC {ac_num}: {ac_name}")
            df = pd.read_excel(excel_path)
            cols = list(df.columns)
            
            if 'Unnamed: 1' in cols and len(df) > 0:
                df = pd.read_excel(excel_path, header=1)
                cols = list(df.columns)

            # Unify column names
            if 'Booth No.' not in cols and 'BOOTH ID' in cols:
                df.rename(columns={'BOOTH ID': 'Booth No.', 'POLLING STATION NAME': 'Polling Station Name'}, inplace=True)
                cols = list(df.columns)
                
            start_cand_idx = 2
            if 'TENDERED VOTERS' in cols:
                start_cand_idx = cols.index('TENDERED VOTERS') + 1

            try:
                end_cand_idx = cols.index('TOTAL VOTES')
            except ValueError:
                try:
                    end_cand_idx = cols.index('TOTAL VOTES POLLED')
                except ValueError:
                    print(f"Cannot find TOTAL VOTES in AC {ac_num}")
                    continue
            
            candidate_names = cols[start_cand_idx:end_cand_idx]
            # Remove NOTA from candidate list if it's there
            candidate_names = [c for c in candidate_names if 'NOTA' not in str(c).upper() and 'TOTAL' not in str(c).upper()]
            
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
                        name=str(cand_name)[:255]
                    )
                    session.add(cand)
                    await session.flush()
                cand_objects[cand_name] = cand

            # Add NOTA
            result = await session.execute(select(Candidate).filter_by(constituency_id=constituency.id, name="NOTA"))
            nota_cand = result.scalars().first()
            if not nota_cand:
                nota_cand = Candidate(constituency_id=constituency.id, election_id=election.id, name="NOTA")
                session.add(nota_cand)
                await session.flush()
            cand_objects["NOTA"] = nota_cand

            booth_count = 0
            for idx, row in df.iterrows():
                booth_id_val = row.get('Booth No.')
                if pd.isna(booth_id_val) or "Total" in str(booth_id_val):
                    continue 
                
                booth_count += 1
                try:
                    total_votes = int(row.get('TOTAL VOTES', row.get('TOTAL VOTES POLLED', 0)))
                except:
                    total_votes = 0

                booth_name_raw = str(row.get('Polling Station Name', ''))
                if len(booth_name_raw) > 250:
                    booth_name_raw = booth_name_raw[:250]

                nota_votes = 0
                if 'NOTA' in cols:
                    try:
                        nota_votes = int(row.get('NOTA', 0))
                    except:
                        pass

                booth = Booth(
                    constituency_id=constituency.id,
                    booth_number=str(booth_id_val),
                    booth_name=booth_name_raw,
                    total_electors=0,
                    male_electors=0,
                    female_electors=0,
                    total_votes_polled=total_votes,
                    turnout_pct=0.0,
                    nota_votes=nota_votes
                )
                session.add(booth)
                await session.flush()

                # Vote records
                for c_name in candidate_names + ['NOTA']:
                    if c_name == 'NOTA' and c_name not in cols:
                        votes = nota_votes
                    else:
                        votes = row.get(c_name, 0)
                        
                    if pd.isna(votes):
                        votes = 0
                    else:
                        try:
                            votes = int(votes)
                        except:
                            votes = 0
                    
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
