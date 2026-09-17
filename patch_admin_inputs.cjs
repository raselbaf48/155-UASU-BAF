const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPasscodeModal.tsx', 'utf8');

code = code.replace(/inputMode="numeric"\s*\n\s*pattern="\[0-9\]\*"/g, "");
fs.writeFileSync('src/components/AdminPasscodeModal.tsx', code);
