text = open('upvidhansabha2017/401.xml', 'r', encoding='utf-8').read()
from bs4 import BeautifulSoup
soup = BeautifulSoup(text, 'xml')
for cell in soup.find_all('cell'):
    if cell.text.strip() == 'Name':
        print(f"Name found at y={cell.get('y')} x={cell.get('x')} p={cell.get('p')}")
