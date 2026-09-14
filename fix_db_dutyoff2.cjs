const fs = require('fs');
let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const regexToRemove = /if \(\!isPT\) \{\s*const yestAss = yestMap\.get\(airmanId\);[\s\S]*?if \(isHeavy\) \{\s*return \{\s*dutyCode: 'DUTY_OFF',[\s\S]*?statusCategory: 'OFF',\s*\};\s*\}\s*\}\s*\}/;

const toAdd = `
      const isDep = ass && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(ass.dutyCode);
      if (!isPT && (!ass || isDep)) {
        const yestAss = yestMap.get(airmanId);
        if (yestAss) {
          let offShort = 'GD Off';
          if (yestAss.dutyCode === 'GD') offShort = 'GD Off';
          else if (yestAss.dutyCode === 'BTF') offShort = 'BTF Off';
          else if (yestAss.dutyCode === 'NTF') offShort = 'NTF Off';
          else if (yestAss.dutyCode === 'AIRPORT') offShort = 'Airfield Off';
          else if (yestAss.dutyCode === 'HALISHAHAR') offShort = 'Halishahar Off';
          else if ((yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') && yestAss.idaShift === 'Night') offShort = 'IDAC Nt Off';
          else if (yestAss.notes?.toLowerCase().includes('idac') || yestAss.previousDutyName?.toLowerCase().includes('idac')) offShort = 'IDAC Nt Off';
          else if (yestAss.dutyCode === 'DUTY_OFF') offShort = yestAss.previousDutyName || yestAss.notes || 'GD Off';
          else if (yestAss.dutyCode === 'ON_PARADE') offShort = 'GD Off';
          else offShort = \`\${yestAss.dutyCode} Off\`;

          offShort = (offShort || "")
            .replace(/DUTY_OFF/g, 'Duty')
            .replace(/Off Off/g, 'Off')
            .replace(/Duty Off Off/g, 'Duty Off');

          const isHeavy =
            ['GD', 'BTF', 'NTF', 'AIRPORT', 'ATT', 'HALISHAHAR'].includes(yestAss.dutyCode) ||
            ((yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') && yestAss.idaShift === 'Night') ||
            yestAss.notes?.toLowerCase().includes('idac');

          if (isHeavy) {
            return { 
              dutyCode: 'DUTY_OFF', 
              dutyName: offShort, 
              previousDutyName: offShort,
              proxyForFlight: yestAss.proxyForFlight,
              notes: offShort,
              statusCategory: 'OFF',
            };
          }
        }
      }
`;

content = content.replace(regexToRemove, "");
content = content.replace(/const ass = assignmentMap\.get\(airmanId\);/, "const ass = assignmentMap.get(airmanId);" + toAdd);

fs.writeFileSync('src/services/localDatabase.ts', content);
