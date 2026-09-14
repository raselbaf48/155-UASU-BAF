const fs = require('fs');
let content = fs.readFileSync('src/components/TdyRegisterView.tsx', 'utf8');

// 1. Remove Remarks field in the Grant Modal
const remarksRegex = /\{\/\*\s*Remarks \(Optional\)\s*\*\/\}\s*<div[^>]*>[\s\S]*?<\/div>\s*\{\/\*\s*Assignment Date Presets\s*\*\/\}/;
content = content.replace(remarksRegex, '{/* Assignment Date Presets */}');

// 2. Update the save logic to only save Destination as notes
content = content.replace(
  'const notes = tdyRemarks ? `${finalDest} - ${tdyRemarks}` : finalDest;',
  'const notes = finalDest;'
);

fs.writeFileSync('src/components/TdyRegisterView.tsx', content);
