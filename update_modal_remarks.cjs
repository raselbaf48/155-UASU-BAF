const fs = require('fs');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// TDY UI Remarks
const tdyRemarksRegex = /<div>\s*<label[^>]*>Remarks \(Optional\)<\/label>\s*<input[^>]*value=\{editTdyRemarks\}[^>]*\/>\s*<\/div>/;
modal = modal.replace(tdyRemarksRegex, '');

// Deployment UI Remarks
const depRemarksRegex = /<div>\s*<label[^>]*>Remarks \(Optional\)<\/label>\s*<input[^>]*value=\{editingGroup\[0\]\.dutyCode === 'DEPLOYMENT' \? editDepRemarks : editNotes\}[^>]*\/>\s*<\/div>/;
modal = modal.replace(depRemarksRegex, '');

// Logic
modal = modal.replace(
  'finalNotes = editTdyRemarks.trim() ? `${destToUse} - ${editTdyRemarks.trim()}` : destToUse;',
  'finalNotes = destToUse;'
);

modal = modal.replace(
  'finalNotes = editDepRemarks.trim() ? `${destToUse} - ${editDepRemarks.trim()}` : destToUse;',
  'finalNotes = destToUse;'
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', modal);
