import os
import glob
import PyPDF2
import re

def count_booths():
    pdf_files = glob.glob('2022 data/*.pdf')
    print(f'Found {len(pdf_files)} PDF files. Counting booths...')
    total_booths = 0
    
    for pdf_file in pdf_files:
        try:
            reader = PyPDF2.PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                # The structure is 'AC <num> <name>  |  BOOTH <num>'
                matches = len(re.findall(r'\|\s*BOOTH\s+\d+', text))
                total_booths += matches
        except Exception as e:
            print(f'Error reading {pdf_file}: {e}')
            
    print(f'Total booths across all 2022 PDFs: {total_booths}')

if __name__ == '__main__':
    count_booths()
