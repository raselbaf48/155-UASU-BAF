const fs = require('fs');

const path = 'src/services/localDatabase.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  
  content = content.replace(
    /status: s.status \|\| 'ACTIVE',/g, 
    "active: s.status === 'ACTIVE' || s.status === null || s.status === undefined,\n          status: s.status || 'ACTIVE',"
  );
  
  // Also check if pushing staff requires 'active' to map back to status
  content = content.replace(
    /status: \(a as any\)\.status \|\| 'ACTIVE',/g,
    "status: a.active === false ? 'SUSPENDED' : 'ACTIVE',"
  );

  fs.writeFileSync(path, content);
}
