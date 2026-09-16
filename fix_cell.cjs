const fs = require('fs');
const file = 'src/features/canteen/pages/EmployeeDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/key=\{.*?\}/, 'key={`cell-${index}`}');
fs.writeFileSync(file, code);
