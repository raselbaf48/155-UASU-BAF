const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');

const regex = /\)}\s*className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">/g;
code = code.replace(regex, ')}');

fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', code);
