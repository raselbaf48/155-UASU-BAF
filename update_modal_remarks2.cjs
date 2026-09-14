const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// Replace the specific lines inside the ATT block
content = content.replace(
`                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Remarks (Optional)</label>
                            <input
                              type="text"
                              value={editingGroup[0].dutyCode === 'ATT' ? editDepRemarks : editNotes}
                              onChange={(e) => {
                                  if (editingGroup[0].dutyCode === 'ATT') setEditDepRemarks(e.target.value);
                                  else setEditNotes(e.target.value);
                              }}
                              placeholder="Any specific notes..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-xs"
                            />
                          </div>`,
""
);

content = content.replace(
  "editingGroup[0].dutyCode === 'ATT' || editingGroup[0].dutyCode === 'ATT'",
  "editingGroup[0].dutyCode === 'ATT'"
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
