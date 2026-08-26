import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

for cell in root.findall('.//cell'):
    if cell.get('h') == '2248':
        print(f"Massive cell found: x={cell.get('x')} y={cell.get('y')} children={len(cell)}")
        for i, child in enumerate(cell):
            if i < 5:
                print(f"  Child {i}: tag={child.tag} attrib={child.attrib} text={child.text}")
        break
