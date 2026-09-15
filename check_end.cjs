const fs = require('fs');

const file = 'src/components/PrintableNightCountModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMatch = content.indexOf(' const getFlightStats = (fl: FlightName | \'Overall\') => {');
const endMatchStr = ' const otherDisposals: { title: string; airmen: Airman[] }[] = Object.entries(customDisposalsMap).map(';
let endMatch = content.indexOf(endMatchStr);

if (endMatch === -1) {
    const regex = / const otherDisposals: \{ title: string; airmen: Airman\[\] \}\[\] = Object\.entries\(customDisposalsMap\)\.map\(/g;
    const m = regex.exec(content);
    if(m) {
        endMatch = m.index;
    }
}
console.log(startMatch, endMatch);
