const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// Find the start of DutyDetailsModal
const detailsModalStartIdx = content.indexOf('const DutyDetailsModal: React.FC<{');
if (detailsModalStartIdx !== -1) {
    let cleanEnd = content.substring(0, detailsModalStartIdx);
    let modalPart = content.substring(detailsModalStartIdx);
    
    // Find the end of the table
    const tableEndIdx = modalPart.lastIndexOf('</table>');
    
    if (tableEndIdx !== -1) {
        // extract the table content for the portal
        const tableSectionRegex = /<table className="w-full text-left text-xs border-collapse">[\s\S]*?<\/table>/;
        const tableMatch = modalPart.match(tableSectionRegex);
        let tableContent = '';
        if (tableMatch) {
          tableContent = tableMatch[0];
        }

        let basePart = modalPart.substring(0, tableEndIdx + 8);
        let endPart = `
          )}
        </div>
      </div>

      {/* Print Preview Portal */}
      {showPrintPreview && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/90 backdrop-blur-sm overflow-hidden print:bg-white print:static print:h-auto print:w-auto print:overflow-visible print:block">
          {/* Header */}
          <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between shadow-2xl print:hidden z-10 sticky top-0">
            <h2 className="text-white font-bold text-lg">Print Preview</h2>
            <div className="flex items-center space-x-3 text-white">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>Official Export / Print</span>
              </button>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
          {/* Scrollable Document Area */}
          <div className="flex-1 overflow-auto bg-slate-800 p-4 sm:p-8 flex justify-center print:bg-white print:p-0 print:block print:overflow-visible h-[calc(100vh-80px)]">
            <div className="bg-white text-black p-8 sm:p-12 shadow-2xl max-w-[1200px] w-full mx-auto print:shadow-none print:p-0 print:w-full print:max-w-none print:m-0 h-max min-h-full">
              <div className="text-center mb-6 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black">{dutyId} Duty Matrix</h1>
                <p className="text-sm font-bold mt-1">Month: {currentMonth}/{currentYear}</p>
              </div>
              <div className="overflow-x-auto">
                ${tableContent}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
`;
        fs.writeFileSync('src/components/DutyAnalytics.tsx', cleanEnd + basePart + endPart);
    }
}
