const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');

    // First, remove the bad injection
    const badInjection = `
  const stats = getFlightStats(selectedFlight);
  const {
    totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, adminCommCount, essnCount, onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap
  } = stats;
`;
    const badInjectionPrintable = `
  const stats = getFlightStats(selectedFlight);
  const {
    totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, adminCommCount, essnCount, onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap, totalOutPt, onPtParadeCount
  } = stats;
`;
    content = content.replace(badInjection, '');
    content = content.replace(badInjectionPrintable, '');

    // Now insert the destructuring right after getFlightStats definition, BEFORE otherDisposals
    const endMatchStr = '  const otherDisposals: { title: string; airmen: Airman[] }[] = Object.entries(customDisposalsMap).map(';
    let endMatch = content.indexOf(endMatchStr);
    if (endMatch === -1) {
        const regex = / const otherDisposals: \{ title: string; airmen: Airman\[\] \}\[\] = Object\.entries\(customDisposalsMap\)\.map\(/g;
        const m = regex.exec(content);
        if(m) endMatch = m.index;
    }

    if (endMatch !== -1) {
        content = content.slice(0, endMatch) + badInjectionPrintable + '\n' + content.slice(endMatch);
    }

    // Also, we need `targetAirmen` in `PrintableNightCountModal.tsx`!
    // We can replace `targetAirmen.forEach` with `flightAirmen.forEach` inside `getFlightStats` inside both files.
    content = content.replace(/targetAirmen\.forEach/g, 'flightAirmen.forEach');

    fs.writeFileSync(file, content);
}

fixFile('src/components/NightCountStateView.tsx');
fixFile('src/components/PrintableNightCountModal.tsx');
console.log('Final fix applied');
