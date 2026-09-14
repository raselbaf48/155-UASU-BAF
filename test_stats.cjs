const fs = require('fs');
let content = fs.readFileSync('src/data/rosterGenerator.ts', 'utf8');

// I'll rewrite the counting logic in calculateDutyStats
const regex = /if \(year && month\) \{\s*const totalDays = getDaysInMonth\(year, month\);[\s\S]*?\}\s*\}/;

const newLogic = `if (year && month) {
    const monthStr = month < 10 ? \`0\${month}\` : \`\${month}\`;
    
    // First, process all explicit assignments for the given month
    assignments.forEach((ass) => {
      const d = new Date(ass.date);
      if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
        const stat = map.get(ass.airmanId);
        if (!stat) return;
        
        switch (ass.dutyCode) {
          case 'GD':
            stat.totalGD++;
            stat.totalDutyCount++;
            break;
          case 'BTF':
            stat.totalBTF++;
            stat.totalDutyCount++;
            break;
          case 'NTF':
            stat.totalNTF++;
            stat.totalDutyCount++;
            break;
          case 'HALISHAHAR':
            stat.totalHalishahar++;
            stat.totalDutyCount++;
            break;
          case 'AIRPORT':
            stat.totalAirport++;
            stat.totalDutyCount++;
            break;
          case 'IDAC':
          case 'IDA':
            stat.totalIDAC++;
            if (ass.idaShift === 'Morning') {
              stat.totalIDACMorning++;
            } else if (ass.idaShift === 'Afternoon') {
              stat.totalIDACAfternoon++;
            } else if (ass.idaShift === 'Night') {
              stat.totalIDACNight++;
            } else {
              stat.totalIDACMorning++;
            }
            stat.totalDutyCount++;
            break;
          case 'BAKE_N_BITE':
            stat.totalBakeNBite++;
            break;
          case 'TDY':
            stat.totalTDY++;
            break;
          case 'LEAVE':
            stat.totalLeave++;
            break;
          case 'SICK':
            stat.totalSick++;
            break;
          case 'ATT':
            stat.totalAtt++;
            break;
          case 'CANTEEN':
            stat.totalCanteen++;
            break;
          case 'DUTY_OFF':
            stat.totalDutyOff++;
            break;
        }
      }
    });
  }`;

content = content.replace(regex, newLogic);
fs.writeFileSync('src/data/rosterGenerator.ts', content);
