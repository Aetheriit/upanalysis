import pandas as pd
import glob
import unicodedata
from indic_transliteration.sanscript import transliterate, DEVANAGARI, IAST
import re

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def has_devanagari(text):
    if not isinstance(text, str):
        return False
    # Check if there is any character in Devanagari block (U+0900 to U+097F)
    return any('\u0900' <= c <= '\u097f' for c in text)

def clean_to_english(text):
    if not isinstance(text, str):
        return text
    if has_devanagari(text):
        iast = transliterate(text, DEVANAGARI, IAST)
        clean = strip_accents(iast).title()
        return clean
    return text

files = glob.glob('excel_outputs/*_boothwise_data.xlsx')
total_fixed_files = 0
total_fixed_rows = 0

for file in files:
    try:
        df = pd.read_excel(file, sheet_name='Booth-wise Data', header=2)
        if 'Polling Station Name' not in df.columns:
            continue
            
        modified = False
        new_names = []
        for name in df['Polling Station Name']:
            if isinstance(name, str) and has_devanagari(name):
                try:
                    eng = clean_to_english(name)
                    if eng != name:
                        new_names.append(eng)
                        modified = True
                        total_fixed_rows += 1
                    else:
                        new_names.append(name)
                except Exception:
                    new_names.append(name)
            else:
                new_names.append(name)
                
        if modified:
            raw_df = pd.read_excel(file, header=None)
            ps_col_idx = df.columns.get_loc('Polling Station Name')
            
            # Reconstruct the column
            raw_df.iloc[3:, ps_col_idx] = new_names
            raw_df.to_excel(file, index=False, header=False)
            total_fixed_files += 1
            print(f'Transliterated {file}')
            
    except Exception as e:
        print(f'Error transliterating {file}: {e}')

print(f'Total files transliterated: {total_fixed_files}')
print(f'Total rows transliterated: {total_fixed_rows}')
