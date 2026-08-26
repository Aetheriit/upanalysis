import re

with open('upvidhansabha2017/380.xml', 'r', encoding='utf-8') as f:
    text = f.read()
    cells = re.findall(r'<cell[^>]*x="199"[^>]*>(.*?)</cell>', text, re.DOTALL)
    print('380 x=199 cells:', len(cells))
    for c in cells[:15]:
        print(repr(c.strip()))
