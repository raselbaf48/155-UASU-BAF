const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const countVars = [
  'gdCount', 'btfCount', 'ntfCount', 'halishaharCount', 'idacCount', 'clCount', 'alCount', 'totalLeave'
];

countVars.forEach(v => {
  code = code.replace(new RegExp(`\\s*const ${v} = [^;]+;`, 'g'), '');
});

fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
