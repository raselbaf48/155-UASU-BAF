const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const imports = `import { BillingManagement } from '../pages/BillingManagement';\nimport { MyBill } from '../pages/MyBill';\nimport { Reports } from '../pages/Reports';\nimport { PieChart } from 'lucide-react';\n`;
code = code.replace("import { MenuManagement } from '../pages/MenuManagement';", "import { MenuManagement } from '../pages/MenuManagement';\n" + imports);

// Update nav items
const oldManagerNav = `    { id: 'inventory_management', name: t('inventory_management'), icon: Package },
    { id: 'billing', name: t('monthly_bill'), icon: CreditCard },
    { id: 'settings', name: t('settings'), icon: Settings },`;
const newManagerNav = `    { id: 'inventory_management', name: t('inventory_management'), icon: Package },
    { id: 'billing', name: t('monthly_bill'), icon: CreditCard },
    { id: 'reports', name: t('reports'), icon: PieChart },
    { id: 'settings', name: t('settings'), icon: Settings },`;
code = code.replace(oldManagerNav, newManagerNav);

// Update render cases
const oldRender = `case 'menu_management': return <MenuManagement />;
      default: return <div className="text-center p-10 font-bold text-slate-500 animate-pulse">Under Construction ({activeTab})</div>;`;
const newRender = `case 'menu_management': return <MenuManagement />;
      case 'billing': return <BillingManagement />;
      case 'my_bill': return <MyBill />;
      case 'reports': return <Reports />;
      default: return <div className="text-center p-10 font-bold text-slate-500 animate-pulse">Under Construction ({activeTab})</div>;`;
code = code.replace(oldRender, newRender);

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
