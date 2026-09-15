import re

with open('src/types.ts', 'r') as f:
    content = f.read()

content = content.replace("addressBlock: string;// e.g. Block-B, Qtr 104 / Barrack-3\\n  bloodGroup?: string;", "addressBlock: string;// e.g. Block-B, Qtr 104 / Barrack-3\n  bloodGroup?: string;")

with open('src/types.ts', 'w') as f:
    f.write(content)

