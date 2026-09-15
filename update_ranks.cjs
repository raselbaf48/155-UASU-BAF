const fs = require('fs');

// --- docxExport.ts ---
let docx = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

const formatRankStr = `
export const formatRank = (rank: string) => {
  if (!rank) return '';
  const upper = rank.toUpperCase();
  if (upper === 'SGT' || upper === 'CPL') {
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
  return upper;
};
`;

docx = docx.replace(/const formatRunningLetter =/, formatRankStr + '\nconst formatRunningLetter =');

docx = docx.replace(/\.rank\.toUpperCase\(\)/g, ".rank)");
docx = docx.replace(/createDataCell\(item\.rank\)/g, "createDataCell(formatRank(item.rank))");
docx = docx.replace(/createArialDataCell\(a\.rank\)/g, "createArialDataCell(formatRank(a.rank))");
docx = docx.replace(/\$\{a\.rank\}/g, "${formatRank(a.rank)}");
docx = docx.replace(/\$\{item\.airman\.rank\}/g, "${formatRank(item.airman.rank)}");
docx = docx.replace(/\$\{col1Item\.rank\}/g, "${formatRank(col1Item.rank)}");
docx = docx.replace(/\$\{col2Item\.rank\}/g, "${formatRank(col2Item.rank)}");
docx = docx.replace(/\$\{col3Item\.rank\}/g, "${formatRank(col3Item.rank)}");

fs.writeFileSync('src/utils/docxExport.ts', docx);

// --- DutyRosterPeriodView.tsx ---
let ui = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

// add formatRank to imports
ui = ui.replace('RosterExportItem,', 'RosterExportItem,\n formatRank,');

// apply formatRank when setting rank
ui = ui.replace(/rank: block\.airman\.rank,/g, "rank: formatRank(block.airman.rank),");
ui = ui.replace(/rank: day1Ass\[0\]\.airman\.rank,/g, "rank: formatRank(day1Ass[0].airman.rank),");

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', ui);
console.log("Done");
