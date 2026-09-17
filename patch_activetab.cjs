const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

code = code.replace(/setActiveTab\('dashboard'\)/g, "setActiveTab('personal_portal')");
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
