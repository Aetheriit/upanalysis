import os
import glob
import re
import pandas as pd
import PyPDF2
from unidecode import unidecode
import sys

# Ensure krutidev converter is accessible
sys.path.insert(0, '2017 data')
from krutidev import KrutiDev_to_Unicode

def is_likely_english(text):
    upper_text = text.upper()
    english_words = ['SCHOOL', 'PRIMARY', 'ROOM', 'PS ', 'VIDYALAYA', 'COLLEGE', 'JUNIOR', 'HIGH', 'INTER', 'PANCHAYAT', 'BHAWAN', 'COMPOSIT']
    for word in english_words:
        if word in upper_text:
            return True
            
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
    if upper_ratio > 0.5:
        return True
        
    return False

def process_pdfs():
    pdf_files = glob.glob('2022 data/*.pdf')
    output_dir = '2022 data/excel_outputs'
    os.makedirs(output_dir, exist_ok=True)
    
    # regexes
    ac_booth_re = re.compile(r'AC\s+(\d+)\s+(.*?)\s+\|\s+BOOTH\s+(\d+)')
    ps_re = re.compile(r'PS:\s+(.*)')
    voters_re = re.compile(r'Electors\s+([\d,]+)\s+\|\s+Voted\s+M\s+([\d,]+)\s+F\s+([\d,]+)\s+O\s+([\d,]+)\s+Total\s+([\d,]+)\s+\(([\d\.]+)%\)')
    epic_re = re.compile(r'EPIC-identified\s+([\d,]+)\s+\|\s+Tendered\s+([\d,]+)')
    cand_re = re.compile(r'^\s*(\d+)\s+(.*?)\s{2,}(.*?)\s+([\d,]+)\s+([\d\.]+)%$')
    valid_re = re.compile(r'Valid\s+(\d+)')
    
    # We will accumulate data constituency by constituency
    current_ac = None
    ac_data = []
    
    def save_ac_data(ac_num, data):
        if not data:
            return
        # Collect all unique candidates to form columns
        candidates = []
        for row in data:
            for c in row['candidates']:
                if c['name'] not in candidates:
                    candidates.append(c['name'])
                    
        # Prepare rows for dataframe
        df_rows = []
        for row in data:
            df_row = {
                'BOOTH ID': row['booth_id'],
                'POLLING STATION NAME': row.get('ps_name', 'UNKNOWN'),
                'TOTAL ELECTORS': row.get('electors', 0),
                'MALE VOTERS': row.get('male', 0),
                'FEMALE VOTERS': row.get('female', 0),
                'OTHER VOTERS': row.get('other', 0),
                'TOTAL TURNOUT': row.get('total_turnout', 0),
                'TURNOUT %': row.get('turnout_pct', 0.0),
                'EPIC': row.get('epic', 0),
                'TENDERED VOTERS': row.get('tendered', 0)
            }
            
            # Candidate votes
            sum_cand = 0
            for cand_name in candidates:
                votes = 0
                for c in row['candidates']:
                    if c['name'] == cand_name:
                        votes = c['votes']
                        break
                df_row[cand_name] = votes
                sum_cand += votes
                
            # NOTA = Total Turnout - Valid votes (sum of candidates). Sometimes NOTA is listed explicitly.
            # We'll calculate it as total_turnout - sum_cand
            df_row['NOTA'] = max(0, row.get('total_turnout', 0) - sum_cand)
            df_row['TOTAL VOTES POLLED'] = row.get('total_turnout', 0)
            df_row['CHECK SUM'] = row.get('total_turnout', 0)
            
            df_rows.append(df_row)
            
        columns = ['BOOTH ID', 'POLLING STATION NAME', 'TOTAL ELECTORS', 'MALE VOTERS', 'FEMALE VOTERS', 'OTHER VOTERS', 
                   'TOTAL TURNOUT', 'TURNOUT %', 'EPIC', 'TENDERED VOTERS'] + candidates + ['NOTA', 'TOTAL VOTES POLLED', 'CHECK SUM']
        
        df = pd.DataFrame(df_rows, columns=columns)
        
        # Add the title row
        title_df = pd.DataFrame(columns=columns)
        title_df.loc[0] = [f'AC {ac_num} Booth-wise Data'] + [float('nan')] * (len(columns) - 1)
        
        headers_df = pd.DataFrame([columns], columns=columns)
        
        # Concat
        final_df = pd.concat([title_df, headers_df, df], ignore_index=True)
        
        out_file = os.path.join(output_dir, f'{ac_num}_boothwise_data.xlsx')
        final_df.to_excel(out_file, index=False, header=False)
        print(f'Saved AC {ac_num} to {out_file} with {len(df)} booths.')

    print(f"Processing {len(pdf_files)} PDF files...")
    for pdf_file in pdf_files:
        try:
            reader = PyPDF2.PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                lines = text.split('\n')
                
                booth_data = {}
                in_candidates = False
                
                for line in lines:
                    line = line.strip()
                    
                    ac_m = ac_booth_re.search(line)
                    if ac_m:
                        ac_num = int(ac_m.group(1))
                        booth_id = int(ac_m.group(3))
                        
                        if ac_num != current_ac:
                            if current_ac is not None:
                                save_ac_data(current_ac, ac_data)
                            current_ac = ac_num
                            ac_data = []
                            
                        booth_data = {
                            'booth_id': booth_id,
                            'candidates': []
                        }
                        in_candidates = False
                        continue
                        
                    if line.startswith('PS:'):
                        ps_raw = line[3:].strip()
                        if is_likely_english(ps_raw):
                            booth_data['ps_name'] = ps_raw
                        else:
                            # convert Kruti Dev -> Hindi -> English transliteration
                            hindi_text = KrutiDev_to_Unicode(ps_raw)
                            booth_data['ps_name'] = unidecode(hindi_text)
                        continue
                        
                    vot_m = voters_re.search(line)
                    if vot_m:
                        booth_data['electors'] = int(vot_m.group(1).replace(',', ''))
                        booth_data['male'] = int(vot_m.group(2).replace(',', ''))
                        booth_data['female'] = int(vot_m.group(3).replace(',', ''))
                        booth_data['other'] = int(vot_m.group(4).replace(',', ''))
                        booth_data['total_turnout'] = int(vot_m.group(5).replace(',', ''))
                        booth_data['turnout_pct'] = float(vot_m.group(6))
                        continue
                        
                    epic_m = epic_re.search(line)
                    if epic_m:
                        booth_data['epic'] = int(epic_m.group(1).replace(',', ''))
                        booth_data['tendered'] = int(epic_m.group(2).replace(',', ''))
                        continue
                        
                    if '#  CANDIDATE' in line:
                        in_candidates = True
                        continue
                        
                    if in_candidates:
                        cand_m = cand_re.search(line)
                        if cand_m:
                            # 1: id, 2: name, 3: party, 4: votes, 5: share
                            name = cand_m.group(2).strip()
                            # Let's keep it as Name
                            booth_data['candidates'].append({
                                'name': name,
                                'votes': int(cand_m.group(4).replace(',', ''))
                            })
                        elif 'Valid' in line and 'WINNER' in line:
                            in_candidates = False
                            ac_data.append(booth_data)
                            booth_data = {}
                            
        except Exception as e:
            print(f'Error processing {pdf_file}: {e}')
            
    # Save the last AC
    if current_ac is not None and ac_data:
        save_ac_data(current_ac, ac_data)

if __name__ == '__main__':
    process_pdfs()
