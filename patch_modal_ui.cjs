const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const tdyEndUI = `                          <div>
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

const replacementUI = `                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Remarks (Optional)</label>
                            <input type="text" value={editTdyRemarks} onChange={(e) => setEditTdyRemarks(e.target.value)} placeholder="Any additional notes..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                          </div>
                        </>
                      ) : editingGroup[0].dutyCode === 'LEAVE' ? (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Leave Type</label>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {['Casual', 'Annual', 'Recreation', 'Sick'].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setEditLeaveType(type)}
                                  className={\`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                    editLeaveType === type
                                      ? (type === 'Casual' ? 'bg-sky-600 text-white border-sky-600 shadow-xs' : type === 'Annual' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : type === 'Recreation' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-rose-600 text-white border-rose-600 shadow-xs')
                                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }\`}
                                >
                                  {type} Leave
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Extra Details (e.g. F-295)</label>
                            <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Leave details..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                          </div>
                        </>
                      ) : editingGroup[0].dutyCode === 'DEPLOYMENT' ? (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Deployment Location (Mandatory)</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                               {presetDeployLocations.map(loc => (
                                  <button
                                    key={loc}
                                    type="button"
                                    onClick={() => {
                                      setEditDepLocation(loc);
                                      setEditDepCustomLocation('');
                                    }}
                                    className={\`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                      editDepLocation === loc
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }\`}
                                  >
                                    {loc}
                                  </button>
                               ))}
                               <button
                                  type="button"
                                  onClick={() => setEditDepLocation('Custom')}
                                  className={\`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                    editDepLocation === 'Custom'
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }\`}
                                >
                                  Custom
                                </button>
                            </div>
                            
                            {editDepLocation === 'Custom' && (
                              <input
                                type="text"
                                value={editDepCustomLocation}
                                onChange={(e) => setEditDepCustomLocation(e.target.value)}
                                placeholder="Enter custom location..."
                                className={\`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer \${
                                  !editDepCustomLocation ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'
                                }\`}
                                required
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Remarks (Optional)</label>
                            <input type="text" value={editDepRemarks} onChange={(e) => setEditDepRemarks(e.target.value)} placeholder="Any additional notes..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Remarks / Details</label>
                          <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Remarks or details..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                        </div>
                      )}`;

content = content.replace(tdyEndUI, replacementUI);
fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

