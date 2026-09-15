const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

content = content.replace("if (!confirm('Are you sure you want to completely remove this entry?')) return;", "");

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
