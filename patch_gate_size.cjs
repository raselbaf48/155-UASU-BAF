const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

const oldContainer = "<div className={`w-full ${activeTab !== 'Office' ? 'flex-1 z-10 p-0 m-0' : 'max-w-md relative z-10'}`}>";
const newContainer = "<div className={`w-full ${(activeTab === 'Nt Count' || (activeTab === 'Canteen' && isCanteenAuth)) ? 'flex-1 z-10 p-0 m-0' : 'max-w-md relative z-10'}`}>";
code = code.replace(oldContainer, newContainer);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);
