import re

with open('src/components/DutyRatioMatrixView.tsx', 'r') as f:
    content = f.read()

# Make sure RotateCcw is imported
if "RotateCcw" not in content:
    content = content.replace("import { Layers, Info, Trash } from 'lucide-react';", "import { Layers, Info, Trash, RotateCcw } from 'lucide-react';")

# Find the month total block using regex to be safe
pattern = re.compile(r'(<span className="text-xs font-bold bg-white/20 px-2\.5 py-1 rounded-lg">\s*Month Total: <strong className="font-mono">[\s\S]*?</strong>\s*</span>)')
replacement = r'''\1
                  <button
                    onClick={() => handleResetTable(tableIdx)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors group"
                    title="Reset this duty table"
                  >
                    <RotateCcw className="w-4 h-4 text-white/70 group-hover:text-white" />
                  </button>'''

content = re.sub(pattern, replacement, content)

with open('src/components/DutyRatioMatrixView.tsx', 'w') as f:
    f.write(content)
