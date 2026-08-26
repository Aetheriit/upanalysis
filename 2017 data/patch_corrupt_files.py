import subprocess
import pandas as pd
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

def clean_name(name):
    if pd.isna(name):
        return name
    name = str(name)
    name = name.replace("A0 PA0", "Primary School")
    name = name.replace("A0PA0", "Primary School")
    name = name.replace("A0 PA.", "Primary School")
    name = name.replace("A. P.", "Primary School")
    
    name = name.replace("I0 KA0", "Inter College")
    name = name.replace("I0KA0", "Inter College")
    name = name.replace("I0 KA.", "Inter College")
    name = name.replace("VA0 RA0 U0 MA0 V0", "Senior Govt High School")
    name = name.replace("BA0RA0 K0U0MA.N0 V0", "Senior Govt High School")
    name = name.replace("JU0 HA0", "Junior High School")
    name = name.replace("JU0HA0", "Junior High School")
    
    name = name.replace("K SAM YA", "Room No ")
    name = name.replace("K SAM0", "Room No ")
    name = name.replace("K. SAM0", "Room No ")
    name = name.replace("SAM0", "Room No ")
    name = name.replace("SAM YA", "Room No ")
    
    name = name.replace("PARU", "PUR")
    name = name.replace("V DYALAYA", "VIDYALAYA")
    
    name = re.sub(r'[\"\&\%\#]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

patched_count = 0

for cf in corrupted_files:
    try:
        # Load OLD file
        cf_git = cf.replace('\\', '/')
        file_data = subprocess.check_output(['git', 'show', f'd219fad:{cf_git}'])
        old_df = pd.read_excel(io.BytesIO(file_data), header=None)
        
        old_ps_col = None
        old_start_idx = -1
        for i in range(5):
            if i < len(old_df):
                for col in old_df.columns:
                    if 'Polling Station Name' == str(old_df.iloc[i][col]).strip() or 'Polling Station' == str(old_df.iloc[i][col]).strip():
                        old_ps_col = col
                        old_start_idx = i + 1
                        break
            if old_ps_col is not None:
                break

        if old_ps_col is None:
            print(f"Skipping {cf}: could not find Polling Station col in old df")
            continue
            
        old_names = old_df[old_ps_col].tolist()[old_start_idx:]
        cleaned_names = [clean_name(n) for n in old_names]
        
        # Load NEW file
        new_df = pd.read_excel(cf, header=None)
        
        new_ps_col = None
        new_start_idx = -1
        for i in range(5):
            if i < len(new_df):
                for col in new_df.columns:
                    if 'Polling Station Name' == str(new_df.iloc[i][col]).strip() or 'Polling Station' == str(new_df.iloc[i][col]).strip():
                        new_ps_col = col
                        new_start_idx = i + 1
                        break
            if new_ps_col is not None:
                break
                
        if new_ps_col is None:
            print(f"Skipping {cf}: could not find Polling Station col in new df")
            continue
            
        # Patch
        num_new_names = len(new_df) - new_start_idx
        
        if len(cleaned_names) >= num_new_names:
            new_df.loc[new_start_idx:, new_ps_col] = cleaned_names[:num_new_names]
        else:
            print(f"Warning {cf}: Length mismatch. Old has {len(cleaned_names)}, New has {num_new_names}")
            new_df.loc[new_start_idx:new_start_idx+len(cleaned_names)-1, new_ps_col] = cleaned_names
            # Just fill the remaining with the last good name or something
            for idx in range(new_start_idx+len(cleaned_names), len(new_df)):
                new_df.loc[idx, new_ps_col] = cleaned_names[-1] if cleaned_names else ""
            
        new_df.to_excel(cf, index=False, header=False)
        print(f"Patched {cf}")
        patched_count += 1
        
    except Exception as e:
        print(f"Error patching {cf}: {e}")

print(f"Successfully patched {patched_count} files.")
