const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

content = content.replace(
  '{!isDutyMatrixMode && onEditAirman && (',
  '{!historyOnly && onEditAirman && ('
);

content = content.replace(
  '{!isDutyMatrixMode && onRemoveAirman && (',
  '{!historyOnly && onRemoveAirman && ('
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
