import sys

with open("src/components/PrintableNightCountModal.tsx", "r") as f:
    code = f.read()

import re
code = re.sub(r'</div>\s*\)\s*:\s*\(', '</>)}</div>) : (', code)
code = re.sub(r'</div>\s*\}\)\}\s*</div>\s*<!-- Row Edit Popover -->', '</>)}</div>)}</div>\n{/* Row Edit Popover */}', code)
code = re.sub(r'</div>\s*\}\)\}\s*</div>\s*\{\/\* Row Edit Popover', '</>)}</div>)}</div>\n{/* Row Edit Popover', code)

with open("src/components/PrintableNightCountModal.tsx", "w") as f:
    f.write(code)
