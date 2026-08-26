import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

for cell in root.findall('.//cell'):
    w, h, x, y = int(cell.get('w')), int(cell.get('h')), int(cell.get('x')), int(cell.get('y'))
    if x > 250 and x < 400 and y > 800 and y < 850:
        text = ''.join(cell.itertext()).strip().replace('\n', ' ')
        print(f"w={w} h={h} x={x} y={y} text={text.encode('ascii', 'ignore').decode()}")
