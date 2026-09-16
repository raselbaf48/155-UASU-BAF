const fs = require('fs');

const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldHeaderStart = `{/* Top Header */}`;
const oldHeaderEnd = `{/* Content View */}`;

const startIndex = code.indexOf(oldHeaderStart);
const endIndex = code.indexOf(oldHeaderEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const newHeader = `{/* Top Header for Mobile only */}
         <div className="md:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-10 sticky top-0">
            <div className="flex items-center space-x-3">
              <button onClick={onBack} className="p-2 text-slate-500 bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-bold text-lg text-slate-800 dark:text-white">CAFEUAV</span>
            </div>
            <button onClick={() => { setShowLogin(true); setLoginError(''); setLoginInput(''); }}>
               <LogIn className="w-5 h-5 text-indigo-600" />
            </button>
         </div>

         `;
  code = code.substring(0, startIndex) + newHeader + code.substring(endIndex);
}

fs.writeFileSync(file, code);
