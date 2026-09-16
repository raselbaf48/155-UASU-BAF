const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

if (!code.includes('Settings } from')) {
    code = code.replace(/X, RefreshCw/, 'X, RefreshCw, Settings, MoreVertical');
}

if (!code.includes('showSettingsDropdown')) {
    code = code.replace(
        /const \[profileTab, setProfileTab\] = useState<'profile' \| 'history'>\('profile'\);/,
        `const [profileTab, setProfileTab] = useState<'profile' | 'history'>('profile');\n  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);`
    );
}

// Ensure the dropdown is closed when opening a new statement
code = code.replace(
    /setStatementMember\(member\);/g,
    `setStatementMember(member); setShowSettingsDropdown(false);`
);

const oldHeader = `<div className="flex items-center space-x-2">
                          <button onClick={() => { handleEdit(statementMember); setStatementMember(null); }} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors" title="Edit Member">
                              <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => { setDeleteConfirmId(statementMember.airman_id); setStatementMember(null); }} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors" title="Delete Member">
                              <Trash2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => setStatementMember(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-2" title="Close">
                              <X className="w-5 h-5" />
                          </button>
                      </div>`;

const newHeader = `<div className="flex items-center space-x-2 relative">
                          <div className="relative">
                              <button onClick={() => setShowSettingsDropdown(!showSettingsDropdown)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors" title="Settings">
                                  <Settings className="w-5 h-5" />
                              </button>
                              
                              {showSettingsDropdown && (
                                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                                      <button 
                                          onClick={() => { handleEdit(statementMember); setStatementMember(null); setShowSettingsDropdown(false); }} 
                                          className="w-full text-left px-4 py-3 flex items-center space-x-3 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700"
                                      >
                                          <Edit2 className="w-4 h-4" />
                                          <span className="text-sm font-bold">Edit Member</span>
                                      </button>
                                      <button 
                                          onClick={() => { setDeleteConfirmId(statementMember.airman_id); setStatementMember(null); setShowSettingsDropdown(false); }} 
                                          className="w-full text-left px-4 py-3 flex items-center space-x-3 text-rose-400 hover:bg-rose-900/30 hover:text-rose-500 transition-colors"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                          <span className="text-sm font-bold">Delete Member</span>
                                      </button>
                                  </div>
                              )}
                          </div>
                          
                          <button onClick={() => setStatementMember(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-2" title="Close">
                              <X className="w-5 h-5" />
                          </button>
                      </div>`;

code = code.replace(oldHeader, newHeader);

fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);
