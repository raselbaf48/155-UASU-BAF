import re

with open("src/components/PrintableNightCountModal.tsx", "r") as f:
    code = f.read()

# Replace the broken closing tags
code = code.replace(" </div>\n </>)}</div>) : (", "\n </>)}\n </div>\n </div>\n ) : (")
code = code.replace(" </div>\n </>)}</div>)}</div>\n{/* Row Edit Popover", "\n </>)}\n </div>\n </div>\n </div>\n {/* Row Edit Popover")
# Let me just run lint after
with open("src/components/PrintableNightCountModal.tsx", "w") as f:
    f.write(code)
