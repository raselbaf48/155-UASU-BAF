const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// Remove Ser and Status from profile grid
code = code.replace(/<div className="grid grid-cols-2 gap-3\.5 bg-slate-50 dark:bg-slate-800\/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">[\s\S]*?<div className="bg-slate-50 dark:bg-slate-800\/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">/, 
`<div className="grid grid-cols-2 gap-3.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    BD No
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                    {airman.bdNo}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Rank
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {formatAirmanName(airman.rank)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Full Name
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {airman.fullName || airman.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Trade
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {airman.trade}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Flight
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {airman.flightName}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">`);

// Remove Status from the list
code = code.replace(/\{variant === 'biodata' && \(\s*<div className="flex items-center justify-between">\s*<span className="text-slate-500 font-semibold text-xs">Status<\/span>[\s\S]*?<\/div>\s*\)\}/, '');

// Replace ATT with DEPL in categoryFilter
code = code.replace(/if \(categoryFilter === 'ATT'\) return \['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'\]\.includes\(a\.dutyCode\);/, 
                    `if (categoryFilter === 'DEPL') return ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(a.dutyCode);`);

code = code.replace(/const isGroupedView = categoryFilter === 'LEAVE' \|\| categoryFilter === 'TDY' \|\| categoryFilter === 'ATT';/,
                    `const isGroupedView = categoryFilter === 'LEAVE' || categoryFilter === 'TDY' || categoryFilter === 'DEPL' || categoryFilter === 'DUTY';`);

code = code.replace(/\{\(\['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'\]\.includes\(categoryFilter\) \? \['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'\] : \['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT', categoryFilter\]\)\.map\(\(cat\) => \(/g,
                    `{(['ALL', 'DUTY', 'LEAVE', 'TDY', 'DEPL'].includes(categoryFilter) ? ['ALL', 'DUTY', 'LEAVE', 'TDY', 'DEPL'] : ['ALL', 'DUTY', 'LEAVE', 'TDY', 'DEPL', categoryFilter]).map((cat) => (`);

// Remove GD and BTF summary boxes
const summaryRegex = /<div className="grid grid-cols-3 sm:grid-cols-6 gap-2">[\s\S]*?<div className="text-\[10px\] font-bold text-orange-700/;
code = code.replace(summaryRegex, `<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="text-[10px] font-bold text-orange-700`);

// Update history table headers and content
code = code.replace(/<th className="py-2\.5 px-3\.5">\{categoryFilter === 'LEAVE' \? 'Leave Type' : 'Destination'\}<\/th>/,
                    `<th className="py-2.5 px-3.5">{categoryFilter === 'LEAVE' ? 'Leave Type' : categoryFilter === 'DUTY' ? 'Duty Type' : 'Destination'}</th>`);

code = code.replace(/<th className="py-2\.5 px-3\.5">Ser No<\/th>/,
                    `<th className="py-2.5 px-3.5">Ser</th>`);

code = code.replace(/const typeOrDest = categoryFilter === 'LEAVE' \? \(first\.notes \|\| 'Leave'\) : \(first\.notes \|\| \(categoryFilter === 'TDY' \? 'TDY' : 'Deployment'\)\);/,
                    `const typeOrDest = categoryFilter === 'LEAVE' ? (first.notes || 'Leave') : categoryFilter === 'DUTY' ? (DUTY_TYPE_MAP[first.dutyCode]?.label || first.dutyCode) : (first.notes || (categoryFilter === 'TDY' ? 'TDY' : 'Deployment'));`);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
