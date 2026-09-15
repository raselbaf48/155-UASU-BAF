const fs = require('fs');

const file = 'src/components/PrintableNightCountModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const injection = `
  const stats = getFlightStats(selectedFlight);
  const {
    totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, adminCommCount, essnCount, onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap, totalOutPt, onPtParadeCount
  } = stats;
`;

const endOfGetFlightStats = content.indexOf(' // Helper to render airman list');
if (endOfGetFlightStats !== -1) {
    content = content.slice(0, endOfGetFlightStats) + injection + '\n' + content.slice(endOfGetFlightStats);
} else {
    // try without comment
    const altEnd = content.indexOf(' const renderAirmanColumnList =');
    if (altEnd !== -1) {
        content = content.slice(0, altEnd) + injection + '\n' + content.slice(altEnd);
    }
}

content = content.replace(/const stats = getFlightStats\(selectedFlight\);/g, '');

fs.writeFileSync(file, content);
console.log('Fixed Printable');
