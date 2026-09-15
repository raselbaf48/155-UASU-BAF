import re

with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-lg p-6 overflow-x-auto"',
    'className="bg-white text-black border border-slate-300 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"'
)

# And another one at the bottom maybe?
# Check if we have other dark text
content = content.replace('text-black dark:text-slate-100', 'text-black')

with open('src/components/PrintableNightCountModal.tsx', 'w') as f:
    f.write(content)
