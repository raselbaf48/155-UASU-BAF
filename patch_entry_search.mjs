import fs from 'fs';
const f = 'src/components/EntryHistoryModal.tsx';
let code = fs.readFileSync(f, 'utf8');

const target = `    return (
      item.airmanName.toLowerCase().includes(q) ||
      item.dutyCode.toLowerCase().includes(q) ||`;
const replacement = `    return (
      (item.airmanName || '').toLowerCase().includes(q) ||
      (item.dutyCode || '').toLowerCase().includes(q) ||`;

if(code.includes(target)) {
  fs.writeFileSync(f, code.replace(target, replacement));
  console.log("Patched search");
} else {
  console.log("Not found search");
}
