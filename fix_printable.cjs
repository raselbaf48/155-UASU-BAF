const fs = require('fs');
const file = 'src/components/PrintableNightCountModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will add the missing variables to the return statement and lists.
const missingListsStr = `
    const dutyOffList: { airman: Airman; note?: string }[] = [];
    const bakeBiteList: { airman: Airman; note?: string }[] = [];
    const receptionList: { airman: Airman; note?: string }[] = [];
`;

content = content.replace(
    'const customDisposalsMap: Record<string, { airman: Airman; note?: string }[]> = {};',
    missingListsStr + '\n    const customDisposalsMap: Record<string, { airman: Airman; note?: string }[]> = {};'
);

// We also need to add them to the return object
content = content.replace(
    /return \{[\s\S]*?customDisposalsMap\n    \};/,
    `return {
      totalStr,
      effStr,
      detTdyCount,
      leaveCount,
      sickExCount,
      hospitalCount,
      othersCount,
      koReceptionCount,
      airFdDutyCount,
      gamesCount,
      classTrgCount,
      absentCount,
      adminCommCount,
      essnCount,
      guardDutyCount,
      bakeBiteCount,
      drillCatCCount,
      detentionCount,
      totalOutPt,
      onPtParadeCount: onPtList.length,
      onPtList,
      dutyOnList,
      tdyList,
      leaveList,
      sickReportList,
      essnList,
      cmhList,
      adminOrderList,
      gamesList,
      absentList,
      classTrgList,
      dutyOffList,
      bakeBiteList,
      receptionList,
      customDisposalsMap
    };`
);

// Also let's populate them in the loop.
content = content.replace(
    "koReceptionCount++;\n        } else if (isBake || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {",
    "koReceptionCount++;\n        } else if (isBake) { bakeBiteCount++; } else if (codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {"
);

// We can just manually populate dutyOffList, etc.
const populationReplace = `
          } else if (isBake) {
            bakeBiteList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : '' });
          } else if (codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {
            receptionList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : '' });
          } else if (codeUpper === 'DUTY_OFF' || codeUpper === 'OFF_DUTY' || statusCategory === 'OFF' || notesLower.includes('off duty') || notesLower.includes('nt off') || notesLower.includes('night off')) {
            dutyOffList.push({ airman, note: 'Duty Off' });
`;
content = content.replace(
    "} else if (isBake || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {\n            onPtList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : '' });",
    populationReplace
);

fs.writeFileSync(file, content);
