const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// update isGroupedView
code = code.replace(
  /const isGroupedView = categoryFilter === 'LEAVE' \|\| categoryFilter === 'TDY' \|\| categoryFilter === 'DEPL' \|\| categoryFilter === 'DUTY';/,
  "const isGroupedView = categoryFilter === 'ALL' || categoryFilter === 'LEAVE' || categoryFilter === 'TDY' || categoryFilter === 'DEPL' || categoryFilter === 'DUTY';"
);

// update header
code = code.replace(
  /<th className="py-2\.5 px-3\.5">\{categoryFilter === 'LEAVE' \? 'Leave Type' : categoryFilter === 'DUTY' \? 'Duty Type' : 'Destination'\}<\/th>/,
  '<th className="py-2.5 px-3.5">Description</th>'
);

// update typeOrDest logic
const typeOrDestOld = "const typeOrDest = categoryFilter === 'LEAVE' ? (first.notes || 'Leave') : categoryFilter === 'DUTY' ? (DUTY_TYPE_MAP.get(first.dutyCode)?.name || first.dutyCode) : (first.notes || (categoryFilter === 'TDY' ? 'TDY' : 'Deployment'));";
const typeOrDestNew = `const typeOrDest = (() => {
                            if (first.dutyCode === 'LEAVE') return first.notes || 'Leave';
                            if (first.dutyCode === 'TDY') return first.notes || 'TDY';
                            if (['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(first.dutyCode)) return first.notes || DUTY_TYPE_MAP.get(first.dutyCode)?.name || 'Deployment';
                            return DUTY_TYPE_MAP.get(first.dutyCode)?.name || first.dutyCode;
                          })();`;

code = code.replace(typeOrDestOld, typeOrDestNew);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
