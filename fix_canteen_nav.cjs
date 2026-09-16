const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const replacementNav = `
  const navItems = currentUser.role === 'manager' ? [
    { id: 'manager_dashboard', name: 'Manager Home', icon: Grid },
    { id: 'pos_sales', name: 'POS Sales', icon: ShoppingCart },
    { id: 'member_db', name: 'Member DB', icon: Users },
    { id: 'inventory', name: 'Inventory', icon: Pkg },
    { id: 'expenditures', name: 'Expenditures', icon: Banknote },
    { id: 'reports', name: 'Reports', icon: PieChart },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'help', name: 'Help', icon: HelpCircle }
  ];
`;

code = code.replace(/const navItems = \[[\s\S]*?\];/m, replacementNav.trim());

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
