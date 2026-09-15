import re

with open('src/components/DutyRatioConfigPanel.tsx', 'r') as f:
    content = f.read()

bad_boxes = """                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 sm:gap-4">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum, idx) => {
                          const table = matrix[settingsTableIdx];
                          let req = table?.dailyRequirements?.[idx];
                          if (req === undefined && table) {
                              if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                  req = table.totalRequiredDaily;
                              } else {
                                  req = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[idx] || 0), 0);
                              }
                          }
                          return (
                            <div key={dayNum} className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-sm">
                              <label className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Day {dayNum}</label>
                              <div className="flex items-center justify-between w-full">
                                <button 
                                  onClick={() => {
                                    if (onMatrixChange) {
                                      const updated = [...matrix];
                                      updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                      const currentReqs = updated[settingsTableIdx].dailyRequirements || new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                                      if (currentReqs[idx] > 0) {
                                        currentReqs[idx] -= 1;
                                        updated[settingsTableIdx].dailyRequirements = currentReqs;
                                        updated[settingsTableIdx].totalRequiredMonth = currentReqs.reduce((a, b) => a + b, 0);
                                        onMatrixChange(updated);
                                      }
                                    }
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-mono font-bold text-base text-slate-800 dark:text-slate-200 w-6 text-center select-none">
                                  {req}
                                </span>
                                <button 
                                  onClick={() => {
                                    if (onMatrixChange) {
                                      const updated = [...matrix];
                                      updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                      const currentReqs = updated[settingsTableIdx].dailyRequirements || new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                                      currentReqs[idx] += 1;
                                      updated[settingsTableIdx].dailyRequirements = currentReqs;
                                      updated[settingsTableIdx].totalRequiredMonth = currentReqs.reduce((a, b) => a + b, 0);
                                      onMatrixChange(updated);
                                    }
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 text-indigo-600 dark:text-indigo-400 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>"""

good_boxes = """                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum, idx) => {
                          const table = matrix[settingsTableIdx];
                          let req = table?.dailyRequirements?.[idx];
                          if (req === undefined && table) {
                              if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                  req = table.totalRequiredDaily;
                              } else {
                                  req = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[idx] || 0), 0);
                              }
                          }
                          return (
                            <div key={dayNum} className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-sm w-full max-w-[120px] mx-auto">
                              <label className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Day {dayNum}</label>
                              <div className="flex items-center justify-between w-full px-1">
                                <button 
                                  onClick={() => {
                                    if (onMatrixChange) {
                                      const updated = [...matrix];
                                      updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                      const currentReqs = updated[settingsTableIdx].dailyRequirements || new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                                      if (currentReqs[idx] > 0) {
                                        currentReqs[idx] -= 1;
                                        updated[settingsTableIdx].dailyRequirements = currentReqs;
                                        updated[settingsTableIdx].totalRequiredMonth = currentReqs.reduce((a, b) => a + b, 0);
                                        onMatrixChange(updated);
                                      }
                                    }
                                  }}
                                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="font-mono font-bold text-lg text-slate-800 dark:text-slate-200 w-8 text-center select-none flex-shrink-0">
                                  {req}
                                </span>
                                <button 
                                  onClick={() => {
                                    if (onMatrixChange) {
                                      const updated = [...matrix];
                                      updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                      const currentReqs = updated[settingsTableIdx].dailyRequirements || new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                                      currentReqs[idx] += 1;
                                      updated[settingsTableIdx].dailyRequirements = currentReqs;
                                      updated[settingsTableIdx].totalRequiredMonth = currentReqs.reduce((a, b) => a + b, 0);
                                      onMatrixChange(updated);
                                    }
                                  }}
                                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 text-indigo-600 dark:text-indigo-400 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>"""

content = content.replace(bad_boxes, good_boxes)

with open('src/components/DutyRatioConfigPanel.tsx', 'w') as f:
    f.write(content)

