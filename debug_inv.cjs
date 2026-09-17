const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/CanteenInventory.tsx', 'utf8');

// replace console log to see if fetchItems finishes
code = code.replace(
    /setLoading\(false\);/,
    "setLoading(false); console.log('Finished fetchItems, items array length:', items.length);"
);

fs.writeFileSync('src/features/canteen/pages/CanteenInventory.tsx', code);
