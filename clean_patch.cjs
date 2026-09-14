const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// The file has a duplicate `<div className="flex-1 overflow-y-auto relative">` or missing `</div>`.
// Let's just fix the syntax error! 
// At line 644 we had an extra `)}`.
// Let's look at the structure and fix it.

content = content.replace(
  '<div className="flex-1 overflow-y-auto relative">\\n                {editingGroup ? (',
  '{editingGroup ? ('
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
