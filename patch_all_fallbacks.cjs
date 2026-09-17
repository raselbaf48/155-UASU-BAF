const fs = require('fs');

const mockDataStr = fs.readFileSync('mock_data.json', 'utf8');

function patchFile(filepath, fallbackRegex) {
    let code = fs.readFileSync(filepath, 'utf8');
    
    // We replace the small array with the huge array
    code = code.replace(
        /set(?:Catalog|Items)\(\[\s*\{\s*id:\s*'1'[\s\S]*?\]\);/,
        `set${filepath.includes('Inventory') ? 'Items' : 'Catalog'}(${mockDataStr});`
    );
    
    fs.writeFileSync(filepath, code);
}

patchFile('src/features/canteen/pages/CanteenInventory.tsx');
patchFile('src/features/canteen/pages/ManagerDashboard.tsx');
patchFile('src/features/canteen/pages/PosSales.tsx');
