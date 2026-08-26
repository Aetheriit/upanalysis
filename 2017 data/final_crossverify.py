import PyPDF2
import re
import pandas as pd
import glob
import os

pdf_files = glob.glob('2017 data 2/*.pdf')

# Store results
results = {
    'total_acs_checked': 0,
    'total_booths_checked': 0,
    'elector_mismatches': 0,
    'vote_variances': [],
    'major_anomalies': []
}

for pdf_path in pdf_files:
    try:
        reader = PyPDF2.PdfReader(pdf_path)
    except Exception:
        continue
        
    full_text = ""
    for page in reader.pages:
        txt = page.extract_text()
        if txt: full_text += txt + "\n"
        
    # Find AC blocks
    blocks = re.split(r'(?=AC \d+)', full_text)
    
    for block in blocks:
        m_ac = re.match(r'AC (\d+)', block)
        if not m_ac: continue
        ac_num = int(m_ac.group(1))
        
        excel_path = f'excel_outputs/{ac_num}_boothwise_data.xlsx'
        if not os.path.exists(excel_path): continue
        
        try:
            df = pd.read_excel(excel_path, header=None)
        except Exception:
            continue
            
        results['total_acs_checked'] += 1
        
        # Parse Excel booths
        excel_booths = {}
        for i in range(3, len(df)):
            b_val = df.iat[i, 0]
            if str(b_val).strip().lower() == 'total': continue
            try:
                b_id = int(b_val)
                e_el = int(df.iat[i, 2])
                # "Total Votes Polled" is usually near the end. We'll grab column index from row 2
                header = df.iloc[2].values.tolist()
                if 'Total Votes Polled' in header:
                    v_idx = header.index('Total Votes Polled')
                    v_el = int(df.iat[i, v_idx])
                    excel_booths[b_id] = {'E': e_el, 'V': v_el}
            except Exception:
                pass
                
        # Parse PDF booths
        b_blocks = re.split(r'(?=AC \d+\s*.*?\|\s*BOOTH)', block)
        for bb in b_blocks:
            m_b = re.search(r'BOOTH\s+(\d+)', bb)
            if not m_b: continue
            b_id = int(m_b.group(1))
            
            m_el = re.search(r'Electors\s+([\d,]+).*?Total\s+([\d,]+)', bb, re.DOTALL)
            if not m_el: continue
            
            p_el = int(m_el.group(1).replace(',',''))
            p_v = int(m_el.group(2).replace(',',''))
            
            if b_id in excel_booths:
                results['total_booths_checked'] += 1
                e_data = excel_booths[b_id]
                
                e_diff = abs(e_data['E'] - p_el)
                v_diff = abs(e_data['V'] - p_v)
                
                if e_diff > 0:
                    results['elector_mismatches'] += 1
                    if e_diff > 10:
                        results['major_anomalies'].append(f"AC {ac_num} Booth {b_id}: Excel E={e_data['E']} PDF E={p_el}")
                
                results['vote_variances'].append(v_diff)
                
                if v_diff > 20: # Over 20 votes variance is an anomaly
                    results['major_anomalies'].append(f"AC {ac_num} Booth {b_id}: Excel V={e_data['V']} PDF V={p_v} (Diff: {v_diff})")

print("=== FINAL CROSS-VERIFICATION AUDIT ===")
print(f"Total ACs compared: {results['total_acs_checked']}")
print(f"Total Booths cross-referenced: {results['total_booths_checked']}")
print(f"Booths with Mismatched Electors: {results['elector_mismatches']}")

if results['vote_variances']:
    avg_var = sum(results['vote_variances']) / len(results['vote_variances'])
    max_var = max(results['vote_variances'])
    print(f"Vote Variance Average: {avg_var:.2f} votes")
    print(f"Vote Variance Maximum: {max_var} votes")

if results['major_anomalies']:
    print("\nMajor Anomalies (> 20 diff):")
    for a in results['major_anomalies'][:20]:
        print(" - " + a)
else:
    print("\nNo major anomalies found. Data alignment is pristine.")
