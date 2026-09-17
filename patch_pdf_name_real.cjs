const fs = require('fs');
let code = fs.readFileSync('src/components/PrintableNightCountModal.tsx', 'utf8');

const oldName = /const fileName = `.*?`;/g;
const newName = `const fileName = \`Parade State - \${userFlight === 'Overall' ? '155 UASU BAF' : userFlight + ' Flt'} (\${startStr} - \${endStr}).docx\`;`;

if(code.match(oldName)) {
    code = code.replace(oldName, newName);
    fs.writeFileSync('src/components/PrintableNightCountModal.tsx', code);
}
