const fs = require('fs');
let code = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

const regex = /const fileName = `.*?`;/g;
const replacement = `const customFileName = \`Parade State - \${userFlight === 'Overall' ? '155 UASU BAF' : userFlight + ' Flt'} (\${dateRangeHeader.replace(/ To /g, ' - ')}).docx\`;
const fileName = \`Parade State - \${userFlight === 'Overall' ? '155 UASU BAF' : userFlight + ' Flt'} (\${dateRangeHeader ? dateRangeHeader.replace(/ To /g, ' - ') : dateStr}).docx\`;`;
// Wait, we need to inspect ParadeStateFormattedView first.
