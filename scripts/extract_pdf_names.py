import pdfplumber
import re
import pandas as pd
import sys
import os
import traceback

sys.path.append('scripts')
from krutidev_to_unicode import KrutiDev_to_Unicode
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

def extract_ac_booths(pdf_path, target_acs):
    booth_map = {ac: {} for ac in target_acs}
    
    print(f"Reading {pdf_path}...")
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            words = page.extract_words()
            
            # 3 columns: < 390, 390-790, > 790
            col1 = [w for w in words if w['x0'] < 390]
            col2 = [w for w in words if 390 <= w['x0'] < 790]
            col3 = [w for w in words if w['x0'] >= 790]
            
            for col in (col1, col2, col3):
                if not col:
                    continue
                # sort by approximate line, then by x0
                col.sort(key=lambda w: (round(w['top'] / 3), w['x0']))
                text = ' '.join(w['text'] for w in col)
                
                matches = re.finditer(r'AC\s+(\d+)\s+.*?\|\s+BOOTH\s+(\d+)\s+PS:\s+(.*?)\s+(?=Electors|AC\s+\d+|$)', text)
                
                for m in matches:
                    ac = int(m.group(1))
                    booth = int(m.group(2))
                    ps_name = m.group(3).strip()
                    
                    if ac in target_acs:
                        booth_map[ac][booth] = ps_name
                        
            if i % 20 == 0:
                print(f"Processed {i} pages...")
                
    return booth_map

def patch_excel(ac, booth_map):
    file_path = f'2022 data/excel_outputs/{ac}_boothwise_data.xlsx'
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return
        
    df = pd.read_excel(file_path)
    count = 0
    for i in range(1, len(df)):
        try:
            booth_val = str(df.iloc[i, 0]).strip()
            if booth_val.isdigit():
                b_id = int(booth_val)
                if b_id in booth_map:
                    raw_name = booth_map[b_id]
                    # Convert to English
                    uni = KrutiDev_to_Unicode(raw_name)
                    eng = transliterate(uni, sanscript.DEVANAGARI, sanscript.ITRANS).upper().replace('{}', '').replace('~', '')
                    df.iloc[i, 1] = eng
                    count += 1
        except Exception as e:
            print(f"Error on row {i}: {e}")
            traceback.print_exc()
            
    df.to_excel(file_path, index=False)
    print(f"Patched {count} booths for AC {ac}")

def main():
    map1 = extract_ac_booths('2022 data/2022_Muzaffarnagar_BOOTHWISE_DETAIL.pdf', [12, 16])
    patch_excel(12, map1[12])
    patch_excel(16, map1[16])
    
    map2 = extract_ac_booths('2022 data/2022_Sonbhadra_BOOTHWISE_DETAIL.pdf', [403])
    patch_excel(403, map2[403])

if __name__ == '__main__':
    main()
