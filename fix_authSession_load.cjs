const fs = require('fs');

const path = 'src/utils/authSession.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  
  const target = `    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) {
        parsed = p;
      }
    }`;
    
  const replace = `    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) {
        parsed = p.map(u => ({
          ...u,
          status: u.status === 'SUSPENDED' && nominalAirmen.find(a => a.bdNo.replace(/^BD\\/?/i, '').trim().toLowerCase() === u.bdNo.toLowerCase())?.active !== false ? 'ACTIVE' : u.status
        }));
      }
    }`;

  if (!content.includes('nominalAirmen.find(a => a.bdNo.replace')) {
     content = content.replace(target, replace);
     fs.writeFileSync(path, content);
  }
}
