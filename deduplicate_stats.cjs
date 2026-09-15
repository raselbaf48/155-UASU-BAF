const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Inside calculateDutyStats
    const replaceFrom = `export const calculateDutyStats = (
  airmen: Airman[],
  assignments: DutyAssignment[],
  year: number,
  month: number
): AirmanDutyStats[] => {`;
    const replaceTo = `export const calculateDutyStats = (
  airmen: Airman[],
  rawAssignments: DutyAssignment[],
  year: number,
  month: number
): AirmanDutyStats[] => {
  const uniqueAss = new Map();
  rawAssignments.forEach(a => {
      const key = a.airmanId + '-' + a.date + '-' + a.dutyCode + '-' + (a.idaShift || '');
      if (!uniqueAss.has(key)) uniqueAss.set(key, a);
  });
  const assignments = Array.from(uniqueAss.values());`;

    if (content.includes(replaceFrom)) {
        content = content.replace(replaceFrom, replaceTo);
        fs.writeFileSync(file, content);
        console.log('Fixed calculateDutyStats');
    } else {
        console.log('Could not find replace point');
    }
}

fix('src/data/rosterGenerator.ts');
