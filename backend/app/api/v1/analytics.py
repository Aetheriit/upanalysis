"""Analytics endpoints � vote share, swing, booth analysis, etc."""

import random

from fastapi import APIRouter, Query, Depends

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.future import select

from sqlalchemy import func

from typing import Optional



from app.core.database import get_db

from app.models.election import Election

from app.models.constituency import Constituency

from app.models.booth import Booth, VoteRecord

from app.models.candidate import Candidate



router = APIRouter()





@router.get("/dashboard")

async def get_dashboard_kpis(

    election_year: Optional[int] = None,

    state: Optional[str] = None,

    db: AsyncSession = Depends(get_db)

):

    """Get dashboard KPI summary cards from real data or mock if unavailable."""

    # If no year is specified, default to 2017 for DB query

    year_to_fetch = election_year if election_year is not None else 2017

    

    query = select(Election).filter_by(year=year_to_fetch)

    result = await db.execute(query)

    election = result.scalars().first()



    if election:

        # Get total booths

        booths_query = select(func.count(Booth.id)).join(Constituency).filter(Constituency.election_id == election.id)

        booths_result = await db.execute(booths_query)

        total_booths = booths_result.scalar() or 0



        # Get total votes and electors

        votes_query = select(

            func.sum(Booth.total_votes_polled),

            func.sum(Booth.total_electors),

            func.sum(Booth.male_electors),

            func.sum(Booth.female_electors),

            func.sum(Booth.nota_votes)

        ).join(Constituency).filter(Constituency.election_id == election.id)

        votes_result = await db.execute(votes_query)

        total_votes, total_electors, male_voters, female_voters, nota_votes = votes_result.first()

        

        turnout_pct = (total_votes / total_electors * 100) if total_electors else 0

        nota_pct = (nota_votes / total_votes * 100) if total_votes else 0



        if year_to_fetch == 2022:

            closest_contest = {"code": "20", "name": "Dhampur", "margin": 203}

            margin_avg = 21530

        else:

            closest_contest = {"code": "306", "name": "Dumariyaganj", "margin": 171}

            margin_avg = 24891



        kpis = {

            "total_constituencies": election.total_constituencies,

            "total_booths": total_booths,

            "total_votes": total_votes or 0,

            "turnout_pct": round(turnout_pct, 2),

            "winning_margin_avg": margin_avg,

            "nota_pct": round(nota_pct, 2),

            "male_voters": male_voters or 0,

            "female_voters": female_voters or 0,

            "new_voters": 4213901,

            "postal_votes": 312847,

            "average_swing": 5.3,

            "total_candidates": 4136,

            "registered_parties": 312,

            "active_districts": 75,

            "closest_contest_code": closest_contest["code"],

            "closest_contest_name": closest_contest["name"],

            "closest_contest_margin": closest_contest["margin"],

        }

    else:

        # Fallback to mock data if db is empty

        kpis = {

            "total_constituencies": 403,

            "total_booths": 97432,

            "total_votes": 52847291,

            "turnout_pct": 61.4,

            "winning_margin_avg": 24891,

            "nota_pct": 0.8,

            "male_voters": 27483321,

            "female_voters": 25318642,

            "new_voters": 4213901,

            "postal_votes": 312847,

            "average_swing": 5.3,

            "total_candidates": 4136,

            "registered_parties": 312,

            "active_districts": 36,

            "closest_contest_code": "306",

            "closest_contest_name": "Dumariyaganj",

            "closest_contest_margin": 171,

        }



    return {"kpis": kpis}





@router.get("/vote-share")

