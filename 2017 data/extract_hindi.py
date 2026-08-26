import re
import sys

with open('upvidhansabha2017/381.xml', 'r', encoding='utf-8') as f:
    text = f.read()
    hindi_words = re.findall(r'[\u0900-\u097F]+', text)
    unique_words = list(set(hindi_words))
    
with open('scratch/381_hindi_words.txt', 'w', encoding='utf-8') as out:
    for w in unique_words[:100]:
        out.write(w + '\n')
