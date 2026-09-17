const fs = require('fs');
let code = fs.readFileSync('/tmp/CanteenLayout.tsx', 'utf8');

// The original CanteenLayout has `EmployeeDashboard` mapped to dashboard and personal_portal
code = code.replace(
    "import { EmployeeDashboard } from '../pages/EmployeeDashboard';",
    "import { EmployeeDashboard } from '../pages/EmployeeDashboard';\nimport { PersonalPortal } from '../pages/PersonalPortal';"
);

code = code.replace(
    "case 'personal_portal': return <EmployeeDashboard currentUser={currentUser} onManagerPortalClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginInput(''); setLoginError(''); }} />;",
    "case 'personal_portal': return <PersonalPortal currentUser={currentUser} />;"
);

// We need to add "Manager Login" in the sidebar for employees
const oldNavItems = `  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'personal_portal', name: 'Personal Portal', icon: UserCircle },
    { id: 'inventory', name: 'Inventory', icon: Pkg },
    { id: 'help', name: 'Help', icon: HelpCircle }
  ];`;

const newNavItems = `  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'personal_portal', name: 'Personal Portal', icon: UserCircle },
    { id: 'inventory', name: 'Inventory', icon: Pkg },
    { id: 'help', name: 'Help', icon: HelpCircle },
    { id: 'manager_login', name: 'Manager Login', icon: LogIn }
  ];`;
code = code.replace(oldNavItems, newNavItems);

// We need to handle manager_login click
const onClickOld = `onClick={() => setActiveTab(item.id)}`;
const onClickNew = `onClick={() => {
                  if (item.id === 'manager_login') {
                      setLoginTab('manager'); 
                      setShowLogin(true); 
                      setLoginInput(''); 
                      setLoginError('');
                  } else {
                      setActiveTab(item.id);
                  }
                }}`;
code = code.replace(onClickOld, onClickNew);
// The mobile one as well
code = code.replace(onClickOld, onClickNew);

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
