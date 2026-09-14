const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const tdyUI = `
                      {editingGroup[0].dutyCode === 'TDY' ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">From Date</label>
                              <DateNavigator
                                value={editFromDate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditFromDate(val);
                                  
                                  if (!editToDate || editToDate < val) {
                                    setEditToDate(val);
                                  }
                                  
                                  if (editTdyPresetDays === 1 || editTdyPresetDays === -1) {
                                      setEditToDate(val);
                                      const todayStr = new Date().toISOString().split('T')[0];
                                      setEditTdyPresetDays(val === todayStr ? 1 : -1);
                                  } else if (editTdyPresetDays !== null) {
                                      const d = new Date(val);
                                      d.setDate(d.getDate() + editTdyPresetDays - 1);
                                      setEditToDate(d.toISOString().split('T')[0]);
                                  }
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                              />
                            </div>
                            
                            {editTdyPresetDays !== 1 && editTdyPresetDays !== -1 && (
                                <div className="animate-fadeIn">
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    To Date
                                  </label>
                                  <DateNavigator
                                    value={editToDate}
                                    min={editFromDate}
                                    onChange={(e) => {
                                      setEditToDate(e.target.value);
                                      setEditTdyPresetDays(null);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                                  />
                                </div>
                            )}
                          </div>
                          
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total TDY Span:</span>
                              <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                                {editLeaveDurationDays} Calendar Day{editLeaveDurationDays > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Destination (Mandatory)</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                               {presetLocations.map(loc => (
                                  <button
                                    key={loc}
                                    type="button"
                                    onClick={() => {
                                      setEditTdyDestination(loc);
                                      setEditTdyCustomDestination('');
                                    }}
                                    className={\`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                      editTdyDestination === loc
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }\`}
                                  >
                                    {loc}
                                  </button>
                               ))}
                               <button
                                  type="button"
                                  onClick={() => setEditTdyDestination('Custom')}
                                  className={\`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                    editTdyDestination === 'Custom'
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }\`}
                                >
                                  Custom
                                </button>
                            </div>
                            {editTdyDestination === 'Custom' && (
                              <input
                                type="text"
                                placeholder="Enter custom destination"
                                value={editTdyCustomDestination}
                                onChange={(e) => setEditTdyCustomDestination(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-xs"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Remarks (Optional)</label>
                            <input
                              type="text"
                              value={editTdyRemarks}
                              onChange={(e) => setEditTdyRemarks(e.target.value)}
                              placeholder="Any specific note for this TDY"
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-xs"
                            />
                          </div>
                        </>
                      ) : `;

content = content.replace(/\{editingGroup\[0\]\.dutyCode === 'TDY' \? \([\s\S]*?\) : \(/, tdyUI);
fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
