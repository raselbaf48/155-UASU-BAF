import re

with open('src/components/DutyRatioMatrixView.tsx', 'r') as f:
    content = f.read()

# I need to fix the missing code in Month Total block
bad_block = """                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                    Month Total: <strong className="font-mono">
                      {selectedFlightFilter === 'Overall' 
                    </>
                  )}
                </div>
              </div>"""

good_block = """                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                    Month Total: <strong className="font-mono">
                      {selectedFlightFilter === 'Overall' 
                        ? (table.totalRequiredMonth || 0) 
                        : (table.flightTargets?.[selectedFlightFilter as 'Mechanics' | 'Avionics' | 'GCS' | 'Admin'] || 0)}
                    </strong>
                  </span>
                </div>
              </div>"""

# replace roughly
content = re.sub(
    r'Month Total: <strong className="font-mono">[\s]*{selectedFlightFilter === \'Overall\' [\s]*</>[\s]*\)}[\s]*</div>[\s]*</div>',
    good_block,
    content,
    flags=re.MULTILINE | re.DOTALL
)

with open('src/components/DutyRatioMatrixView.tsx', 'w') as f:
    f.write(content)

