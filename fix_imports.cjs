const fs = require('fs');
const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

// Remove all lucide-react imports
code = code.replace(/import\s+\{[^}]+\}\s+from\s+'lucide-react';/g, '');

// Add one unified import
const unifiedImport = "import { LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft, Utensils, Wifi, HelpCircle, LogIn, Grid, Package as Pkg, ShoppingCart, Users, Banknote, BarChart2, Settings as SettingsIcon, PieChart, Package, UserCircle, X } from 'lucide-react';";

code = code.replace("import { Settings } from '../pages/Settings';", "import { Settings } from '../pages/Settings';\n" + unifiedImport);

fs.writeFileSync(file, code);
