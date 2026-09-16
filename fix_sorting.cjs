const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const oldSort = `    const sorted = [...list].sort((a, b) => {
      if (a.dutyCode !== b.dutyCode) return (a.dutyCode || '').localeCompare(b.dutyCode || '');
      return a.date.localeCompare(b.date);
    });`;

const newSort = `    const sorted = [...list].sort((a, b) => {
      if (a.dutyCode !== b.dutyCode) return (a.dutyCode || '').localeCompare(b.dutyCode || '');
      // Also separate by notes if they differ (e.g. different destinations)
      if ((a.notes || '') !== (b.notes || '')) return (a.notes || '').localeCompare(b.notes || '');
      return a.date.localeCompare(b.date);
    });`;

code = code.replace(oldSort, newSort);

const oldSameCheck = "const isSameDutyCode = current.dutyCode === prev.dutyCode;";
const newSameCheck = "const isSameDutyCode = current.dutyCode === prev.dutyCode && (current.notes || '') === (prev.notes || '');";

code = code.replace(oldSameCheck, newSameCheck);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
