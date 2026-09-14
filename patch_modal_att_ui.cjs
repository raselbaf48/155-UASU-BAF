const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const attUI = `
                      {editingGroup[0].dutyCode === 'ATT' ? (
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
                                  
                                  if (editDepPresetDays === 1 || editDepPresetDays === -1) {
                                      setEditToDate(val);
                                      const todayStr = new Date().toISOString().split('T')[0];
                                      setEditDepPresetDays(val === todayStr ? 1 : -1);
                                  } else if (editDepPresetDays !== null) {
                                      const d = new Date(val);
                                      d.setDate(d.getDate() + editDepPresetDays - 1);
                                      setEditToDate(d.toISOString().split('T')[0]);
                                  }
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                              />
                            </div>
                            
                            {editDepPresetDays !== 1 && editDepPresetDays !== -1 && (
                                <div className="animate-fadeIn">
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    To Date
                                  </label>
                                  <DateNavigator
                                    value={editToDate}
                                    min={editFromDate}
                                    onChange={(e) => {
                                      setEditToDate(e.target.value);
                                      setEditDepPresetDays(null);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                                  />
                                </div>
                            )}
                          </div>
                          
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total Deployment Span:</span>
                              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                                {editLeaveDurationDays} Calendar Day{editLeaveDurationDays > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Remarks (Optional)</label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Any specific note for this Deployment"
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-xs"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">From Date</label>
                              <DateNavigator
                                value={editFromDate}
                                onChange={(e) => setEditFromDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">To Date</label>
                              <DateNavigator
                                value={editToDate}
                                onChange={(e) => setEditToDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Extra Details</label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="E.g. Sick Leave, specific reason, etc."
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                            />
                          </div>
                        </div>
                      )}
`;

content = content.replace(/\{editingGroup\[0\]\.dutyCode === 'ATT' \? \([\s\S]*?\}\)/, attUI);
fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
