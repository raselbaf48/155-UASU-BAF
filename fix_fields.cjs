const fs = require('fs');

function fixFields(file) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/item\.Item_Name/g, 'item.name');
    code = code.replace(/i\.Item_Name/g, 'i.name');
    code = code.replace(/item\.Category/g, 'item.category');
    code = code.replace(/item\.Selling_Price/g, 'item.price');
    fs.writeFileSync(file, code);
}

fixFields('src/features/canteen/pages/ManagerDashboard.tsx');
fixFields('src/features/canteen/pages/EmployeeDashboard.tsx');
