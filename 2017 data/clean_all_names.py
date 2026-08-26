import os
import pandas as pd
import re

def clean_station_name(name):
    if pd.isna(name):
        return name
    name = str(name).upper()
    
    # Pre-cleaning
    name = re.sub(r'[\"\&\%\#]', '', name)
    name = name.replace('0', '0 ')
    name = re.sub(r'\s+', ' ', name)
    name = name.replace('0 .', '0.')
    name = name.replace('0 ,', '0,')
    name = name.replace('0 -', '0-')
    
    # Common abbreviations
    name = re.sub(r'\bP\s*R\s*A\s*0\s*V\s*I\s*0\b', 'Primary School', name)
    name = re.sub(r'\bP\s*R\s*A\s*0\s*P\s*A\s*0\b', 'Primary School', name)
    name = re.sub(r'\bP\s*R\s*A\s*0\s*S\s*K\s*U\s*L\s*A\b', 'Primary School', name)
    name = re.sub(r'\bP\s*R\s*A\s*0\b', 'Primary School', name)
    name = re.sub(r'\bP\s*0\s*P\s*0\b', 'Primary School', name)
    name = re.sub(r'\bA\s*0\s*P\s*A\s*0\b', 'Primary School', name)
    
    name = re.sub(r'\bI\s*0\s*K\s*A\s*0\b', 'Inter College', name)
    name = re.sub(r'\bI\s*0\s*K\s*A\b', 'Inter College', name)
    name = re.sub(r'\bI\s*M\s*0\s*K\s*A\s*0\b', 'Inter College', name)
    
    name = re.sub(r'\bJ\s*U\s*0\s*H\s*A\s*0\s*S\s*K\s*U\s*L\s*A\b', 'Junior High School', name)
    name = re.sub(r'\bJ\s*U\s*0\s*H\s*A\s*0\b', 'Junior High School', name)
    name = re.sub(r'\bJ\s*U\s*0\b', 'Junior', name)
    
    name = re.sub(r'\bM\s*A\s*0\s*V\s*I\s*0\b', 'Middle School', name)
    name = re.sub(r'\bM\s*A\s*0\b', 'Middle School', name)
    
    name = re.sub(r'\bU\s*0\s*M\s*A\s*0\s*V\s*I\s*0\b', 'High School', name)
    
    name = re.sub(r'\bV\s*I\s*0\b', 'Vidyalaya', name)
    
    # Rooms and numbers
    name = re.sub(r'\bK\s*A\s*K\s*S\s*A\b', 'Room', name)
    name = re.sub(r'\bK\s*A\s*K\s*S\s*H\b', 'Room', name)
    name = re.sub(r'\bK\s*A\s*M\s*A\s*R\s*A\b', 'Room', name)
    name = re.sub(r'\bK\s*A\s*M\s*R\s*A\b', 'Room', name)
    name = re.sub(r'\bK\s*A\s*M\s*0\b', 'Room', name)
    
    name = re.sub(r'\bS\s*A\s*M\s*K\s*H\s*Y\s*A\b', 'No', name)
    name = re.sub(r'\bS\s*A\s*M\s*0\b', 'No', name)
    name = re.sub(r'\bK\s*0\s*S\s*A\s*M\s*0\b', 'Room No', name)
    name = re.sub(r'\bK\s*A\s*0\s*S\s*A\s*M\s*0\b', 'Room No', name)
    name = re.sub(r'\bN\s*A\s*M\s*0\b', 'No', name)
    name = re.sub(r'\bK\s*0\s*N\s*A\s*M\s*0\b', 'Room No', name)
    name = re.sub(r'\bK\s*0\s*N\s*A\s*M\b', 'Room No', name)
    name = re.sub(r'\bK\s*0\s*N\s*0\b', 'Room No', name)
    name = re.sub(r'\bN\s*A\s*0\b', 'No', name)
    
    # Directions
    name = re.sub(r'\bD\s*A\s*K\s*S\s*I\s*A\s*N\s*I\b', 'South', name)
    name = re.sub(r'\bD\s*A\s*K\s*S\s*H\s*I\s*N\s*I\b', 'South', name)
    name = re.sub(r'\bD\s*A\s*0\s*B\s*H\s*A\s*G\s*A\b', 'South Part', name)
    name = re.sub(r'\bD\s*A\s*0\b', 'South', name)
    
    name = re.sub(r'\bP\s*U\s*R\s*V\s*I\b', 'East', name)
    name = re.sub(r'\bP\s*U\s*R\s*V\s*A\b', 'East', name)
    name = re.sub(r'\bP\s*U\s*R\s*A\s*B\b', 'East', name)
    name = re.sub(r'\bP\s*U\s*0\s*B\s*H\s*A\s*G\s*A\b', 'East Part', name)
    name = re.sub(r'\bP\s*U\s*0\b', 'East', name)
    
    name = re.sub(r'\bP\s*A\s*S\s*H\s*C\s*H\s*I\s*M\s*I\b', 'West', name)
    name = re.sub(r'\bP\s*A\s*S\s*I\s*C\s*A\s*M\s*I\b', 'West', name)
    name = re.sub(r'\bP\s*A\s*0\s*B\s*H\s*A\s*G\s*A\b', 'West Part', name)
    name = re.sub(r'\bP\s*A\s*0\b', 'West', name)
    
    name = re.sub(r'\bU\s*T\s*T\s*A\s*R\s*I\b', 'North', name)
    name = re.sub(r'\bU\s*T\s*T\s*R\s*I\b', 'North', name)
    name = re.sub(r'\bU\s*0\s*B\s*H\s*A\s*G\s*A\b', 'North Part', name)
    name = re.sub(r'\bU\s*0\b', 'North', name)
    
    # Synonyms
    name = re.sub(r'\bS\s*K\s*U\s*L\s*A\b', 'School', name)
    name = re.sub(r'\bS\s*K\s*U\s*L\b', 'School', name)
    name = re.sub(r'\bK\s*A\s*L\s*E\s*J\s*A\b', 'College', name)
    name = re.sub(r'\bK\s*A\s*L\s*E\s*J\b', 'College', name)
    name = re.sub(r'\bC\s*O\s*L\s*L\s*A\s*G\s*E\b', 'College', name)
    name = re.sub(r'\bB\s*H\s*A\s*G\s*A\b', 'Part', name)
    name = re.sub(r'\bB\s*H\s*A\s*G\b', 'Part', name)
    name = re.sub(r'\bB\s*H\s*A\s*A\s*G\b', 'Part', name)
    
    name = re.sub(r'\bV\s*I\s*D\s*Y\s*A\s*L\s*A\s*Y\s*A\b', 'Vidyalaya', name)
    name = re.sub(r'\bV\s*I\s*D\s*Y\s*A\s*L\s*A\s*Y\b', 'Vidyalaya', name)
    name = re.sub(r'\bV\s*I\s*D\s*Y\s*A\s*L\s*Y\s*A\b', 'Vidyalaya', name)
    name = re.sub(r'\bV\s*I\s*D\s*H\s*A\s*L\s*Y\s*A\b', 'Vidyalaya', name)
    name = re.sub(r'\bV\s*I\s*D\s*H\s*A\s*L\s*A\s*Y\s*A\b', 'Vidyalaya', name)
    name = re.sub(r'\bV\s*I\s*D\s*H\s*A\s*L\s*A\s*Y\b', 'Vidyalaya', name)
    name = re.sub(r'\bV\s*I\s*D\s*H\s*Y\s*A\s*L\s*A\s*Y\s*A\b', 'Vidyalaya', name)
    name = re.sub(r'\bV\s*I\s*D\s*H\s*Y\s*A\s*L\s*A\s*Y\b', 'Vidyalaya', name)
    
    name = re.sub(r'\bP\s*R\s*A\s*T\s*H\s*M\s*I\s*K\b', 'Primary', name)
    name = re.sub(r'\bP\s*R\s*A\s*T\s*H\s*A\s*M\s*I\s*K\b', 'Primary', name)
    name = re.sub(r'\bP\s*R\s*A\s*I\s*M\s*A\s*R\s*I\b', 'Primary', name)
    name = re.sub(r'\bP\s*R\s*A\s*I\s*M\s*A\s*R\s*Y\b', 'Primary', name)
    
    name = re.sub(r'\bI\s*N\s*T\s*A\s*R\b', 'Inter', name)
    name = re.sub(r'\bI\s*N\s*T\s*A\s*R\s*A\b', 'Inter', name)
    
    # Other fixes
    name = name.replace("K SAM YA", "Room No ")
    name = name.replace("K SAM0", "Room No ")
    name = name.replace("K. SAM0", "Room No ")
    name = name.replace("SAM0", "Room No ")
    name = name.replace("SAM YA", "Room No ")
    
    # Capitalize properly (Title Case)
    words = name.split()
    capitalized = []
    for w in words:
        if w.lower() == 'no':
            capitalized.append('No.')
        elif re.match(r'^M\d+$', w):
            capitalized.append(w)
        else:
            capitalized.append(w.capitalize())
            
    name = ' '.join(capitalized)
    return name

patched_count = 0
for f in os.listdir('excel_outputs'):
    if not f.endswith('.xlsx'): continue
    path = os.path.join('excel_outputs', f)
    
    try:
        df = pd.read_excel(path, header=None)
        ps_col = None
        start_idx = -1
        
        # locate the polling station column
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
                
        if ps_col is None:
            print(f"Skipping {f}, could not find Polling Station col")
            continue
            
        original_names = df.iloc[start_idx:][ps_col].tolist()
        new_names = [clean_station_name(n) for n in original_names]
        
        # Check if anything changed
        if original_names != new_names:
            df.loc[start_idx:, ps_col] = new_names
            df.to_excel(path, index=False, header=False)
            print(f"Patched {f}")
            patched_count += 1
            
    except Exception as e:
        print(f"Error on {f}: {e}")

print(f"Patched {patched_count} files total.")
