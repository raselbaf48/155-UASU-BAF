const fs = require('fs');

const files = [
  'src/components/PrintableNightCountModal.tsx',
  'src/components/NightCountStateView.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace:
  // } else if (['SICK_REPORT', 'SICK', 'EX_PPGF'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf')) {
  //   sickReportList.push({ airman, note: item.dutyName || dutyCode || 'Sick Report' });
  // With:
  // } else if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf') || notesLower.includes('ed')) {
  //   sickReportList.push({ airman, note: notes || item.dutyName || dutyCode || 'Sick Report' });
  
  const target = /\} else if \(\['SICK_REPORT', 'SICK', 'EX_PPGF'\]\.includes\(codeUpper\) \|\| notesLower\.includes\('sick'\) \|\| notesLower\.includes\('ppgf'\)\) \{[\s\S]*?sickReportList\.push\(\{ airman, note: item\.dutyName \|\| dutyCode \|\| 'Sick Report' \}\);/g;
  
  const replacement = `} else if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf') || notesLower === 'ed' || notesLower.startsWith('ed ')) {
        sickReportList.push({ airman, note: notes || item.dutyName || dutyCode || 'Sick Report' });`;
        
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
}
