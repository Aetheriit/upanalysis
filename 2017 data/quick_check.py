import PyPDF2
import re
import pandas as pd

def check_ac(ac_num, pdf_path):
    reader = PyPDF2.PdfReader(pdf_path)
    full_text = ''
    for page in reader.pages:
        full_text += page.extract_text() + '\n'
        
    df = pd.read_excel(f'excel_outputs/{ac_num}_boothwise_data.xlsx', header=None)
    
    excel_booths = {}
    for i in range(3, len(df)):
        b_val = df.iat[i, 0]
        if str(b_val).strip().lower() == 'total': continue
        try:
            b_id = int(b_val)
            e_el = int(df.iat[i, 2])
            header = df.iloc[2].values.tolist()
            if 'Total Votes Polled' in header:
                v_idx = header.index('Total Votes Polled')
                v_el = int(df.iat[i, v_idx])
                excel_booths[b_id] = {'E': e_el, 'V': v_el}
        except: pass
        
    pdf_booths = {}
    blocks = re.split(rf'(?=AC {ac_num}\s*.*?\|\s*BOOTH)', full_text)
    for bb in blocks:
        m_b = re.search(r'BOOTH\s+(\d+)', bb)
        if not m_b: continue
        b_id = int(m_b.group(1))
        m_el = re.search(r'Electors\s+([\d,]+).*?Total\s+([\d,]+)', bb, re.DOTALL)
        if not m_el: continue
        p_el = int(m_el.group(1).replace(',',''))
        p_v = int(m_el.group(2).replace(',',''))
        pdf_booths[b_id] = {'E': p_el, 'V': p_v}
        
    print(f'=== AC {ac_num} ===')
    print(f'Booths in Excel: {len(excel_booths)}')
    print(f'Booths in PDF: {len(pdf_booths)}')
    
    mismatches = 0
    for b_id, e_data in excel_booths.items():
        if b_id in pdf_booths:
            p_data = pdf_booths[b_id]
            if e_data['E'] != p_data['E'] or e_data['V'] != p_data['V']:
                print(f"Mismatch in Booth {b_id}: Excel(E={e_data['E']}, V={e_data['V']}) PDF(E={p_data['E']}, V={p_data['V']})")
                mismatches += 1
        else:
            print(f'Booth {b_id} missing in PDF')
            mismatches += 1
            
    if mismatches == 0:
        print('PERFECT MATCH!')
    else:
        print(f'{mismatches} mismatches found.')
    print()

check_ac(27, '2017 data 2/2017_Moradabad_BOOTHWISE_DETAIL.pdf')
check_ac(401, '2017 data 2/2017_Sonbhadra_BOOTHWISE_DETAIL.pdf')
