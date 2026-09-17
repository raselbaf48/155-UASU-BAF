const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

code = code.replace(
  /\{targetAirman && \(/g,
  "{targetAirman && bdInput.trim().length > 0 && ("
);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);
