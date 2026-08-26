import pandas as pd
import glob
import os
import krutidev
import re

files = glob.glob('excel_outputs/*_boothwise_data.xlsx')

def is_krutidev(text):
    if not isinstance(text, str):
        return False
    # If the text has lots of a-z letters but no standard English words, it's likely KrutiDev
    # Common KrutiDev substrings:
    patterns = ['izk', 'ik0', 'd{', 'la0', 'nhu', 'fo0', 'jk;', 'iqj']
    for p in patterns:
        if p in text:
            return True
    return False

fixed_files = 0
total_fixed_rows = 0

for file in files:
    try:
        df = pd.read_excel(file, sheet_name='Booth-wise Data', header=2)
        if 'Polling Station Name' not in df.columns:
            continue
            
        modified = False
        new_names = []
        for name in df['Polling Station Name']:
            if isinstance(name, str) and is_krutidev(name):
                # KrutiDev to Unicode
                try:
                    uni = krutidev.KrutiDev_to_Unicode(name)
                    new_names.append(uni)
                    modified = True
                    total_fixed_rows += 1
                except Exception as e:
                    new_names.append(name)
            else:
                new_names.append(name)
                
        if modified:
            df['Polling Station Name'] = new_names
            
            # Reconstruct the full excel structure (with headers)
            # The original structure has 2 rows of headers. We will just save df directly since we only read header=2
            # Wait, we need to preserve the first 2 rows of headers.
            
            # Read raw
            raw_df = pd.read_excel(file, header=None)
            
            # The polling station name is at column 1 (0-indexed: 0 is Booth ID, 1 is Polling Station Name)
            # Find which column it actually is in df
            ps_col_idx = df.columns.get_loc('Polling Station Name')
            
            # Update raw_df starting from row 3
            raw_df.iloc[3:, ps_col_idx] = new_names
            
            raw_df.to_excel(file, index=False, header=False)
            fixed_files += 1
            print(f'Fixed {file}')
            
    except Exception as e:
        print(f'Error processing {file}: {e}')

print(f'Total files fixed: {fixed_files}')
print(f'Total rows fixed: {total_fixed_rows}')
