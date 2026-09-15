const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

content = content.replace("onClick={() => setShowDeleteGroupConfirm(false)}", "onClick={() => setShowDeleteConfirm(false)}");

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
