const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

const fetchCode = `const fetchCatalog = async () => {
    try {
        const { data, error } = await supabase.from('Canteen_Inventory').select('*');
        if (!error && data && data.length > 0) {
            setCatalog(data);
        } else {
            setCatalog([
                { id: '1', name: 'Samosa', category: 'SNACKS', price: 10, stock: 50 },
                { id: '2', name: 'Chicken Patties', category: 'SNACKS', price: 25, stock: 30 },
                { id: '3', name: 'Tea', category: 'BEVERAGE', price: 10, stock: 100 },
                { id: '4', name: 'Coffee', category: 'BEVERAGE', price: 20, stock: 80 },
                { id: '5', name: 'Chicken Biryani', category: 'LUNCH', price: 120, stock: 20 },
            ]);
        }
    } catch(e) {
        setCatalog([]);
    }
  };`;

code = code.replace(/const fetchCatalog = async \(\) => \{[\s\S]*?\};\n/, fetchCode + '\n');
fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', code);
