import pandas as pd
import os
import re
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

def clean_kruti_to_unicode(text):
    text = str(text).strip()
    if pd.isna(text) or text == 'nan' or not text:
        return ''
    try:
        from krutidev_to_unicode import KrutiDev_to_Unicode
        if re.search(r'izk|fo0|ua0|d\{k|iV~Vh', text) or (len(re.findall(r'[a-z]', text)) > len(re.findall(r'[A-Z]', text))):
            text = KrutiDev_to_Unicode(text)
        if re.search(r'[\u0900-\u097F]', text):
            text = transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
            text = re.sub(r'([A-Za-z])a(?=\s|$|[^A-Za-z])', r'\1', text)
            text = text.replace('.h', '').replace('aa', 'A').replace('ii', 'I').replace('uu', 'U').upper()
    except:
        pass
    return text.strip()

files = [31, 32, 33, 111, 162, 163, 164, 165, 166, 167, 193, 194, 259, 390, 396]
good_files = [31, 32, 33, 111, 162, 163, 164, 165, 166, 167, 259, 390, 396]

for f in good_files:
    xls = pd.ExcelFile(f'2017_missing/{f}.xls')
    
    # Find best sheet
    best_sheet = None
    max_rows = 0
    for s in xls.sheet_names:
        try:
            df = pd.read_excel(xls, sheet_name=s, header=None)
            if len(df) > max_rows:
                max_rows = len(df)
                best_sheet = s
        except: pass
        
    df = pd.read_excel(xls, sheet_name=best_sheet, header=None)
    
    # Locate data start (look for 1, 2, 3 in first or second column)
    data_start_row = -1
    booth_col = -1
    for i in range(min(20, len(df))):
        for col in [0, 1, 2]:
            val = str(df.iat[i, col]).strip()
            if val == '1' and str(df.iat[i+1, col]).strip() == '2':
                data_start_row = i
                booth_col = col
                break
        if data_start_row != -1: break
        
    if data_start_row == -1:
        print(f"Failed to find data start in AC {f}")
        continue
        
    cand_row = data_start_row - 1
    # Check if cand_row has names, else try cand_row - 1
    if pd.isna(df.iat[cand_row, booth_col + 2]):
        cand_row = cand_row - 1
        
    headers = []
    for col in range(len(df.columns)):
        headers.append(clean_kruti_to_unicode(df.iat[cand_row, col]))
        
    # Build extracted dataframe
    extracted = []
    for i in range(data_start_row, len(df)):
        b_val = str(df.iat[i, booth_col]).strip()
        if not b_val.isdigit(): continue
        
        row_data = {'Booth ID': b_val}
        for col in range(booth_col + 1, len(df.columns)):
            h = headers[col]
            if not h: h = f"Col_{col}"
            val = df.iat[i, col]
            row_data[h] = val
            
        extracted.append(row_data)
        
    out_df = pd.DataFrame(extracted)
    out_df.to_csv(f'scratch/extracted_{f}.csv', index=False)
    print(f"Extracted {len(out_df)} booths for AC {f}")

