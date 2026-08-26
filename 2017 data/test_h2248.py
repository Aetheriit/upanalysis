import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
from collections import defaultdict

with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

cells = []
for cell in root.findall('.//cell'):
    if cell.get('p') == '1' and cell.get('h') == '2248':
        x = int(cell.get('x'))
        text = ''.join(cell.itertext()).strip().replace('\n', ' ')
        cells.append((x, text))

cells.sort(key=lambda item: item[0])
for x, text in cells:
    print(f"x={x}: {text[:50]}")
