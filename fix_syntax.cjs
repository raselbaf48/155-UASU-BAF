const fs = require('fs');

let code = fs.readFileSync('src/features/canteen/pages/PersonalPortal.tsx', 'utf8');

const regexActivity = /          <\/div>\s*\{\/\* Cancel Confirmation Modal \*\/\}/;

code = code.replace(regexActivity, "          </div>\n      </div>\n      {/* Cancel Confirmation Modal */}");

fs.writeFileSync('src/features/canteen/pages/PersonalPortal.tsx', code);
