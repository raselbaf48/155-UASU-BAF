import fs from 'fs';
const f = 'src/components/EntryHistoryModal.tsx';
let code = fs.readFileSync(f, 'utf8');

const target = `{(item.actionType || 'UNKNOWN_ACTION').replace('_', ' ')}`;
const replacement = `{(item.actionType || item.type || 'UNKNOWN_ACTION').replace('_', ' ')}`;

if(code.includes(target)) {
  fs.writeFileSync(f, code.replace(target, replacement));
  console.log("Patched actionType");
} else {
  console.log("Not found actionType");
}

const target2 = `item.actionType === 'SYSTEM_ACTION'`;
const replacement2 = `(item.actionType === 'SYSTEM_ACTION' || item.type === 'SYSTEM_ACTION')`;

if(code.includes(target2)) {
  fs.writeFileSync(f, code.replace(new RegExp(target2, 'g'), replacement2));
  console.log("Patched SYSTEM_ACTION");
} else {
  console.log("Not found SYSTEM_ACTION");
}

