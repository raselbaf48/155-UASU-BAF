import re

with open('src/components/DutyRatioMatrixView.tsx', 'r') as f:
    content = f.read()

content = content.replace('<span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">\n                                      <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">', '<span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">')

with open('src/components/DutyRatioMatrixView.tsx', 'w') as f:
    f.write(content)

