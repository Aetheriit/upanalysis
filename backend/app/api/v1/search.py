from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, String
from typing import Optional

from app.core.database import get_db
from app.models.constituency import Constituency
from app.models.candidate import Candidate
from app.models.party import Party

router = APIRouter()

@router.get("/")
async def search(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db)
):
    """Global search across constituencies, districts, and candidates."""
    search_term = f"%{q}%"
    
    # Search constituencies
    const_query = select(Constituency).filter(
        or_(
            Constituency.name.ilike(search_term),
            Constituency.district.ilike(search_term)
        )
    ).limit(10)
    
    const_result = await db.execute(const_query)
    constituencies = const_result.scalars().all()
    
    # Unique districts from constituencies that match the term
    # It's easier to just pick them from constituencies table
    district_query = select(Constituency.district).filter(
        Constituency.district.ilike(search_term)
    ).distinct().limit(5)
    
    district_result = await db.execute(district_query)
    districts = [d for d in district_result.scalars().all() if d]
    
    # Search candidates
    # Wait, the database for Candidates might be populated or empty.
    # Let's search if candidates exist
    cand_query = select(Candidate).filter(
        Candidate.name.ilike(search_term)
    ).limit(10)
    
    cand_result = await db.execute(cand_query)
    candidates = cand_result.scalars().all()
    
    return {
        "constituencies": [
            {
                "id": str(c.id),
                "name": c.name,
                "district": c.district,
                "type": "constituency"
            }
            for c in constituencies
        ],
        "districts": [
            {
                "name": d,
                "type": "district"
            }
            for d in districts
        ],
        "candidates": [
            {
                "id": str(c.id),
                "name": c.name,
                "type": "candidate"
            }
            for c in candidates
        ]
    }
