const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const target = `  const [showCurateMenu, setShowCurateMenu] = useState(false);`;
const replace = `  const [showCurateMenu, setShowCurateMenu] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);`;

code = code.replace(target, replace);
fs.writeFileSync(mgrFile, code);
