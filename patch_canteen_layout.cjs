const fs = require('fs');
const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/select\('Name, Rank'\)/g, "select('Surname, Rank')");
code = code.replace(/\$\{data\.Rank\} \$\{data\.Name\}/g, "${data.Rank} ${data.Surname}");

fs.writeFileSync(file, code);
