const assignments = [
  { airmanId: '1', dutyCode: 'GD', date: '2026-09-01' },
  { airmanId: '1', dutyCode: 'GD', date: '2026-09-02' },
  { airmanId: '1', dutyCode: 'GD', date: '2026-09-01' } // Duplicate assignment?
];
const aCount = assignments.filter(x => x.airmanId === '1').length;
console.log(aCount);
