import fs from 'fs';

const f = 'src/services/localDatabase.ts';
let code = fs.readFileSync(f, 'utf8');

const targetAssignDuty = `    if (assignment.dutyCode === 'IDAC' || assignment.dutyCode === 'IDA') {
      if (assignment.idaShift === 'Night') {
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'
        );
      } else {
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift !== 'Night'
        );
      }
    } else {
      const scope = assignment.disposalScope || 'ALL';
      index = list.findIndex((a) => a.airmanId === assignment.airmanId && a.date === assignment.date && (a.disposalScope || 'ALL') === scope);
    }`;

const replaceAssignDuty = `    if (assignment.dutyCode === 'IDAC' || assignment.dutyCode === 'IDA') {
      if (assignment.idaShift === 'Night') {
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'
        );
      } else {
        // Any day duty that is IDAC day
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night')
        );
      }
    } else {
      // Overwrite any existing day duty for this date
      index = list.findIndex(
        (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night')
      );
    }`;

if (code.includes(targetAssignDuty)) {
    code = code.replace(targetAssignDuty, replaceAssignDuty);
} else {
    console.log("Could not find targetAssignDuty");
}


const targetAssignRange = `      let index = -1;
      if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
        if (idaShift === 'Night') {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
        } else {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift !== 'Night');
        }
      } else if (dutyCode === 'AIRPORT' || dutyCode === 'ATT' || dutyCode === 'DETT') {
        const scope = disposalScope || 'ALL';
        index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'AIRPORT' || a.dutyCode === 'ATT' || a.dutyCode === 'DETT') && (a.disposalScope || 'ALL') === scope);
      } else {
        const scope = disposalScope || 'ALL';
        index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.disposalScope || 'ALL') === scope);
      }`;

const replaceAssignRange = `      let index = -1;
      if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
        if (idaShift === 'Night') {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
        } else {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'));
        }
      } else {
        index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'));
      }`;

if (code.includes(targetAssignRange)) {
    code = code.replace(targetAssignRange, replaceAssignRange);
} else {
    console.log("Could not find targetAssignRange");
}

fs.writeFileSync(f, code);
console.log("Patched assignment logic");
