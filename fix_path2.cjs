const fs = require('fs');

function fixImport(file) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import \{ formatMoney, formatNumber \} from '\.\.\/\.\.\/i18n';/g, "import { formatMoney, formatNumber } from '../i18n';");
    code = code.replace(/import \{ formatNumber \} from '\.\.\/\.\.\/i18n';/g, "import { formatNumber } from '../i18n';");
    fs.writeFileSync(file, code);
}

fixImport('src/features/canteen/pages/ManagerDashboard.tsx');
fixImport('src/features/canteen/pages/InventoryManagement.tsx');