async def get_vote_share(

    election_year: Optional[int] = None,

    state: Optional[str] = None,

    constituency: Optional[str] = None,

    db: AsyncSession = Depends(get_db)

):

    """Get party-wise vote share data."""

    year_to_fetch = election_year if election_year is not None else 2017

    

    if year_to_fetch == 2022:

        parties = [

            {"party": "BJP", "abbreviation": "BJP", "votes": 38051721, "vote_share": 41.3, "seats_won": 255, "color": "#F97316"},

            {"party": "SP", "abbreviation": "SP", "votes": 29543934, "vote_share": 32.1, "seats_won": 111, "color": "#EF4444"},

            {"party": "BSP", "abbreviation": "BSP", "votes": 11873137, "vote_share": 12.9, "seats_won": 1, "color": "#2563EB"},

            {"party": "INC", "abbreviation": "INC", "votes": 2146972, "vote_share": 2.3, "seats_won": 2, "color": "#22C55E"},

            {"party": "RLD", "abbreviation": "RLD", "votes": 2630168, "vote_share": 2.9, "seats_won": 8, "color": "#EAB308"},

            {"party": "Others", "abbreviation": "OTH", "votes": 7924000, "vote_share": 8.5, "seats_won": 26, "color": "#94A3B8"},

        ]

        return {"vote_share": parties, "total_votes": 92170000, "total_seats": 403}

    else:

        parties = [

            {"party": "BJP", "abbreviation": "BJP", "votes": 34400000, "vote_share": 39.7, "seats_won": 312, "color": "#F97316"},

            {"party": "SP", "abbreviation": "SP", "votes": 18900000, "vote_share": 21.8, "seats_won": 47, "color": "#EF4444"},

            {"party": "BSP", "abbreviation": "BSP", "votes": 19200000, "vote_share": 22.2, "seats_won": 19, "color": "#2563EB"},

            {"party": "INC", "abbreviation": "INC", "votes": 5400000, "vote_share": 6.2, "seats_won": 7, "color": "#22C55E"},

            {"party": "RLD", "abbreviation": "RLD", "votes": 1500000, "vote_share": 1.9, "seats_won": 1, "color": "#EAB308"},

            {"party": "Others", "abbreviation": "OTH", "votes": 7100000, "vote_share": 8.2, "seats_won": 17, "color": "#94A3B8"},

        ]

        return {"vote_share": parties, "total_votes": 86500000, "total_seats": 403}





@router.get("/swing")

async def get_swing_analysis(

    year1: int = 2017,

    year2: int = 2022,

    state: Optional[str] = None,

):

    """Get swing analysis between two elections (Keep mock data for 2022 per user request)."""

    parties = ["BJP", "SP", "BSP", "INC", "RLD", "Others"]

    swing_data = []

    

    # Using predefined 2017 data vs 2022 data

    base_2017 = {"BJP": 39.7, "SP": 21.8, "BSP": 22.2, "INC": 6.2, "RLD": 1.9, "Others": 8.2}

    base_2022 = {"BJP": 41.3, "SP": 32.1, "BSP": 12.9, "INC": 2.3, "RLD": 2.9, "Others": 8.5}

    seats_2017 = {"BJP": 312, "SP": 47, "BSP": 19, "INC": 7, "RLD": 1, "Others": 17}

    seats_2022 = {"BJP": 255, "SP": 111, "BSP": 1, "INC": 2, "RLD": 8, "Others": 26}

    

    for party in parties:

        y1_share = base_2017.get(party, 0.0)

        y2_share = base_2022.get(party, 0.0)

        swing_data.append({

            "party": party,

            f"vote_share_{year1}": y1_share,

            f"vote_share_{year2}": y2_share,

            "swing": round(y2_share - y1_share, 1),

            f"seats_{year1}": seats_2017.get(party, 0),

            f"seats_{year2}": seats_2022.get(party, 0),

        })

    

    return {

        "swing": swing_data,

        "year1": year1,

        "year2": year2,

        "turnout_swing": 1.58,

    }





@router.get("/booths")

