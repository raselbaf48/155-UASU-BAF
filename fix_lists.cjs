const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Update list population logic
    const oldIf = "if (codeUpper === 'ON_PARADE' || codeUpper === 'PT' || codeUpper === 'PT_PARADE' || statusCategory === 'PARADE') {";
    const newIf = "if (codeUpper === 'ON_PARADE' || codeUpper === 'PT' || codeUpper === 'PT_PARADE' || statusCategory === 'PARADE' || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o') || codeUpper === 'DUTY_OFF' || codeUpper === 'OFF_DUTY' || statusCategory === 'OFF' || notesLower.includes('off duty') || notesLower.includes('nt off') || notesLower.includes('night off')) {";
    
    content = content.replace(oldIf, newIf);

    // Remove the `} else if (codeUpper === 'CANTEEN' ...)` logic
    // Since whitespace might vary, we can use regex or exact replacement if we extract it first.
    // Let's just use string replace since we know the exact lines from previous output:
    const toRemove1 = "} else if (codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {\n            receptionList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : '' });\n          ";
    const toRemove2 = "} else if (codeUpper === 'DUTY_OFF' || codeUpper === 'OFF_DUTY' || statusCategory === 'OFF' || notesLower.includes('off duty') || notesLower.includes('nt off') || notesLower.includes('night off')) {\n            dutyOffList.push({ airman, note: 'Duty Off' });\n\n          ";
    
    content = content.replace(toRemove1, '');
    content = content.replace(toRemove2, '');

    // Now, there's a chance the formatting is slightly off. Let's use Regex.
    content = content.replace(/\} else if \(codeUpper === 'CANTEEN'[\s\S]*?receptionList\.push\([\s\S]*?\}\s*/, '');
    content = content.replace(/\} else if \(codeUpper === 'DUTY_OFF'[\s\S]*?dutyOffList\.push\([\s\S]*?\}\s*/, '');

    fs.writeFileSync(file, content);
}

fix('src/components/NightCountStateView.tsx');
fix('src/components/PrintableNightCountModal.tsx');
console.log('list appended logic fixed');
