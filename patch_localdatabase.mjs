import fs from 'fs';
const f = 'src/services/localDatabase.ts';
let code = fs.readFileSync(f, 'utf8');

const target = `      if (staffData) {
        const parsedAirmen = staffData.map((s: any, idx: number) => ({`;

const replacement = `      if (staffData) {
        staffData.sort((a, b) => {
           const getNum = (id) => {
              if (!id) return 9999;
              const match = id.match(/\\d+/);
              return match ? parseInt(match[0], 10) : 9999;
           };
           return getNum(a.airman_id) - getNum(b.airman_id);
        });

        const parsedAirmen = staffData.map((s: any, idx: number) => ({`;

if(code.includes(target)) {
  fs.writeFileSync(f, code.replace(target, replacement));
  console.log("Patched successfully");
} else {
  console.log("Not found");
}
