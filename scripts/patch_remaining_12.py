import os
import glob
import re
import pandas as pd
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

def is_likely_hindi(text):
    if not isinstance(text, str):
        return False
    # Check if string contains Devanagari characters
    for char in text:
        if '\u0900' <= char <= '\u097F':
            return True
    return False

def translate_to_english(text):
    if not isinstance(text, str):
        return text
    if not is_likely_hindi(text):
        return text
    try:
        # Simple transliteration
        eng_text = transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
        return eng_text.upper()
    except Exception as e:
        return text

def get_actual_ac(filepath):
    import re
    filename = filepath.split('\\')[-1].split('/')[-1]
    match = re.search(r'AC(\d+)', filename, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None

def main():
    print("Mapping 2022 data 2 files to actual AC numbers...")
    ac_file_map = {}
    import glob
    for f in glob.glob('2022 data 2/*.xls*'):
        ac = get_actual_ac(f)
        if ac:
            ac_file_map[ac] = f

    missing_acs = [167, 179, 242, 251, 298, 371]
    patchable_gibberish_acs = [12, 16, 101, 173, 320, 403]

    print(f"Generating {len(missing_acs)} missing ACs...")
    for ac in missing_acs:
        if ac not in ac_file_map:
            print(f"Skipping AC {ac} (not in map)")
            continue
        filepath = ac_file_map[ac]
        print(f"Generating AC {ac} from {filepath}...")
        df_raw = pd.read_excel(filepath, header=None)
        
        try:
            # For these, we might have header variations, let's look for the row with 'Total No. of Electors'
            header_row = 3
            for r in range(10):
                row_str = ' '.join([str(x) for x in df_raw.iloc[r].values if pd.notna(x)])
                if 'Electors' in row_str or 'Male' in row_str:
                    header_row = r
                    break
            
            # Now candidate names are in header_row (usually) or the row below it
            candidate_names = []
            candidate_cols = []
            # We look from col 8 onwards
            for col in range(8, df_raw.shape[1]):
                name1 = str(df_raw.iloc[header_row, col]).strip()
                name2 = str(df_raw.iloc[header_row+1, col]).strip() if header_row+1 < df_raw.shape[0] else ''
                
                # Heuristic: the candidate name could be in name1 or name2
                name = name1 if name1 and name1 != 'nan' and len(name1) > 2 else name2
                if name and name != 'nan' and name != 'None' and 'NOTA' not in name.upper() and 'TOTAL' not in name.upper() and 'REJECTED' not in name.upper() and not name.isdigit():
                    # check if this is a vote column
                    if 'Vote Secured' in name or 'Sl. No.' in name or 'Party' in name:
                        continue # Sometimes they span columns
                    # check if this column actually has votes in the data rows
                    try:
                        # check row header_row+2
                        val = df_raw.iloc[header_row+2, col]
                        if pd.isna(val) or not str(val).isdigit():
                            continue
                    except:
                        pass
                        
                    candidate_names.append(translate_to_english(name))
                    candidate_cols.append(col)
                    
            if not candidate_names:
                print(f"Skipping AC {ac}: Could not find candidates")
                continue
                
            nota_col = None
            for col in range(8, df_raw.shape[1]):
                val1 = str(df_raw.iloc[header_row, col]).strip().upper()
                val2 = str(df_raw.iloc[header_row+1, col]).strip().upper() if header_row+1 < df_raw.shape[0] else ''
                if 'NOTA' in val1 or 'NONE OF THE ABOVE' in val1 or 'NOTA' in val2 or 'NONE OF THE ABOVE' in val2:
                    nota_col = col
                    break
            
            data_rows = []
            start_row = header_row + 2
            for i in range(header_row, min(header_row+15, df_raw.shape[0])):
                val = str(df_raw.iloc[i, 1]).strip()
                if val.isdigit() and int(val) == 1:
                    start_row = i
                    break
                    
            for row in range(start_row, df_raw.shape[0]):
                booth_id = str(df_raw.iloc[row, 1]).strip()
                if not booth_id.isdigit():
                    continue # End of booths
                    
                booth_name = translate_to_english(str(df_raw.iloc[row, 2]).strip())
                total_electors = df_raw.iloc[row, 3] if pd.notna(df_raw.iloc[row, 3]) else 0
                male_voters = df_raw.iloc[row, 4] if pd.notna(df_raw.iloc[row, 4]) else 0
                female_voters = df_raw.iloc[row, 5] if pd.notna(df_raw.iloc[row, 5]) else 0
                other_voters = df_raw.iloc[row, 6] if pd.notna(df_raw.iloc[row, 6]) else 0
                total_turnout = df_raw.iloc[row, 7] if pd.notna(df_raw.iloc[row, 7]) else 0
                
                try:
                    turnout_pct = round((float(total_turnout) / float(total_electors)) * 100, 2) if float(total_electors) > 0 else 0.0
                except:
                    turnout_pct = 0.0
                    
                row_dict = {
                    'BOOTH ID': int(booth_id),
                    'POLLING STATION NAME': booth_name,
                    'TOTAL ELECTORS': total_electors,
                    'MALE VOTERS': male_voters,
                    'FEMALE VOTERS': female_voters,
                    'OTHER VOTERS': other_voters,
                    'TOTAL TURNOUT': total_turnout,
                    'TURNOUT %': turnout_pct
                }
                
                for name, col in zip(candidate_names, candidate_cols):
                    v = df_raw.iloc[row, col]
                    row_dict[name] = v if pd.notna(v) else 0
                    
                if nota_col:
                    v = df_raw.iloc[row, nota_col]
                    row_dict['NOTA'] = v if pd.notna(v) else 0
                else:
                    row_dict['NOTA'] = 0
                    
                data_rows.append(row_dict)
                
            df_new = pd.DataFrame(data_rows)
            cols = list(df_new.columns)
            header_df = pd.DataFrame(columns=[f'AC {ac} Booth-wise Data'] + ['Unnamed: ' + str(i) for i in range(1, len(cols))])
            header_df.loc[0] = cols
            
            df_new.columns = header_df.columns
            final_df = pd.concat([header_df, df_new], ignore_index=True)
            
            out_path = f'2022 data/excel_outputs/{ac}_boothwise_data.xlsx'
            final_df.to_excel(out_path, index=False)
            print(f"Saved AC {ac} to {out_path}")
        except Exception as e:
            print(f"Error processing AC {ac}: {e}")

    print(f"\nPatching {len(patchable_gibberish_acs)} gibberish ACs...")
    for ac in patchable_gibberish_acs:
        if ac not in ac_file_map:
            print(f"Skipping AC {ac} (not in map)")
            continue
            
        print(f"Patching AC {ac}...")
        raw_filepath = ac_file_map[ac]
        df_raw = pd.read_excel(raw_filepath, header=None)
        
        # Build a mapping of booth ID -> clean name
        booth_map = {}
        start_row = 6
        for i in range(15):
            val = str(df_raw.iloc[i, 1]).strip()
            if val.isdigit() and int(val) == 1:
                start_row = i
                break
                
        for row in range(start_row, df_raw.shape[0]):
            booth_id = str(df_raw.iloc[row, 1]).strip()
            if not booth_id.isdigit():
                continue
            booth_name = translate_to_english(str(df_raw.iloc[row, 2]).strip())
            booth_map[int(booth_id)] = booth_name
            
        extracted_filepath = f'2022 data/excel_outputs/{ac}_boothwise_data.xlsx'
        if not os.path.exists(extracted_filepath):
            print(f"File not found: {extracted_filepath}")
            continue
            
        df_extracted = pd.read_excel(extracted_filepath, header=1)
        patched_count = 0
        df_out = pd.read_excel(extracted_filepath)
        for i in range(1, len(df_out)):
            booth_val = str(df_out.iloc[i, 0]).strip()
            if booth_val.isdigit():
                b_id = int(booth_val)
                if b_id in booth_map:
                    df_out.iloc[i, 1] = booth_map[b_id]
                    patched_count += 1
        
        df_out.to_excel(extracted_filepath, index=False)
        print(f"Patched {patched_count} booths for AC {ac}")

if __name__ == '__main__':
    main()
