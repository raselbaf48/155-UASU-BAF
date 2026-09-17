const fs = require('fs');
const file = 'src/features/canteen/pages/PersonalPortal.tsx';
let code = fs.readFileSync(file, 'utf8');

const importTarget = "import { Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, Clock, Trash2, CheckCircle2 } from 'lucide-react';";
const importReplace = "import { Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, Clock, Trash2, CheckCircle2, XCircle } from 'lucide-react';";
code = code.replace(importTarget, importReplace);

fs.writeFileSync(file, code);
