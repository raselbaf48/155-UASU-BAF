import fs from 'fs';
const f = 'src/components/EntryHistoryModal.tsx';
let code = fs.readFileSync(f, 'utf8');

const target = `{(item.actionType || 'UNKNOWN_ACTION').replace('_', ' ')}`;
const replacement = `{(item.actionType || item.type || 'UNKNOWN ACTION').replace('_', ' ')}`;

if(code.includes(target)) {
  fs.writeFileSync(f, code.replace(target, replacement));
  console.log("Patched");
} else {
  console.log("Not found");
}

