import os
import glob
import PyPDF2
import re

def count_constituencies():
    pdf_files = glob.glob('2022 data/*.pdf')
    print(f'Found {len(pdf_files)} PDF files. Extracting constituencies...')
    unique_acs = set()
    
    for pdf_file in pdf_files:
        try:
            reader = PyPDF2.PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                # Find all 'AC <num>'
                matches = re.findall(r'AC\s+(\d+)\s+', text)
                unique_acs.update(matches)
        except Exception as e:
            print(f'Error reading {pdf_file}: {e}')
            
    print(f'Total unique constituencies found: {len(unique_acs)}')
    print(f'List of AC numbers: {sorted([int(x) for x in unique_acs])}')

if __name__ == '__main__':
    count_constituencies()
