import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

for cell in root.findall('.//cell'):
    text = ''.join(cell.itertext()).strip().replace('\n', ' ')
    if 'Samajvadi Party' in text or '453' in text:
        h, p, w, x, y = cell.get('h'), cell.get('p'), cell.get('w'), cell.get('x'), cell.get('y')
        print(f"w={w} h={h} x={x} y={y} text={text[:50]}")
