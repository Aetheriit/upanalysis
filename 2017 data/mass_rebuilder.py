import os
import glob
import pandas as pd
import re
import numpy as np
import warnings
warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

def audit_acs():
    files = glob.glob('excel_outputs/*_boothwise_data.xlsx')
    corrupted_acs = set()
    for f in files:
        ac_num = int(os.path.basename(f).split('_')[0])
        try:
            df = pd.read_excel(f, sheet_name='Booth-wise Data', header=2)
        except Exception:
            corrupted_acs.add(ac_num)
            continue
            
        cols = df.columns.tolist()
        booth_rows = df[~df['Booth ID'].isna()]
        
        if len(booth_rows) < 100: corrupted_acs.add(ac_num)
        elif any('Unnamed' in str(c) for c in cols): corrupted_acs.add(ac_num)
        elif 'Polling Station Name' in cols and booth_rows['Polling Station Name'].isna().sum() > 0: corrupted_acs.add(ac_num)
        elif 'Total Electors' in cols and (booth_rows['Total Electors'].isna().sum() + (booth_rows['Total Electors'] == 0).sum()) > 50: corrupted_acs.add(ac_num)
        elif 'Check Sum' in cols and (~df['Check Sum'].astype(bool)).sum() > 0: corrupted_acs.add(ac_num)
        elif 'Male Voters' not in cols or 'Female Voters' not in cols: corrupted_acs.add(ac_num)
        elif booth_rows['Male Voters'].isna().sum() > 50: corrupted_acs.add(ac_num)
    return sorted(list(corrupted_acs))

