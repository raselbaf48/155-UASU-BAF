import re

with open("src/components/PrintableNightCountModal.tsx", "r") as f:
    code = f.read()

# I will find all lines around 1140 to 1180 to see what they look like
code = code.replace(" {false && (\n                <>\n{/* LEFT SIGNATURE BLOCK (Prepared By) */", "{/* LEFT SIGNATURE BLOCK (Prepared By) */")
code = code.replace("\n </>\)}\n </div>\n </div>\n \) : \(", "\n </div>\n </div>\n ) : (")
code = code.replace("\n </>\)}\n </div>\n </div>\n </div>\n {/* Row Edit Popover", "\n </div>\n </div>\n </div>\n {/* Row Edit Popover")

with open("src/components/PrintableNightCountModal.tsx", "w") as f:
    f.write(code)
