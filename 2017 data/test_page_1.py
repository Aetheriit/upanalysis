import xml.etree.ElementTree as ET
import sys; sys.path.append('scripts')
from scripts.convert_xml_to_xlsx import clean_xml_content
with open('upvidhansabha2017/102.xml', 'r', encoding='utf-8', errors='ignore') as f:
    root = ET.fromstring(clean_xml_content(f.read()))

page_texts = []
for cell in root.findall('.//cell'):
    if cell.get('p') == '1':
        h, w, x, y = int(cell.get('h')), int(cell.get('w')), int(cell.get('x')), int(cell.get('y'))
        text = ''.join(cell.itertext()).strip().replace('\n', ' ')
        page_texts.append({'x': x, 'y': y, 'w': w, 'h': h, 'text': text})

page_texts.sort(key=lambda item: (item['y'] // 100, item['x']))
for pt in page_texts[:20]:
    print(f"w={pt['w']} h={pt['h']} x={pt['x']} y={pt['y']} text={pt['text'].encode('ascii', 'ignore').decode()[:50]}")
