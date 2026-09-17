const fs = require('fs');

const mockDataStr = fs.readFileSync('mock_data.json', 'utf8');

function patchFile(filepath, isInventory) {
    let code = fs.readFileSync(filepath, 'utf8');
    const stateName = isInventory ? 'items' : 'catalog';
    const setStateName = isInventory ? 'setItems' : 'setCatalog';
    
    // Change initial state to mock data instead of empty array
    code = code.replace(
        new RegExp(`const \\\[${stateName}, ${setStateName}\\\] = useState(?:<any\\\[\\\]>)?\\(\\\[\\\]\\);`),
        `const [${stateName}, ${setStateName}] = useState<any[]>(${mockDataStr});`
    );

    // Make fetchItems/fetchCatalog NOT block loading if we already have initial data
    if (isInventory) {
        // Remove setLoading(true) from fetchItems
        code = code.replace(/setLoading\(true\);/, "setLoading(false); // Instant load");
    }

    fs.writeFileSync(filepath, code);
    console.log("Patched", filepath);
}

patchFile('src/features/canteen/pages/CanteenInventory.tsx', true);
patchFile('src/features/canteen/pages/ManagerDashboard.tsx', false);
patchFile('src/features/canteen/pages/PosSales.tsx', false);
