import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
with open('upvidhansabha2017/20.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

for cell in root.findall('.//cell'):
    h = int(cell.get('h'))
    if h > 2000:
        text = ''.join(cell.itertext()).strip().replace('\n', ' ')
        print(f"Massive cell: h={h} text={text.encode('ascii', 'ignore').decode()[:50]}")
        break
