const fs = require('fs');

const files = [
  'src/components/PrintableNightCountModal.tsx',
  'src/components/NightCountStateView.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // 1. AIRPORT / ATT
  // Replace: dutyOnList.push({ airman, note: 'Airfield' });
  // With: dutyOnList.push({ airman, note: notes || 'Airfield' });
  content = content.replace(/dutyOnList\.push\(\{ airman, note: 'Airfield' \}\);/g, "dutyOnList.push({ airman, note: notes || 'Airfield' });");
  
  // 2. CMH
  // Replace: cmhList.push({ airman, note: item.dutyName || dutyCode || 'CMH' });
  // With: cmhList.push({ airman, note: notes || item.dutyName || dutyCode || 'CMH' });
  content = content.replace(/cmhList\.push\(\{ airman, note: item\.dutyName \|\| dutyCode \|\| 'CMH' \}\);/g, "cmhList.push({ airman, note: notes || item.dutyName || dutyCode || 'CMH' });");

  // 3. GAMES
  // Replace: gamesList.push({ airman, note: 'G/H & Games' });
  // With: gamesList.push({ airman, note: notes || 'G/H & Games' });
  content = content.replace(/gamesList\.push\(\{ airman, note: 'G\/H & Games' \}\);/g, "gamesList.push({ airman, note: notes || 'G/H & Games' });");

  // 4. CANTEEN / onPtList
  // The original block is:
  // } else if (isBake || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {
  //   onPtList.push({ airman, note: '' });
  // }
  // We want to replace onPtList.push({ airman, note: '' }) with onPtList.push({ airman, note: notes || '' }); BUT ONLY IN THAT ELSE IF BLOCK!
  // To be safe, we can just replace ALL `onPtList.push({ airman, note: '' });` with `onPtList.push({ airman, note: notes || '' });` because `notes` would be empty for regular ON_PARADE anyway unless specified.
  content = content.replace(/onPtList\.push\(\{ airman, note: '' \}\);/g, "onPtList.push({ airman, note: notes || '' });");
  
  fs.writeFileSync(file, content);
}
