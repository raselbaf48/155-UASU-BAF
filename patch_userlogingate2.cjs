const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// Change "User ID" to "Member ID" for Canteen
const oldUserIdLabel = `<label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">User ID</label>`;
const newUserIdLabel = `<label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{activeTab === 'Canteen' ? 'Member ID' : 'User ID'}</label>`;
code = code.replace(oldUserIdLabel, newUserIdLabel);

// Make the input box look "blank" instead of keeping the eye icon space for Canteen
const oldInput = `className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all"`;
const newInput = `className={\`w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-sm font-mono font-bold text-white outline-none transition-all \${activeTab !== 'Canteen' ? 'pr-12' : ''}\`}`;
code = code.replace(oldInput, newInput);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);
