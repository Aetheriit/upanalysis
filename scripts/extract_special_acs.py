import pandas as pd
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

def translate_to_english(text):
    if not isinstance(text, str): return text
    has_hindi = any('\u0900' <= char <= '\u097F' for char in text)
    if not has_hindi: return text
    try:
        return transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS).upper()
    except: return text

def process_185():
    print("Processing AC 185...")
    df = pd.read_excel('2022 data 2/AC185.xls', header=None)
    booths = []
    for i in range(df.shape[0]):
        row = df.iloc[i]
        if pd.notna(row[0]) and 'Round No.' in str(row[0]):
            nota_idx = -1
            for j in range(i+6, i+30):
                if j < df.shape[0] and pd.notna(df.iloc[j, 1]) and 'NOTA' in str(df.iloc[j, 1]).upper():
                    nota_idx = j
                    break
                    
            candidates = []
            if nota_idx != -1:
                for j in range(i+6, nota_idx + 1):
                    c_name = translate_to_english(str(df.iloc[j, 1]).strip())
                    candidates.append((j, c_name))
                    
            electors_row = i + 4
            for col in range(2, df.shape[1]):
                booth_id = df.iloc[i+2, col]
                if pd.isna(booth_id) or str(booth_id).strip() == '' or str(booth_id).strip() == 'Total':
                    break
                    
                booth_data = {
                    'BOOTH ID': int(booth_id),
                    'POLLING STATION NAME': 'N/A',
                    'TOTAL ELECTORS': df.iloc[electors_row, col],
                    'MALE VOTERS': 0, 'FEMALE VOTERS': 0, 'OTHER VOTERS': 0,
                }
                total_turnout = 0
                for j, c_name in candidates:
                    votes = df.iloc[j, col]
                    if pd.isna(votes): votes = 0
                    booth_data[c_name] = int(votes)
                    if c_name.upper() != 'NOTA':
                        total_turnout += int(votes)
                    
                booth_data['TOTAL TURNOUT'] = total_turnout + booth_data.get('NOTA', 0)
                try:
                    booth_data['TURNOUT %'] = round((booth_data['TOTAL TURNOUT'] / float(df.iloc[electors_row, col])) * 100, 2)
                except:
                    booth_data['TURNOUT %'] = 0.0
                
                booths.append(booth_data)

    save_ac(185, booths)

def process_horizontal(ac, file_path, name_row, cand_start_col, name_offset=0, vote_offset=2, data_start_row=8, booth_col=1, name_col=2, elec_col=3, turn_col=7, step=3):
    print(f"Processing AC {ac}...")
    df = pd.read_excel(file_path, header=None)
    
    candidates = []
    for col in range(cand_start_col, df.shape[1], step):
        c_name = str(df.iloc[name_row, col + name_offset]).strip()
        if pd.notna(c_name) and c_name != 'nan' and c_name != 'None':
            c_name = translate_to_english(c_name)
            if c_name.startswith('('):
                # Remove leading (1) 
                c_name = c_name.split(')', 1)[-1].strip()
            candidates.append((col + vote_offset, c_name))
            
    booths = []
    for row in range(data_start_row, df.shape[0]):
        booth_id = str(df.iloc[row, booth_col]).strip()
        if not booth_id.isdigit(): continue
        
        booth_name = translate_to_english(str(df.iloc[row, name_col]).strip())
        total_electors = df.iloc[row, elec_col]
        total_turnout = df.iloc[row, turn_col]
        
        try: turnout_pct = round((float(total_turnout) / float(total_electors)) * 100, 2)
        except: turnout_pct = 0.0
            
        booth_data = {
            'BOOTH ID': int(booth_id),
            'POLLING STATION NAME': booth_name,
            'TOTAL ELECTORS': total_electors,
            'MALE VOTERS': 0, 'FEMALE VOTERS': 0, 'OTHER VOTERS': 0,
            'TOTAL TURNOUT': total_turnout,
            'TURNOUT %': turnout_pct
        }
        
        for v_col, c_name in candidates:
            if v_col < df.shape[1]:
                votes = df.iloc[row, v_col]
            else:
                votes = 0
            if pd.isna(votes): votes = 0
            booth_data[c_name] = int(votes)
            
        booths.append(booth_data)
        
    save_ac(ac, booths)

def save_ac(ac, booths):
    df_out = pd.DataFrame(booths)
    cols = list(df_out.columns)
    
    # reorder NOTA if exists
    nota_col = None
    for c in cols:
        if 'NOTA' in c.upper():
            nota_col = c
            break
    if nota_col:
        cols.remove(nota_col)
        cols.append(nota_col)
        df_out = df_out[cols]
        # rename exactly to NOTA
        df_out.rename(columns={nota_col: 'NOTA'}, inplace=True)
        cols[-1] = 'NOTA'
        
    header_df = pd.DataFrame(columns=[f'AC {ac} Booth-wise Data'] + ['Unnamed: ' + str(i) for i in range(1, len(cols))])
    
    print(f"Len cols: {len(cols)}")
    print(f"Len header_df.columns: {len(header_df.columns)}")
    print(f"Cols: {cols}")
    print(f"Header cols: {header_df.columns}")
    
    header_df.loc[0] = cols
    df_out.columns = header_df.columns
    final_df = pd.concat([header_df, df_out], ignore_index=True)
    
    out_path = f'2022 data/excel_outputs/{ac}_boothwise_data.xlsx'
    final_df.to_excel(out_path, index=False)
    print(f"Saved AC {ac} to {out_path} with {len(booths)} booths")

