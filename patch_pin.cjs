const fs = require('fs');
const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/type="password"\s+maxLength=\{1\}/g, 'type="password" inputMode="numeric" pattern="[0-9]*" autoFocus={i === 0} maxLength={1}');
fs.writeFileSync(file, code);
