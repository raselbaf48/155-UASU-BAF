import re

with open("src/components/PrintableNightCountModal.tsx", "r") as f:
    code = f.read()

# I will find all lines around 1140 to 1180 to see what they look like
print(code[35000:36000])
