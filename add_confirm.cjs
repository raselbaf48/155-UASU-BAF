const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

content = content.replace(
  "if (!editingGroup) return;\\n    \\n    setDeletingGroup(true);",
  "if (!editingGroup) return;\\n    if (!window.confirm('Are you sure you want to completely remove this entry?')) return;\\n    \\n    setDeletingGroup(true);"
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
