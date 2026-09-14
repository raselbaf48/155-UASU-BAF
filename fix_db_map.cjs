const fs = require('fs');

let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const regex = /const existing = assignmentMap\.get\(a\.airmanId\);\s*if \(\!existing \|\| \(existing\.disposalScope \|\| 'ALL'\) === 'ALL'\) \{\s*assignmentMap\.set\(a\.airmanId, a\);\s*\}/g;

const replacement = `const existing = assignmentMap.get(a.airmanId);
        if (!existing) {
          assignmentMap.set(a.airmanId, a);
        } else {
          // If we have both, determine priority
          const isDeployment = (code) => ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
          const existingIsDep = isDeployment(existing.dutyCode);
          const newIsDep = isDeployment(a.dutyCode);
          if (existingIsDep && !newIsDep) {
            assignmentMap.set(a.airmanId, a); // New regular duty overwrites deployment
          } else if (!existingIsDep && !newIsDep) {
            // Overwrite with higher specificity scope if applicable, else overwrite
            if ((existing.disposalScope || 'ALL') === 'ALL') {
              assignmentMap.set(a.airmanId, a);
            }
          }
        }`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/services/localDatabase.ts', content);
