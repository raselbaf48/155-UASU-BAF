const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', 'utf8');

code = code.replace(
    /seed=\\\$\\{currentUser/g,
    "seed=${currentUser"
);

code = code.replace(
    /key=\{\`cell-\\\$\\{index\\}\`\}/g,
    "key={`cell-${index}`}"
);

fs.writeFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', code);
