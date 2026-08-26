import re

files = ['167', '193', '390', '396']
for base_name in files:
    with open(f'upvidhansabha2017/{base_name}.xml', 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        print(f"\n--- {base_name}.xml snippet ---")
        text = re.sub(r'<[^>]+>', ' ', content)
        text = re.sub(r'\s+', ' ', text)
        print(text[:1000])
