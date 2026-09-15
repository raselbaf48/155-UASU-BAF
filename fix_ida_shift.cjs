const fs = require('fs');
let db = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

// Update deleteAssignment signature
db = db.replace(
  "public deleteAssignment(airmanId: string, date: string, dutyCode?: DutyCategoryCode): boolean {",
  "public deleteAssignment(airmanId: string, date: string, dutyCode?: DutyCategoryCode, idaShift?: any): boolean {"
);

// Update filter condition
const oldFilter = `        if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
          return !(a.dutyCode === 'IDAC' || a.dutyCode === 'IDA');
        }`;

const newFilter = `        if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
          if (idaShift) {
            return !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === idaShift);
          }
          return !(a.dutyCode === 'IDAC' || a.dutyCode === 'IDA');
        }`;

db = db.replace(oldFilter, newFilter);

// Update deleteRange signature and call
db = db.replace(
  "dutyCode?: DutyCategoryCode;",
  "dutyCode?: DutyCategoryCode;\n    idaShift?: any;"
);
db = db.replace(
  "const { airmanId, fromDate, toDate, dutyCode } = params;",
  "const { airmanId, fromDate, toDate, dutyCode, idaShift } = params;"
);
db = db.replace(
  "if (this.deleteAssignment(airmanId, d, dutyCode)) {",
  "if (this.deleteAssignment(airmanId, d, dutyCode, idaShift)) {"
);

fs.writeFileSync('src/services/localDatabase.ts', db);
console.log("Fixed idaShift delete");
