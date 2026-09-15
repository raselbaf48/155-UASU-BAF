import re

with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

# The wrapper for the actual document is at:
search_doc = '<div className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 shadow-2xl print:shadow-none w-[297mm] min-h-[210mm] relative mx-auto print:mx-0 print:w-full print:min-h-0 shrink-0">'
replace_doc = '<div className="bg-white text-black shadow-2xl print:shadow-none w-[297mm] min-h-[210mm] relative mx-auto print:mx-0 print:w-full print:min-h-0 shrink-0">'

content = content.replace(search_doc, replace_doc)

# Next div inside
search_inner = '<div className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-lg p-6 overflow-x-auto">'
replace_inner = '<div className="bg-white text-black border border-slate-300 rounded-2xl shadow-lg p-6 overflow-x-auto">'

content = content.replace(search_inner, replace_inner)

# Signatures lines:
content = content.replace('className="border-t border-slate-900 dark:border-slate-600 pt-1.5"', 'className="border-t border-slate-900 pt-1.5"')

with open('src/components/PrintableNightCountModal.tsx', 'w') as f:
    f.write(content)
