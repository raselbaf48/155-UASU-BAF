const fs = require('fs');

let depTab = fs.readFileSync('src/components/AssignDeploymentTab.tsx', 'utf8');
depTab = depTab.replace(/\{\/\*\s*Remarks\s*\*\/\}\s*<div>\s*<label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">\s*Remarks \(Optional\)\s*<\/label>\s*<input[^>]+value=\{deploymentRemarks\}[^>]+>\s*<\/div>/g, '');
depTab = depTab.replace(/const fullNotes = deploymentRemarks\.trim\(\) \? \`\$\{finalDest\} \- \$\{deploymentRemarks\.trim\(\)\}\` : finalDest;/g, 'const fullNotes = finalDest;');
fs.writeFileSync('src/components/AssignDeploymentTab.tsx', depTab);

let tdyTab = fs.readFileSync('src/components/AssignTdyTab.tsx', 'utf8');
tdyTab = tdyTab.replace(/\{\/\*\s*Remarks\s*\*\/\}\s*<div>\s*<label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">\s*Remarks \(Optional\)\s*<\/label>\s*<input[^>]+value=\{tdyRemarks\}[^>]+>\s*<\/div>/g, '');
tdyTab = tdyTab.replace(/const notes = tdyRemarks\.trim\(\) \? \`\$\{finalDest\} \- \$\{tdyRemarks\.trim\(\)\}\` : finalDest;/g, 'const notes = finalDest;');
fs.writeFileSync('src/components/AssignTdyTab.tsx', tdyTab);

