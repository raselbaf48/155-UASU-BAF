const fs = require('fs');

// Patch UserLoginGate.tsx
let ulgCode = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');
ulgCode = ulgCode.replace(/value=\{bdInput\}/g, 'inputMode="numeric" pattern="[0-9]*" value={bdInput}');
ulgCode = ulgCode.replace(/value=\{passwordInput\}/g, 'inputMode="numeric" pattern="[0-9]*" value={passwordInput}');
ulgCode = ulgCode.replace(/value=\{resetBd\}/g, 'inputMode="numeric" pattern="[0-9]*" value={resetBd}');
ulgCode = ulgCode.replace(/value=\{newPass\}/g, 'inputMode="numeric" pattern="[0-9]*" value={newPass}');
ulgCode = ulgCode.replace(/value=\{confirmPass\}/g, 'inputMode="numeric" pattern="[0-9]*" value={confirmPass}');
fs.writeFileSync('src/components/UserLoginGate.tsx', ulgCode);

// Patch AdminPasscodeModal.tsx
let apmCode = fs.readFileSync('src/components/AdminPasscodeModal.tsx', 'utf8');
apmCode = apmCode.replace(/value=\{passcode\}/g, 'inputMode="numeric" pattern="[0-9]*" value={passcode}');
apmCode = apmCode.replace(/value=\{resetBd\}/g, 'inputMode="numeric" pattern="[0-9]*" value={resetBd}');
apmCode = apmCode.replace(/value=\{newPass\}/g, 'inputMode="numeric" pattern="[0-9]*" value={newPass}');
apmCode = apmCode.replace(/value=\{confirmPass\}/g, 'inputMode="numeric" pattern="[0-9]*" value={confirmPass}');
fs.writeFileSync('src/components/AdminPasscodeModal.tsx', apmCode);
