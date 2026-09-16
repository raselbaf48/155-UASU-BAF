const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const oldXButton = `<button onClick={() => setShowLogin(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-300 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>`;
const newXButton = `<button onClick={onBack} className="absolute top-6 right-6 text-slate-400 hover:text-slate-300 dark:hover:text-slate-300" title="Back to Office">
                  <X className="w-5 h-5" />
                </button>`;

code = code.replace(oldXButton, newXButton);

// Also remove Guest rendering if it exists in the main content so they don't see it (though they shouldn't if they can't bypass login)
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
