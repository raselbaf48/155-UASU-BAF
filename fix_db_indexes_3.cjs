const fs = require('fs');
let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const oldLogic = /if \(dutyCode === 'IDAC' \|\| dutyCode === 'IDA'\) \{\s*if \(idaShift === 'Night'\) \{\s*index = list\.findIndex\(\(a\) => a\.airmanId === airmanId && a\.date === dateStr && \(a\.dutyCode === 'IDAC' \|\| a\.dutyCode === 'IDA'\) && a\.idaShift === 'Night'\);\s*\} else \{\s*index = list\.findIndex\(\(a\) => a\.airmanId === airmanId && a\.date === dateStr && \(a\.dutyCode === 'IDAC' \|\| a\.dutyCode === 'IDA'\) && a\.idaShift !== 'Night'\);\s*\}\s*\} else if \(dutyCode === 'AIRPORT' \|\| dutyCode === 'ATT' \|\| dutyCode === 'DETT'\) \{\s*const scope = disposalScope \|\| 'ALL';\s*index = list\.findIndex\(\(a\) => a\.airmanId === airmanId && a\.date === dateStr && \(a\.dutyCode === 'AIRPORT' \|\| a\.dutyCode === 'ATT' \|\| a\.dutyCode === 'DETT'\) && \(a\.disposalScope \|\| 'ALL'\) === scope\);\s*\} else \{\s*const scope = disposalScope \|\| 'ALL';\s*index = list\.findIndex\(\(a\) => a\.airmanId === airmanId && a\.date === dateStr && \(a\.disposalScope \|\| 'ALL'\) === scope\);\s*\}/;

const newLogic = `const isDep = (code) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
        if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
          if (idaShift === 'Night') {
            index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
          } else {
            index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(dutyCode));
          }
        } else {
          const scope = disposalScope || 'ALL';
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && (a.disposalScope || 'ALL') === scope && isDep(a.dutyCode) === isDep(dutyCode));
        }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/services/localDatabase.ts', content);
