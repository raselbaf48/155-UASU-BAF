const fs = require('fs');
let code = fs.readFileSync('src/components/PrintableParadeStateModal.tsx', 'utf8');

const oldName = /const fileName = `.*?`;/g;
const newName = `const fileName = \`Parade State - \${userFlight === 'Overall' ? '155 UASU BAF' : userFlight + ' Flt'} (\${dateRangeHeader.replace(/ To /g, ' - ')}).docx\`;`;

if(code.match(oldName)) {
    code = code.replace(oldName, newName);
    fs.writeFileSync('src/components/PrintableParadeStateModal.tsx', code);
}
