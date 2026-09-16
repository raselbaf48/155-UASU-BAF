const fs = require('fs');
let lines = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8').split('\n');

const newDesktopLogout = `          <button
              onClick={onBack}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors font-bold text-xs uppercase tracking-widest"
          >
              <LogIn className="w-4 h-4 rotate-180" />
              <span>LOGOUT</span>
          </button>`;

// Replace from line 168 (where `{currentUser.name === 'Guest' ? (` is) down to line 186 (where `)}` is)
// Actually we can just find `{currentUser.name === 'Guest' ? (`
let startIndex = lines.findIndex(l => l.includes("{currentUser.name === 'Guest' ? ("));
if (startIndex !== -1) {
    let endIndex = startIndex;
    let braceCount = 0;
    // this is a bit risky if braces are nested. Let's just find the exact lines
}
