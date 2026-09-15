const fs = require('fs');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const fetchEvt = `const fetchEvt = new CustomEvent('baf_roster_updated');`;
const fetchEvtNew = `const fetchEvt = new CustomEvent('baf_state_updated');`;

modal = modal.replace(/baf_roster_updated/g, 'baf_state_updated');

fs.writeFileSync('src/components/AirmanProfileModal.tsx', modal);
console.log("Replaced baf_roster_updated");
