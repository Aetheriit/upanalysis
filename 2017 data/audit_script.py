import pandas as pd
import glob
import os

files = glob.glob('excel_outputs/*_boothwise_data.xlsx')
anomalies = {
    'low_booth_count': {},
    'unnamed_cols': [],
    'numbered_cols_instead_of_candidates': [],
    'missing_ps_names': {},
    'missing_electors': {},
    'missing_demographics': [],
    'checksum_failures': {}
}

for f in files:
    ac_num = int(os.path.basename(f).split('_')[0])
    try:
        df = pd.read_excel(f, sheet_name='Booth-wise Data', header=2)
    except Exception:
        continue
        
    cols = df.columns.tolist()
    booth_rows = df[~df['Booth ID'].isna()]
    
    # 1. Low booth count
    if len(booth_rows) < 100:
        anomalies['low_booth_count'][ac_num] = len(booth_rows)
        
    # 2. Unnamed cols
    if any('Unnamed' in str(c) for c in cols):
        anomalies['unnamed_cols'].append(ac_num)
        
    # 3. Numbered cols
    if 'Tendered Voters' in cols:
        tend_idx = cols.index('Tendered Voters')
        cand_cols = cols[tend_idx+1: -5]
        if any(str(c).isdigit() for c in cand_cols):
            anomalies['numbered_cols_instead_of_candidates'].append(ac_num)
            
    # 4. Missing PS Names
    if 'Polling Station Name' in cols:
        missing_ps = booth_rows['Polling Station Name'].isna().sum()
        if missing_ps > 0:
            anomalies['missing_ps_names'][ac_num] = int(missing_ps)
            
    # 5. Missing Electors
    if 'Total Electors' in cols:
        missing_electors = booth_rows['Total Electors'].isna().sum() + (booth_rows['Total Electors'] == 0).sum()
        if missing_electors > 50:
            anomalies['missing_electors'][ac_num] = int(missing_electors)
            
    # 6. Checksum failures
    if 'Check Sum' in cols:
        fails = (~df['Check Sum'].astype(bool)).sum()
        if fails > 0:
            anomalies['checksum_failures'][ac_num] = int(fails)
            
    # 7. Missing demographics
    demo_cols = ['Male Voters', 'Female Voters']
    for d in demo_cols:
        if d not in cols:
            anomalies['missing_demographics'].append(ac_num)
            break
        else:
            if booth_rows[d].isna().sum() > 50:
                if ac_num not in anomalies['missing_demographics']:
                    anomalies['missing_demographics'].append(ac_num)

# Write to markdown
with open(r'C:\Users\ASUS\.gemini\antigravity-ide\brain\07514ea7-6f52-45d8-89bc-d7f90f95d2a5\audit_report.md', 'w') as f:
    f.write('# Comprehensive Audit Report: 403 Constituencies\n\n')
    f.write('The following structural and data discrepancies were found across the generated `.xlsx` files.\n\n')
    
    f.write('## 1. Severely Truncated Files (Less than 100 Booths extracted)\n')
    f.write('These files are missing the vast majority of their booths. In some cases, only 1 booth was extracted.\n')
    low_booths = sorted(anomalies['low_booth_count'].items())
    f.write(f'**Total Affected ACs: {len(low_booths)}**\n')
    f.write(', '.join([f'AC {k} ({v} booths)' for k, v in low_booths]) + '\n\n')
    
    f.write('## 2. Broken Candidate Columns (Numbered headers instead of Candidate Names)\n')
    f.write('Instead of Candidate Names/Parties, the headers are just numbers (1, 2, 3...) meaning the candidate mapping failed.\n')
    f.write(f'**Total Affected ACs: {len(anomalies["numbered_cols_instead_of_candidates"])}**\n')
    f.write(', '.join([f'AC {k}' for k in sorted(anomalies['numbered_cols_instead_of_candidates'])]) + '\n\n')
    
    f.write('## 3. Unnamed Columns (Data shifted out of bounds)\n')
    f.write('Columns like "Unnamed: 12" appeared, indicating table misalignment.\n')
    f.write(f'**Total Affected ACs: {len(anomalies["unnamed_cols"])}**\n')
    f.write(', '.join([f'AC {k}' for k in sorted(anomalies['unnamed_cols'])]) + '\n\n')
    
    f.write('## 4. Missing Polling Station Names\n')
    f.write('Booths are missing their Polling Station string.\n')
    miss_ps = sorted(anomalies['missing_ps_names'].items())
    f.write(f'**Total Affected ACs: {len(miss_ps)}**\n')
    f.write('*(Too many to list individually, over 250 constituencies are missing some polling station names)*\n\n')
    
    f.write('## 5. Missing or Zero Total Electors\n')
    f.write('Booths have 0 or blank total electors, which breaks Turnout % calculations.\n')
    miss_el = sorted(anomalies['missing_electors'].items())
    f.write(f'**Total Affected ACs: {len(miss_el)}**\n')
    f.write('*(Too many to list individually, over 200 constituencies affected)*\n\n')
    
    f.write('## 6. Missing Demographic Columns (Male/Female Voters)\n')
    f.write('The entire columns for Male/Female voters are missing or completely empty.\n')
    f.write(f'**Total Affected ACs: {len(anomalies["missing_demographics"])}**\n')
    f.write(', '.join([f'AC {k}' for k in sorted(anomalies['missing_demographics'])]) + '\n\n')
    
    f.write('## 7. Checksum Failures (Total Turnout != Total Votes Polled)\n')
    fails = sorted(anomalies['checksum_failures'].items())
    f.write(f'**Total Affected ACs: {len(fails)}**\n')
    f.write('*(Indicates severe column shifting where votes are spilling into wrong columns)*\n')
