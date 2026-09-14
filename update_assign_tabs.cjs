const fs = require('fs');

// AssignTdyTab
let tdy = fs.readFileSync('src/components/AssignTdyTab.tsx', 'utf8');
tdy = tdy.replace(
  /\{\/\*\s*Remarks\s*\*\/\}\s*<div[^>]*>[\s\S]*?<\/div>\s*\{\/\*\s*Assignment Date Presets\s*\*\/\}/,
  '{/* Assignment Date Presets */}'
);
tdy = tdy.replace(
  'const fullNotes = tdyRemarks.trim() ? `${finalDest} - ${tdyRemarks.trim()}` : finalDest;',
  'const fullNotes = finalDest;'
);
fs.writeFileSync('src/components/AssignTdyTab.tsx', tdy);

// AssignDeploymentTab
let dep = fs.readFileSync('src/components/AssignDeploymentTab.tsx', 'utf8');
dep = dep.replace(
  /\{\/\*\s*Remarks\s*\*\/\}\s*<div[^>]*>[\s\S]*?<\/div>\s*\{\/\*\s*Assignment Date Presets\s*\*\/\}/,
  '{/* Assignment Date Presets */}'
);
dep = dep.replace(
  'const fullNotes = depRemarks.trim() ? `${finalDest} - ${depRemarks.trim()}` : finalDest;',
  'const fullNotes = finalDest;'
);
fs.writeFileSync('src/components/AssignDeploymentTab.tsx', dep);
