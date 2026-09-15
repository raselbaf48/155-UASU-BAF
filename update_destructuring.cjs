const fs = require('fs');

function update(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Replace the destructuring line to include all variables.
    const oldRegex = /const \{\s*totalStr, effStr[\s\S]*?\} = stats;/g;
    const newDestructure = `
  const {
    totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, adminCommCount, essnCount, onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap, totalOutPt, onPtParadeCount, guardDutyCount, drillCatCCount, bakeBiteCount, detentionCount, officeDutyCount
  } = stats;
`;
    content = content.replace(oldRegex, newDestructure);

    // Also make sure getFlightStats returns them.
    const returnRegex = /return \{[\s\S]*?officeDutyCount\n\s*\};/g;
    const newReturn = `return {
      totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, drillCatCCount, essnCount, guardDutyCount, bakeBiteCount, detentionCount, totalOutPt, officeDutyCount, onPtParadeCount: onPtList.length, adminCommCount,
      onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap
    };`;
    
    // In NightCountStateView, getFlightStats ends with `return { ... officeDutyCount };`
    content = content.replace(returnRegex, newReturn);
    
    // But wait! PrintableNightCountModal might have a different return. 
    // Let's just blindly replace any `return { ... customDisposalsMap };` or similar
    const returnRegex2 = /return \{[\s\S]*?customDisposalsMap\n\s*\};/g;
    content = content.replace(returnRegex2, newReturn);

    fs.writeFileSync(file, content);
}

update('src/components/NightCountStateView.tsx');
update('src/components/PrintableNightCountModal.tsx');
console.log('Done destructuring');
