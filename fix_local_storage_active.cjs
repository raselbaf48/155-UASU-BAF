const fs = require('fs');

const path = 'src/services/localDatabase.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  
  const target = `    if (raw) {
      try {
        const parsed = JSON.parse(raw);`;
        
  const replace = `    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.airmen) {
           parsed.airmen = parsed.airmen.map(a => ({
              ...a,
              active: a.active === undefined ? true : a.active
           }));
        }
        if (parsed.detailedUsers) {
           parsed.detailedUsers = parsed.detailedUsers.map(u => ({
              ...u,
              status: u.status === 'SUSPENDED' && (parsed.airmen.find(a => a.bdNo === u.bdNo)?.active) ? 'ACTIVE' : (u.status || 'ACTIVE')
           }));
        }`;
        
  if (!content.includes('active: a.active === undefined ? true : a.active')) {
    content = content.replace(target, replace);
    fs.writeFileSync(path, content);
  }
}
