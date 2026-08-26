import re
import os
import pandas as pd

def parse_blob(content, base_name):
    text = re.sub(r'<[^>]+>', ' ', content)
    text = re.sub(r'\s+', ' ', text)
    
    # 194 is base_name. But the PDF has "1 P.S.BADI GULARIYA MAJRA 194 KARI GANGPUR 467 224 173 - 397 153 0"
    # Wait, the AC number might NOT be before the booth number!
    # Let's see the text.
    print(text[:1000])

with open('upvidhansabha2017/194.xml', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()
parse_blob(content, '194')
