const fs = require('fs');

// Patch PersonalPortal.tsx
let ppCode = fs.readFileSync('src/features/canteen/pages/PersonalPortal.tsx', 'utf8');

ppCode = ppCode.replace(
    /import \{ (.*?) \} from 'lucide-react';/,
    "import { $1, CheckCircle2 } from 'lucide-react';"
);

ppCode = ppCode.replace(
    /const \[activities, setActivities\] = useState<any\[\]>\(\[\]\);/,
    "const [activities, setActivities] = useState<any[]>([]);\n  const [toastMessage, setToastMessage] = useState('');"
);

ppCode = ppCode.replace(
    /alert\('Pre-order placed successfully!'\);/,
    "setToastMessage('✅ Pre-order placed successfully!'); setTimeout(() => setToastMessage(''), 2500);"
);

const toastUi = `
      {/* Toast Notification */}
      {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center space-x-3 animate-in slide-in-from-top-10 fade-in duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
      )}
`;

ppCode = ppCode.replace(/    <\/div>\s*<\/div>\s*\);\s*\};\s*$/, toastUi + "\n    </div>\n  );\n};\n");
fs.writeFileSync('src/features/canteen/pages/PersonalPortal.tsx', ppCode);


// Patch PosSales.tsx
let psCode = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

// Replace showSuccessModal with toastMessage
psCode = psCode.replace(
    /const \[showSuccessModal, setShowSuccessModal\] = useState\(false\);\n\s*const \[successMessage, setSuccessMessage\] = useState\(''\);/,
    "const [toastMessage, setToastMessage] = useState('');"
);

psCode = psCode.replace(
    /setSuccessMessage\(\`Sale completed successfully for ৳\$\{memberChargeAmount \* multiplier\}\!\`\);\n\s*setShowSuccessModal\(true\);/,
    "setToastMessage(`✅ Sale completed successfully for ৳${memberChargeAmount * multiplier}!`); setTimeout(() => setToastMessage(''), 2500);"
);

// Remove the old success modal JSX
psCode = psCode.replace(/\{\/\* Success Modal \*\/\}([\s\S]*?)\{\/\* History Modal \*\/\}/, toastUi + "\n    {/* History Modal */}");

fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', psCode);
