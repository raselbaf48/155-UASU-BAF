import fs from 'fs';
const f = 'src/types.ts';
let code = fs.readFileSync(f, 'utf8');

const target = `export interface ActivityHistoryItem {
  id: string;
  timestamp: string;
  actionType: 'ASSIGN_DUTY' | 'ASSIGN_RANGE' | 'GRANT_LEAVE' | 'DELETE_ASSIGNMENT' | 'CLEAR_RANGE' | 'EDIT_DUTY' | 'IMPORT_PDF_ROSTER' | 'SYSTEM_ACTION';`;

const replacement = `export interface ActivityHistoryItem {
  id: string;
  timestamp: string;
  actionType?: 'ASSIGN_DUTY' | 'ASSIGN_RANGE' | 'GRANT_LEAVE' | 'DELETE_ASSIGNMENT' | 'CLEAR_RANGE' | 'EDIT_DUTY' | 'IMPORT_PDF_ROSTER' | 'SYSTEM_ACTION';
  type?: string;`;

if(code.includes(target)) {
  fs.writeFileSync(f, code.replace(target, replacement));
  console.log("Patched types");
} else {
  console.log("Not found types");
}

