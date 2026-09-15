import re

with open('src/components/DutyRatioMatrixView.tsx', 'r') as f:
    content = f.read()

# Add RotateCcw (Reset) icon to imports if not there
if "RotateCcw" not in content:
    content = content.replace("import { Layers, Info, Trash } from 'lucide-react';", "import { Layers, Info, Trash, RotateCcw } from 'lucide-react';")

bad_header = """              <div className={`px-4 py-3 flex items-center justify-between ${colors.header}`}>
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-black text-sm tracking-wider">
                    {table.serNo !== undefined ? `${table.serNo}. ` : `${tableIdx + 1}. `}{table.title}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                    Month Total: <strong className="font-mono">
                      {selectedFlightFilter === 'Overall' 
                        ? (table.totalRequiredMonth || 0) 
                        : (table.flightTargets?.[selectedFlightFilter as 'Mechanics' | 'Avionics' | 'GCS' | 'Admin'] || 0)}
                    </strong>
                  </span>
                </div>
              </div>"""

good_header = """              <div className={`px-4 py-3 flex items-center justify-between ${colors.header}`}>
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-black text-sm tracking-wider">
                    {table.serNo !== undefined ? `${table.serNo}. ` : `${tableIdx + 1}. `}{table.title}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                    Month Total: <strong className="font-mono">
                      {selectedFlightFilter === 'Overall' 
                        ? (table.totalRequiredMonth || 0) 
                        : (table.flightTargets?.[selectedFlightFilter as 'Mechanics' | 'Avionics' | 'GCS' | 'Admin'] || 0)}
                    </strong>
                  </span>
                  <button
                    onClick={() => handleResetTable(tableIdx)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors group"
                    title="Reset this duty table"
                  >
                    <RotateCcw className="w-4 h-4 text-white/70 group-hover:text-white" />
                  </button>
                </div>
              </div>"""

content = content.replace(bad_header, good_header)

with open('src/components/DutyRatioMatrixView.tsx', 'w') as f:
    f.write(content)

