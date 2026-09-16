const fs = require('fs');
let lines = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes("{currentUser.name === 'Guest' ? ("));
if (startIndex !== -1) {
    const endIndex = startIndex + 19;
    console.log("Replacing lines", startIndex, "to", endIndex);
    const replacement = `              <button
                  onClick={onBack}
                 className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors font-bold text-xs uppercase tracking-widest"
              >
                 <LogIn className="w-4 h-4 rotate-180" />
                 <span>LOGOUT</span>
              </button>`;
    
    lines.splice(startIndex, 20, replacement);
    fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', lines.join('\n'));
} else {
    console.log("Not found");
}
