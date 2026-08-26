import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content, extract_candidates
from collections import defaultdict
with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

cands, cand_xs, max_base_x = extract_candidates(root)
pages = defaultdict(list)
for cell in root.findall('.//cell'):
    try:
        h, p, w, x, y = int(cell.get('h', 0)), int(cell.get('p', 0)), int(cell.get('w', 0)), int(cell.get('x', 0)), int(cell.get('y', 0))
        text = ''.join(cell.itertext()).strip().replace('\n', ' ')
        if text: pages[p].append({'h': h, 'w': w, 'x': x, 'y': y, 'text': text})
    except: pass

cells = pages[1]
row_groups = defaultdict(list)
for cell in cells:
    row_groups[(cell['w'], cell['h'])].append(cell)

for key in sorted(row_groups.keys(), key=lambda k: k[0]):
    row_cells = sorted(row_groups[key], key=lambda item: item['x'])
    base_texts = [c['text'].strip() for c in row_cells if c['x'] <= max_base_x + 30]
    cand_cells = [c for c in row_cells if c['x'] > max_base_x + 30]
    if base_texts and cand_cells:
        print(f"Key: {key}")
        print(f"base_texts: {base_texts}")
        print(f"cand_cells_texts: {[c['text'].encode('ascii', 'ignore').decode() for c in cand_cells]}")
        print('-'*50)
