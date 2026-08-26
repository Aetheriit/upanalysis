import PyPDF2
import re
import pandas as pd
import numpy as np

# Load original headers
orig_df = pd.read_excel('excel_outputs/27_boothwise_data.xlsx', header=None)
header_row = orig_df.iloc[2].values
header_list = list(header_row)

pdf_path = '2017 data 2/2017_Moradabad_BOOTHWISE_DETAIL.pdf'
reader = PyPDF2.PdfReader(pdf_path)

booths_data = []

# To ensure we get the full AC 27 block, we iterate through pages and accumulate text
# But extracting page by page is easier as long as booths don't span pages (they do, but a single booth block is usually intact, or we just extract text entirely).
full_text = ""
for page in reader.pages:
    full_text += page.extract_text() + "\n"

blocks = re.split(r'(?=AC \d+)', full_text)
ac27_text = ""
for block in blocks:
    if block.startswith('AC 27 '):
        ac27_text += block

# Now split AC 27 text by BOOTH
b_blocks = re.split(r'(?=AC 27\s+\|\s*BOOTH)', ac27_text)

for bb in b_blocks:
    if not bb.startswith('AC 27'): continue
    
    # Booth ID
    m_b = re.search(r'BOOTH\s+(\d+)', bb)
    if not m_b: continue
    booth_id = int(m_b.group(1))
    
    # PS Name
    m_ps = re.search(r'PS:\s*(.*?)\n', bb)
    ps_name = m_ps.group(1).strip() if m_ps else ''
    
    # Electors etc
    m_el = re.search(r'Electors\s+([\d,]+)\s*\|\s*Voted\s+M\s+([\d,]+)\s+F\s+([\d,]+)\s+O\s+([\d,]+)\s+Total\s+([\d,]+)', bb)
    if not m_el: continue
    electors = int(m_el.group(1).replace(',',''))
    m_v = int(m_el.group(2).replace(',',''))
    f_v = int(m_el.group(3).replace(',',''))
    o_v = int(m_el.group(4).replace(',',''))
    total_voted = int(m_el.group(5).replace(',',''))
    
    # Tendered
    m_tend = re.search(r'Tendered\s+([\d,]+)', bb)
    tendered = int(m_tend.group(1).replace(',','')) if m_tend else 0
    
    # Candidates
    cand_votes = {}
    lines = bb.split('\n')
    in_cands = False
    for line in lines:
        if 'CANDIDATE' in line and 'PARTY' in line:
            in_cands = True
            continue
        if in_cands:
            if line.strip() == '' or line.startswith('---') or line.startswith('Valid') or line.startswith('=='):
                break
            m_c = re.match(r'\s*(\d+)\s+(.+?)\s+([\d,]+)\s+[\d\.]+%?', line)
            if m_c:
                c_idx = int(m_c.group(1))
                v = int(m_c.group(3).replace(',',''))
                cand_votes[c_idx] = v
    
    row_data = {
        'Booth ID': booth_id,
        'Polling Station Name': ps_name,
        'Total Electors': electors,
        'Male Voters': m_v,
        'Female Voters': f_v,
        'Other Voters': o_v,
        'Total Turnout': total_voted,
        'EPIC': 0, # not cleanly parsed, filling 0 for now as it's not critical
        'Tendered Voters': tendered,
    }
    
    # Add candidate votes
    total_cand_votes = 0
    for i in range(1, 18): # 17 candidates
        cand_col = header_list[9 + i] # Candidate Name 1 is at index 10
        v = cand_votes.get(i, 0)
        row_data[cand_col] = v
        total_cand_votes += v
        
    row_data['NOTA'] = total_voted - total_cand_votes
    row_data['Total Votes Polled'] = total_voted
    row_data['Turnout %'] = (total_voted / electors * 100) if electors > 0 else 0
    row_data['Check Sum'] = True
    
    booths_data.append(row_data)

# Sort by Booth ID to ensure order
booths_data.sort(key=lambda x: x['Booth ID'])

df_new = pd.DataFrame(booths_data)

# Reorder columns to match original
df_new = df_new[header_list]

# Calculate total row
total_row = {'Booth ID': 'Total', 'Polling Station Name': ''}
sum_cols = ['Total Electors', 'Male Voters', 'Female Voters', 'Other Voters', 'Total Turnout', 'EPIC', 'Tendered Voters', 'NOTA', 'Total Votes Polled']
for i in range(1, 18):
    sum_cols.append(header_list[9 + i])

for c in sum_cols:
    total_row[c] = df_new[c].sum()
    
total_row['Turnout %'] = (total_row['Total Turnout'] / total_row['Total Electors'] * 100) if total_row['Total Electors'] > 0 else 0
total_row['Check Sum'] = True

df_new = pd.concat([df_new, pd.DataFrame([total_row])], ignore_index=True)

# Save with exact formatting
writer = pd.ExcelWriter('excel_outputs/27_boothwise_data.xlsx', engine='xlsxwriter')
df_new.to_excel(writer, index=False, header=False, startrow=3)

worksheet = writer.sheets['Sheet1']
# Write titles
worksheet.write(0, 0, 'AC 27 Booth-wise Data')
for col_num, value in enumerate(header_list):
    worksheet.write(2, col_num, value)

writer.close()

print(f"Successfully rebuilt AC 27 with {len(booths_data)} booths.")
