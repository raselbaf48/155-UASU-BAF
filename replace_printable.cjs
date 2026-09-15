const fs = require('fs');

const file = 'src/components/PrintableNightCountModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMatch = content.indexOf(' const getFlightStats = (fl: FlightName | \'Overall\') => {');
const endMatchStr = ' const otherDisposals: { title: string; airmen: Airman[] }[] = Object.entries(customDisposalsMap).map(';
let endMatch = content.indexOf(endMatchStr);

const replacement = fs.readFileSync('getFlightStats.txt', 'utf8');
const newContent = content.slice(0, startMatch) + replacement + '\n' + content.slice(endMatch);

fs.writeFileSync(file, newContent);
console.log('Replaced successfully');
