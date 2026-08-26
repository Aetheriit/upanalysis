import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('upvidhansabha2017/381.xml', 'r', encoding='utf-8') as f:
    text = f.read()
    cells = re.findall(r'<cell[^>]*p="1"[^>]*>(.*?)</cell>', text, re.DOTALL)
    for c in cells[95:110]:
        print(c.strip())
