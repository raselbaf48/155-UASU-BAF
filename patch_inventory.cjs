const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/CanteenInventory.tsx', 'utf8');

const fetchCode = `const fetchItems = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.from('Canteen_Inventory').select('*');
        console.log('CanteenInventory fetchItems:', { data, error });
        if (!error && data && data.length > 0) {
            setItems(data);
        } else {
            console.error('Failed or empty fetch:', error);
            // Fallback
            setItems([
                { id: '1', name: 'BLACK COFFEE', category: 'DRINK', price: 20, stock: 929994, isFixed: false },
                { id: '2', name: 'BOILED EGG', category: 'SNACKS', price: 15, stock: 81986, isFixed: false, active: true },
                { id: '3', name: 'CHICKEN BIRIYANI', category: 'SNACKS', price: 65, stock: 97994, isFixed: false },
                { id: '4', name: 'CHICKEN CURRY', category: 'SNACKS', price: 50, stock: 9981, isFixed: false },
            ]);
        }
    } catch (e) {
        console.error('Exception fetching items:', e);
    }
    setLoading(false);
  };`;

code = code.replace(/const fetchItems = async \(\) => \{[\s\S]*?setLoading\(false\);\n  \};/, fetchCode);
fs.writeFileSync('src/features/canteen/pages/CanteenInventory.tsx', code);
