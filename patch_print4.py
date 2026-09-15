import re

with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

# I also noticed we might need to restore the border-black dark:border-slate-400 for tables.
# Wait, I didn't change border-black in previous patches, just text-black.

with open('src/components/PrintableNightCountModal.tsx', 'w') as f:
    f.write(content)
