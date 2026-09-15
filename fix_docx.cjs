const fs = require('fs');
let content = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

// Replace formatRunningLetter usages for rank
content = content.replace(/formatRunningLetter\(item\.rank\)/g, "item.rank.toUpperCase()");
content = content.replace(/formatRunningLetter\(a\.rank\)/g, "a.rank.toUpperCase()");
content = content.replace(/formatRunningLetter\(col1Item\.rank\)/g, "col1Item.rank.toUpperCase()");
content = content.replace(/formatRunningLetter\(col2Item\.rank\)/g, "col2Item.rank.toUpperCase()");
content = content.replace(/formatRunningLetter\(col3Item\.rank\)/g, "col3Item.rank.toUpperCase()");

// Wait, the user specifically mentioned LAC running letter, let's just uppercase the rank everywhere.
content = content.replace(/formatRunningLetter\(item\.airman\.rank\)/g, "item.airman.rank.toUpperCase()");


fs.writeFileSync('src/utils/docxExport.ts', content);
