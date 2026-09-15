const fs = require('fs');
let content = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

// The user might want both Rank and Name as they are, but "LAC" is usually all caps.
// I'll just change Rank to upper case, and leave Name as Running Letter since the user only complained about "LAC Running Letter".

fs.writeFileSync('src/utils/docxExport.ts', content);
