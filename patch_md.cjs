const fs = require('fs');

let code = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');

// Safely handle selectedItems
code = code.replace(
    /try \{ setSelectedItems\(JSON\.parse\(stored\)\); \} catch\(e\)\{\}/,
    `try { 
            const parsed = JSON.parse(stored); 
            if (Array.isArray(parsed)) setSelectedItems(parsed);
            else setSelectedItems([]);
        } catch(e){
            setSelectedItems([]);
        }`
);

// Fallback in fetchCatalog
const fetchCode = `const fetchCatalog = async () => {
    try {
        const { data, error } = await supabase.from('Canteen_Inventory').select('*');
        if (!error && data && data.length > 0) {
            setCatalog(data);
        } else {
            // fallback mock data
            setCatalog([
                { id: '1', name: 'Samosa', category: 'SNACKS', price: 10, stock: 50 },
                { id: '2', name: 'Chicken Patties', category: 'SNACKS', price: 25, stock: 30 },
                { id: '3', name: 'Tea', category: 'BEVERAGE', price: 10, stock: 100 },
                { id: '4', name: 'Coffee', category: 'BEVERAGE', price: 20, stock: 80 },
                { id: '5', name: 'Chicken Biryani', category: 'LUNCH', price: 120, stock: 20 },
            ]);
        }
    } catch (e) {
        setCatalog([]);
    }
  };`;

// We previously modified fetchCatalog, so we might need a general replace
code = code.replace(/const fetchCatalog = async \(\) => \{[\s\S]*?\};\n/, fetchCode + '\n');

// Update modal rendering for safety and empty state
const emptyState = `{catalog.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                              <Utensils className="w-10 h-10 mb-3 opacity-20" />
                              <p className="text-xs font-bold uppercase tracking-widest">No items in catalog</p>
                          </div>
                      ) : (
                          catalog.filter(i => (i.name || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => {
                              const isSelected = Array.isArray(selectedItems) && selectedItems.includes(item.id);`;

code = code.replace(/\{catalog\.filter\(i => \(i\.name \|\| ''\)\.toLowerCase\(\)\.includes\(searchCatalog\.toLowerCase\(\)\)\)\.map\(item => \{\s*const isSelected = selectedItems\.includes\(item\.id\);/, emptyState);

// we have one more closing bracket to add since we added a ternary operator
code = code.replace(/                          \)\n                      \}\)\}\n                  <\/div>\n                  <button onClick=\{saveDailyMenu\}/, 
`                          )
                      })
                  )}
                  </div>
                  <button onClick={saveDailyMenu}`);

fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', code);
