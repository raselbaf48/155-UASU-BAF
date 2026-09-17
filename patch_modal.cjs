const fs = require('fs');
let code = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

const oldCall = `await exportParadeStateMultiDocx(
        title,
        dateRangeHeader,
        docxRows,
        fileName,
        leftSig,
        rightSig
      );`;

// The requested file name format: 
// "Parade State - Avi Flt (dt -dt).pdf/docx"

const newCall = `const customFileName = \`Parade State - \${userFlight === 'Overall' ? '155 UASU BAF' : userFlight + ' Flt'} (\${dateRangeHeader.replace(/ To /g, ' - ')}).docx\`;
      await exportParadeStateMultiDocx(
        title,
        dateRangeHeader,
        docxRows,
        customFileName,
        leftSig,
        rightSig
      );`;
      
code = code.replace(oldCall, newCall);

fs.writeFileSync('src/components/ParadeStateFormattedView.tsx', code);
