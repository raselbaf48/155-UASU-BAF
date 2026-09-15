const list = [
    { id: 1, dutyCode: 'GD' },
    { id: 2, dutyCode: 'IDAC' }
];

const relevant = list.filter(a => ['GD', 'IDAC'].includes(a.dutyCode));
console.log(relevant);
