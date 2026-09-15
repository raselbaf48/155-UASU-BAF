const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

// Add createPortal import
content = content.replace(/import { DateNavigator } from '\.\/DateNavigator';/, "import { DateNavigator } from './DateNavigator';\nimport { createPortal } from 'react-dom';");

// Add showPrintPreview state
content = content.replace(/const \[rosterMode, setRosterMode\] = useState<'BASE_DUTIES' \| 'IDAC_DUTY'>\('BASE_DUTIES'\);/, "const [rosterMode, setRosterMode] = useState<'BASE_DUTIES' | 'IDAC_DUTY'>('BASE_DUTIES');\n  const [showPrintPreview, setShowPrintPreview] = useState(false);");

// modify handlePrint
content = content.replace(/const handlePrint = \(\) => {\s*window.print\(\);\s*};/, "const handlePrint = () => {\n    setShowPrintPreview(true);\n  };");

// extract document rendering
const renderDocStr = `
  const renderDocument = () => (
    <>
      {/* ========================================================================= */}
      {/* OPTION 1: BASE DUTIES */}
`;
content = content.replace(/\{\/\* ========================================================================= \*\/\}\s*\{\/\* OPTION 1: BASE DUTIES \*\/\}/, renderDocStr);

content = content.replace(/<\/div>\n  \);\n};/, "</>\n  );\n\n  return (\n    <div className=\"duty-register-print space-y-6\">\n      {/* Top Header & Option Selector Card */}");

const oldTopHeaderMatch = `return (
    <div className="duty-register-print space-y-6">
      {/* Top Header & Option Selector Card */}`;
content = content.replace(oldTopHeaderMatch, "");
content = content.replace(/<\/div>\n\n  return \(/, "</div>\n\n  return ("); // clean up

// Now inject the renderDocument into the main return and portal

const replacement = `
      {renderDocument()}

      {/* Print Preview Portal */}
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
    </div>
  );
};
`;

content = content.replace(/\{\/\* ========================================================================= \*\/\}\s*\{\/\* OPTION 2: IDAC DUTY \(IDA CENTER DUTY - Font 12 Arial, Bold Header, Normal Below\) \*\/\}/g, "{/* ========================================================================= */}\n      {/* OPTION 2: IDAC DUTY (IDA CENTER DUTY - Font 12 Arial, Bold Header, Normal Below) */}");

content = content.replace(/\{\/\* ========================================================================= \*\/\}\n\s*\{\/\* OPTION 2: IDAC DUTY[\s\S]*?<\/div>\n\s*\)\}\n\s*<\/div>\n\s*\);\n};/, (match) => {
  // We need to keep everything inside renderDocument, and THEN return the main thing.
  return match; // This is a bit too complex for regex. Let's do it manually.
});

fs.writeFileSync('fix_print_modal.cjs_disabled', content);
