const fs = require('fs');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

modal = modal.replace(
  /\} else if \(editingGroup\[0\]\.dutyCode === 'ATT'\) \{/g,
  `} else if (['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(editingGroup[0].dutyCode)) {`
);

modal = modal.replace(
  /\) : editingGroup\[0\]\.dutyCode === 'ATT' \? \(/g,
  `) : ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(editingGroup[0].dutyCode) ? (`
);

modal = modal.replace(
  /body: JSON\.stringify\(\{\n\s*airmanId: airman\.id,\n\s*dutyCode: editingGroup\[0\]\.dutyCode,/g,
  `body: JSON.stringify({\n          airmanId: airman.id,\n          dutyCode: finalDutyCode,`
);

// We need to add `let finalDutyCode = editingGroup[0].dutyCode;` and update it.
modal = modal.replace(
  /let finalNotes = editNotes;/g,
  `let finalNotes = editNotes;\n    let finalDutyCode = editingGroup[0].dutyCode;`
);

modal = modal.replace(
  /finalNotes = destToUse;\n\s*\}/g,
  `finalNotes = destToUse;\n        finalDutyCode = destToUse === 'Canteen' ? 'CANTEEN' : destToUse.includes('Bake') ? 'BAKE_N_BITE' : 'ATT';\n    }`
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', modal);
