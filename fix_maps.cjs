const fs = require('fs');

function replaceMapLogic(file, hasImport) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if addAssignmentToMap needs to be imported
    if (hasImport && !content.includes('addAssignmentToMap')) {
        content = content.replace(/resolveAirmanDutyForDate/, 'resolveAirmanDutyForDate, addAssignmentToMap');
    }

    // Replace logic
    const oldLogic = /assignments\.forEach\(\(ass\) => \{\s*const key = \`\$\{ass\.airmanId\}_\$\{ass\.date\}\`;\s*const existing = assignmentMap\.get\(key\);\s*if \(\!existing \|\| \(existing\.disposalScope \|\| 'ALL'\) \!\=\= 'ALL'\) \{\s*assignmentMap\.set\(key, ass\);\s*\}\s*\}\);/g;
    
    content = content.replace(oldLogic, `assignments.forEach((ass) => addAssignmentToMap(assignmentMap, ass));`);
    fs.writeFileSync(file, content);
}

replaceMapLogic('src/components/MonthlyDutyRegister.tsx', true);
replaceMapLogic('src/data/rosterGenerator.ts', false);
replaceMapLogic('src/utils/docxExport.ts', true); // Note: might need to fix import manually for docxExport