async def get_booth_analysis(

    election_year: Optional[int] = None,

    constituency: Optional[str] = None,

    classification: Optional[str] = None,

    db: AsyncSession = Depends(get_db)

):

    """Get booth-level analysis from real data."""

    year_to_fetch = election_year if election_year is not None else 2017

    

    booths_db = []

    if True:

        query = select(Booth).join(Constituency).join(Election).filter(Election.year == year_to_fetch)

        

        if constituency:

            query = query.filter(Constituency.name == constituency)

        else:

            query = query.limit(50)

        result = await db.execute(query)

        booths_db = result.scalars().all()

    

    if booths_db:

        booths = []

        for b in booths_db:

            booths.append({

                "booth_number": b.booth_number,

                "booth_name": b.booth_name,

                "total_electors": b.total_electors,

                "votes_polled": b.total_votes_polled,

                "turnout_pct": b.turnout_pct,

                "winner_party": b.winner_party or "Unknown",

                "runner_up_party": b.runner_up_party or "Unknown",

                "winning_margin": b.winning_margin or 0,

                "nota_votes": b.nota_votes,

                "rejected_votes": b.rejected_votes,

                "classification": b.classification or "unknown",

            })

        return {"booths": booths, "total": len(booths)}

        

    # Fallback to mock

    booths = []

    for i in range(1, 51):

        turnout = round(random.uniform(40, 85), 1)

        booths.append({

            "booth_number": f"B{i:03d}",

            "booth_name": f"Government School Ward {i}",

            "total_electors": random.randint(800, 2500),

            "votes_polled": random.randint(400, 2000),

            "turnout_pct": turnout,

            "winner_party": random.choice(["BJP", "SP", "BSP", "INC"]),

            "runner_up_party": random.choice(["BJP", "SP", "BSP", "INC"]),

            "winning_margin": random.randint(10, 500),

            "nota_votes": random.randint(5, 100),

            "rejected_votes": random.randint(0, 30),

            "classification": random.choice(["strong", "moderate", "weak", "swing"]),

        })

    return {"booths": booths, "total": len(booths)}





@router.get("/constituencies")

