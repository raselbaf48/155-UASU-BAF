const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. In the first loop (counting loop)
    // Update the ON_PARADE if condition
    content = content.replace(
        /if \(codeUpper === 'ON_PARADE' \|\| statusCategory === 'PARADE' \|\| isNightCountIdacA \|\| isDutyOff\) \{/,
        "if (codeUpper === 'ON_PARADE' || statusCategory === 'PARADE' || isNightCountIdacA || isDutyOff || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {"
    );

    // Remove the `else if (codeUpper === 'RECEPTION' ...)` block in counting loop
    content = content.replace(
        /\} else if \(codeUpper === 'RECEPTION' \|\| notesLower\.includes\('reception'\) \|\| notesLower\.includes\('k\/o'\)\) \{\s*koReceptionCount\+\+;/g,
        ""
    );

    // Modify `} else if (isBake || codeUpper === 'CANTEEN' ...)` to just `} else if (isBake) {`
    // Actually, in the code we currently have:
    // } else if (isBake) { bakeBiteCount++; } else if (codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) { koReceptionCount++; }
    // Let's check exactly what is there.
    
    fs.writeFileSync(file, content);
}

fix('src/components/NightCountStateView.tsx');
fix('src/components/PrintableNightCountModal.tsx');
console.log('first step done');
