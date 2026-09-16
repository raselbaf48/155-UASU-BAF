const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');

code = code.replace(
`      )} className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">`,
`      )}`
);

fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', code);
