const fs = require('fs');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

if (!modal.includes('const presetDeployLocations')) {
  modal = modal.replace(
    /const presetLocations = \['AIR HQ', 'BAF AKR', 'BAF BSR', 'BAF MTR', 'BAF CXB', 'BAF SMD'\];/g,
    `const presetLocations = ['AIR HQ', 'BAF AKR', 'BAF BSR', 'BAF MTR', 'BAF CXB', 'BAF SMD'];\nconst presetDeployLocations = ['Canteen', 'Bake & Bite'];`
  );
}

// Ensure the second block (Deployment block) uses presetDeployLocations instead of presetLocations
const blocks = modal.split('editingGroup[0].dutyCode');
// Actually, it's safer to just replace in the deployment section.
// Let's find the location in the code.
const depTarget = `['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(editingGroup[0].dutyCode) ? (`;
const depIndex = modal.indexOf(depTarget);

if (depIndex !== -1) {
   let afterDep = modal.substring(depIndex);
   afterDep = afterDep.replace(
     /\{presetLocations\.map\(loc => \(/,
     `{presetDeployLocations.map(loc => (`
   );
   modal = modal.substring(0, depIndex) + afterDep;
}

fs.writeFileSync('src/components/AirmanProfileModal.tsx', modal);
