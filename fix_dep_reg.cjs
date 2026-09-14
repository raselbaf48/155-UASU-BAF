const fs = require('fs');
let content = fs.readFileSync('src/components/DeploymentRegisterView.tsx', 'utf8');

const oldStr = `const airmanAttAssignments = allAssignments
          .filter((ass: any) => ass && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(ass.dutyCode) && ass.airmanId === airmanId && ass.date)
          .sort((a: any, b: any) => a.date.localeCompare(b.date));`;

const newStr = `const airmanAttAssignments = allAssignments
          .filter((ass: any) => ass && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(ass.dutyCode) && ass.airmanId === airmanId && ass.date)
          .reduce((acc: any[], curr: any) => {
            // Because we now store both deployment and base duties, 
            // deduplicate by date so we don't count the same day twice for deployments
            if (!acc.some(a => a.date === curr.date)) {
              acc.push(curr);
            }
            return acc;
          }, [])
          .sort((a: any, b: any) => a.date.localeCompare(b.date));`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('src/components/DeploymentRegisterView.tsx', content);
