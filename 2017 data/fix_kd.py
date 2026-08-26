with open('krutidev_converter.py', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("ur'", "r'")
code = code.replace('ur"', 'r"')
code = code.replace(".decode('utf-8')", "")
with open('krutidev_converter.py', 'w', encoding='utf-8') as f:
    f.write(code)
