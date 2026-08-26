import re

with open("variance_report.txt", "r") as f:
    lines = f.readlines()

major_variances = []
total_mismatches = 0
for line in lines:
    if line.startswith("AC "):
        match = re.search(r"Excel\(E=(\d+),\s*V=(\d+)\)\s*vs\s*PDF\(E=(\d+),\s*V=(\d+)\)", line)
        if match:
            total_mismatches += 1
            e_excel, v_excel, e_pdf, v_pdf = map(int, match.groups())
            
            e_diff = abs(e_excel - e_pdf)
            v_diff = abs(v_excel - v_pdf)
            
            if e_diff > 10 or v_diff > 10:
                major_variances.append({
                    "line": line.strip(),
                    "e_diff": e_diff,
                    "v_diff": v_diff
                })

print(f"Total mismatches parsed: {total_mismatches}")
print(f"Major variances (diff > 10): {len(major_variances)}")

if major_variances:
    major_variances.sort(key=lambda x: max(x["e_diff"], x["v_diff"]), reverse=True)
    print("\nTop 20 major variances:")
    for item in major_variances[:20]:
        print(f"{item['line']} (Diff E: {item['e_diff']}, V: {item['v_diff']})")
else:
    print("No major variances found.")
