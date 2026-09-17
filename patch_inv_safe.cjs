const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/CanteenInventory.tsx', 'utf8');

code = code.replace(
    /item\.name\.toLowerCase\(\)/g,
    "(item.name || '').toLowerCase()"
);
code = code.replace(
    /item\.category\.toLowerCase\(\)/g,
    "(item.category || '').toLowerCase()"
);

fs.writeFileSync('src/features/canteen/pages/CanteenInventory.tsx', code);
