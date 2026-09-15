const fs = require('fs');

// --- Update DutyRosterPeriodView.tsx ---
let roster = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

// 1. Remove Section from React table
roster = roster.replace('<th className="border border-black dark:border-white print:border-black py-1.5 px-2">Section</th>', '');
roster = roster.replace(/<td className="border border-black dark:border-white print:border-black py-1 px-2 font-bold">\s*\{item.section\}\s*<\/td>/, '');

// 2. Add Download Document button to Print Preview modal
// Find Official Export / Print in the modal
const printBtnStr = `              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>Official Export / Print</span>
              </button>`;
const downloadBtnStr = `              <button
                onClick={handleExportDocx}
                disabled={isExportingDocx}
                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-900/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-5 h-5" />
                <span>{isExportingDocx ? 'Generating...' : 'Download Document'}</span>
              </button>`;

if (roster.includes(printBtnStr)) {
  roster = roster.replace(printBtnStr, downloadBtnStr + '\n' + printBtnStr);
}

// 3. Format Block String
const blockFormatTarget = `  formatted = formatted.replace(/Airmen's Mess, Block No:\\s*/gi, '');
  formatted = formatted.replace(/\\s*&\\s*Svc\\s*/gi, '');`;
const blockFormatReplacement = `  formatted = formatted.replace(/Airmen's Mess, Block No:\\s*/gi, '');
  formatted = formatted.replace(/Sgt's Mess, Block No:\\s*/gi, '');
  formatted = formatted.replace(/\\s*&\\s*Svc\\s*/gi, '');
  formatted = formatted.replace(/Svc\\s*Qtr\\s*No:\\s*/gi, 'Qtr No: ');
  formatted = formatted.replace(/Svc\\s*/gi, '');`;

roster = roster.replace(blockFormatTarget, blockFormatReplacement);

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', roster);


// --- Update docxExport.ts ---
let docx = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

// Remove Header Cell
docx = docx.replace("        createHeaderCell('Section', 1200),", "");

// Remove Data Cell
docx = docx.replace("          createDataCell(item.section || '155 UASU', 1200, AlignmentType.CENTER),", "");

fs.writeFileSync('src/utils/docxExport.ts', docx);

console.log("Done");
