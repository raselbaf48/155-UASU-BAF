const fs = require('fs');

const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Update imports
if (!code.includes('Utensils')) {
    code = code.replace("import { LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft } from 'lucide-react';", 
                        "import { LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft, Utensils, Wifi, HelpCircle, LogIn, Grid, Package as Pkg } from 'lucide-react';");
}

// 2. Update nav items
const oldNavItems = /const navItems = [^\]]+\]\s*:\s*\[[^\]]+\];/s;
const newNavItems = `const navItems = [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'inventory_management', name: 'Inventory', icon: Pkg },
    { id: 'help', name: 'Help', icon: HelpCircle }
];`;
code = code.replace(oldNavItems, newNavItems);

fs.writeFileSync(file, code);