def process_167():
    print("Processing AC 167...")
    df = pd.read_excel('2022 data 2/AC167.xls', header=None)
    booths = []
    candidates = []
    for col in range(1, 17):
        c_name = translate_to_english(str(df.iloc[6, col]).strip())
        candidates.append((col, c_name))
        
    for row in range(7, df.shape[0]):
        booth_id = str(df.iloc[row, 0]).strip()
        if not booth_id.isdigit(): continue
        total_turnout = df.iloc[row, 19] if pd.notna(df.iloc[row, 19]) else 0
        booth_data = {
            'BOOTH ID': int(booth_id),
            'POLLING STATION NAME': 'N/A',
            'TOTAL ELECTORS': 0, 'MALE VOTERS': 0, 'FEMALE VOTERS': 0, 'OTHER VOTERS': 0,
            'TOTAL TURNOUT': total_turnout, 'TURNOUT %': 0.0
        }
        for v_col, c_name in candidates:
            votes = df.iloc[row, v_col]
            if pd.isna(votes): votes = 0
            if 'NOTA' in c_name.upper() or 'dksbZ ugha' in c_name: c_name = 'NOTA'
            booth_data[c_name] = int(float(votes))
        booths.append(booth_data)
    save_ac(167, booths)

def process_251():
    print("Processing AC 251...")
    df = pd.read_excel('2022 data 2/AC251.xls', header=None)
    booths = []
    candidates = []
    for col in range(2, 20):
        c_name = translate_to_english(str(df.iloc[8, col]).strip())
        candidates.append((col, c_name))
    candidates.append((22, 'NOTA'))
        
    for row in range(10, df.shape[0]):
        booth_id = str(df.iloc[row, 1]).strip()
        if not booth_id.isdigit(): continue
        total_turnout = df.iloc[row, 23] if pd.notna(df.iloc[row, 23]) else 0
        booth_data = {
            'BOOTH ID': int(booth_id),
            'POLLING STATION NAME': 'N/A',
            'TOTAL ELECTORS': 0, 'MALE VOTERS': 0, 'FEMALE VOTERS': 0, 'OTHER VOTERS': 0,
            'TOTAL TURNOUT': total_turnout, 'TURNOUT %': 0.0
        }
        for v_col, c_name in candidates:
            votes = df.iloc[row, v_col]
            if pd.isna(votes): votes = 0
            booth_data[c_name] = int(float(votes))
        booths.append(booth_data)
    save_ac(251, booths)

if __name__ == '__main__':
    process_167()
    process_251()
    # AC 179: c_names row 3, col 9 (step 3), votes col 11 (offset 2). Data starts row 6. Booth id col 0. name col 1. elec col 2. turn col 6
    process_horizontal(179, '2022 data 2/AC179.xlsx', name_row=3, cand_start_col=9, name_offset=0, vote_offset=2, data_start_row=6, booth_col=0, name_col=1, elec_col=2, turn_col=6, step=3)
    process_185()
    # AC 186: c_names row 4, col 10 (step 3), votes col 12 (offset 2). Data starts row 8. Booth id col 1. name col 2. turn col 7
    process_horizontal(186, '2022 data 2/AC186.xls', name_row=4, cand_start_col=10, name_offset=0, vote_offset=2, data_start_row=8, booth_col=1, name_col=2, elec_col=3, turn_col=7, step=3)
    # AC 187: c_names row 6, col 11 (step 3), votes col 12 (offset 1). Data starts row 6. Booth id col 0. name col 2. turn col 7
    process_horizontal(187, '2022 data 2/AC187.xls', name_row=6, cand_start_col=11, name_offset=0, vote_offset=1, data_start_row=6, booth_col=0, name_col=2, elec_col=3, turn_col=7, step=3)
    # AC 371: c_names row 6, col 10 (step 3), votes col 12 (offset 2). Data starts row 8. Booth id col 1. name col 2. turn col 7
    process_horizontal(371, '2022 data 2/AC371.xlsx', name_row=6, cand_start_col=10, name_offset=0, vote_offset=2, data_start_row=8, booth_col=1, name_col=2, elec_col=3, turn_col=7, step=3)
    # AC 381: c_names row 4, col 10 (step 3), votes col 12 (offset 2). Data starts row 6. Booth id col 1. name col 2. turn col 7
    process_horizontal(381, '2022 data 2/AC381.xlsx', name_row=4, cand_start_col=10, name_offset=0, vote_offset=2, data_start_row=6, booth_col=1, name_col=2, elec_col=3, turn_col=7, step=3)
