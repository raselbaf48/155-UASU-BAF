const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

code = code.replace(
    "const [activeTab, setActiveTab] = useState<string>(initialMember?.role === 'manager' ? 'manager_dashboard' : 'dashboard');",
    "const [activeTab, setActiveTab] = useState<string>(initialMember?.role === 'manager' ? 'manager_dashboard' : 'personal_portal');"
);
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
