const fs = require('fs');
const mockDataStr = fs.readFileSync('mock_data.json', 'utf8');

function patchFile(filepath) {
    let code = fs.readFileSync(filepath, 'utf8');
    
    const target = `  const fetchMenu = async () => {
      const stored = localStorage.getItem('canteen_daily_menu');
      if (stored) {
          try {
              const ids = JSON.parse(stored);
              if (ids.length > 0) {
                  const { data, error } = await supabase.from('Canteen_Inventory').select('*').in('id', ids);
                  if (!error && data) {
                      setDailyMenu(data);
                  }
              }
          } catch(e){}
      }
  };`;

    const replacement = `  const fetchMenu = async () => {
      const stored = localStorage.getItem('canteen_daily_menu');
      if (stored) {
          try {
              const ids = JSON.parse(stored);
              if (ids.length > 0) {
                  const allItems = ${mockDataStr};
                  const filtered = allItems.filter(item => ids.includes(item.id));
                  
                  try {
                      const { data, error } = await supabase.from('Canteen_Inventory').select('*').in('id', ids);
                      if (!error && data && data.length > 0) {
                          setDailyMenu(data);
                          return;
                      }
                  } catch(err) {
                      console.warn("Supabase fetchMenu failed, using local mock data.");
                  }
                  
                  setDailyMenu(filtered);
              } else {
                  setDailyMenu([]);
              }
          } catch(e){}
      } else {
          setDailyMenu([]);
      }
  };`;

    if (code.includes(target)) {
        code = code.replace(target, replacement);
        fs.writeFileSync(filepath, code);
        console.log("Patched", filepath);
    } else {
        console.log("Target not found in", filepath);
    }
}

patchFile('src/features/canteen/pages/PersonalPortal.tsx');
patchFile('src/features/canteen/pages/EmployeeDashboard.tsx');
