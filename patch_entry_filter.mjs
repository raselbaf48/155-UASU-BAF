import fs from 'fs';
const f = 'src/components/EntryHistoryModal.tsx';
let code = fs.readFileSync(f, 'utf8');

const target = `  const filteredHistory = last10Entries.filter((item) => {`;
const replacement = `  const filteredHistory = last10Entries.filter((item) => {
    // Hide corrupted logs that have neither actionType nor type
    if (!item.actionType && !item.type) return false;`;

if(code.includes(target)) {
  fs.writeFileSync(f, code.replace(target, replacement));
  console.log("Patched filter");
} else {
  console.log("Not found filter");
}
