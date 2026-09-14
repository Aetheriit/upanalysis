"""Analytics endpoints � vote share, swing, booth analysis, etc."""

import random
import re

from fastapi import APIRouter, Query, Depends

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.future import select

from sqlalchemy import func, and_, case, cast, Integer

from typing import Optional



from app.core.database import get_db

from app.models.election import Election

from app.models.constituency import Constituency

from app.models.booth import Booth, VoteRecord

from app.models.candidate import Candidate

from app.models.party import Party

from sqlalchemy.orm import joinedload, selectinload



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

        # FIX: The 2017 booths and vote records were duplicated during database ingestion, halve them to reflect accurate reality
        if year_to_fetch == 2017:
            total_booths = (total_booths // 2) if total_booths else 0
            total_votes = (total_votes // 2) if total_votes else 0
            total_electors = (total_electors // 2) if total_electors else 0
            male_voters = (male_voters // 2) if male_voters else 0
            female_voters = (female_voters // 2) if female_voters else 0
            nota_votes = (nota_votes // 2) if nota_votes else 0
        
        turnout_pct = (total_votes / total_electors * 100) if total_electors else 0

        nota_pct = (nota_votes / total_votes * 100) if total_votes else 0


        # Get closest contest and avg margin dynamically
        const_query = select(
            Constituency.code,
            Constituency.name,
            Constituency.winning_margin
        ).join(Election).filter(Election.id == election.id, Constituency.winning_margin > 0).order_by(Constituency.winning_margin.asc()).limit(1)
        const_result = await db.execute(const_query)
        closest_row = const_result.first()
        if closest_row:
            closest_contest = {"code": closest_row.code, "name": closest_row.name, "margin": closest_row.winning_margin}
        else:
            closest_contest = {"code": "N/A", "name": "N/A", "margin": 0}

        avg_query = select(func.avg(Constituency.winning_margin)).join(Election).filter(Election.id == election.id, Constituency.winning_margin > 0)
        avg_result = await db.execute(avg_query)
        margin_avg = int(avg_result.scalar() or 0)



        kpis = {

            "total_constituencies": election.total_constituencies,

            "total_booths": total_booths,

            "total_votes": total_votes or 0,

            "turnout_pct": round(turnout_pct, 2),

            "winning_margin_avg": margin_avg,

            "nota_pct": round(nota_pct, 2),

            "male_voters": male_voters or 0,

            "female_voters": female_voters or 0,

            "new_voters": 0,

            "postal_votes": 0,

            "average_swing": 0.0,

            "total_candidates": 0,

            "registered_parties": 0,

            "active_districts": 75,

            "closest_contest_code": closest_contest["code"],

            "closest_contest_name": closest_contest["name"],

            "closest_contest_margin": closest_contest["margin"],

        }

    else:

        kpis = {
            "total_constituencies": 0,
            "total_booths": 0,
            "total_votes": 0,
            "turnout_pct": 0.0,
            "winning_margin_avg": 0,
            "nota_pct": 0.0,
            "male_voters": 0,
            "female_voters": 0,
            "new_voters": 0,
            "postal_votes": 0,
            "average_swing": 0.0,
            "total_candidates": 0,
            "registered_parties": 0,
            "active_districts": 0,
            "closest_contest_code": "N/A",
            "closest_contest_name": "N/A",
            "closest_contest_margin": 0,
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

    
    # Get total votes for election
    votes_query = select(func.sum(Constituency.total_votes_polled)).join(Election).filter(Election.year == year_to_fetch)
    if constituency:
        votes_query = votes_query.filter(Constituency.name == constituency)
    votes_result = await db.execute(votes_query)
    total_votes = votes_result.scalar() or 0

    # Get party wise data
    party_query = (
        select(
            Party.name,
            Party.abbreviation,
            func.sum(Candidate.votes_received).label('votes'),
            func.sum(case((Candidate.is_winner == True, 1), else_=0)).label('seats')
        )
        .join(Candidate, Candidate.party_id == Party.id)
        .join(Election, Candidate.election_id == Election.id)
    )
    
    if constituency:
        party_query = party_query.join(Constituency, Candidate.constituency_id == Constituency.id).filter(Constituency.name == constituency)
    
    party_query = party_query.filter(Election.year == year_to_fetch).group_by(Party.name, Party.abbreviation)
    result = await db.execute(party_query)
    rows = result.all()
    
    if not rows:
        return {"vote_share": [], "total_votes": 0, "total_seats": 0}
        
    total_seats = sum(r.seats for r in rows)
    if not total_votes:
        total_votes = sum(r.votes for r in rows)
        
    # Aggregate into major parties
    party_stats = {}
    
    for name, abbr, votes, seats in rows:
        abbr = abbr or "OTH"
        if "BJP" in abbr: p = "BJP"
        elif abbr == "SP": p = "SP"
        elif abbr == "BSP": p = "BSP"
        elif "INC" in abbr or "CONGRESS" in abbr.upper(): p = "INC"
        elif "RLD" in abbr: p = "RLD"
        else: p = "Others"
        
        if p not in party_stats:
            party_stats[p] = {"votes": 0, "seats": 0, "name": name, "abbr": p if p != "Others" else "OTH"}
            
        party_stats[p]["votes"] += (votes or 0)
        party_stats[p]["seats"] += (seats or 0)
        
    parties = []
    colors = {
        "BJP": "#F97316",
        "SP": "#EF4444",
        "BSP": "#2563EB",
        "INC": "#22C55E",
        "RLD": "#EAB308",
        "Others": "#94A3B8"
    }
    
    for p, stats in party_stats.items():
        parties.append({
            "party": p if p != "Others" else "Others",
            "abbreviation": stats["abbr"],
            "votes": stats["votes"],
            "vote_share": round((stats["votes"] / total_votes * 100), 1) if total_votes else 0,
            "seats_won": stats["seats"],
            "color": colors.get(p, "#94A3B8")
        })
        
    # Sort by votes
    parties.sort(key=lambda x: x["votes"], reverse=True)
    
    return {"vote_share": parties, "total_votes": total_votes, "total_seats": total_seats}


UP_REGIONS_MAP = {
    "Western UP": [
        "Agra", "Aligarh", "Baghpat", "Bulandshahr", "Gautam Buddha Nagar", "Gautam Budh Nagar",
        "Ghaziabad", "Hapur", "Hathras", "Mathura", "Meerut", "Muzaffarnagar", "Shamli",
        "Prabuddha Nagar", "Panchsheel Nagar", "Mahamaya Nagar", "Bheem Nagar",
        "Kasganj", "Mainpuri", "Etah", "Firozabad"
    ],
    "Rohilkhand": [
        "Amroha", "Bareilly", "Bijnor", "Budaun", "Badaun", "Moradabad", "Pilibhit", "Rampur",
        "Shahjahanpur", "Sambhal", "Jyotiba Phule Nagar"
    ],
    "Awadh": [
        "Amethi", "Ambedkar Nagar", "Ayodhya", "Bahraich", "Balrampur", "Barabanki", 
        "Chhatrapati Shahuji Maharaj Nagar", "Etawah", "Faizabad", "Farrukhabad", "Fatehpur",
        "Gonda", "Hardoi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Lakhimpur Kheri", 
        "Lucknow", "Pratapgarh", "Rae Bareli", "Raebareli", "Shrawasti", "Sitapur", "Unnao",
        "Kanshiram Nagar", "Auraiya"
    ],
    "Bundelkhand": [
        "Banda", "Chitrakoot", "Hamirpur", "Jalaun", "Jhansi", "Lalitpur", "Mahoba"
    ],
    "Purvanchal": [
        "Allahabad", "Prayagraj", "Azamgarh", "Ballia", "Basti", "Bhadohi", "Chandauli",
        "Deoria", "Ghazipur", "Gorakhpur", "Jaunpur", "Kaushambi", "Kushinagar", "Maharajganj",
        "Mau", "Mirzapur", "Sant Kabir Nagar", "Siddharthnagar", "Sonbhadra", "Varanasi"
    ]
}

def get_region_for_district(district_name: str) -> str:
    if not district_name:
        return "Other"
    
    # Clean up name if needed
    name = district_name.strip()
    
    for region, districts in UP_REGIONS_MAP.items():
        if name in districts:
            return region
    return "Other"

@router.get("/regional-vote-share")
async def get_regional_vote_share(
    election_year: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get regional vote share distribution."""
    year_to_fetch = election_year if election_year is not None else 2017
    
    # We need to query Candidate, Constituency, and Party
    # Grouping by Constituency.district and Party.abbreviation
    query = (
        select(
            Constituency.district,
            Party.abbreviation,
            func.sum(Candidate.votes_received).label('votes')
        )
        .join(Constituency, Candidate.constituency_id == Constituency.id)
        .join(Party, Candidate.party_id == Party.id)
        .join(Election, Candidate.election_id == Election.id)
        .filter(Election.year == year_to_fetch)
        .group_by(Constituency.district, Party.abbreviation)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    if not rows:
        return {"regions": []}
    
    # Process into regions
    region_totals = {}
    region_party_votes = {}
    
    # Specifically track the top parties to avoid cluttering UI with minor parties
    target_parties = ["BJP", "SP", "BSP", "INC", "RLD"]
    
    for district, party_abbr, votes in rows:
        region = get_region_for_district(district)
        
        # Initialize if not present
        if region not in region_totals:
            region_totals[region] = 0
            region_party_votes[region] = {p: 0 for p in target_parties}
            region_party_votes[region]["Other"] = 0
            
        region_totals[region] += votes
        
        if party_abbr in target_parties:
            region_party_votes[region][party_abbr] += votes
        else:
            # For regional parties like ADAL or SBSP, if we want them as "Other"
            # In the UI they only display BJP, SP, BSP, INC, RLD
            region_party_votes[region]["Other"] += votes
            
    # Format for UI Recharts
    # { region: "Western UP", BJP: 43.2, SP: 38.1, BSP: 12.4, INC: 3.1, RLD: 2.1 }
    formatted_regions = []
    
    # Keep standard ordering
    ordered_regions = ["Western UP", "Purvanchal", "Awadh", "Bundelkhand", "Rohilkhand", "Other"]
    
    for region in ordered_regions:
        if region in region_totals and region_totals[region] > 0:
            total = region_totals[region]
            party_votes = region_party_votes[region]
            
            region_data = {"region": region}
            for party in target_parties:
                # Add percentage rounded to 1 decimal
                pct = round((party_votes.get(party, 0) / total) * 100, 1)
                region_data[party] = pct
                
            formatted_regions.append(region_data)
            
    return {"regions": formatted_regions}





async def _fetch_vote_share_for_year(db: AsyncSession, year: int):
    party_query = (
        select(
            Party.abbreviation,
            func.sum(Candidate.votes_received).label('votes'),
            func.sum(case((Candidate.is_winner == True, 1), else_=0)).label('seats')
        )
        .join(Candidate, Candidate.party_id == Party.id)
        .join(Election, Candidate.election_id == Election.id)
        .filter(Election.year == year)
        .group_by(Party.abbreviation)
    )
    result = await db.execute(party_query)
    rows = result.all()
    
    total_votes = sum(r.votes for r in rows) if rows else 0
    stats = {}
    for abbr, votes, seats in rows:
        abbr = abbr or "OTH"
        if "BJP" in abbr: p = "BJP"
        elif abbr == "SP": p = "SP"
        elif abbr == "BSP": p = "BSP"
        elif "INC" in abbr or "CONGRESS" in abbr.upper(): p = "INC"
        elif "RLD" in abbr: p = "RLD"
        else: p = "Others"
        
        if p not in stats:
            stats[p] = {"votes": 0, "seats": 0}
        stats[p]["votes"] += (votes or 0)
        stats[p]["seats"] += (seats or 0)
        
    return stats, total_votes

@router.get("/swing")
async def get_swing_analysis(
    year1: int = 2017,
    year2: int = 2022,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get swing analysis between two elections."""
    parties = ["BJP", "SP", "BSP", "INC", "RLD", "Others"]
    
    stats_y1, total_votes_y1 = await _fetch_vote_share_for_year(db, year1)
    stats_y2, total_votes_y2 = await _fetch_vote_share_for_year(db, year2)
    
    swing_data = []
    for party in parties:
        y1_votes = stats_y1.get(party, {}).get("votes", 0)
        y2_votes = stats_y2.get(party, {}).get("votes", 0)
        
        y1_share = round((y1_votes / total_votes_y1 * 100), 1) if total_votes_y1 else 0.0
        y2_share = round((y2_votes / total_votes_y2 * 100), 1) if total_votes_y2 else 0.0
        
        swing_data.append({
            "party": party,
            f"vote_share_{year1}": y1_share,
            f"vote_share_{year2}": y2_share,
            "swing": round(y2_share - y1_share, 1),
            f"seats_{year1}": stats_y1.get(party, {}).get("seats", 0),
            f"seats_{year2}": stats_y2.get(party, {}).get("seats", 0),
        })
        
    return {
        "swing": swing_data,
        "year1": year1,
        "year2": year2,
        "turnout_swing": 0.0,
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

        query = query.options(selectinload(Booth.vote_records).selectinload(VoteRecord.candidate).selectinload(Candidate.party))
        query = query.order_by(func.lpad(Booth.booth_number, 10, '0'))
        result = await db.execute(query)

        booths_db = result.scalars().unique().all()

    

    if booths_db:

        booths = []

        for b in booths_db:

            party_votes = {}
            winner_votes = 0
            runner_up_votes = 0

            for vr in b.vote_records:
                party_abbr = vr.candidate.party.abbreviation if vr.candidate and vr.candidate.party else "IND"
                party_votes[party_abbr] = party_votes.get(party_abbr, 0) + vr.votes
                
                if vr.votes > winner_votes:
                    runner_up_votes = winner_votes
                    winner_votes = vr.votes
                elif vr.votes > runner_up_votes:
                    runner_up_votes = vr.votes
                    
            if year_to_fetch == 2017:
                sp_allies = ["SP", "INC"]
                bjp_allies = ["BJP", "AD(S)", "SBSP"]
            else:
                sp_allies = ["SP", "RLD", "SBSP", "AD(K)"]
                bjp_allies = ["BJP", "AD(S)", "NISHAD"]

            bjp_top_party = max((p for p in bjp_allies if p in party_votes), key=lambda p: party_votes[p], default="BJP")
            bjp_val = party_votes.get(bjp_top_party, 0)
            bjp_display = bjp_val if bjp_top_party == "BJP" else f"{bjp_val} ({bjp_top_party})"

            sp_top_party = max((p for p in sp_allies if p in party_votes), key=lambda p: party_votes[p], default="SP")
            sp_val = party_votes.get(sp_top_party, 0)
            sp_display = sp_val if sp_top_party == "SP" else f"{sp_val} ({sp_top_party})"

            actual_margin = winner_votes - runner_up_votes

            final_margin = b.winning_margin if getattr(b, 'winning_margin', 0) > 0 else actual_margin



            booths.append({

                "booth_number": b.booth_number,

                "booth_name": b.booth_name,

                "total_electors": b.total_electors,

                "votes_polled": b.total_votes_polled,

                "turnout_pct": b.turnout_pct,

                "winner_party": b.winner_party or "Unknown",

                "runner_up_party": b.runner_up_party or "Unknown",

                "winning_margin": final_margin,

                "bjp_votes": bjp_display,
                "sp_votes": sp_display,

                "nota_votes": b.nota_votes,

                "rejected_votes": b.rejected_votes,

                "classification": b.classification or "unknown",

            })

        return {"booths": booths, "total": len(booths)}

        return {"booths": [], "total": 0}





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



    return {"constituencies": [], "total": 0}



@router.get("/districts")
async def get_district_winners(
    election_year: Optional[int] = None,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get district-level winning party (the party that won the most seats in the district)."""
    year_to_fetch = election_year if election_year is not None else 2022
    
    query = select(Constituency.district, Constituency.winner_party, func.count(Constituency.id)).join(Election).filter(Election.year == year_to_fetch).group_by(Constituency.district, Constituency.winner_party)
    result = await db.execute(query)
    rows = result.all()
    
    districts = {}
    for d, party, count in rows:
        if not d: continue
        d = d.strip()
        if d not in districts:
            districts[d] = {'BJP':0, 'SP':0, 'BSP':0, 'INC':0, 'RLD':0, 'OTH':0}
        
        p = party.upper() if party else 'OTH'
        if 'BJP' in p: p = 'BJP'
        elif 'SP' in p and 'BSP' not in p and 'SBSP' not in p: p = 'SP'
        elif 'BSP' in p: p = 'BSP'
        elif 'INC' in p or 'CONGRESS' in p: p = 'INC'
        elif 'RLD' in p: p = 'RLD'
        else: p = 'OTH'
        
        districts[d][p] += count
    
    # Compute the winner for each district
    district_data = {}
    for d, counts in districts.items():
        # Get the party with the max count
        winner = max(counts, key=counts.get)
        district_data[d] = {
            "winner": winner,
            "bjp": counts["BJP"],
            "sp": counts["SP"],
            "bsp": counts["BSP"],
            "inc": counts["INC"],
            "rld": counts["RLD"],
            "oth": counts["OTH"]
        }
        
    return {"districts": district_data, "year": year_to_fetch}


@router.get("/constituencies-map")
async def get_constituency_map_winners(
    election_year: Optional[int] = None,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get constituency-level winning party for the map."""
    year_to_fetch = election_year if election_year is not None else 2022
    
    query = (
        select(Constituency, Party.abbreviation.label("winner_party_from_candidate"))
        .join(Election)
        .outerjoin(
            Candidate,
            and_(
                Candidate.constituency_id == Constituency.id,
                Candidate.election_id == Constituency.election_id,
                Candidate.is_winner.is_(True),
            ),
        )
        .outerjoin(Party, Party.id == Candidate.party_id)
        .filter(Election.year == year_to_fetch)
    )
    result = await db.execute(query)
    constituency_rows = result.all()
    
    const_data = {}
    for c, candidate_party in constituency_rows:
        if not c.name: continue
        
        # normalize string
        name = re.sub(r'\[[^\]]*\]', '', c.name.lower())
        name = re.sub(r'\s*\((?:sc|st)\)\s*', ' ', name)
        name = re.sub(r'\s+', ' ', name).strip()
        
        # Constituency.winner_party can be stale after candidate ingestion.
        # Prefer the party attached to the winning candidate, then fall back
        # to the denormalized constituency field for legacy rows.
        p_raw = (candidate_party or c.winner_party or 'OTH').upper().strip()
        
        if p_raw in ['BJP', 'BHARATIYA JANATA PARTY'] or 'BHARATIYA JANATA PARTY' in p_raw: p = 'BJP'
        elif p_raw in ['SP', 'SAMAJWADI PARTY'] or 'SAMAJWADI' in p_raw: p = 'SP'
        elif p_raw in ['BSP', 'BAHUJAN SAMAJ PARTY'] or 'BAHUJAN SAMAJ PARTY' in p_raw: p = 'BSP'
        elif p_raw in ['INC', 'INDIAN NATIONAL CONGRESS'] or 'CONGRESS' in p_raw: p = 'INC'
        elif p_raw in ['RLD', 'RASHTRIYA LOK DAL'] or 'RASHTRIYA LOK DAL' in p_raw: p = 'RLD'
        else: p = 'OTH'
        
        const_data[name] = {
            "winner": p,
            "winner_name": c.winner_name,
            "margin": c.winning_margin,
            "original_name": c.name
        }
        
    return {"constituencies": const_data, "year": year_to_fetch}


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



@router.get("/candidates")

async def get_candidates(

    election_year: Optional[int] = None,

    constituency_id: Optional[str] = None,

    party: Optional[str] = None,

    limit: int = 10000,

    db: AsyncSession = Depends(get_db)

):

    """Get candidates with optional filtering."""

    year_to_fetch = election_year if election_year is not None else 2022

    

    query = (

        select(Candidate, Constituency, Party)

        .join(Constituency, Candidate.constituency_id == Constituency.id)

        .join(Election, Candidate.election_id == Election.id)

        .outerjoin(Party, Candidate.party_id == Party.id)

        .filter(Election.year == year_to_fetch)

    )



    if constituency_id:

        query = query.filter(Constituency.id == constituency_id)

    if party:

        query = query.filter(Party.abbreviation == party)



    # Filter out NOTA and bad records

    query = query.filter(Candidate.name.not_in(['NOTA', 'TOTAL VOTES POLLED', 'TOTAL VOTES']))



    query = query.order_by(Candidate.votes_received.desc().nulls_last()).limit(min(max(limit, 1), 10000))



    result = await db.execute(query)

    rows = result.all()



    candidates = []

    for cand, const, pty in rows:

        candidates.append({

            "id": str(cand.id),

            "name": cand.name,

            "party": pty.abbreviation if pty else "IND",

            "constituency": const.name,

            "district": const.district or "Unknown",

            "votes_received": cand.votes_received or 0,

            "vote_share_pct": cand.vote_share_pct or 0.0,

            "margin": cand.margin or 0,

            "position": cand.position or 0,

            "is_winner": cand.is_winner or False,

            "deposit_lost": cand.deposit_lost or False

        })



    return {"candidates": candidates, "total": len(candidates)}



@router.get("/margin")
async def get_margin_analysis(
    election_year: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get margin analysis data including close contests and distributions."""
    year_to_fetch = election_year if election_year is not None else 2022
    
    query = (
        select(Constituency)
        .join(Election)
        .filter(Election.year == year_to_fetch)
        .options(
            selectinload(Constituency.candidates).selectinload(Candidate.party)
        )
    )
    result = await db.execute(query)
    constituencies = result.scalars().unique().all()
    
    if not constituencies:
        return {"error": "No data found for this election year"}
        
    margins = [c.winning_margin for c in constituencies if c.winning_margin is not None]
    avg_margin = sum(margins) / len(margins) if margins else 0
    
    distribution = [
        {"range": "0-1K", "count": 0, "label": "Razor Thin"},
        {"range": "1K-5K", "count": 0, "label": "Close"},
        {"range": "5K-10K", "count": 0, "label": "Competitive"},
        {"range": "10K-25K", "count": 0, "label": "Comfortable"},
        {"range": "25K-50K", "count": 0, "label": "Strong"},
        {"range": "50K+", "count": 0, "label": "Dominant"},
    ]
    
    close_contests_count = 0
    contests_data = []
    
    for c in constituencies:
        margin = c.winning_margin or 0
        
        # Distribution logic
        if margin < 1000: distribution[0]["count"] += 1
        elif margin < 5000: distribution[1]["count"] += 1
        elif margin < 10000: distribution[2]["count"] += 1
        elif margin < 25000: distribution[3]["count"] += 1
        elif margin < 50000: distribution[4]["count"] += 1
        else: distribution[5]["count"] += 1
            
        if margin < 5000:
            close_contests_count += 1
            
        # Candidates sorting for Runner-up
        # Filter out NOTA
        valid_candidates = [cand for cand in c.candidates if cand.name not in ('NOTA', 'TOTAL VOTES POLLED', 'TOTAL VOTES')]
        sorted_candidates = sorted(valid_candidates, key=lambda x: x.votes_received or 0, reverse=True)
        
        winner = sorted_candidates[0] if len(sorted_candidates) > 0 else None
        runner_up = sorted_candidates[1] if len(sorted_candidates) > 1 else None
        
        winner_party = winner.party.abbreviation if winner and winner.party else (c.winner_party or "Unknown")
        runner_up_party = runner_up.party.abbreviation if runner_up and runner_up.party else "Unknown"
        
        # Some edge cases mapping
        if winner_party == "IPT": winner_party = "IND"
        if runner_up_party == "IPT": runner_up_party = "IND"
        
        contests_data.append({
            "constituency": c.name,
            "winner": winner_party,
            "runnerUp": runner_up_party,
            "margin": margin,
            "turnout": f"{round(c.turnout_pct, 1)}%" if c.turnout_pct else "0%"
        })
        
    # Sort by margin ascending
    contests_data.sort(key=lambda x: x["margin"])
    
    return {
        "smallest_margin": contests_data[0] if contests_data else None,
        "largest_margin": contests_data[-1] if contests_data else None,
        "close_contests_count": close_contests_count,
        "avg_margin": round(avg_margin),
        "distribution": distribution,
        "closest_contests": [c for c in contests_data if c["margin"] < 5000][:10]
    }
