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
    try:
        df = pd.read_excel(filepath, nrows=10, header=None)
        text = df.to_string().upper()
        match = re.search(r'CONSTITUENCY[^\d]*(\d{1,3})', text)
        if not match:
            match = re.search(r'AC NO\.\s*(\d{1,3})', text)
        if match:
            return int(match.group(1))
    except:
        pass
    return None

def main():
    print("Mapping 2022 data 2 files to actual AC numbers...")
    ac_file_map = {}
    for f in glob.glob('2022 data 2/*.xls*'):
        ac = get_actual_ac(f)
        if ac:
            ac_file_map[ac] = f

    missing_acs = [119, 176, 177, 185, 186, 187, 295, 299, 381, 386, 389, 390]
    patchable_gibberish_acs = [17, 20, 21, 67, 102, 116, 124, 152, 170, 172, 178, 183, 194, 231, 236, 237, 290, 302, 323, 357, 358, 359, 361, 363, 378, 383]

    print(f"Generating 12 missing ACs...")
    for ac in missing_acs:
        if ac not in ac_file_map:
            print(f"Skipping AC {ac} (not in map)")
            continue
        filepath = ac_file_map[ac]
        print(f"Generating AC {ac} from {filepath}...")
        df_raw = pd.read_excel(filepath, header=None)
        
        try:
            # Extract candidate names (Row 3, columns 10, 13, 16...)
            candidate_names = []
            candidate_cols = []
            for col in range(10, df_raw.shape[1], 3):
                name = str(df_raw.iloc[3, col]).strip()
                if name != 'nan' and name and name != 'None' and 'NOTA' not in name.upper() and 'TOTAL' not in name.upper() and 'REJECTED' not in name.upper():
                    candidate_names.append(translate_to_english(name))
                    vote_col = col + 2
                    if vote_col >= df_raw.shape[1]:
                        vote_col = df_raw.shape[1] - 1 # Fallback to last column
                    candidate_cols.append(vote_col)
                    
            if not candidate_names or all(n.isdigit() for n in candidate_names):
                print(f"Skipping AC {ac}: Doesn't look like Form 20 data")
                continue
                
            # Find NOTA column (sometimes NOTA is just a regular candidate column, or at the end)
            nota_col = None
            for col in range(10, df_raw.shape[1]):
                val = str(df_raw.iloc[3, col]).strip().upper()
                if 'NOTA' in val or 'NONE OF THE ABOVE' in val:
                    nota_col = col + 2 if (col + 2) < df_raw.shape[1] else col # adjust if necessary
                    break
            if not nota_col:
                # Maybe NOTA is in row 4?
                for col in range(10, df_raw.shape[1]):
                    val = str(df_raw.iloc[4, col]).strip().upper()
                    if 'NOTA' in val or 'NONE OF THE ABOVE' in val:
                        nota_col = col + 2
                        break
            
            data_rows = []
            # Find start row (usually around row 6)
            start_row = 6
            for i in range(5, min(15, df_raw.shape[0])):
                val = str(df_raw.iloc[i, 1]).strip()
                if val.isdigit() and int(val) == 1:
                    start_row = i
                    break
                    
            for row in range(start_row, df_raw.shape[0]):
                booth_id = str(df_raw.iloc[row, 1]).strip()
                if not booth_id.isdigit():
                    continue # End of booths
                    
                booth_name = translate_to_english(str(df_raw.iloc[row, 2]).strip())
                total_electors = df_raw.iloc[row, 3]
                male_voters = df_raw.iloc[row, 4]
                female_voters = df_raw.iloc[row, 5]
                other_voters = df_raw.iloc[row, 6]
                total_turnout = df_raw.iloc[row, 7]
                
                # compute turnout %
                try:
                    turnout_pct = round((float(total_turnout) / float(total_electors)) * 100, 2)
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
                    row_dict[name] = df_raw.iloc[row, col]
                    
                if nota_col:
                    row_dict['NOTA'] = df_raw.iloc[row, nota_col]
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
        for i in range(5, 10):
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
            
        # Open the extracted PDF file
        extracted_filepath = f'2022 data/excel_outputs/{ac}_boothwise_data.xlsx'
        if not os.path.exists(extracted_filepath):
            print(f"File not found: {extracted_filepath}")
            continue
            
        df_extracted = pd.read_excel(extracted_filepath, header=1) # Row 1 has the actual columns
        patched_count = 0
        for i in range(len(df_extracted)):
            booth_val = str(df_extracted.iloc[i, 0]).strip()
            if booth_val.isdigit():
                b_id = int(booth_val)
                if b_id in booth_map:
                    df_extracted.iloc[i, 1] = booth_map[b_id]
                    patched_count += 1
                    
        # Re-save the file with the top header
        df_out = pd.read_excel(extracted_filepath)
        # Update the values directly
        for i in range(1, len(df_out)):
            booth_val = str(df_out.iloc[i, 0]).strip()
            if booth_val.isdigit():
                b_id = int(booth_val)
                if b_id in booth_map:
                    df_out.iloc[i, 1] = booth_map[b_id]
        
        df_out.to_excel(extracted_filepath, index=False)
        print(f"Patched {patched_count} booths for AC {ac}")

if __name__ == '__main__':
    main()
