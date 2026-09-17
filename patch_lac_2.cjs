const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// Also clear it in onBack
code = code.replace(
  /onBack=\{\(\) => \{ setIsCanteenAuth\(false\); setBdInput\(''\); setPasswordInput\(''\); setSuccessAirman\(null\); \}\} /g,
  "onBack={() => { setIsCanteenAuth(false); setBdInput(''); setPasswordInput(''); setSuccessAirman(null); setTargetAirman(null); }} "
);

// Also when switching tabs
code = code.replace(
  /setActiveTab\('Office'\);/g,
  "setActiveTab('Office'); setTargetAirman(null); setBdInput(''); setPasswordInput('');"
);
code = code.replace(
  /setActiveTab\('Nt Count'\);/g,
  "setActiveTab('Nt Count'); setTargetAirman(null); setBdInput(''); setPasswordInput('');"
);
code = code.replace(
  /setActiveTab\('Canteen'\);/g,
  "setActiveTab('Canteen'); setTargetAirman(null); setBdInput(''); setPasswordInput('');"
);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);
