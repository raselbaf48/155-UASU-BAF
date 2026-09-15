import re

with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

# Fix inner container background
search_inner_wrong = 'className="bg-white text-black dark:text-white border border-slate-300 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"'
replace_inner_right = 'className="bg-white dark:bg-slate-900 text-black dark:text-white border border-slate-300 dark:border-slate-700 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"'

content = content.replace(search_inner_wrong, replace_inner_right)

with open('src/components/PrintableNightCountModal.tsx', 'w') as f:
    f.write(content)

