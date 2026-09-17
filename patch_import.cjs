const fs = require('fs');
const file = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/import \{ Utensils, Search, X, Check, ChefHat, Clock, Plus, XCircle, AlertTriangle \} from 'lucide-react';/, "import { Utensils, Search, X, Check, ChefHat, Clock, Plus, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';");
fs.writeFileSync(file, code);
