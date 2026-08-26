import xml.etree.ElementTree as ET
import re

with open('upvidhansabha2017/401.xml', 'r', encoding='utf-8') as f:
    xml_content = f.read()

xml_content = re.sub(r'<\?xml[^>]+\?>', '', xml_content)
xml_content = re.sub(r'<!DOCTYPE[^>]+>', '', xml_content)

xml_content = f"<root>{xml_content}</root>"
root = ET.fromstring(xml_content)

with open('401_xml_dump.txt', 'w', encoding='utf-8') as f:
    for page in root.findall('.//page')[:2]:
        for text in page.findall('.//text'):
            content = ''.join(text.itertext()).strip()
            if content:
                f.write(f"Page {page.get('number')} y:{text.get('top')} x:{text.get('left')} text:{content}\n")
