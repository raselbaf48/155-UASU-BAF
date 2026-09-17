const fs = require('fs');
const file = 'src/components/UserLoginGate.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/name: successAirman\.rank \+ ' ' \+ successAirman\.name/g, "name: (successAirman.rank && successAirman.name) ? (successAirman.rank + ' ' + successAirman.name) : (successAirman.name || successAirman.fullName || 'Guest')");

fs.writeFileSync(file, code);
