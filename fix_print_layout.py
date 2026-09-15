import re

with open('src/components/PrintableNightCountModal.tsx', 'r') as f:
    content = f.read()

# Fix layout to allow horizontal scrolling
# The wrapper around the document currently is:
# <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:overflow-visible print:block">
# In mobile, flex justify-center can break overflow-x on child elements if it exceeds screen width. Let's make it justify-start or justify-center on lg screens.

search_wrapper = '<div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:overflow-visible print:block">'
replace_wrapper = '<div className="flex-1 overflow-auto p-4 sm:p-8 md:flex md:justify-center print:p-0 print:overflow-visible print:block">'
content = content.replace(search_wrapper, replace_wrapper)


with open('src/components/PrintableNightCountModal.tsx', 'w') as f:
    f.write(content)

