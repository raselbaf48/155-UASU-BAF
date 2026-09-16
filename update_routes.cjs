const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// Insert imports
const imports = `import { DemandManagement } from '../pages/DemandManagement';\nimport { MenuManagement } from '../pages/MenuManagement';\n`;
code = code.replace("import { InventoryManagement } from '../pages/InventoryManagement';", "import { InventoryManagement } from '../pages/InventoryManagement';\n" + imports);

// Update render
const oldRender = `const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard />;
      case 'place_demand': return <PlaceDemand />;
      case 'my_demands': return <MyDemands />;
      case 'manager_dashboard': return <ManagerDashboard />;
      case 'inventory_management': return <InventoryManagement />;
      default: return <div className="text-center p-10 font-bold text-slate-500 animate-pulse">Under Construction ({activeTab})</div>;
    }
  };`;

const newRender = `const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard />;
      case 'place_demand': return <PlaceDemand />;
      case 'my_demands': return <MyDemands />;
      case 'manager_dashboard': return <ManagerDashboard />;
      case 'inventory_management': return <InventoryManagement />;
      case 'demand_management': return <DemandManagement />;
      case 'menu_management': return <MenuManagement />;
      default: return <div className="text-center p-10 font-bold text-slate-500 animate-pulse">Under Construction ({activeTab})</div>;
    }
  };`;

code = code.replace(oldRender, newRender);
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
