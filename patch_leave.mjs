import fs from 'fs';
const f = 'src/components/LeaveRegisterView.tsx';
let code = fs.readFileSync(f, 'utf8');

const target = `  const { role = 'GUEST' } = useAuth();`;
const replacement = `  const { role = 'GUEST' } = useAuth();
  
  // Filter only active airmen
  const activeAirmen = useMemo(() => airmen.filter((a) => a.active !== false), [airmen]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  
  // Now replace all other uses of 'airmen' with 'activeAirmen' EXCEPT in props and useMemo dependencies that specifically need it (we can just replace useMemo dependencies with activeAirmen)
  
  code = code.replace(/const list = airmen.filter/g, 'const list = activeAirmen.filter');
  code = code.replace(/\[airmen, grantLeaveFlight\]/g, '[activeAirmen, grantLeaveFlight]');
  
  code = code.replace(/airmen.forEach/g, 'activeAirmen.forEach');
  code = code.replace(/\[selectedYear, airmen\]/g, '[selectedYear, activeAirmen]');
  
  code = code.replace(/const found = airmen.find/g, 'const found = activeAirmen.find');
  
  code = code.replace(/sortAirmenBySeniority\(airmen\)/g, 'sortAirmenBySeniority(activeAirmen)');
  
  // We can keep EntryHistoryModal airmen={airmen} so history still has the full list of airmen to show names correctly if needed, or we can change it. Let's keep it airmen={airmen}.
  // Actually, wait, EntryHistoryModal is at the very end. Let's just leave it as airmen={airmen} since it's just for name resolution.

  fs.writeFileSync(f, code);
  console.log("Patched Leave");
} else {
  console.log("Not found Leave");
}
