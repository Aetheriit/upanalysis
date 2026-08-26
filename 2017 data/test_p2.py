import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

count = 0
for cell in root.findall('.//cell'):
    if cell.get('p') == '2':
        h, p, w, x, y = cell.get('h'), cell.get('p'), cell.get('w'), cell.get('x'), cell.get('y')
        text = ''.join(cell.itertext()).strip().replace('\n', ' ')
        print(f"w={w} h={h} x={x} y={y} text={text[:50]}")
        count += 1
        if count >= 10: break
