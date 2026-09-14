const fs = require('fs');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const tdyBlock = `
                        <>
                          {/* Destination */}
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Destination (Mandatory) <span className="text-red-500">*</span>
                            </label>
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
                                placeholder="Enter custom destination..."
                                value={editTdyCustomDestination}
                                onChange={(e) => setEditTdyCustomDestination(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-xs"
                              />
                            )}
                          </div>

                          {/* Assignment Date Presets */}
                          <div>
                             <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                                Assignment Date
                              </label>
                             <div className="grid grid-cols-5 gap-1.5 mb-3">
                              {[{label: 'Today', val: 1}, {label: '2 Days', val: 2}, {label: '3 Days', val: 3}, {label: '7 Days', val: 7}, {label: '15 Days', val: 15}].map((opt) => {
                                const isSelected = editTdyPresetDays === opt.val;
                                return (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => {
                                      if (opt.val === 1) {
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        setEditFromDate(todayStr);
                                        setEditToDate(todayStr);
                                      } else {
                                        const d = new Date(editFromDate);
                                        d.setDate(d.getDate() + opt.val - 1);
                                        setEditToDate(d.toISOString().split('T')[0]);
                                      }
                                      setEditTdyPresetDays(opt.val);
                                    }}
                                    className={\`py-1.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs text-center border \${
                                      isSelected
                                        ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-500/50 shadow-sm'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-300'
                                    }\`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Date Range */}
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
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">To Date</label>
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
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total Span:</span>
                              <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                                {editTdyDurationDays} Calendar Day{editTdyDurationDays > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </>
`;

const depBlock = `
                        <>
                          {/* Destination */}
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Destination (Mandatory) <span className="text-red-500">*</span>
                            </label>
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
                                placeholder="Enter custom location..."
                                value={editDepCustomLocation}
                                onChange={(e) => setEditDepCustomLocation(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-xs"
                              />
                            )}
                          </div>

                          {/* Assignment Date Presets */}
                          <div>
                             <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                                Assignment Date
                              </label>
                             <div className="grid grid-cols-5 gap-1.5 mb-3">
                              {[{label: 'Today', val: 1}, {label: '2 Days', val: 2}, {label: '3 Days', val: 3}, {label: '7 Days', val: 7}, {label: '15 Days', val: 15}].map((opt) => {
                                const isSelected = editDepPresetDays === opt.val;
                                return (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => {
                                      if (opt.val === 1) {
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        setEditFromDate(todayStr);
                                        setEditToDate(todayStr);
                                      } else {
                                        const d = new Date(editFromDate);
                                        d.setDate(d.getDate() + opt.val - 1);
                                        setEditToDate(d.toISOString().split('T')[0]);
                                      }
                                      setEditDepPresetDays(opt.val);
                                    }}
                                    className={\`py-1.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs text-center border \${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/50 shadow-sm'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300'
                                    }\`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Date Range */}
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
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">To Date</label>
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
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total Span:</span>
                              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                                {editTdyDurationDays} Calendar Day{editTdyDurationDays > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </>
`;

const leaveRegex = /\{\/\*\s*Assignments Table\s*\*\/\}[\s\S]*?\{editingGroup\[0\]\.dutyCode === 'LEAVE' \? \([\s\S]*?\) : editingGroup\[0\]\.dutyCode === 'TDY' \? \(/;

let leaveBlock = modal.match(leaveRegex);
if(leaveBlock) {
  // First, we need to extract the exact components from AssignLeaveTab to use in AirmanProfileModal.
  // Actually, wait, the simplest way is to manually adjust the order of elements within the LEAVE block in AirmanProfileModal to match AssignLeaveTab.
}

