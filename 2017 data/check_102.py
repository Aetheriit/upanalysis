import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content

with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

from collections import defaultdict
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
    text_joined = ' '.join(c['text'] for c in row_cells)
    if '102' in text_joined and len(row_cells) > 5:
        print(text_joined)
        for c in row_cells:
            print(f"  x={c['x']} text={c['text']}")
        break
