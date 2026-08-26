import subprocess
import pandas as pd
import glob
import io
import re

corrupted_files = [
"excel_outputs/101_boothwise_data.xlsx",
"excel_outputs/102_boothwise_data.xlsx",
"excel_outputs/112_boothwise_data.xlsx",
"excel_outputs/116_boothwise_data.xlsx",
"excel_outputs/120_boothwise_data.xlsx",
"excel_outputs/122_boothwise_data.xlsx",
"excel_outputs/123_boothwise_data.xlsx",
"excel_outputs/125_boothwise_data.xlsx",
"excel_outputs/126_boothwise_data.xlsx",
"excel_outputs/12_boothwise_data.xlsx",
"excel_outputs/133_boothwise_data.xlsx",
"excel_outputs/134_boothwise_data.xlsx",
"excel_outputs/146_boothwise_data.xlsx",
"excel_outputs/154_boothwise_data.xlsx",
"excel_outputs/155_boothwise_data.xlsx",
"excel_outputs/156_boothwise_data.xlsx",
"excel_outputs/159_boothwise_data.xlsx",
"excel_outputs/15_boothwise_data.xlsx",
"excel_outputs/160_boothwise_data.xlsx",
"excel_outputs/161_boothwise_data.xlsx",
"excel_outputs/16_boothwise_data.xlsx",
"excel_outputs/170_boothwise_data.xlsx",
"excel_outputs/172_boothwise_data.xlsx",
"excel_outputs/182_boothwise_data.xlsx",
"excel_outputs/183_boothwise_data.xlsx",
"excel_outputs/189_boothwise_data.xlsx",
"excel_outputs/197_boothwise_data.xlsx",
"excel_outputs/1_boothwise_data.xlsx",
"excel_outputs/200_boothwise_data.xlsx",
"excel_outputs/224_boothwise_data.xlsx",
"excel_outputs/225_boothwise_data.xlsx",
"excel_outputs/231_boothwise_data.xlsx",
"excel_outputs/236_boothwise_data.xlsx",
"excel_outputs/237_boothwise_data.xlsx",
"excel_outputs/241_boothwise_data.xlsx",
"excel_outputs/244_boothwise_data.xlsx",
"excel_outputs/246_boothwise_data.xlsx",
"excel_outputs/247_boothwise_data.xlsx",
"excel_outputs/248_boothwise_data.xlsx",
"excel_outputs/255_boothwise_data.xlsx",
"excel_outputs/256_boothwise_data.xlsx",
"excel_outputs/257_boothwise_data.xlsx",
"excel_outputs/25_boothwise_data.xlsx",
"excel_outputs/261_boothwise_data.xlsx",
"excel_outputs/262_boothwise_data.xlsx",
"excel_outputs/263_boothwise_data.xlsx",
"excel_outputs/26_boothwise_data.xlsx",
"excel_outputs/290_boothwise_data.xlsx",
"excel_outputs/2_boothwise_data.xlsx",
"excel_outputs/300_boothwise_data.xlsx",
"excel_outputs/313_boothwise_data.xlsx",
"excel_outputs/319_boothwise_data.xlsx",
"excel_outputs/320_boothwise_data.xlsx",
"excel_outputs/323_boothwise_data.xlsx",
"excel_outputs/326_boothwise_data.xlsx",
"excel_outputs/327_boothwise_data.xlsx",
"excel_outputs/328_boothwise_data.xlsx",
"excel_outputs/331_boothwise_data.xlsx",
"excel_outputs/344_boothwise_data.xlsx",
"excel_outputs/356_boothwise_data.xlsx",
"excel_outputs/381_boothwise_data.xlsx",
"excel_outputs/386_boothwise_data.xlsx",
"excel_outputs/390_boothwise_data.xlsx",
"excel_outputs/401_boothwise_data.xlsx",
"excel_outputs/42_boothwise_data.xlsx",
"excel_outputs/44_boothwise_data.xlsx",
"excel_outputs/46_boothwise_data.xlsx",
"excel_outputs/4_boothwise_data.xlsx",
"excel_outputs/51_boothwise_data.xlsx",
"excel_outputs/58_boothwise_data.xlsx",
"excel_outputs/59_boothwise_data.xlsx",
"excel_outputs/61_boothwise_data.xlsx",
"excel_outputs/63_boothwise_data.xlsx",
"excel_outputs/70_boothwise_data.xlsx",
"excel_outputs/71_boothwise_data.xlsx",
"excel_outputs/72_boothwise_data.xlsx",
"excel_outputs/73_boothwise_data.xlsx",
"excel_outputs/74_boothwise_data.xlsx",
"excel_outputs/75_boothwise_data.xlsx",
"excel_outputs/77_boothwise_data.xlsx",
"excel_outputs/7_boothwise_data.xlsx",
"excel_outputs/81_boothwise_data.xlsx",
"excel_outputs/95_boothwise_data.xlsx"
]

all_names = []
for cf in corrupted_files:
    try:
        # Load the old file from git
        # Note: using Forward slashes for git paths
        cf_git = cf.replace('\\', '/')
        file_data = subprocess.check_output(['git', 'show', f'd219fad:{cf_git}'])
        df = pd.read_excel(io.BytesIO(file_data))
        
        # Find polling station name column
        ps_col = None
        for col in df.columns:
            if 'Polling Station Name' in str(col) or 'Polling Station' in str(col):
                ps_col = col
                break
        
        if not ps_col:
            # Check row 1
            for col in df.columns:
                if 'Polling Station Name' in str(df[col].iloc[0]) or 'Polling Station' in str(df[col].iloc[0]):
                    ps_col = col
                    df = df.iloc[1:].reset_index(drop=True)
                    break

        if ps_col:
            names = df[ps_col].dropna().astype(str).tolist()
            all_names.extend(names)
    except Exception as e:
        print(f"Error loading {cf}: {e}")

from collections import Counter
words = []
for name in all_names:
    for word in re.split(r'\s+', name):
        words.append(word)

counts = Counter(words)
print("Most common words:")
for w, c in counts.most_common(100):
    print(f"{w}: {c}")

