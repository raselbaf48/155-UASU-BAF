const fs = require('fs');
let code = fs.readFileSync('src/components/DutyRatioMatrixView.tsx', 'utf8');

code = code.replace(
    /<span>\{showAllTableInfo \? 'Hide Req & Ratio Info' : 'Show Req & Ratio Info'\}<\/span>/,
    "<span>{showAllTableInfo ? 'Hide Info' : 'Show Info'}</span>"
);

fs.writeFileSync('src/components/DutyRatioMatrixView.tsx', code);
