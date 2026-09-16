const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

code = code.replace(
    "interface CanteenLayoutProps {\n  initialMember?: { name: string, bdNo: string };",
    "interface CanteenLayoutProps {\n  initialMember?: { name: string, bdNo: string, role?: 'employee'|'manager' };"
);

code = code.replace(
    "const [currentUser, setCurrentUser] = useState({ name: initialMember ? initialMember.name : 'Guest', role: 'employee' as 'employee'|'manager' });",
    "const [currentUser, setCurrentUser] = useState({ name: initialMember ? initialMember.name : 'Guest', role: (initialMember && initialMember.role) ? initialMember.role : 'employee' as 'employee'|'manager' });"
);

// If they are manager, they should land on manager_dashboard?
// The CanteenLayout defaults to `activeTab` 'dashboard'. If role is manager, should we set it to 'manager_dashboard'?
code = code.replace(
    "const [activeTab, setActiveTab] = useState<string>('dashboard');",
    "const [activeTab, setActiveTab] = useState<string>(initialMember?.role === 'manager' ? 'manager_dashboard' : 'dashboard');"
);


fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
