const fs = require('fs');
let code = fs.readFileSync('src/components/DutyRatioMatrixView.tsx', 'utf8');

const oldLogic = `      matrix.filter(t => !t.isDisabled).forEach(table => {
         const isSecurity = table.id === 'security_duty';
         const poolSize = isSecurity ? totalCpl : totalAll;
         const dutyTotal = table.totalRequiredMonth || 0;
         const dpp = poolSize > 0 ? (dutyTotal / poolSize) : 0;
         
         flights.forEach(fl => {
             const flightPool = isSecurity ? fltStrength[fl].cpl : fltStrength[fl].total;
             autoTargets[fl][table.id] = dpp * flightPool;
         });
      });`;

const newLogic = `      let tieBreakerTracker = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
      matrix.filter(t => !t.isDisabled).forEach(t => {
         const isSecurity = t.id === 'security_duty';
         const dutyTotal = t.totalRequiredMonth || 0;
         let actualPoolSize = 0;
         let flightPools = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
         
         flights.forEach(fl => {
            let fltPool = isSecurity ? fltStrength[fl].cpl : fltStrength[fl].total;
            if (t.eligibleFlights && !t.eligibleFlights.includes(fl)) {
              fltPool = 0;
            }
            flightPools[fl] = fltPool;
            actualPoolSize += fltPool;
         });
         
         if (dutyTotal === 0 || actualPoolSize === 0) {
            flights.forEach(fl => { autoTargets[fl][t.id] = 0; });
            return;
         }
         
         const exactVals = flights.map(fl => {
            const exact = (flightPools[fl] / actualPoolSize) * dutyTotal;
            return {
              flight: fl,
              exact: exact,
              floor: Math.floor(exact),
              remainder: exact - Math.floor(exact)
            };
         });
         
         const allocated = exactVals.reduce((sum, item) => sum + item.floor, 0);
         const remaining = dutyTotal - allocated;
         
         const sortedForDistribution = [...exactVals]
           .filter(item => flightPools[item.flight] > 0)
           .sort((a, b) => {
             const diff = b.remainder - a.remainder;
             if (Math.abs(diff) > 1e-9) return diff;
             const floorDiff = a.floor - b.floor;
             if (floorDiff !== 0) return floorDiff;
             return tieBreakerTracker[a.flight] - tieBreakerTracker[b.flight];
           });
           
         for (let i = 0; i < remaining && i < sortedForDistribution.length; i++) {
           sortedForDistribution[i].floor += 1;
           tieBreakerTracker[sortedForDistribution[i].flight] += 1;
         }
         
         exactVals.forEach(item => {
           autoTargets[item.flight][t.id] = item.floor;
         });
      });`;

code = code.replace(oldLogic, newLogic);

// Now fix the Math.round usage in render, because autoTargets already contains the exact integers
code = code.replace(/Math\.round\(autoTargets\?\.\[flight\]\?\.\[table\.id\] \|\| table\.flightTargets\?\.\[flight\] \|\| 0\)/g, '(autoTargets?.[flight]?.[table.id] ?? table.flightTargets?.[flight] ?? 0)');

fs.writeFileSync('src/components/DutyRatioMatrixView.tsx', code);
