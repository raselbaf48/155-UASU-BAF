const fs = require('fs');

let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

// Replace assignDuty block
content = content.replace(/if \(assignment\.dutyCode === 'IDAC' \|\| assignment\.dutyCode === 'IDA'\) \{\s*if \(assignment\.idaShift === 'Night'\) \{[\s\S]*?\} else \{\s*\/\/[^\n]*\s*index = list\.findIndex\([\s\S]*?\);\s*\}\s*\} else \{\s*\/\/[^\n]*\s*index = list\.findIndex\([\s\S]*?\);\s*\}/,
`const isDep = (code) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
    if (assignment.dutyCode === 'IDAC' || assignment.dutyCode === 'IDA') {
      if (assignment.idaShift === 'Night') {
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'
        );
      } else {
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(assignment.dutyCode)
        );
      }
    } else {
      index = list.findIndex(
        (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(assignment.dutyCode)
      );
    }`);

// Clean up the duplicated isDeployment and replace assignRange block
const assignRangeOld = /const isDeployment = \(code\) => code && \['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'\]\.includes\(code\);\s*const isDeployment = \(code\) => code && \['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'\]\.includes\(code\);\s*if \(dutyCode === 'IDAC' \|\| dutyCode === 'IDA'\) \{\s*if \(idaShift === 'Night'\) \{\s*index = list\.findIndex\(\(a\) => a\.airmanId === airmanId && a\.date === dateStr && \(a\.dutyCode === 'IDAC' \|\| a\.dutyCode === 'IDA'\) && a\.idaShift === 'Night'\);\s*\} else \{\s*index = list\.findIndex\(\(a\) => a\.airmanId === airmanId && a\.date === dateStr && !\(\(a\.dutyCode === 'IDAC' \|\| a\.dutyCode === 'IDA'\) && a\.idaShift === 'Night'\) && isDeployment\(a\.dutyCode\) === isDeployment\(dutyCode\)\);\s*\}\s*\} else \{\s*index = list\.findIndex\(\(a\) => a\.airmanId === airmanId && a\.date === dateStr && !\(\(a\.dutyCode === 'IDAC' \|\| a\.dutyCode === 'IDA'\) && a\.idaShift === 'Night'\) && isDeployment\(a\.dutyCode\) === isDeployment\(dutyCode\)\);\s*\}/;

const assignRangeNew = `const isDep = (code) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
      if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
        if (idaShift === 'Night') {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
        } else {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(dutyCode));
        }
      } else {
        index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(dutyCode));
      }`;

content = content.replace(assignRangeOld, assignRangeNew);

// What about batchAssign? Let's check it manually before replacing
fs.writeFileSync('src/services/localDatabase.ts', content);
