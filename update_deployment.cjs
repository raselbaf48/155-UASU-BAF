const fs = require('fs');
let content = fs.readFileSync('src/components/DeploymentRegisterView.tsx', 'utf8');

// 1. Add Destination Column Header
content = content.replace(
  '<th className="py-3 px-4 text-center">Current Status</th>',
  '<th className="py-3 px-4 text-center">Destination</th>\n                <th className="py-3 px-4 text-center">Current Status</th>'
);

// 2. Add Destination Column Data
content = content.replace(
  '<td className="py-3 px-4 text-center">\n                        {rec.currentlyOnAtt ? (',
  '<td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300 font-bold">\n                        {rec.currentlyOnAtt ? (rec.currentAttLocation || \'Outstation\') : \'-\'}\n                      </td>\n                      <td className="py-3 px-4 text-center">\n                        {rec.currentlyOnAtt ? ('
);

// 3. Remove Remarks field in the Grant Modal
const remarksRegex = /\{\/\*\s*Remarks \(Optional\)\s*\*\/\}\s*<div[^>]*>[\s\S]*?<\/div>\s*\{\/\*\s*Date Range\s*\*\/\}/;
content = content.replace(remarksRegex, '{/* Date Range */}');

// 4. Update the save logic to only save Destination as notes
content = content.replace(
  'const notes = attRemarks ? `${finalDest} - ${attRemarks}` : finalDest;',
  'const notes = finalDest;'
);

fs.writeFileSync('src/components/DeploymentRegisterView.tsx', content);
