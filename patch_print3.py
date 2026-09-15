import re

with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

# Restore the dark mode classes that were removed in the previous patch

# 1. Restore the wrapper div for the actual document
search_doc = '<div className="bg-white text-black shadow-2xl print:shadow-none w-[297mm] min-h-[210mm] relative mx-auto print:mx-0 print:w-full print:min-h-0 shrink-0">'
replace_doc = '<div className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 shadow-2xl print:shadow-none w-[297mm] min-h-[210mm] relative mx-auto print:mx-0 print:w-full print:min-h-0 shrink-0">'

content = content.replace(search_doc, replace_doc)

# 2. Restore the inner container
search_inner = '<div className="bg-white text-black border border-slate-300 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"'
replace_inner = '<div className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"'

content = content.replace(search_inner, replace_inner)

# 3. Restore any other text-black dark:text-slate-100 replacements
content = content.replace('text-black mt-0.5', 'text-black dark:text-slate-100 mt-0.5')
content = content.replace('text-black pr-1', 'text-black dark:text-slate-100 pr-1')


# And for the header size and buttons for mobile view:
# <h2 className="text-lg font-black text-white">Print Preview</h2>
# <p className="text-xs font-medium text-slate-400">Night Count State</p>
content = content.replace(
    '<h2 className="text-lg font-black text-white">Print Preview</h2>',
    '<h2 className="text-base sm:text-lg font-black text-white">Preview</h2>'
)

# And make the buttons smaller on mobile
# <button className="flex items-center space-x-2 px-6 py-2.5 ...">
content = content.replace(
    'px-6 py-2.5 bg-blue-700',
    'px-3 sm:px-6 py-2 bg-blue-700'
)
content = content.replace(
    'px-6 py-2.5 bg-emerald-600',
    'px-3 sm:px-6 py-2 bg-emerald-600'
)
content = content.replace(
    '<span>Download Document</span>',
    '<span className="hidden sm:inline">Download Document</span><span className="inline sm:hidden">Download</span>'
)
content = content.replace(
    '<span>Official Export / Print</span>',
    '<span className="hidden sm:inline">Official Export / Print</span><span className="inline sm:hidden">Print</span>'
)


with open('src/components/PrintableNightCountModal.tsx', 'w') as f:
    f.write(content)

