import re

with open('src/components/DutyRatioConfigPanel.tsx', 'r') as f:
    content = f.read()

# Add Minus, Plus to lucide-react imports
content = content.replace(
    "import { AlertCircle, Settings, Info, Users, ChevronDown, ChevronUp, Calendar, X, Save, Power, PowerOff, Trash, Filter } from 'lucide-react';",
    "import { AlertCircle, Settings, Info, Users, ChevronDown, ChevronUp, Calendar, X, Save, Power, PowerOff, Trash, Filter, Plus, Minus } from 'lucide-react';"
)

# Update global req part
bad_global = """                        <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <input 
                            type="number"
                            min="0"
                            id="panelGlobalReqInput"
                            className="w-16 px-2 py-1.5 text-sm font-bold font-mono text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:border-indigo-500"
                            defaultValue={matrix[settingsTableIdx]?.totalRequiredDaily || 0}
                          />
                          <button 
                            onClick={() => {
                              const val = parseInt((document.getElementById('panelGlobalReqInput') as HTMLInputElement).value, 10);
                              if (isNaN(val)) return;
                              if (onMatrixChange) {
                                const updated = [...matrix];
                                updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                updated[settingsTableIdx].dailyRequirements = new Array(31).fill(val);
                                updated[settingsTableIdx].totalRequiredDaily = val;
                                updated[settingsTableIdx].totalRequiredMonth = val * 31;
                                onMatrixChange(updated);
                              }
                            }}
                            className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            Apply to All
                          </button>
                        </div>"""

good_global = """                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
                            <button 
                              onClick={() => {
                                const input = document.getElementById('panelGlobalReqInput') as HTMLInputElement;
                                let val = parseInt(input.value, 10);
                                if (isNaN(val)) val = 0;
                                if (val > 0) input.value = (val - 1).toString();
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input 
                              type="text"
                              readOnly
                              id="panelGlobalReqInput"
                              className="w-12 px-1 py-1 text-base font-bold font-mono text-center bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100"
                              defaultValue={matrix[settingsTableIdx]?.totalRequiredDaily || 0}
                            />
                            <button 
                              onClick={() => {
                                const input = document.getElementById('panelGlobalReqInput') as HTMLInputElement;
                                let val = parseInt(input.value, 10);
                                if (isNaN(val)) val = 0;
                                input.value = (val + 1).toString();
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button 
                            onClick={() => {
                              const val = parseInt((document.getElementById('panelGlobalReqInput') as HTMLInputElement).value, 10);
                              if (isNaN(val)) return;
                              if (onMatrixChange) {
                                const updated = [...matrix];
                                updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                updated[settingsTableIdx].dailyRequirements = new Array(31).fill(val);
                                updated[settingsTableIdx].totalRequiredDaily = val;
                                updated[settingsTableIdx].totalRequiredMonth = val * 31;
                                onMatrixChange(updated);
                              }
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto"
                          >
                            Apply to All
                          </button>
                        </div>"""

content = content.replace(bad_global, good_global)

# Update day-wise boxes
bad_day_boxes = """                      <div className="grid grid-cols-7 gap-2 sm:gap-3">
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
                            <div key={dayNum} className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 mb-1 text-center">Day {dayNum}</label>
                              <input 
                                type="number"
                                min="0"
                                value={req}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  if (onMatrixChange) {
                                    const updated = [...matrix];
                                    updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                    const currentReqs = updated[settingsTableIdx].dailyRequirements || new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                                    currentReqs[idx] = val;
                                    updated[settingsTableIdx].dailyRequirements = currentReqs;
                                    updated[settingsTableIdx].totalRequiredMonth = currentReqs.reduce((a, b) => a + b, 0);
                                    onMatrixChange(updated);
                                  }
                                }}
                                className="w-full text-center px-1 py-1.5 text-sm font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
                              />
                            </div>
                          );
                        })}
                      </div>"""

good_day_boxes = """                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 sm:gap-4">
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

content = content.replace(bad_day_boxes, good_day_boxes)

with open('src/components/DutyRatioConfigPanel.tsx', 'w') as f:
    f.write(content)
