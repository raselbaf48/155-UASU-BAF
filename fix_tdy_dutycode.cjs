const fs = require('fs');
const file = 'src/components/AirmanProfileModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "finalDutyCode = destToUse === 'Canteen' ? 'CANTEEN' : destToUse.includes('Bake') ? 'BAKE_N_BITE' : 'ATT';",
  "finalDutyCode = 'TDY';"
);

fs.writeFileSync(file, content);
