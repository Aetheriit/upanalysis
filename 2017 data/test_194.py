import xml.etree.ElementTree as ET
try:
    tree = ET.parse('upvidhansabha2017/194.xml')
    root = tree.getroot()
    ws = root.find('.//{urn:schemas-microsoft-com:office:spreadsheet}Worksheet')
    table = ws.find('{urn:schemas-microsoft-com:office:spreadsheet}Table')
    rows = table.findall('{urn:schemas-microsoft-com:office:spreadsheet}Row')
    print(f'194.xml: {len(rows)} rows found.')
    for i, row in enumerate(rows[:10]):
        cells = row.findall('{urn:schemas-microsoft-com:office:spreadsheet}Cell')
        data = [c.find("{urn:schemas-microsoft-com:office:spreadsheet}Data").text if c.find("{urn:schemas-microsoft-com:office:spreadsheet}Data") is not None else "" for c in cells]
        print(f'Row {i}: {data}')
except Exception as e:
    print(e)
