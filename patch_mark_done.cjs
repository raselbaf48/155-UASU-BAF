const fs = require('fs');
const file = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `const member = members.find(m => m['BD No'] === order.memberId);`;
const replaceStr = `const member = members.find(m => String(m['BD No']) === String(order.memberId));`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync(file, code);