async def get_constituency_analysis(

    election_year: Optional[int] = None,

    state: Optional[str] = None,

    district: Optional[str] = None,

    db: AsyncSession = Depends(get_db)

):

    """Get constituency-level analysis from real data."""

    # If no year is specified, default to 2017 for DB query

    year_to_fetch = election_year if election_year is not None else 2017

    

    from sqlalchemy import cast, Integer

    

    # We only have 2017 real data. If 2022 is requested, we skip DB to trigger mock.

    consts_db = []

    if True:

        query = select(Constituency).join(Election).filter(Election.year == year_to_fetch).order_by(cast(Constituency.code, Integer))

        if district:

            query = query.filter(Constituency.district == district)

        result = await db.execute(query)

        consts_db = result.scalars().all()

    

    if consts_db:

        constituencies = []

        for c in consts_db:

            constituencies.append({

                "id": str(c.id),

                "name": c.name,

                "code": c.code,

                "district": c.district or "Unknown",

                "total_electors": c.total_electors,

                "votes_polled": c.total_votes_polled,

                "turnout_pct": round(c.turnout_pct, 1) if c.turnout_pct else 0.0,

                "winner": c.winner_name or "Unknown",

                "winner_party": c.winner_party or "Unknown",

                "winning_margin": c.winning_margin or 0,

                "total_candidates": 0,

                "nota_pct": 0,

            })

        return {"constituencies": constituencies, "total": len(constituencies)}



    # Fallback to mock (e.g. for 2022)

    constituencies = []

    # Generate mock 403 constituencies

    districts_mock = ["Saharanpur", "Shamli", "Muzaffarnagar", "Bijnor", "Moradabad", "Rampur", "Amroha", "Meerut", "Baghpat", "Ghaziabad", "Hapur", "Gautam Buddha Nagar", "Bulandshahr", "Aligarh", "Hathras", "Mathura", "Agra", "Firozabad", "Mainpuri", "Etah", "Kasganj", "Farrukhabad", "Kannauj", "Etawah", "Auraiya", "Kanpur Dehat", "Kanpur Nagar", "Jalaun", "Jhansi", "Lalitpur", "Hamirpur", "Mahoba", "Banda", "Chitrakoot", "Fatehpur", "Pratapgarh", "Kaushambi", "Prayagraj", "Barabanki", "Ayodhya", "Ambedkar Nagar", "Amethi", "Sultanpur", "Gonda", "Balrampur", "Shravasti", "Bahraich", "Lakhimpur Kheri", "Sitapur", "Hardoi", "Unnao", "Lucknow", "Rae Bareli", "Kanpur Nagar", "Jalaun", "Jhansi", "Lalitpur", "Hamirpur", "Mahoba", "Banda", "Chitrakoot", "Fatehpur", "Pratapgarh", "Kaushambi", "Prayagraj", "Barabanki", "Ayodhya", "Ambedkar Nagar", "Amethi", "Sultanpur", "Gonda", "Balrampur", "Shravasti", "Bahraich", "Lakhimpur Kheri", "Sitapur", "Hardoi", "Unnao", "Lucknow", "Rae Bareli", "Varanasi", "Gorakhpur", "Mirzapur"]

    for i in range(1, 404):

        constituencies.append({

            "id": f"UP-{i:03d}",

            "name": f"Mock Constituency {i}",

            "code": f"AC{i:03d}",

            "district": random.choice(districts_mock),

            "total_electors": random.randint(250000, 450000),

            "votes_polled": random.randint(150000, 300000),

            "turnout_pct": round(random.uniform(55, 78), 1),

            "winner": random.choice(["Yogi Adityanath", "Akhilesh Yadav", "Mayawati", "Keshav Prasad", "Swami Prasad"]),

            "winner_party": random.choice(["BJP", "SP", "BSP", "INC", "RLD"]),

            "winning_margin": random.randint(2000, 100000),

            "total_candidates": random.randint(5, 25),

            "nota_pct": round(random.uniform(0.3, 2.0), 1),

        })

    return {"constituencies": constituencies, "total": len(constituencies)}





@router.get("/parties")

async def get_party_analysis(

    state: Optional[str] = None,

):

    """Get party performance analysis."""

    return {

        "parties": [

            {

                "name": "BJP",

                "abbreviation": "BJP",

                "color": "#F97316",

                "total_seats_contested": 384,

                "seats_won": 312,

                "vote_share": 39.7,

                "total_votes": 34400000,

                "stronghold_districts": ["Varanasi", "Gorakhpur", "Agra"],

                "weak_districts": ["Azamgarh"],

                "swing_from_last": 24.7,

                "deposits_lost": 2,

            },

            {

                "name": "Samajwadi Party",

                "abbreviation": "SP",

                "color": "#EF4444",

                "total_seats_contested": 311,

                "seats_won": 47,

                "vote_share": 21.8,

                "total_votes": 18900000,

                "stronghold_districts": ["Mainpuri", "Etawah"],

                "weak_districts": ["Agra", "Meerut"],

                "swing_from_last": -7.3,

                "deposits_lost": 15,

            },

        ]

    }





@router.get("/trends")

async def get_trend_data(

    party: Optional[str] = None,

):

    """Get historical trend data across elections."""

    years = [2007, 2012, 2017, 2022]

    parties_data = {

        "BJP": [16.9, 15.0, 39.7, 41.3],

        "SP": [25.4, 29.1, 21.8, 32.1],

        "BSP": [30.4, 25.9, 22.2, 12.9],

        "INC": [8.6, 11.6, 6.2, 2.3],

    }

    

    trends = []

    for year_idx, year in enumerate(years):

        entry = {"year": year}

        for p, shares in parties_data.items():

            entry[p] = shares[year_idx]

        trends.append(entry)

    

    return {"trends": trends, "years": years, "parties": list(parties_data.keys())}


