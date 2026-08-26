import re
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('upvidhansabha2017/381.xml', 'r', encoding='utf-8') as f:
    text = f.read()
    cells = re.findall(r'<cell[^>]*p="1"[^>]*w="([^"]+)"\s*x="([^"]+)"\s*y="([^"]+)"[^>]*>(.*?)</cell>', text, re.DOTALL)
    
    parsed = []
    for w, x, y, c in cells:
        parsed.append({'w': int(w), 'x': int(x), 'y': int(y), 'text': c.strip()})
        
    parsed.sort(key=lambda item: (item['y'], item['x']))
    
    for item in parsed[:50]:
        t = item['text']
        if len(t) > 0 and t not in ['S.No.', 'Party Affiliation', 'Votes Secured', 'No.']:
            print(f"x={item['x']} y={item['y']} text={repr(t)}")
