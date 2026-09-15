const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// Inside handleSaveEdit
content = content.replace(/setEditingGroup\(null\);\s*\n\s*\/\/\s*refresh hack\s*\n\s*setFromDate\(prev => prev\.slice\(\)\);\s*\n\s*const fetchEvt = new CustomEvent\('baf_state_updated'\);\s*\n\s*window\.dispatchEvent\(fetchEvt\);/g, 
`setEditingGroup(null);
      setRefreshKey(prev => prev + 1);
      const fetchEvt = new CustomEvent('baf_state_updated');
      window.dispatchEvent(fetchEvt);`);

// Inside handleDeleteGroup
content = content.replace(/setEditingGroup\(null\);\s*\n\s*setFromDate\(prev => prev\.slice\(\)\);\s*\n\s*const fetchEvt = new CustomEvent\('baf_state_updated'\);\s*\n\s*window\.dispatchEvent\(fetchEvt\);/g,
`setEditingGroup(null);
      setRefreshKey(prev => prev + 1);
      const fetchEvt = new CustomEvent('baf_state_updated');
      window.dispatchEvent(fetchEvt);`);

// Add listener inside useEffect for baf_state_updated
// Let's find the fetchHistory useEffect and add an event listener to it.
const oldUseEffect = `fetchHistory();
  }, [airman.id, fromDate, toDate, refreshKey]);`;

const newUseEffect = `fetchHistory();
    
    const handleGlobalUpdate = () => {
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('baf_state_updated', handleGlobalUpdate);
    };
  }, [airman.id, fromDate, toDate, refreshKey]);`;

content = content.replace(oldUseEffect, newUseEffect);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
