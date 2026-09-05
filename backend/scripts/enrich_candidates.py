"""
Candidate data enrichment script.
Extracts party affiliations from Excel headers, computes aggregate votes,
and updates candidate records with winner/position/margin/vote_share info.

Designed to run inside the Docker container on the VPS.
"""
import asyncio
import asyncpg
import csv
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / 'backend'))

# ─── 2022: Extract candidate→party mapping from raw ECI Excel files ───
def extract_2022_candidates(data_dir):
    """Parse 2022 AC Excel files to get candidate name → party mapping per AC."""
    import openpyxl
    
    results = {}  # {ac_num: [(name, party), ...]}
    
    for ac_num in range(1, 404):
        # Try both .xlsx and .xls
        fpath = None
        for ext in ['.xlsx', '.xls']:
            candidate = os.path.join(data_dir, f'AC{ac_num}{ext}')
            if os.path.exists(candidate):
                fpath = candidate
                break
        
        if not fpath:
            continue
        
        try:
            wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(max_row=6, values_only=True))
            wb.close()
            
            if len(rows) < 5:
                continue
            
            # Row index 3 (0-based) = candidate names row
            # Row index 4 (0-based) = party info row
            names_row = rows[3]
            party_row = rows[4]
            
            candidates = []
            # Candidate columns start at col 10 (0-based) and repeat every 3 cols
            # Pattern: col 10=name, col 11=party, col 12=votes
            #          col 13=name, col 14=party, col 15=votes ...
            i = 10
            while i < len(names_row):
                name = names_row[i]
                if name and str(name).strip() and str(name).strip() != 'nan':
                    name_str = str(name).strip().upper()
                    if name_str in ('NOTA', 'TOTAL VOTES SECURED', 'TOTAL VOTES', 'TOTAL'):
                        i += 3
                        continue
                    
                    # Party is in the next row, one column over
                    party = None
                    if i + 1 < len(party_row) and party_row[i + 1]:
                        party_val = str(party_row[i + 1]).strip()
                        if party_val and party_val != 'nan' and party_val != 'Party Affilication':
                            party = party_val.upper()
                    
                    if not party:
                        party = 'IND'
                    
                    candidates.append((name_str, party))
                i += 3
            
            results[ac_num] = candidates
        except Exception as e:
            print(f"Error reading AC{ac_num}: {e}")
    
    return results


def load_2017_party_map(csv_path):
    """Load winner and runner-up party affiliations from the ECI results CSV."""
    result = {}
    if not csv_path or not os.path.exists(csv_path):
        print(f"  WARNING: 2017 results CSV not found: {csv_path}")
        return result
    with open(csv_path, newline='', encoding='utf-8-sig') as handle:
        for row in csv.DictReader(handle):
            code = str(row.get('Constituency #', '') or '').strip()
            if not code:
                continue
            for name_key, party_key in (
                ('Winner Candidate', 'Winner Party.1'),
                ('Runner-up Candidate', 'Runner-up Party.1'),
            ):
                name = str(row.get(name_key, '') or '').strip().upper()
                party = str(row.get(party_key, '') or '').strip().upper()
                if name and party:
                    result[(code, name)] = party
    return result


