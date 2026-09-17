const fs = require('fs');
const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `const [currentUser, setCurrentUser] = useState({ name: initialMember ? initialMember.name : 'Guest', role: (initialMember && initialMember.role) ? initialMember.role : 'employee' as 'employee'|'manager' });`;
const replaceStr = `const [currentUser, setCurrentUser] = useState<any>({ name: initialMember ? initialMember.name : 'Guest', role: (initialMember && initialMember.role) ? initialMember.role : 'employee', bdNo: initialMember?.bdNo });`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync(file, code);
