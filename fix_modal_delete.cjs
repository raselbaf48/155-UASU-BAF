const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// The delete-range call in save edit:
content = content.replace(
  /body: JSON\.stringify\(\{\s*airmanId: airman\.id,\s*fromDate: editingGroup\[0\]\.date,\s*toDate: editingGroup\[editingGroup\.length - 1\]\.date,\s*\}\),/g,
  `body: JSON.stringify({
          airmanId: airman.id,
          fromDate: editingGroup[0].date,
          toDate: editingGroup[editingGroup.length - 1].date,
          dutyCode: editingGroup[0].dutyCode,
        }),`
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
