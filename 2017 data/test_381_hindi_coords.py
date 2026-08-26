import re
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('upvidhansabha2017/381.xml', 'r', encoding='utf-8') as f:
    text = f.read()
    cells = re.findall(r'<cell[^>]*w="([^"]+)"\s*x="([^"]+)"\s*y="([^"]+)"[^>]*>(.*?)</cell>', text, re.DOTALL)
    
    count = 0
    for w, x, y, c in cells:
        if re.search(r'[\u0900-\u097F]', c):
            print(f"x={x} y={y} text={repr(c.strip())}")
            count += 1
            if count >= 30:
                break
