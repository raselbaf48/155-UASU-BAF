const fs = require('fs');
let content = fs.readFileSync('src/data/rosterGenerator.ts', 'utf8');

const oldLogic = /if \(assignmentMap\.has\(directKey\)\) \{\s*return assignmentMap\.get\(directKey\)\!;\s*\}\s*\/\/ Calculate previous date D-1\s*const d = new Date\(dateStr\);\s*d\.setDate\(d\.getDate\(\) - 1\);\s*const year = d\.getFullYear\(\);\s*const month = String\(d\.getMonth\(\) \+ 1\)\.padStart\(2, '0'\);\s*const day = String\(d\.getDate\(\)\)\.padStart\(2, '0'\);\s*const yestStr = \`\$\{year\}-\$\{month\}-\$\{day\}\`;\s*const yestKey = \`\$\{airmanId\}_\$\{yestStr\}\`;\s*const yestAss = assignmentMap\.get\(yestKey\);\s*if \(yestAss\) \{\s*const isHeavyDuty =\s*\['GD', 'BTF', 'NTF', 'AIRPORT'\]\.includes\(yestAss\.dutyCode\) \|\|\s*\(\(yestAss\.dutyCode === 'IDAC' \|\| yestAss\.dutyCode === 'IDA'\) && yestAss\.idaShift === 'Night'\);\s*if \(isHeavyDuty\) \{\s*return \{\s*airmanId,\s*date: dateStr,\s*dutyCode: 'DUTY_OFF',\s*notes: 'Auto Duty Off \\(Post Night\/Heavy Duty\\)',\s*\};\s*\}\s*\}/;

const newLogic = `const currentAss = assignmentMap.get(directKey);

  // Calculate previous date D-1
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const yestStr = \`\${year}-\${month}-\${day}\`;
  const yestKey = \`\${airmanId}_\${yestStr}\`;

  const yestAss = assignmentMap.get(yestKey);
  const isHeavyDuty = yestAss ? (
    ['GD', 'BTF', 'NTF', 'AIRPORT', 'ATT', 'HALISHAHAR'].includes(yestAss.dutyCode) ||
    ((yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') && yestAss.idaShift === 'Night') ||
    (yestAss.notes || '').toLowerCase().includes('idac')
  ) : false;

  const isDeployment = currentAss && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(currentAss.dutyCode);

  if (!currentAss || isDeployment) {
    if (isHeavyDuty) {
      return {
        airmanId,
        date: dateStr,
        dutyCode: 'DUTY_OFF',
        notes: 'Auto Duty Off (Post Night/Heavy Duty)',
      };
    }
  }

  if (currentAss) {
    return currentAss;
  }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/data/rosterGenerator.ts', content);
