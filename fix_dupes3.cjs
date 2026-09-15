const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    const replaceFrom = `export function calculateDutyStats(
  airmen: Airman[],
  assignments: DutyAssignment[],
  year?: number,
  month?: number
): AirmanDutyStats[] {
  const map = new Map<string, AirmanDutyStats>();`;

    const replaceTo = `export function calculateDutyStats(
  airmen: Airman[],
  rawAssignments: DutyAssignment[],
  year?: number,
  month?: number
): AirmanDutyStats[] {
  const uniqueAss = new Map();
  rawAssignments.forEach(a => {
      const key = a.airmanId + '-' + a.date + '-' + a.dutyCode + '-' + (a.idaShift || '');
      if (!uniqueAss.has(key)) uniqueAss.set(key, a);
  });
  const assignments = Array.from(uniqueAss.values());

  const map = new Map<string, AirmanDutyStats>();`;

    content = content.replace(replaceFrom, replaceTo);
    fs.writeFileSync(file, content);
}

fix('src/data/rosterGenerator.ts');
console.log('Fixed calculateDutyStats');