def find_pdf_text_for_ac(ac_num, txt_dumps_dir='txt_dumps_nolayout'):
    txt_files = glob.glob(os.path.join(txt_dumps_dir, '*_nolayout.txt'))
    ac_pattern = re.compile(rf'AC {ac_num}(?:[^\n\|]*)(?:\n)?\s*\|\s*BOOTH\s+\d+')
    for tf in txt_files:
        with open(tf, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
            if ac_pattern.search(text):
                return text
    return None

def get_candidates_from_excel(ac_num):
    path = f'excel_outputs/{ac_num}_boothwise_data.xlsx'
    try:
        df = pd.read_excel(path, sheet_name='Booth-wise Data', header=2)
        cols = df.columns.tolist()
        if 'Tendered Voters' in cols and 'Total Votes Polled' in cols:
            start_idx = cols.index('Tendered Voters') + 1
            end_idx = cols.index('Total Votes Polled')
            cand_cols = cols[start_idx:end_idx]
            
            if all(str(c).isdigit() or 'Unnamed' in str(c) or 'NOTA' in str(c).upper() for c in cand_cols):
                return None
            return {i+1: str(c).replace('\n', ' ').strip() for i, c in enumerate(cand_cols) if 'NOTA' not in str(c).upper()}
    except: pass
    return None

def get_candidates_from_text(text, ac_num):
    candidates = {}
    booth_matches = list(re.finditer(r'AC ' + str(ac_num) + r'(?:[^\n\|]*)(?:\n)?\s*\|\s*BOOTH\s+(\d+)', text))
    if not booth_matches: return candidates
    
    start_idx = booth_matches[0].end()
    end_idx = booth_matches[1].start() if len(booth_matches) > 1 else len(text)
    chunk = text[start_idx:end_idx]
    
    cand_matches = list(re.finditer(r'(?m)^(\d+)\s+([A-Za-z].*?)$', chunk))
    for cm in cand_matches:
        c_id = int(cm.group(1))
        c_name = cm.group(2).strip()
        if c_name == 'NOTA (None of the Above)':
            c_name = 'NOTA'
        if 'NOTA' not in c_name.upper():
            candidates[c_id] = c_name
        
    return candidates

def extract_booths_from_text(text, ac_num, expected_candidates):
    booths = []
    
    booth_matches = list(re.finditer(r'AC ' + str(ac_num) + r'(?:[^\n\|]*)(?:\n)?\s*\|\s*BOOTH\s+(\d+)', text))
    for i in range(len(booth_matches)):
        start_idx = booth_matches[i].end()
        end_idx = booth_matches[i+1].start() if i + 1 < len(booth_matches) else len(text)
        chunk = text[start_idx:end_idx]
        
        # TRUNCATE chunk at "Valid" to prevent it from bleeding into the rest of the file for the last booth
        valid_match = re.search(r'Valid\s+\d+\s*\|', chunk)
        if valid_match:
            chunk = chunk[:valid_match.end()]
            
        booth_id = int(booth_matches[i].group(1))
        
        b_data = {'Booth ID': booth_id}
        
        m_ps = re.search(r'PS:\s*(.*)', chunk)
        if m_ps: b_data['Polling Station Name'] = m_ps.group(1).strip()
        
        m_el = re.search(r'Electors\s+(\d[\d,]*)\s*\|\s*Voted M\s+(\d[\d,]*)\s*F\s+(\d[\d,]*)\s*O\s+(\d[\d,]*)\s*Total\s+(\d[\d,]*)', chunk)
        if m_el:
            b_data['Total Electors'] = int(m_el.group(1).replace(',',''))
            b_data['Male Voters'] = int(m_el.group(2).replace(',',''))
            b_data['Female Voters'] = int(m_el.group(3).replace(',',''))
            b_data['Other Voters'] = int(m_el.group(4).replace(',',''))
            b_data['Total Turnout'] = int(m_el.group(5).replace(',',''))
            
        m_epic = re.search(r'EPIC-identified\s+(\d[\d,]*)\s*\|\s*Tendered\s+(\d[\d,]*)', chunk)
        if m_epic:
            b_data['EPIC'] = int(m_epic.group(1).replace(',',''))
            b_data['Tendered Voters'] = int(m_epic.group(2).replace(',',''))
            
        cand_matches = list(re.finditer(r'(?m)^(\d+)\s+([A-Za-z].*?)$', chunk))
        for j, cm in enumerate(cand_matches):
            c_id = int(cm.group(1))
            if c_id not in expected_candidates: continue
            
            c_start = cm.end()
            c_end = cand_matches[j+1].start() if j + 1 < len(cand_matches) else len(chunk)
            c_chunk = chunk[c_start:c_end]
            
            m_votes = re.search(r'(?m)^(\d+)\s+[\d\.]+%?$', c_chunk)
            if not m_votes:
                m_votes = re.search(r'(?m)^(\d+)\s*$', c_chunk)
                
            if m_votes:
                b_data[expected_candidates[c_id]] = int(m_votes.group(1))
            else:
                m_fallback = re.search(r'(?m)^(\d+)', c_chunk.strip().split('\n')[-1])
                if m_fallback:
                    b_data[expected_candidates[c_id]] = int(m_fallback.group(1))
                    
        booths.append(b_data)
        
    unique_booths = {}
    for b in booths: unique_booths[b['Booth ID']] = b
    return [unique_booths[k] for k in sorted(unique_booths.keys())]

def rebuild_ac(ac_num):
    print(f"Rebuilding AC {ac_num}...")
    text = find_pdf_text_for_ac(ac_num)
    if not text:
        print(f"  ERROR: Could not find txt dump for AC {ac_num}")
        return False
        
    cands = get_candidates_from_excel(ac_num)
    if not cands:
        cands = get_candidates_from_text(text, ac_num)
        
    if not cands:
        print(f"  ERROR: Could not find any candidates for AC {ac_num}")
        return False
        
    booths = extract_booths_from_text(text, ac_num, cands)
    if not booths:
        print(f"  ERROR: Could not extract any booths for AC {ac_num}")
        return False
        
    df = pd.DataFrame(booths)
    cand_names = [cands[k] for k in sorted(cands.keys())]
    
    for c in cand_names:
        if c not in df.columns: df[c] = 0
            
    df['Total Votes Polled'] = df[cand_names].sum(axis=1)
    ordered_cols = ['Booth ID', 'Polling Station Name', 'Total Electors', 'Male Voters', 'Female Voters', 'Other Voters', 'Total Turnout', 'Turnout %', 'EPIC', 'Tendered Voters'] + cand_names + ['NOTA', 'Total Votes Polled', 'Check Sum']
    
    if 'Total Turnout' in df.columns:
        # Check if NOTA is naturally present or we need to calculate it
        if 'NOTA' not in df.columns:
            df['NOTA'] = df['Total Turnout'] - df['Total Votes Polled']
        
        # After adding NOTA, Total Votes Polled should be updated to include it
        df['Total Votes Polled'] = df[cand_names].sum(axis=1) + df['NOTA']
        
        df['Turnout %'] = (df['Total Turnout'] / df['Total Electors']) * 100
        df['Check Sum'] = df['Total Votes Polled'] == df['Total Turnout']
    else:
        df['Turnout %'] = np.nan
        df['Check Sum'] = False
        df['NOTA'] = np.nan
        
    for c in ordered_cols:
        if c not in df.columns: df[c] = np.nan
            
    df = df[ordered_cols]
    
    total_row = {'Booth ID': 'Total', 'Polling Station Name': ''}
    sum_cols = ['Total Electors', 'Male Voters', 'Female Voters', 'Other Voters', 'Total Turnout', 'EPIC', 'Tendered Voters', 'Total Votes Polled', 'NOTA'] + cand_names
    for c in sum_cols:
        total_row[c] = df[c].sum()
        
    if total_row['Total Electors'] > 0:
        total_row['Turnout %'] = (total_row['Total Turnout'] / total_row['Total Electors']) * 100
        
    df = pd.concat([df, pd.DataFrame([total_row])], ignore_index=True)
    
    out_path = f'excel_outputs/{ac_num}_boothwise_data.xlsx'
    with pd.ExcelWriter(out_path, engine='openpyxl') as writer:
        title_df = pd.DataFrame([[f'AC {ac_num} Booth-wise Data']])
        title_df.to_excel(writer, sheet_name='Booth-wise Data', index=False, header=False, startrow=0)
        df.to_excel(writer, sheet_name='Booth-wise Data', index=False, startrow=2)
        
    print(f"  Successfully rebuilt AC {ac_num} with {len(booths)} booths.")
    return True

if __name__ == "__main__":
    corrupted = audit_acs()
    print(f"Found {len(corrupted)} corrupted ACs.")
    
    success_count = 0
    for ac in corrupted:
        if rebuild_ac(ac):
            success_count += 1
            
    print(f"Finished rebuilding {success_count}/{len(corrupted)} ACs.")
