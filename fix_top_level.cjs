const fs = require('fs');

const file = 'src/components/NightCountStateView.tsx';
let content = fs.readFileSync(file, 'utf8');

const injection = `
  const stats = getFlightStats(selectedFlight);
  const {
    totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, adminCommCount, essnCount, onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap
  } = stats;
`;

// Insert the injection right after getFlightStats definition
const endOfGetFlightStats = content.indexOf('  // Helper to render airman list');
if (endOfGetFlightStats !== -1) {
    content = content.slice(0, endOfGetFlightStats) + injection + '\n' + content.slice(endOfGetFlightStats);
}

// Now we need to remove the IIFE `const stats = getFlightStats(selectedFlight);`
// so it doesn't shadow the top-level stats and cause "Cannot find name" inside it if we need it.
// Actually, it doesn't matter if it shadows `stats`, because `tdyList` etc. are top-level now!
// Let's just remove the shadowing to be clean.
content = content.replace(/const stats = getFlightStats\(selectedFlight\);/g, '');

fs.writeFileSync(file, content);
console.log('Fixed NightCount');
