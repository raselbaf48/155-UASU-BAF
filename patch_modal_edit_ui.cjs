const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const leaveUI = `
                      {editingGroup[0].dutyCode === 'LEAVE' ? (
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
                                  
                                  if (editSelectedPresetDays !== null) {
                                    const d = new Date(val);
                                    const extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
                                    d.setDate(d.getDate() + editSelectedPresetDays + extra - 1);
                                    setEditToDate(d.toISOString().split('T')[0]);
                                  } else if (editIsCustomPresetActive) {
                                    const d = new Date(val);
                                    const extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
                                    d.setDate(d.getDate() + editCustomLeaveDays + extra - 1);
                                    setEditToDate(d.toISOString().split('T')[0]);
                                  }
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">To Date</label>
                              <DateNavigator
                                value={editToDate}
                                min={editFromDate}
                                onChange={(e) => {
                                  setEditToDate(e.target.value);
                                  setEditSelectedPresetDays(null);
                                  setEditIsCustomPresetActive(false);
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                              />
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-300">Quick Leave Presets:</span>
                              <span className="text-[11px] text-slate-400">Click to Select / Unselect</span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1.5">
                              {[3, 4, 7, 15, 21, 30].map((days) => {
                                const isSelected = editSelectedPresetDays === days;
                                return (
                                  <button
                                    key={days}
                                    type="button"
                                    onClick={() => handleEditPresetToggle(days)}
                                    className={\`py-1.5 px-3 rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-2xs text-center border \${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/50 shadow-sm'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300'
                                    }\`}
                                  >
                                    {days} Days
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => { setEditSelectedPresetDays(null); setEditIsCustomPresetActive(true); handleEditCustomLeaveDaysChange(editCustomLeaveDays); }}
                                className={\`py-1.5 px-3 rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-2xs text-center border \${
                                  editIsCustomPresetActive
                                    ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/50 shadow-sm'
                                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300'
                                }\`}
                              >
                                Custom
                              </button>
                              
                              {editIsCustomPresetActive && (
                                <div className="flex items-center space-x-1 ml-1 animate-fadeIn">
                                  <input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={editCustomLeaveDays}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      handleEditCustomLeaveDaysChange(val);
                                    }}
                                    className="w-14 px-2 py-1 text-xs font-black text-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                  <span className="text-[11px] text-slate-500 font-semibold">Days</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <div 
                                  className="flex items-center space-x-2.5 cursor-pointer select-none group"
                                  onClick={() => handleEditF295Toggle(!editIncludeF295)}
                                >
                                  <div className={\`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out \${editIncludeF295 ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'}\`}>
                                    <span className={\`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out \${editIncludeF295 ? 'translate-x-4.5' : 'translate-x-0.5'}\`} style={{ transform: editIncludeF295 ? 'translateX(18px)' : 'translateX(3px)' }} />
                                  </div>
                                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                    Include F-295 (Journey Time)
                                  </span>
                                </div>
                                {editIncludeF295 && (
                                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                    +{editF295Option === '2' ? '2' : editF295Option === '3' ? '3' : editF295CustomDays} Days Added
                                  </span>
                                )}
                              </div>
                              
                              {editIncludeF295 && (
                                <div className="flex flex-wrap items-center gap-2 pl-6 animate-fadeIn">
                                  <button
                                    type="button"
                                    onClick={() => handleEditF295OptionChange('2')}
                                    className={\`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                      editF295Option === '2'
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                                    }\`}
                                  >
                                    2 Days
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEditF295OptionChange('3')}
                                    className={\`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                      editF295Option === '3'
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                                    }\`}
                                  >
                                    3 Days
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEditF295OptionChange('custom')}
                                    className={\`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer \${
                                      editF295Option === 'custom'
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                                    }\`}
                                  >
                                    Custom
                                  </button>
                                  
                                  {editF295Option === 'custom' && (
                                    <div className="flex items-center space-x-1">
                                      <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={editF295CustomDays}
                                        onChange={(e) => {
                                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                          handleEditF295OptionChange('custom', val);
                                        }}
                                        className="w-14 px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none"
                                      />
                                      <span className="text-[11px] text-slate-500">Days</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Leave Type
                              </label>
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                Duration: {editLeaveDurationDays} Day{editLeaveDurationDays > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-1.5">
                              <button
                                type="button"
                                disabled={editLeaveDurationDays > 10}
                                onClick={() => setEditLeaveType('Casual')}
                                className={\`py-2 text-[11px] font-black rounded-xl border transition-all \${
                                  editLeaveDurationDays > 10 ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                                  editLeaveType === 'Casual'
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs cursor-pointer'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer'
                                }\`}
                              >
                                Casual Leave
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditLeaveType('Annual')}
                                className={\`py-2 text-[11px] font-black rounded-xl border transition-all cursor-pointer \${
                                  editLeaveType === 'Annual'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }\`}
                              >
                                Annual Leave
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditLeaveType('Recreation')}
                                className={\`py-2 text-[11px] font-black rounded-xl border transition-all cursor-pointer \${
                                  editLeaveType === 'Recreation'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }\`}
                              >
                                Recreation Leave
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditLeaveType('Sick')}
                                className={\`py-2 text-[11px] font-black rounded-xl border transition-all cursor-pointer \${
                                  editLeaveType === 'Sick'
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }\`}
                              >
                                Sick Leave
                              </button>
                            </div>
                            {editLeaveDurationDays > 10 ? (
                              <p className="text-[10.5px] text-slate-400">
                                Duration is &gt; 10 days: Casual Leave disabled. Selected {editLeaveType || 'None'}.
                              </p>
                            ) : (
                              <p className="text-[10.5px] text-slate-400">
                                Duration is &le; 10 days: Casual Leave auto-selected. Selected {editLeaveType || 'None'}.
                              </p>
                            )}
                          </div>
                          
                          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
                            <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
                              <span>Net Leave Balance Count:</span>
                              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                                {editModalDaysCalc.netLeaveDays} Day{editModalDaysCalc.netLeaveDays > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1.5">
                              <span>Total Calendar Span: <strong>{editModalDaysCalc.totalCalendarDays} Days</strong></span>
                              {editModalDaysCalc.f295Days > 0 ? (
                                <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-900/60 px-2 py-0.5 rounded-md">
                                  F-295 (Free Leave): {editModalDaysCalc.f295Days} Day(s)
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">No F-295 (F-295: 0)</span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : `;

const oldLeaveUI = /                      \{editingGroup\[0\]\.dutyCode === 'TDY' \? \([\s\S]*?<\/div>\n                      \}\)/;

content = content.replace(/<div className="grid grid-cols-2 gap-3">[\s\S]*?\{editingGroup\[0\]\.dutyCode === 'TDY' \? \(/, leaveUI);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
