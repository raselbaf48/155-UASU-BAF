const fs = require('fs');

let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const oldLogic = /if \(dutyCode === 'AIRPORT' \|\| dutyCode === 'ATT' \|\| dutyCode === 'DETT'\) \{\s*return a\.dutyCode === 'AIRPORT' \|\| a\.dutyCode === 'ATT' \|\| a\.dutyCode === 'DETT';\s*\}/;
const newLogic = `const isDep = (code) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
        if (isDep(dutyCode)) {
          return isDep(a.dutyCode);
        }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/services/localDatabase.ts', content);
