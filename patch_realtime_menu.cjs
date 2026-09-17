const fs = require('fs');

function patchFile(filepath) {
    let code = fs.readFileSync(filepath, 'utf8');

    // Find the useEffect array dependencies for fetchMenu
    // We want to add an event listener for storage and a custom event
    const searchString = `  useEffect(() => {
      fetchMenu();`;
      
    const replaceString = `  useEffect(() => {
      fetchMenu();
      
      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'canteen_daily_menu') {
              fetchMenu();
          }
      };
      
      const handleCustomEvent = () => {
          fetchMenu();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('canteen_menu_updated', handleCustomEvent);
      
      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('canteen_menu_updated', handleCustomEvent);
      };`;

    if (code.includes(searchString) && !code.includes('window.addEventListener(\'canteen_menu_updated\'')) {
        // Also we need to make sure the useEffect dependencies include fetchMenu if we were to add it, but empty or [currentUser] is fine since fetchMenu is in closure
        code = code.replace(searchString, replaceString);
        fs.writeFileSync(filepath, code);
        console.log("Patched Realtime", filepath);
    }
}

patchFile('src/features/canteen/pages/PersonalPortal.tsx');
patchFile('src/features/canteen/pages/EmployeeDashboard.tsx');

// Also update ManagerDashboard to dispatch the custom event when saving
let mgrCode = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');
const mgrTarget = `  const saveDailyMenu = () => {
      localStorage.setItem('canteen_daily_menu', JSON.stringify(selectedItems));
      setShowCurateMenu(false);
  };`;
const mgrReplace = `  const saveDailyMenu = () => {
      localStorage.setItem('canteen_daily_menu', JSON.stringify(selectedItems));
      window.dispatchEvent(new Event('canteen_menu_updated'));
      setShowCurateMenu(false);
  };`;
if (mgrCode.includes(mgrTarget) && !mgrCode.includes('window.dispatchEvent(new Event(\'canteen_menu_updated\'))')) {
    mgrCode = mgrCode.replace(mgrTarget, mgrReplace);
    fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', mgrCode);
    console.log("Patched ManagerDashboard");
}
