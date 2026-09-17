const fs = require('fs');
let code = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

// The request is: 
// "multi dt parade state e always Portrait mode e hbe"
// "Same dt 2 page a jbe na." (Rows should not break across pages)
// "Upore onk empty space ase oitao thakbe na" (Reduce top margin)

// Look for exportParadeStateMultiDocx document configuration
const docxMultiString = `  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: docChildren,
      },
    ],
  });`;

const replaceDocxMultiString = `  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 400,
              right: 600,
              bottom: 600,
              left: 600,
            },
          },
        },
        children: docChildren,
      },
    ],
  });`;

if(code.includes(docxMultiString)) {
    code = code.replace(docxMultiString, replaceDocxMultiString);
} else {
    // If exact match isn't there, let's find the orientation in exportParadeStateMultiDocx
    // It's probably in exportParadeStateMultiDocx. We will do a regex.
}

fs.writeFileSync('src/utils/docxExport.ts', code);
