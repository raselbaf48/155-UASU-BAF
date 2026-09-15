const fs = require('fs');

const file = 'src/components/NightCountStateView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the start and end of getFlightStats
const startMatch = content.indexOf('  // Compute Flight Stats for Single-Day Summary Matrix\n  const getFlightStats = (fl: FlightName | \'Overall\') => {');
if (startMatch === -1) {
  console.log('Could not find start of getFlightStats');
  process.exit(1);
}

// Find the end by looking for the next top-level comment or const declaration
// Actually, I can just look for the first occurrence of:
// `  const otherDisposals: { title: string; airmen: Airman[] }[] = Object.entries(customDisposalsMap).map(`
const endMatchStr = '  const otherDisposals: { title: string; airmen: Airman[] }[] = Object.entries(customDisposalsMap).map(';
let endMatch = content.indexOf(endMatchStr);
if (endMatch === -1) {
    // maybe it's without spaces
    const regex = /  const otherDisposals: \{ title: string; airmen: Airman\[\] \}\[\] = Object\.entries\(customDisposalsMap\)\.map\(/g;
    const m = regex.exec(content);
    if(m) {
        endMatch = m.index;
    }
}

if (endMatch === -1) {
  console.log('Could not find end of getFlightStats');
  process.exit(1);
}

const replacement = fs.readFileSync('getFlightStats.txt', 'utf8');
const newContent = content.slice(0, startMatch) + replacement + '\n' + content.slice(endMatch);

fs.writeFileSync(file, newContent);
console.log('Replaced successfully');
