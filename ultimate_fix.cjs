const fs = require('fs');

function cleanFile(file, isPrintable) {
    let content = fs.readFileSync(file, 'utf8');

    // First, let's remove ALL instances of `const stats = getFlightStats(selectedFlight);`
    content = content.replace(/const stats = getFlightStats\(selectedFlight\);/g, '');

    // Let's remove ALL instances of the destructured variables.
    // It's a huge multiline block. We'll use regex.
    const regex = /const \{\s*totalStr, effStr, detTdyCount[\s\S]*?\} = stats;/g;
    content = content.replace(regex, '');

    // Now, we inject exactly ONCE.
    const injection = `
  const stats = getFlightStats(selectedFlight);
  const {
    totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, adminCommCount, essnCount, onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap, totalOutPt, onPtParadeCount
  } = stats;
`;

    // Find where to inject
    const endMatchStr = 'const otherDisposals';
    let endMatch = content.indexOf(endMatchStr);
    
    // go back to start of line
    while (endMatch > 0 && content[endMatch - 1] !== '\n') {
        endMatch--;
    }

    content = content.slice(0, endMatch) + injection + '\n' + content.slice(endMatch);
    fs.writeFileSync(file, content);
}

cleanFile('src/components/NightCountStateView.tsx', false);
cleanFile('src/components/PrintableNightCountModal.tsx', true);
console.log('Done!');
