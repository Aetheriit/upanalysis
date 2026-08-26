import PyPDF2
import re
import json

def parse_pdf(file_path):
    total_electors = 0
    total_voters = 0
    total_polling_stations = 0
    parties = {}
    
    with open(file_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        
        for i in range(len(reader.pages)):
            text = reader.pages[i].extract_text()
            
            # Find total electors (look for II. ELECTORS ... 4. TOTAL ... <numbers>)
            # Find total voters (look for III. VOTERS ... 4. TOTAL ... <numbers>)
            # Find polling stations (look for V. POLLING STATIONS ... NUMBER <number>)
            # Find winner and runner-up party and votes
            
            # Total Electors (4. TOTAL under II. ELECTORS)
            e_match = re.search(r'II\.\s*ELECTORS.*?4\.\s*TOTAL\s+\d+\s+\d+\s+(\d+)', text, re.DOTALL)
            if not e_match:
                e_match = re.search(r'II\.\s*ELECTORS.*?4\.\s*TOTAL\s+\d+\s+\d+\s+\d+\s+(\d+)', text, re.DOTALL)
            if e_match:
                total_electors += int(e_match.group(1))
                
            # Total Voters (4. TOTAL under III. VOTERS)
            v_match = re.search(r'III\.\s*VOTERS.*?4\.\s*TOTAL\s+(\d+)', text, re.DOTALL)
            if not v_match:
                v_match = re.search(r'4\.\s*TOTAL.*?(\d+)', text, re.DOTALL)
            # Actually, total votes polled is also IV. VOTES 3. TOTAL VALID VOTES POLLED
            # Let's extract polling stations
            ps_match = re.search(r'V\.\s*POLLING STATIONS.*?NUMBER\s+(\d+)', text, re.DOTALL)
            if ps_match:
                total_polling_stations += int(ps_match.group(1))
                
            # Parties
            winner_match = re.search(r'WINNER\s+([A-Z]+)\s+.*?\s+(\d+)', text)
            if winner_match:
                p, v = winner_match.groups()
                if p not in parties:
                    parties[p] = {"votes": 0, "seats": 0}
                parties[p]["votes"] += int(v)
                parties[p]["seats"] += 1
                
            runner_match = re.search(r'RUNNER-UP\s+([A-Z]+)\s+.*?\s+(\d+)', text)
            if runner_match:
                p, v = runner_match.groups()
                if p not in parties:
                    parties[p] = {"votes": 0, "seats": 0}
                parties[p]["votes"] += int(v)

    # Let's just calculate total voters by summing up all winner+runnerup votes + others (estimate if needed)
    # Actually, it's better to just extract III(A). POLLING PERCENTAGE and calculate.
    
    print(f"Parsed {len(reader.pages)} pages")
    print(f"Total Electors (estimate): {total_electors}")
    print(f"Total Polling Stations: {total_polling_stations}")
    print("Parties:", parties)

parse_pdf("../Constituency Data Summry.pdf")
