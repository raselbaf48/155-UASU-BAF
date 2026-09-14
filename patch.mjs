import fs from 'fs';
const f = 'src/components/AssignDutyModal.tsx';
let code = fs.readFileSync(f, 'utf8');

const regex = /const infoA = getDutyStatusInfo\(a\.id\);[\s\S]*?if \(!isAAvailable && isBAvailable\) return 1;/;
if(regex.test(code)) {
  fs.writeFileSync(f, code.replace(regex, ''));
  console.log("Patched successfully");
} else {
  console.log("Not found");
}
