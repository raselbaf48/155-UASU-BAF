const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const summaryRegex = /\s*\{\/\* Counters Summary \*\/\}\s*\{!historyOnly && \(\s*<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">[\s\S]*?<\/div>\s*\)\}\s*/;
code = code.replace(summaryRegex, '\n            ');

fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
