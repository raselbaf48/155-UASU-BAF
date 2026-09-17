const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', 'utf8');
code = code.replace("seed=\\${currentUser?.name || 'Guest'}", "seed=${currentUser?.name || 'Guest'}");
code = code.replace("key={`cell-\\${index}`}", "key={`cell-${index}`}");
fs.writeFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', code);
