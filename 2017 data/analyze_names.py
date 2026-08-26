import os
import pandas as pd
from collections import Counter
import re

words = Counter()

for f in os.listdir('excel_outputs'):
    if not f.endswith('.xlsx'):
        continue
    
    path = os.path.join('excel_outputs', f)
    try:
        df = pd.read_excel(path, header=None)
        
        ps_col = None
        start_idx = -1
        for i in range(5):
            if i < len(df):
                for col in df.columns:
                    val = str(df.iloc[i][col]).strip()
                    if 'Polling Station Name' == val or 'Polling Station' == val:
                        ps_col = col
                        start_idx = i + 1
                        break
            if ps_col is not None:
                break
                
        if ps_col is not None:
            for name in df.iloc[start_idx:][ps_col]:
                if pd.isna(name):
                    continue
                
                parts = str(name).upper().replace('-', ' ').replace('.', ' ').replace(',', ' ').split()
                for p in parts:
                    words[p] += 1
    except Exception as e:
        print(f"Error reading {f}: {e}")

with open('word_counts.txt', 'w', encoding='utf-8') as out:
    out.write("Most common words:\n")
    for w, c in words.most_common(500):
        if any(char.isdigit() for char in w):
            out.write(f"{w}: {c}\n")
        elif len(w) > 3 and c > 50:
            out.write(f"{w}: {c}\n")
        elif len(w) <= 3 and c > 500:
            out.write(f"{w}: {c}\n")
