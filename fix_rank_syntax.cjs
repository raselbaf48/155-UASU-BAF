const fs = require('fs');
let docx = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

docx = docx.replace(/\$\{a\.rank\)\}/g, "${formatRank(a.rank)}");
docx = docx.replace(/\$\{item\.airman\.rank\)\}/g, "${formatRank(item.airman.rank)}");
docx = docx.replace(/\$\{col1Item\.rank\)\}/g, "${formatRank(col1Item.rank)}");
docx = docx.replace(/\$\{col2Item\.rank\)\}/g, "${formatRank(col2Item.rank)}");
docx = docx.replace(/\$\{col3Item\.rank\)\}/g, "${formatRank(col3Item.rank)}");

fs.writeFileSync('src/utils/docxExport.ts', docx);
console.log("Done");
