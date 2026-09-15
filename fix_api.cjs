const fs = require('fs');
let api = fs.readFileSync('src/services/apiBridge.ts', 'utf8');

api = api.replace(
  "const { airmanId, date, dutyCode } = body || {};",
  "const { airmanId, date, dutyCode, idaShift } = body || {};"
);
api = api.replace(
  "localDb.deleteAssignment(airmanId, date, dutyCode);",
  "localDb.deleteAssignment(airmanId, date, dutyCode, idaShift);"
);

fs.writeFileSync('src/services/apiBridge.ts', api);
console.log("Fixed API bridge");
