const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

const toastJsx = `
      {/* Toast Notification */}
      {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center space-x-3 animate-in slide-in-from-top-10 fade-in duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
      )}
`;

// Insert it right before the last </div>
const EndTags = '</div>\n    )}\n    </>\n  );\n};';
if (code.includes(EndTags)) {
    code = code.replace(EndTags, toastJsx + '\n' + EndTags);
} else {
    // try a more generic approach if that specific string isn't found
    code = code.replace(/<\/div>\s*\)\}\s*<\/>\s*\);\s*\};\s*(const PackageIcon|$)/, toastJsx + "\n    </div>\n    )}\n    </>\n  );\n};\n$1");
}

fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', code);
