const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

// 1. Add createPortal and Printer/X
content = content.replace(/import { DateNavigator } from '\.\/DateNavigator';/, "import { DateNavigator } from './DateNavigator';\nimport { createPortal } from 'react-dom';");

// Make sure Printer, X are imported from lucide-react if not already
if (!content.includes('Printer')) {
  content = content.replace(/from 'lucide-react';/, ", Printer } from 'lucide-react';");
}
if (!content.includes(' X,')) {
  content = content.replace(/from 'lucide-react';/, ", X } from 'lucide-react';");
}

// 2. Add showPrintPreview
content = content.replace(/const \[rosterMode, setRosterMode\] = useState<'BASE_DUTIES' \| 'IDAC_DUTY'>\('BASE_DUTIES'\);/, "const [rosterMode, setRosterMode] = useState<'BASE_DUTIES' | 'IDAC_DUTY'>('BASE_DUTIES');\n  const [showPrintPreview, setShowPrintPreview] = useState(false);");

// 3. change handlePrint
content = content.replace(/const handlePrint = \(\) => {\s*window.print\(\);\s*};/, "const handlePrint = () => { setShowPrintPreview(true); };");

// 4. Wrap document rendering
const splitToken = "{/* ========================================================================= */}\n {/* OPTION 1: BASE DUTY";

const splitParts = content.split("{/* ========================================================================= */}");
// We need to find the one right before OPTION 1
let targetIdx = -1;
for (let i = 0; i < splitParts.length; i++) {
  if (splitParts[i].includes("OPTION 1: BASE DUTY")) {
    targetIdx = i;
    break;
  }
}

if (targetIdx === -1) {
  console.log("Token not found");
  process.exit(1);
}

const before = splitParts.slice(0, targetIdx).join("{/* ========================================================================= */}");
const after = "{/* ========================================================================= */}" + splitParts.slice(targetIdx).join("{/* ========================================================================= */}");

const endStr = "      )}\n </div>\n );\n};\n";
// Let's just find the last closing of the component.
const lastCloseIdx = after.lastIndexOf("</div>\n );\n};");

if (lastCloseIdx === -1) {
  console.log("Could not find the end of the component");
  process.exit(1);
}

const docContent = after.substring(0, lastCloseIdx);
const theRest = after.substring(lastCloseIdx);

const renderDocument = `
  const renderDocument = () => (
    <>
      ${docContent}
    </>
  );

  return (
    <>
      {renderDocument()}
      {showPrintPreview && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/90 backdrop-blur-sm overflow-hidden print:bg-white print:static print:h-auto print:w-auto print:overflow-visible print:block">
          <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between shadow-2xl print:hidden z-10 sticky top-0">
            <h2 className="text-white font-bold text-lg">Print Preview</h2>
            <div className="flex items-center space-x-3 text-white">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>Official Export / Print</span>
              </button>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
                <span>Close</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-slate-800 p-4 sm:p-8 flex justify-center print:bg-white print:p-0 print:block print:overflow-visible h-[calc(100vh-80px)]">
            <div className="bg-white text-black p-8 sm:p-12 shadow-2xl max-w-[1200px] w-full mx-auto print:shadow-none print:p-0 print:w-full print:max-w-none print:m-0 h-max min-h-full">
              {renderDocument()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
`;

const finalContent = before + renderDocument;

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', finalContent);
console.log("Success");
