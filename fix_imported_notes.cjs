const fs = require('fs');

const files = [
  'src/components/PrintableNightCountModal.tsx',
  'src/components/NightCountStateView.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/note: notes \|\| 'Airfield'/g, "note: (notes && !notes.toLowerCase().includes('imported')) ? notes : 'Airfield'");
  content = content.replace(/note: notes \|\| item\.dutyName \|\| dutyCode \|\| 'CMH'/g, "note: (notes && !notes.toLowerCase().includes('imported')) ? notes : (item.dutyName || dutyCode || 'CMH')");
  content = content.replace(/note: notes \|\| 'G\/H & Games'/g, "note: (notes && !notes.toLowerCase().includes('imported')) ? notes : 'G/H & Games'");
  content = content.replace(/note: notes \|\| ''/g, "note: (notes && !notes.toLowerCase().includes('imported')) ? notes : ''");
  content = content.replace(/note: notes \|\| item\.dutyName \|\| dutyCode \|\| 'Sick Report'/g, "note: (notes && !notes.toLowerCase().includes('imported')) ? notes : (item.dutyName || dutyCode || 'Sick Report')");
  
  fs.writeFileSync(file, content);
}
