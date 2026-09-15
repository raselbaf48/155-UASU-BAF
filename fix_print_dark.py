import re

with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

# Replace border-black with border-black dark:border-slate-400 everywhere
content = content.replace('border-black', 'border-black dark:border-slate-500')
# Wait, let's just make it dark:border-slate-300 so it's clearly visible in dark mode.
content = content.replace('dark:border-slate-500', 'dark:border-slate-300')

# Also, there's text-black which should be text-black dark:text-white
content = content.replace('text-black', 'text-black dark:text-white')
# Correct duplicate dark:text-white if we just created it
content = content.replace('text-black dark:text-white dark:text-slate-100', 'text-black dark:text-white')
content = content.replace('text-black dark:text-white mt-0.5', 'text-black dark:text-white mt-0.5')
content = content.replace('text-black dark:text-white pr-1', 'text-black dark:text-white pr-1')

# Ensure the background container itself has dark mode bg
search_doc = '<div className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 shadow-2xl print:shadow-none w-[297mm] min-h-[210mm] relative mx-auto print:mx-0 print:w-full print:min-h-0 shrink-0">'
replace_doc = '<div className="bg-white dark:bg-slate-900 text-black dark:text-white shadow-2xl print:shadow-none w-[297mm] min-h-[210mm] relative mx-auto print:mx-0 print:w-full print:min-h-0 shrink-0">'

content = content.replace(search_doc, replace_doc)

search_inner = '<div className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"'
replace_inner = '<div className="bg-white dark:bg-slate-900 text-black dark:text-white border border-slate-300 dark:border-slate-700 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"'

content = content.replace(search_inner, replace_inner)

# Fix the print style to ensure that IN PRINT it forces black text and white borders
# The print media query already has background: white !important and color: black !important
# Let's ensure table borders are black in print

style_search = """              body { 
                 background: white !important; 
                 color: black !important;
                -webkit-print-color-adjust: exact !important; 
                 print-color-adjust: exact !important; 
               }"""
style_replace = """              body { 
                 background: white !important; 
                 color: black !important;
                -webkit-print-color-adjust: exact !important; 
                 print-color-adjust: exact !important; 
               }
               
              /* Force black borders and text in print */
              .print\\:border-black, table, th, td {
                 border-color: black !important;
              }
              .print\\:text-black, span, div, p, h1, h2, h3, h4, th, td {
                 color: black !important;
              }"""
content = content.replace(style_search, style_replace)


with open('src/components/PrintableNightCountModal.tsx', 'w') as f:
    f.write(content)
