const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// Insert imports
const imports = `import { ManagerDashboard } from '../pages/ManagerDashboard';\nimport { InventoryManagement } from '../pages/InventoryManagement';\nimport { BarChart2, Package, Settings, UserCircle } from 'lucide-react';\n`;
code = code.replace("import { MyDemands } from '../pages/MyDemands';", "import { MyDemands } from '../pages/MyDemands';\n" + imports);

// Add role state
code = code.replace("const [activeTab, setActiveTab] = useState<'dashboard' | 'place_demand' | 'all_demands' | 'my_demands' | 'my_bill'>('dashboard');", "const [activeTab, setActiveTab] = useState<string>('dashboard');\n  const [role, setRole] = useState<'employee'|'manager'>('manager');");

// Update Nav Items
const oldNavItems = `const navItems = [
    { id: 'dashboard', name: t('dashboard'), icon: LayoutDashboard },
    { id: 'place_demand', name: t('place_demand'), icon: Coffee },
    { id: 'my_demands', name: t('my_demands'), icon: List },
    { id: 'my_bill', name: t('my_bill'), icon: CreditCard },
  ] as const;`;

const newNavItems = `const navItems = role === 'employee' ? [
    { id: 'dashboard', name: t('dashboard'), icon: LayoutDashboard },
    { id: 'place_demand', name: t('place_demand'), icon: Coffee },
    { id: 'my_demands', name: t('my_demands'), icon: List },
    { id: 'my_bill', name: t('my_bill'), icon: CreditCard },
  ] : [
    { id: 'manager_dashboard', name: t('manager_dashboard'), icon: BarChart2 },
    { id: 'menu_management', name: t('menu_management'), icon: Coffee },
    { id: 'demand_management', name: t('demand_management'), icon: List },
    { id: 'inventory_management', name: t('inventory_management'), icon: Package },
    { id: 'billing', name: t('monthly_bill'), icon: CreditCard },
    { id: 'settings', name: t('settings'), icon: Settings },
  ];`;

code = code.replace(oldNavItems, newNavItems);

// Update render
const oldRender = `const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard />;
      case 'place_demand': return <PlaceDemand />;
      case 'my_demands': return <MyDemands />;
      case 'my_bill': return <div className="text-center p-10 font-bold text-slate-500">Under Construction</div>;
      default: return <EmployeeDashboard />;
    }
  };`;

const newRender = `const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard />;
      case 'place_demand': return <PlaceDemand />;
      case 'my_demands': return <MyDemands />;
      case 'manager_dashboard': return <ManagerDashboard />;
      case 'inventory_management': return <InventoryManagement />;
      default: return <div className="text-center p-10 font-bold text-slate-500 animate-pulse">Under Construction ({activeTab})</div>;
    }
  };`;

code = code.replace(oldRender, newRender);

// Add Role Toggle
const oldLangBtn = `<button 
                onClick={toggleLanguage}`;

const newRoleBtn = `<button 
                onClick={() => {
                   setRole(role === 'employee' ? 'manager' : 'employee');
                   setActiveTab(role === 'employee' ? 'manager_dashboard' : 'dashboard');
                }}
                className="flex items-center space-x-1 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors shadow-sm text-indigo-600"
              >
                <UserCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t('switch_role')}</span>
              </button>
              <button 
                onClick={toggleLanguage}`;

code = code.replace(oldLangBtn, newRoleBtn);

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
