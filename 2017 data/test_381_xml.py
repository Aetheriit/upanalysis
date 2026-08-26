import re
with open('upvidhansabha2017/381.xml', 'r', encoding='utf-8') as f:
    text = f.read()
    cells = re.findall(r'<cell[^>]*x="199"[^>]*>(.*?)</cell>', text, re.DOTALL)
    print(len(cells))
    for c in cells[:20]:
        print(repr(c.strip()))
