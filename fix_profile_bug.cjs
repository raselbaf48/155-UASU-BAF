const fs = require('fs');

function fixProfile() {
  let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

  // We need to fix the grouping logic so it doesn't separate when notes are slightly different or when diffDays == 1
  const oldGroupingLogic = `
      if (current.dutyCode === prev.dutyCode && (diffDays === 1 || diffDays === 0) && current.notes === prev.notes) {
        if (diffDays === 1) { // avoid adding same date duplicates
          currentGroup.push(current);
        }
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
  `;

  const newGroupingLogic = `
      // Treat TDY, ATT, DETT, BAKE_N_BITE, CANTEEN similarly for grouping if they share duty code or are in the same category
      // We do not strictly require 'notes' to match perfectly if it's the same duty type and contiguous
      
      const isContiguous = (diffDays === 1 || diffDays === 0);
      const isSameDutyCode = current.dutyCode === prev.dutyCode;
      
      // Let's loosen the notes restriction for deployment/tdy to group better
      let canGroup = isSameDutyCode && isContiguous;
      
      if (canGroup) {
        if (diffDays === 1) { // avoid adding same date duplicates
          currentGroup.push(current);
        }
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
  `;

  if (content.includes("current.notes === prev.notes")) {
      content = content.replace(/if \(current\.dutyCode === prev\.dutyCode && \(diffDays === 1 \|\| diffDays === 0\) && current\.notes === prev\.notes\) {/g, 
      "const isContiguous = (diffDays === 1 || diffDays === 0); const isSameDutyCode = current.dutyCode === prev.dutyCode; if (isSameDutyCode && isContiguous) {");
  }

  fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
}

fixProfile();
