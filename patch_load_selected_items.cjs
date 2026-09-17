const fs = require('fs');

const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let mgrCode = fs.readFileSync(mgrFile, 'utf8');

const target = `  const [selectedItems, setSelectedItems] = useState<string[]>([]);`;
const replacement = `  const [selectedItems, setSelectedItems] = useState<string[]>(() => {
      const stored = localStorage.getItem('canteen_daily_menu');
      if (stored) {
          try {
              return JSON.parse(stored);
          } catch(e) { return []; }
      }
      return [];
  });`;

if (mgrCode.includes(target) && !mgrCode.includes('JSON.parse(stored)')) {
    mgrCode = mgrCode.replace(target, replacement);
    fs.writeFileSync(mgrFile, mgrCode);
    console.log("Patched Initial Selected Items");
}
