import re

seg = '20 20 izk0fo0 vkteiqj teuhHkku d{k ua0 2 992 339 341 0 680 0 0 1 ASHOK KUMAR RANA 1 2 NAIMUDDIN 2'
base_name = '20'

first_cand_match = re.search(r'\b(?:0\s+0\s+)?1\s+[A-Za-z.\- ]+?\s+(?:\d+|-)\b', seg)
if first_cand_match:
    base_part = seg[:first_cand_match.start()].strip()
    cand_part = seg[first_cand_match.start():]
    
    base_match = re.match(fr'^({base_name})\s+(\d+)\s+(.+)$', base_part)
    if base_match:
        ac_no, booth_no, rest = base_match.groups()
        numbers = re.findall(r'\b([\d,]+|-)\b', rest)
        
        if len(numbers) >= 2 and numbers[-2:] == ['0', '0']:
            base_numbers = numbers[-7:-2]
            trailer = numbers[-2:]
        else:
            base_numbers = numbers[-5:]
            trailer = []
            
        print('Base numbers:', base_numbers)
        name = rest
        for num in reversed(base_numbers + trailer):
            name = re.sub(fr'\s+\b{num}\b$', '', name)
        
        print(f'Name: "{name}"')
        print(f'Electors: {base_numbers[0]}, Turnout: {base_numbers[4]}')
        
        votes_match = re.findall(r'\b\d+\s+[A-Za-z.\- ]+?\s+(\d+|-)\b', cand_part)
        print('Votes:', votes_match)
