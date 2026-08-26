text = open('upvidhansabha2017/401.xml', 'r', encoding='utf-8').read()
from bs4 import BeautifulSoup
soup = BeautifulSoup(text, 'xml')
count = 0
for cell in soup.find_all('cell'):
    if cell.get('p') == '2':
        y = cell.get('y')
        content = cell.text.strip()
        if content:
            print(f"y={y} text={content[:30]}")
        count += 1
        if count > 50:
            break
