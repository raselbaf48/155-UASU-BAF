const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

code = code.replace(
    "case 'dashboard': return <EmployeeDashboard onManagerPortalClick",
    "case 'dashboard': return <EmployeeDashboard currentUser={currentUser} onManagerPortalClick"
);
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
