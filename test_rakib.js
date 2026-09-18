const pList = [
  {
    airman: { name: 'Rakib', rank: 'Cpl', flightName: 'A' },
    dutyCode: 'IDAC',
    idaShift: 'Morning',
    statusCategory: 'DUTY',
    dutyName: 'IDAC Duty (Morning)'
  }
];

const idaMorn = pList.filter(
  (s) => ['IDAC', 'IDA'].includes(s.dutyCode?.trim()?.toUpperCase()) && (!s.idaShift || s.idaShift.trim() === 'Morning')
);

console.log('idaMorn:', idaMorn);
