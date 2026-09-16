const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/CanteenFund.tsx', 'utf8');

code = code.replace(/\\\\\`/g, '\`');
code = code.replace(/\\\$/g, '$');

fs.writeFileSync('src/features/canteen/pages/CanteenFund.tsx', code);
