const fs = require('fs');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// Replace handleEditTdyPresetToggle with inline logic
modal = modal.replace(
  /onClick=\{\(\) \=\> handleEditTdyPresetToggle\(opt\.val\)\}/g,
  `onClick={() => {
    setEditTdyPresetDays(opt.val);
    if (editFromDate) {
      const d = new Date(editFromDate);
      d.setDate(d.getDate() + opt.val - 1);
      setEditToDate(d.toISOString().split('T')[0]);
    }
  }}`
);

// Replace handleEditDepPresetToggle with inline logic
modal = modal.replace(
  /onClick=\{\(\) \=\> handleEditDepPresetToggle\(days\)\}/g,
  `onClick={() => {
    setEditDepPresetDays(days);
    if (editFromDate) {
      const d = new Date(editFromDate);
      d.setDate(d.getDate() + days - 1);
      setEditToDate(d.toISOString().split('T')[0]);
    }
  }}`
);

// Replace missing variables for DEP
modal = modal.replace(/deploymentLocation/g, 'editDepLocation');
modal = modal.replace(/setDeploymentLocation/g, 'setEditDepLocation');
modal = modal.replace(/deploymentCustomDestination/g, 'editDepCustomLocation');
modal = modal.replace(/setDeploymentCustomDestination/g, 'setEditDepCustomLocation');
modal = modal.replace(/deploymentFromDate/g, 'editFromDate');
modal = modal.replace(/setDeploymentFromDate/g, 'setEditFromDate');
modal = modal.replace(/deploymentToDate/g, 'editToDate');
modal = modal.replace(/setDeploymentToDate/g, 'setEditToDate');

// Duration days
modal = modal.replace(/editTdyDurationDays/g, 'editLeaveDurationDays');
modal = modal.replace(/deploymentDurationDays/g, 'editLeaveDurationDays');

// Deployment Remarks - wait, I removed remarks from Grant tab, but let's just use editNotes just in case
modal = modal.replace(/deploymentRemarks/g, 'editNotes');
modal = modal.replace(/setDeploymentRemarks/g, 'setEditNotes');

fs.writeFileSync('src/components/AirmanProfileModal.tsx', modal);
