const fs = require('fs');

const code = `

export function addAssignmentToMap(assignmentMap: Map<string, DutyAssignment>, ass: DutyAssignment) {
  const scope = ass.disposalScope || 'ALL';
  if (scope !== 'ALL') return; // We only build the map for the main roster
  
  const key = \`\${ass.airmanId}_\${ass.date}\`;
  const existing = assignmentMap.get(key);
  
  if (!existing) {
    assignmentMap.set(key, ass);
  } else {
    // Both exist. Determine priority.
    const isDeployment = (code: string) => ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
    const existingIsDep = isDeployment(existing.dutyCode);
    const newIsDep = isDeployment(ass.dutyCode);
    
    // If the existing is a deployment and the new one is not, the new one overwrites it.
    if (existingIsDep && !newIsDep) {
      assignmentMap.set(key, ass);
    } 
    // If both are not deployments, or both are deployments, usually the latest assignment wins
    // but just overwrite normally.
    else if (!existingIsDep && !newIsDep) {
      assignmentMap.set(key, ass);
    }
  }
}
`;

let content = fs.readFileSync('src/data/rosterGenerator.ts', 'utf8');
content = content.replace("export function getDaysInMonth", code + "\nexport function getDaysInMonth");
fs.writeFileSync('src/data/rosterGenerator.ts', content);
