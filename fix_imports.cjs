const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', 'utf8');
code = code.replace(
    "import { Utensils, Search, User, Zap, History, CreditCard } from 'lucide-react';",
    "import { Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, Clock } from 'lucide-react';"
);
fs.writeFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', code);
