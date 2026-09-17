const fs = require('fs');

const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const targetStr = `return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || bd.includes(memberSearchTerm);`;
const replaceStr = `return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || String(bd).includes(memberSearchTerm);`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync(mgrFile, code);
