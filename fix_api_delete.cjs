const fs = require('fs');

let content = fs.readFileSync('src/services/apiBridge.ts', 'utf8');

content = content.replace(
  /const \{ airmanId, date \} = body \|\| \{\};\s*localDb\.deleteAssignment\(airmanId, date\);/g,
  `const { airmanId, date, dutyCode } = body || {};
      localDb.deleteAssignment(airmanId, date, dutyCode);`
);

fs.writeFileSync('src/services/apiBridge.ts', content);
