const fs = require('fs');

let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

const searchState = `  const [recentLogins, setRecentLogins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('baf_recent_logins');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const removeRecent = (id: string) => {
    const updated = recentLogins.filter(x => x !== id);
    setRecentLogins(updated);
    localStorage.setItem('baf_recent_logins', JSON.stringify(updated));
  };`;

const replaceState = `  const [officeRecentLogins, setOfficeRecentLogins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('baf_recent_logins');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [canteenRecentLogins, setCanteenRecentLogins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('baf_canteen_recent_logins');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const recentLogins = activeTab === 'Canteen' ? canteenRecentLogins : officeRecentLogins;

  const removeRecent = (id: string) => {
    if (activeTab === 'Canteen') {
      const updated = canteenRecentLogins.filter(x => x !== id);
      setCanteenRecentLogins(updated);
      localStorage.setItem('baf_canteen_recent_logins', JSON.stringify(updated));
    } else {
      const updated = officeRecentLogins.filter(x => x !== id);
      setOfficeRecentLogins(updated);
      localStorage.setItem('baf_recent_logins', JSON.stringify(updated));
    }
  };`;

code = code.replace(searchState, replaceState);

const searchCanteenSuccess = `        setIsLoading(false);
        setIsCanteenAuth(true);
        setSuccessAirman(airman);
        return;
      } else {`;

const replaceCanteenSuccess = `        const updatedRecents = [cleanInput, ...canteenRecentLogins.filter(x => x !== cleanInput)].slice(0, 4);
        setCanteenRecentLogins(updatedRecents);
        localStorage.setItem('baf_canteen_recent_logins', JSON.stringify(updatedRecents));
        
        setIsLoading(false);
        setIsCanteenAuth(true);
        setSuccessAirman(airman);
        return;
      } else {`;

code = code.replace(searchCanteenSuccess, replaceCanteenSuccess);

const searchOfficeSuccess = `      const updatedRecents = [cleanInput, ...recentLogins.filter(x => x !== cleanInput)].slice(0, 4);
      setRecentLogins(updatedRecents);
      localStorage.setItem('baf_recent_logins', JSON.stringify(updatedRecents));`;

const replaceOfficeSuccess = `      const updatedRecents = [cleanInput, ...officeRecentLogins.filter(x => x !== cleanInput)].slice(0, 4);
      setOfficeRecentLogins(updatedRecents);
      localStorage.setItem('baf_recent_logins', JSON.stringify(updatedRecents));`;

code = code.replace(searchOfficeSuccess, replaceOfficeSuccess);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);
