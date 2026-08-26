import urllib.request
import json
import re

url = 'https://en.wikipedia.org/wiki/List_of_constituencies_of_the_Uttar_Pradesh_Legislative_Assembly'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    rows = re.findall(r'<tr.*?>(.*?)</tr>', html, re.DOTALL | re.IGNORECASE)
    constituencies = {}
    for row in rows:
        cells = re.findall(r'<td.*?>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
        if len(cells) >= 3:
            # First cell is usually the AC No.
            ac_no_match = re.search(r'>\s*(\d+)\s*<', cells[0]) or re.search(r'^\s*(\d+)\s*$', re.sub(r'<.*?>', '', cells[0]))
            if ac_no_match:
                ac_no = ac_no_match.group(1)
                name_match = re.search(r'title=\"([^\"]+)\"', cells[1])
                name = name_match.group(1).replace(' (Assembly constituency)', '').replace(' (Uttar Pradesh)', '') if name_match else re.sub(r'<.*?>', '', cells[1]).strip()
                name = re.sub(r'&\#\d+;', '', name).strip()
                constituencies[ac_no] = name
    print(f"Extracted {len(constituencies)} constituencies")
    print("Sample:", {k: constituencies[k] for k in list(constituencies)[:5]})
    with open("constituencies.json", "w") as f:
        json.dump(constituencies, f, indent=4)
except Exception as e:
    print("Error:", e)
