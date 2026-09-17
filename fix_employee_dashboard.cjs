const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', 'utf8');

code = code.replace(
    /<img src=\{\\\`https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\\\$\{currentUser\?\.name \|\| 'Guest'\}\\&backgroundColor=f1f5f9\\\`\}/g,
    "<img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.name || 'Guest'}&backgroundColor=f1f5f9`}"
);

code = code.replace(
    /key=\{\\\`cell-\\\$\{index\}\\\`\}/g,
    "key={`cell-${index}`}"
);

fs.writeFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', code);
