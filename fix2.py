import sys

with open("src/components/PrintableNightCountModal.tsx", "r") as f:
    code = f.read()

import re
code = re.sub(r'\{false && \(\n                <>\n\{\/\* LEFT SIGNATURE BLOCK \(Prepared By\) \*\/(.*?)\n              \/\* ========================================================================= \*\/\n              \/\* 2\. SINGLE-DAY OFFICIAL BAF NIGHT COUNT STATE SHEET \*\/', r'{/* LEFT SIGNATURE BLOCK (Prepared By) */\1\n              /* ========================================================================= */\n              /* 2. SINGLE-DAY OFFICIAL BAF NIGHT COUNT STATE SHEET */', code, flags=re.DOTALL)

code = re.sub(r'\{false && \(\n                <>\n\{\/\* LEFT SIGNATURE BLOCK \(Prepared By\) \*\/(.*?)\n      \{\/\* Row Edit Popover \*\/', r'{/* LEFT SIGNATURE BLOCK (Prepared By) */\1\n      {/* Row Edit Popover */', code, flags=re.DOTALL)

with open("src/components/PrintableNightCountModal.tsx", "w") as f:
    f.write(code)
