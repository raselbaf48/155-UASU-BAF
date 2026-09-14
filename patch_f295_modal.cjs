const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// 1. Add states for F-295 in edit mode
const f295States = `
  const [editIncludeF295, setEditIncludeF295] = useState<boolean>(false);
  const [editF295Option, setEditF295Option] = useState<'2' | '3' | 'custom'>('2');
  const [editF295CustomDays, setEditF295CustomDays] = useState<number>(0);
`;
content = content.replace(/const \[editLeaveType, setEditLeaveType\] = useState<string>\('Casual'\);/, `const [editLeaveType, setEditLeaveType] = useState<string>('Casual');\n${f295States}`);

// 2. Parse F-295 when clicking a LEAVE group
const parseF295Logic = `
        let type = 'Casual';
        if (rawNotes.includes('Annual')) type = 'Annual';
        else if (rawNotes.includes('Sick')) type = 'Sick';
        else if (rawNotes.includes('Recreation')) type = 'Recreation';
        setEditLeaveType(type);

        const f295Match = rawNotes.match(/\\(F-295: (\\d+) Free Days\\)/);
        if (f295Match && f295Match[1]) {
            setEditIncludeF295(true);
            const days = parseInt(f295Match[1], 10);
            if (days === 2) {
                setEditF295Option('2');
            } else if (days === 3) {
                setEditF295Option('3');
            } else {
                setEditF295Option('custom');
                setEditF295CustomDays(days);
            }
        } else {
            setEditIncludeF295(false);
            setEditF295Option('2');
            setEditF295CustomDays(0);
        }
`;
content = content.replace(/let type = 'Casual';[\s\S]*?setEditLeaveType\(type\);/, parseF295Logic.trim());

// 3. Reconstruct notes when saving
const saveF295Logic = `
        const fullTypeName = editLeaveType === 'Casual' ? 'Casual Leave' : editLeaveType === 'Annual' ? 'Annual Leave' : editLeaveType === 'Sick' ? 'Sick Leave' : editLeaveType === 'Recreation' ? 'Recreation Leave' : 'Leave';
        const f295Extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
        finalNotes = f295Extra > 0 ? \`\${fullTypeName} (F-295: \${f295Extra} Free Days)\` : fullTypeName;
`;
content = content.replace(/const fullTypeName = editLeaveType[\s\S]*?if \(editNotes\.includes\('F-295'\)\) \{[\s\S]*?\}\s*\}/, saveF295Logic.trim());

// 4. Update UI for Leave
const f295UI = `                      ) : editingGroup[0].dutyCode === 'LEAVE' ? (
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
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                                <span>Include F-295 (Free Days)?</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setEditIncludeF295(!editIncludeF295)}
                                className={\`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none cursor-pointer \${
                                  editIncludeF295 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                                }\`}
                              >
                                <span className={\`inline-block h-3 w-3 transform rounded-full bg-white transition-transform \${editIncludeF295 ? 'translate-x-3.5' : 'translate-x-0.5'}\`} />
                              </button>
                            </div>
                            
                            {editIncludeF295 && (
                              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <button
                                  type="button"
                                  onClick={() => setEditF295Option('2')}
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
                                  onClick={() => setEditF295Option('3')}
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
                                  onClick={() => setEditF295Option('custom')}
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
                                      onChange={(e) => setEditF295CustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                      className="w-14 px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none"
                                    />
                                    <span className="text-[11px] text-slate-500">Days</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
`;

const oldLeaveUI = /                      \) : editingGroup\[0\]\.dutyCode === 'LEAVE' \? \([\s\S]*?<\/div>\n                        <\/>/;
content = content.replace(oldLeaveUI, f295UI.trim());


// 5. Calculate net leave days in grouped table
const groupedTableDays = `
                              <td className="py-2.5 px-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                                {(() => {
                                  let days = group.length;
                                  if (first.dutyCode === 'LEAVE' && first.notes) {
                                    const match = first.notes.match(/\\(F-295: (\\d+) Free Days\\)/);
                                    if (match && match[1]) {
                                      days = Math.max(0, days - parseInt(match[1], 10));
                                    }
                                  }
                                  return \`\${String(days).padStart(2, '0')} days\`;
                                })()}
                              </td>
`;
content = content.replace(/<td className="py-2\.5 px-3\.5 text-right font-black text-emerald-600 dark:text-emerald-400">\s*\{String\(group\.length\)\.padStart\(2, '0'\)\} days\s*<\/td>/, groupedTableDays.trim());

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

