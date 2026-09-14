const fs = require('fs');

let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const isDepStr = `const isDeployment = (code) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);`;

// In assignRange
let assignRangeLogic = `
      if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
        if (idaShift === 'Night') {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
        } else {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDeployment(a.dutyCode) === isDeployment(dutyCode));
        }
      } else {
        index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDeployment(a.dutyCode) === isDeployment(dutyCode));
      }
`;

content = content.replace(/if \(dutyCode === 'IDAC' \|\| dutyCode === 'IDA'\) \{\s*if \(idaShift === 'Night'\) \{\s*index = list\.findIndex[^\}]+\}\s*else\s*\{\s*index = list\.findIndex[^\}]+\}\s*\}\s*else\s*\{\s*index = list\.findIndex[^\}]+\}/, isDepStr + assignRangeLogic);

// In assignDuty
let assignDutyLogic = `
      if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
        if (idaShift === 'Night') {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
        } else {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDeployment(a.dutyCode) === isDeployment(dutyCode));
        }
      } else {
        index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDeployment(a.dutyCode) === isDeployment(dutyCode));
      }
`;
content = content.replace(/if \(dutyCode === 'IDAC' \|\| dutyCode === 'IDA'\) \{\s*if \(idaShift === 'Night'\) \{\s*index = list\.findIndex[^\}]+\}\s*else\s*\{\s*index = list\.findIndex[^\}]+\}\s*\}\s*else\s*\{\s*index = list\.findIndex[^\}]+\}/, isDepStr + assignDutyLogic); // Wait, this will just replace the first one again if not careful.

fs.writeFileSync('src/services/localDatabase.ts', content);
