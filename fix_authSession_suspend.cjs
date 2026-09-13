const fs = require('fs');

const path = 'src/utils/authSession.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  
  content = content.replace(
    /status: a.active \? 'ACTIVE' : 'SUSPENDED',/g, 
    "status: a.active === false ? 'SUSPENDED' : 'ACTIVE',"
  );
  
  fs.writeFileSync(path, content);
}
