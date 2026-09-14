const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const oldSave = `  const handleSaveEdit = async () => {
    if (!editingGroup) return;
    setSavingEdit(true);
    setErrorMsg('');
    try {
      let finalNotes = editNotes;
      if (editingGroup[0].dutyCode === 'TDY') {
          const destToUse = editTdyDestination === 'Custom' ? editTdyCustomDestination : editTdyDestination;
          finalNotes = editTdyRemarks.trim() ? \`\${destToUse} - \${editTdyRemarks.trim()}\` : destToUse;
      }`;

const newSave = `  const handleSaveEdit = async () => {
    if (!editingGroup) return;
    
    let finalNotes = editNotes;
    if (editingGroup[0].dutyCode === 'TDY') {
        const destToUse = editTdyDestination === 'Custom' ? editTdyCustomDestination : editTdyDestination;
        if (!destToUse) {
            setErrorMsg('Please select or enter a destination.');
            return;
        }
        finalNotes = editTdyRemarks.trim() ? \`\${destToUse} - \${editTdyRemarks.trim()}\` : destToUse;
    }
    
    setSavingEdit(true);
    setErrorMsg('');
    try {`;

content = content.replace(oldSave, newSave);
fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
