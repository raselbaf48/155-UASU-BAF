const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const oldUI = `                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Destination / Details</label>
                        <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Destination or details..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                      </div>`;

const newUI = `                      {editingGroup[0].dutyCode === 'TDY' ? (
                        <>
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
                                value={editTdyCustomDestination}
                                onChange={(e) => setEditTdyCustomDestination(e.target.value)}
                                placeholder="Enter custom destination..."
                                className={\`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer \${
                                  !editTdyCustomDestination ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700 focus:border-amber-500'
                                }\`}
                                required
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Remarks (Optional)</label>
                            <input type="text" value={editTdyRemarks} onChange={(e) => setEditTdyRemarks(e.target.value)} placeholder="Any additional notes..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">{editingGroup[0].dutyCode === 'LEAVE' ? 'Leave Details' : 'Remarks / Details'}</label>
                          <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Remarks or details..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                        </div>
                      )}`;

content = content.replace(oldUI, newUI);
fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
