const fs = require('fs');
const file = 'src/components/UserLoginGate.tsx';
let code = fs.readFileSync(file, 'utf8');

const badPart = `  useEffect(() => {
      if (activeTab === 'Canteen' && canteenRecentLogins.length > 0 && !bdInput) {
          setBdInput(canteenRecentLogins[0]);
      }
  }, [activeTab, canteenRecentLogins]);`;
code = code.replace(badPart, '');

const insertAfter = `  const [canteenRecentLogins, setCanteenRecentLogins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('baf_canteen_recent_logins');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });`;

const newEffect = `\n  useEffect(() => {
      if (activeTab === 'Canteen' && canteenRecentLogins.length > 0 && !bdInput) {
          setBdInput(canteenRecentLogins[0]);
      }
  }, [activeTab, canteenRecentLogins, bdInput]);\n`;

code = code.replace(insertAfter, insertAfter + newEffect);

fs.writeFileSync(file, code);
