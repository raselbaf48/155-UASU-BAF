const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

const toMove = `  const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');
  const [isCanteenAuth, setIsCanteenAuth] = useState<boolean>(false);
  const [isCanteenManagerMode, setIsCanteenManagerMode] = useState<boolean>(false);`;

code = code.replace(toMove + '\n', '');

// insert it right before officeRecentLogins
const target = `  const [officeRecentLogins, setOfficeRecentLogins] = useState<string[]>(() => {`;
code = code.replace(target, toMove + '\n\n' + target);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);
