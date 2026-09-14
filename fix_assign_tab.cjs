const fs = require('fs');
let tab = fs.readFileSync('src/components/AssignDeploymentTab.tsx', 'utf8');

tab = tab.replace(
  /const fullNotes = deploymentRemarks\.trim\(\) \? \`\$\{finalDest\} \- \$\{deploymentRemarks\.trim\(\)\}\` : finalDest;/g,
  `const fullNotes = deploymentRemarks.trim() ? \`\${finalDest} - \${deploymentRemarks.trim()}\` : finalDest;
      const dutyCodeToUse = finalDest === 'Canteen' ? 'CANTEEN' : finalDest.includes('Bake') ? 'BAKE_N_BITE' : 'ATT';`
);

tab = tab.replace(
  /dutyCode: 'DEPLOYMENT',/g,
  `dutyCode: dutyCodeToUse,`
);

fs.writeFileSync('src/components/AssignDeploymentTab.tsx', tab);
