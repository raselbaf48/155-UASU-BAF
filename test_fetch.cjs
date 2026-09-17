const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');
code = code.replace(
    /const fetchCatalog = async \(\) => \{[\s\S]*?\};\n/,
    `const fetchCatalog = async () => {
    const { data, error } = await supabase.from('Canteen_Inventory').select('*');
    console.log('ManagerDashboard fetchCatalog:', { data, error });
    if (!error && data) {
      setCatalog(data);
    } else {
      console.error('Failed to fetch catalog', error);
    }
  };
`
);
fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', code);
