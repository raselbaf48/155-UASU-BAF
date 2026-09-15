const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

content = content.replace("setShowDeleteGroupConfirm(true);", "setShowDeleteConfirm(true);");
content = content.replace("setShowDeleteGroupConfirm(false);", "setShowDeleteConfirm(false);");

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
