const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

if (!code.includes("import { User as UserIcon")) {
    code = code.replace("import { Package as Pkg, ShoppingCart, Users, PieChart, Banknote, Settings as SettingsIcon, LogOut, Search, Clock, Plus, Check, FileText, Download, Edit2, Wallet, ArrowLeft, Utensils, X, Menu, Grid, HelpCircle, User, LayoutDashboard, Coffee, LogIn } from 'lucide-react';", 
    "import { Package as Pkg, ShoppingCart, Users, PieChart, Banknote, Settings as SettingsIcon, LogOut, Search, Clock, Plus, Check, FileText, Download, Edit2, Wallet, ArrowLeft, Utensils, X, Menu, Grid, HelpCircle, User, LayoutDashboard, Coffee, LogIn, UserCircle } from 'lucide-react';");
}

const oldNavItems = `  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'help', name: 'Help', icon: HelpCircle }
  ];`;

const newNavItems = `  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'personal_portal', name: 'Personal Portal', icon: UserCircle },
    { id: 'inventory', name: 'Inventory', icon: Pkg },
    { id: 'help', name: 'Help', icon: HelpCircle }
  ];`;
code = code.replace(oldNavItems, newNavItems);

const oldCase = `case 'dashboard': return <EmployeeDashboard currentUser={currentUser} onManagerPortalClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginInput(''); setLoginError(''); }} />;`;
const newCase = `case 'dashboard': return <EmployeeDashboard currentUser={currentUser} onManagerPortalClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginInput(''); setLoginError(''); }} />;
      case 'personal_portal': return <EmployeeDashboard currentUser={currentUser} onManagerPortalClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginInput(''); setLoginError(''); }} />;\n`; // Just rendering the same component for now, or maybe they want the Personal Portal layout when clicking Personal Portal, and Home is different. Wait!
// "Customer Mode e ogin korle aivabe Left side a personal portal open hoye aivabe show hbe"
// (When logging in Customer mode, the left side Personal Portal will be open and show like this.)
code = code.replace(oldCase, newCase);
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
