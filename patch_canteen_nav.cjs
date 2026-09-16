const fs = require('fs');

const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Update imports for icons
if (!code.includes('ShoppingCart')) {
    code = code.replace("import { LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft, Utensils, Wifi, HelpCircle, LogIn, Grid, Package as Pkg } from 'lucide-react';", 
                        "import { LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft, Utensils, Wifi, HelpCircle, LogIn, Grid, Package as Pkg, ShoppingCart, Users, Banknote, BarChart2, Settings as SettingsIcon } from 'lucide-react';");
}

// 2. Fix the nav items logic
const oldNavItems = /const navItems = \[\s*\{\s*id:\s*'dashboard'[\s\S]*?\];/;
const newNavItems = `const navItems = currentUser.role === 'manager' ? [
    { id: 'manager_dashboard', name: 'Dashboard', icon: Grid },
    { id: 'pos_sales', name: 'POS Sales', icon: ShoppingCart },
    { id: 'member_db', name: 'Member DB', icon: Users },
    { id: 'inventory', name: 'Inventory', icon: Pkg },
    { id: 'expenditures', name: 'Expenditures', icon: Banknote },
    { id: 'reports', name: 'Reports', icon: BarChart2 },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
    { id: 'guide', name: 'Guide', icon: HelpCircle },
  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'my_bill', name: 'My Bill', icon: CreditCard },
    { id: 'help', name: 'Help', icon: HelpCircle }
  ];`;
  
code = code.replace(oldNavItems, newNavItems);

// 3. Add cases in renderContent
const renderContentOld = /switch\(activeTab\)\s*\{[\s\S]*?default:/;
const renderContentNew = `switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard />;
      case 'manager_dashboard': return <ManagerDashboard />;
      case 'pos_sales': return <PosSales />;
      case 'member_db': return <MemberDB />;
      case 'inventory': return <CanteenInventory />;
      case 'expenditures': return <Expenditures />;
      case 'reports': return <CanteenReports />;
      case 'settings': return <CanteenSettings />;
      default:`;

code = code.replace(renderContentOld, renderContentNew);

// Add missing imports for these new components at the top (we will create them)
const importsToAdd = `
import { PosSales } from '../pages/PosSales';
import { MemberDB } from '../pages/MemberDB';
import { CanteenInventory } from '../pages/CanteenInventory';
import { Expenditures } from '../pages/Expenditures';
import { CanteenReports } from '../pages/CanteenReports';
import { CanteenSettings } from '../pages/CanteenSettings';
`;
if(!code.includes('PosSales')) {
    code = code.replace("import { Settings } from '../pages/Settings';", "import { Settings } from '../pages/Settings';" + importsToAdd);
}

fs.writeFileSync(file, code);
