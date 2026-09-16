const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const replacement = `<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-center">
                  <div className="text-[10px] font-bold text-orange-700`;
                  
code = code.replace(/<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">\s*<div className="text-\[10px\] font-bold text-orange-700/, replacement);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
