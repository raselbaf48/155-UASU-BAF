const fs = require('fs');

function fixImport(file) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import \{ formatNumber, formatMoney \} from '\.\.\/\.\.\/i18n';/g, "import { formatNumber, formatMoney } from '../i18n';");
    code = code.replace(/import \{ formatMoney \} from '\.\.\/\.\.\/i18n';/g, "import { formatMoney } from '../i18n';");
    fs.writeFileSync(file, code);
}

fixImport('src/features/canteen/pages/DemandManagement.tsx');
fixImport('src/features/canteen/pages/MenuManagement.tsx');
