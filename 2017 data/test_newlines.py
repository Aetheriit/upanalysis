import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

for cell in root.findall('.//cell'):
    text = ''.join(cell.itertext()).strip()
    if '\n' in text and len(text.split('\n')) > 3:
        h, w, x, y = cell.get('h'), cell.get('w'), cell.get('x'), cell.get('y')
        print(f"x={x} y={y} w={w} h={h} num_lines={len(text.split(chr(10)))}")
        break