async def enrich_candidates():
    database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/election_intel')
    database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://', 1)
    conn = await asyncpg.connect(database_url)
    
    # ─── Step 1: Delete bad candidate records ───
    print("Step 1: Cleaning up bad candidate records...")
    bad_names = ['TOTAL VOTES POLLED', 'TOTAL VOTES', 'TOTAL', 'CHECK SUM', 'CHECKSUM']
    deleted = await conn.execute('''
        DELETE FROM vote_records WHERE candidate_id IN (
            SELECT id FROM candidates WHERE UPPER(name) = ANY($1::text[])
        )
    ''', bad_names)
    print(f"  Deleted vote_records for bad candidates: {deleted}")
    
    deleted = await conn.execute(
        'DELETE FROM candidates WHERE UPPER(name) = ANY($1::text[])', bad_names
    )
    print(f"  Deleted bad candidates: {deleted}")
    
    # ─── Step 2: Get elections ───
    elections = await conn.fetch('SELECT id, name, year FROM elections')
    election_map = {r['name']: r['id'] for r in elections}
    print(f"Elections: {[r['name'] for r in elections]}")
    
    e2022_id = election_map.get('UP Assembly 2022')
    e2017_id = election_map.get('UP Assembly 2017')
    
    # ─── Step 3: Extract party info from 2022 Excel files ───
    print("\nStep 2: Extracting 2022 candidate-party mappings from Excel files...")
    
    # Check which data directory exists
    data_dir_2022 = None
    for d in [os.getenv('CANDIDATE_DATA_2022'), '/2022_data_2', '/app/2022_data_2', '/2022 data 2', str(PROJECT_ROOT / '2022 data 2')]:
        if not d:
            continue
        if os.path.exists(d):
            data_dir_2022 = d
            break
    
    party_map_2022 = {}  # {(ac_code, candidate_name): party}
    
    if data_dir_2022:
        ac_candidates = extract_2022_candidates(data_dir_2022)
        for ac_num, cands in ac_candidates.items():
            for name, party in cands:
                party_map_2022[(str(ac_num), name)] = party
        print(f"  Extracted party info for {len(party_map_2022)} candidate-constituency pairs")
    else:
        print("  WARNING: 2022 data directory not found on this system, will try DB-only approach")
    
    # ─── Step 4: Create/update parties table ───
    print("\nStep 3: Ensuring parties exist in DB...")
    
    all_parties = set(party_map_2022.values())
    # Add known parties
    known_parties = {
        'BJP': ('Bharatiya Janata Party', '#F97316'),
        'SP': ('Samajwadi Party', '#EF4444'),
        'BSP': ('Bahujan Samaj Party', '#2563EB'),
        'INC': ('Indian National Congress', '#22C55E'),
        'AAP': ('Aam Aadmi Party', '#9333EA'),
        'RLD': ('Rashtriya Lok Dal', '#EAB308'),
        'AIMIM': ('All India Majlis-e-Ittehadul Muslimeen', '#06B6D4'),
        'AD(S)': ('Apna Dal (Sonelal)', '#F59E0B'),
        'SBSP': ('Suheldev Bharatiya Samaj Party', '#EC4899'),
        'JD(U)': ('Janata Dal (United)', '#14B8A6'),
        'NCP': ('Nationalist Congress Party', '#3B82F6'),
        'NISHAD': ('Nishad Party', '#8B5CF6'),
        'IND': ('Independent', '#94A3B8'),
    }
    
    party_id_map = {}  # abbreviation -> id
    for abbr in all_parties | set(known_parties.keys()):
        row = await conn.fetchrow(
            'SELECT id FROM parties WHERE UPPER(abbreviation) = $1', abbr.upper()
        )
        if row:
            party_id_map[abbr.upper()] = row['id']
        else:
            name = known_parties.get(abbr, (abbr, '#94A3B8'))[0]
            color = known_parties.get(abbr, (abbr, '#94A3B8'))[1]
            new_id = await conn.fetchval('''
                INSERT INTO parties (id, name, abbreviation, color, created_at)
                VALUES (gen_random_uuid(), $1, $2, $3, NOW())
                RETURNING id
            ''', name, abbr.upper(), color)
            party_id_map[abbr.upper()] = new_id
            print(f"  Created party: {abbr} ({name})")
    
    # ─── Step 5: Update 2022 candidates with party info ───
    if e2022_id:
        print("\nStep 4: Updating 2022 candidates with party info and aggregate votes...")
        
        # Get all 2022 constituencies
        constituencies = await conn.fetch('''
            SELECT id, code, name FROM constituencies WHERE election_id = $1
        ''', e2022_id)
        
        for const in constituencies:
            ac_code = const['code']
            const_id = const['id']
            
            # Get candidates for this constituency
            candidates = await conn.fetch('''
                SELECT id, name FROM candidates
                WHERE constituency_id = $1 AND election_id = $2
                AND UPPER(name) NOT IN ('NOTA')
            ''', const_id, e2022_id)
            
            # Compute aggregate votes from vote_records
            for cand in candidates:
                cand_id = cand['id']
                cand_name = cand['name'].strip().upper()
                
                # Get total votes from vote_records
                total_votes = await conn.fetchval('''
                    SELECT COALESCE(SUM(vr.votes), 0)
                    FROM vote_records vr
                    WHERE vr.candidate_id = $1
                ''', cand_id)
                
                # Get party from our extracted map
                party_abbr = party_map_2022.get((ac_code, cand_name), 'IND')
                party_id = party_id_map.get(party_abbr.upper())
                
                await conn.execute('''
                    UPDATE candidates
                    SET votes_received = $1, party_id = $2
                    WHERE id = $3
                ''', total_votes, party_id, cand_id)
            
            # Now compute positions, margins, vote shares for this constituency
            all_cands = await conn.fetch('''
                SELECT id, name, votes_received
                FROM candidates
                WHERE constituency_id = $1 AND election_id = $2
                AND UPPER(name) != 'NOTA'
                ORDER BY votes_received DESC
            ''', const_id, e2022_id)
            
            # Total valid votes in constituency
            total_const_votes = sum(c['votes_received'] or 0 for c in all_cands)
            
            for pos, cand in enumerate(all_cands, 1):
                is_winner = (pos == 1)
                votes = cand['votes_received'] or 0
                vote_share = (votes / total_const_votes * 100) if total_const_votes > 0 else 0
                
                # Margin: winner margin = winner - runner-up, others = their votes - winner votes
                if pos == 1 and len(all_cands) > 1:
                    margin = votes - (all_cands[1]['votes_received'] or 0)
                elif pos > 1:
                    margin = votes - (all_cands[0]['votes_received'] or 0)
                else:
                    margin = 0
                
                # Deposit lost if vote share < 1/6 = 16.67%
                deposit_lost = vote_share < 16.67
                
                await conn.execute('''
                    UPDATE candidates
                    SET is_winner = $1, position = $2, margin = $3,
                        vote_share_pct = $4, deposit_lost = $5
                    WHERE id = $6
                ''', is_winner, pos, margin, round(vote_share, 2), deposit_lost, cand['id'])
            
            # Update constituency winner info
            if all_cands:
                winner = all_cands[0]
                winner_party = await conn.fetchval(
                    'SELECT abbreviation FROM parties WHERE id = (SELECT party_id FROM candidates WHERE id = $1)',
                    winner['id']
                )
                margin = (winner['votes_received'] or 0) - (all_cands[1]['votes_received'] or 0) if len(all_cands) > 1 else 0
                await conn.execute('''
                    UPDATE constituencies
                    SET winner_name = $1, winner_party = $2, winning_margin = $3
                    WHERE id = $4
                ''', winner['name'], winner_party, margin, const_id)
        
        print("  2022 candidates updated!")
    
    # ─── Step 6: Update 2017 candidates ───
    if e2017_id:
        print("\nStep 5: Updating 2017 candidates with aggregate votes...")
        
        constituencies = await conn.fetch('''
            SELECT id, code, name FROM constituencies WHERE election_id = $1
        ''', e2017_id)
        
        results_csv = os.getenv('CANDIDATE_RESULTS_2017')
        if not results_csv:
            for candidate_path in (PROJECT_ROOT / 'up_2017_results.csv', Path('/app/up_2017_results.csv'), Path('/2017 data/up_2017_results.csv')):
                if candidate_path.exists():
                    results_csv = str(candidate_path)
                    break
        party_map_2017 = load_2017_party_map(results_csv)
        print(f"  Loaded 2017 party info for {len(party_map_2017)} candidate rows")
        
        for const in constituencies:
            const_id = const['id']
            
            # Get candidates
            candidates = await conn.fetch('''
                SELECT id, name FROM candidates
                WHERE constituency_id = $1 AND election_id = $2
                AND UPPER(name) NOT IN ('NOTA')
            ''', const_id, e2017_id)
            
            # Compute aggregate votes
            for cand in candidates:
                total_votes = await conn.fetchval('''
                    SELECT COALESCE(SUM(vr.votes), 0)
                    FROM vote_records vr
                    WHERE vr.candidate_id = $1
                ''', cand['id'])
                
                await conn.execute('''
                    UPDATE candidates SET votes_received = $1 WHERE id = $2
                ''', total_votes, cand['id'])
            
            # Re-fetch with updated votes
            all_cands = await conn.fetch('''
                SELECT id, name, votes_received
                FROM candidates
                WHERE constituency_id = $1 AND election_id = $2
                AND UPPER(name) != 'NOTA'
                ORDER BY votes_received DESC
            ''', const_id, e2017_id)
            
            total_const_votes = sum(c['votes_received'] or 0 for c in all_cands)
            
            for pos, cand in enumerate(all_cands, 1):
                is_winner = (pos == 1)
                votes = cand['votes_received'] or 0
                vote_share = (votes / total_const_votes * 100) if total_const_votes > 0 else 0
                
                if pos == 1 and len(all_cands) > 1:
                    margin = votes - (all_cands[1]['votes_received'] or 0)
                elif pos > 1:
                    margin = votes - (all_cands[0]['votes_received'] or 0)
                else:
                    margin = 0
                
                deposit_lost = vote_share < 16.67
                
                party_abbr = party_map_2017.get(
                    (str(const['code']), str(cand['name']).strip().upper()), 'IND'
                )
                candidate_party_id = party_id_map.get(
                    party_abbr.upper(), party_id_map.get('IND')
                )
                
                await conn.execute('''
                    UPDATE candidates
                    SET is_winner = $1, position = $2, margin = $3,
                        vote_share_pct = $4, deposit_lost = $5, party_id = $6
                    WHERE id = $7
                ''', is_winner, pos, margin, round(vote_share, 2), deposit_lost, candidate_party_id, cand['id'])
        
        print("  2017 candidates updated!")
    
    # ─── Step 7: Summary ───
    print("\n=== SUMMARY ===")
    for ename, eid in election_map.items():
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM candidates WHERE election_id = $1 AND UPPER(name) != 'NOTA'", eid
        )
        winners = await conn.fetchval(
            'SELECT COUNT(*) FROM candidates WHERE election_id = $1 AND is_winner = true', eid
        )
        with_party = await conn.fetchval(
            'SELECT COUNT(*) FROM candidates WHERE election_id = $1 AND party_id IS NOT NULL', eid
        )
        print(f"{ename}: {total} candidates, {winners} winners, {with_party} with party info")
    
    # Show top candidates
    top = await conn.fetch('''
        SELECT c.name, p.abbreviation as party, co.name as constituency, co.code,
               c.votes_received, c.vote_share_pct, c.is_winner, c.position, c.margin
        FROM candidates c
        JOIN constituencies co ON c.constituency_id = co.id
        LEFT JOIN parties p ON c.party_id = p.id
        JOIN elections e ON c.election_id = e.id
        WHERE e.name = 'UP Assembly 2022' AND c.is_winner = true
        ORDER BY c.votes_received DESC
        LIMIT 10
    ''')
    print("\nTop 10 winners (2022) by votes:")
    for t in top:
        print(f"  {t['name']} ({t['party']}) - {t['constituency']} | Votes: {t['votes_received']:,} | Share: {t['vote_share_pct']}% | Margin: {t['margin']:,}")
    
    await conn.close()
    print("\nDone!")

if __name__ == '__main__':
    asyncio.run(enrich_candidates())
