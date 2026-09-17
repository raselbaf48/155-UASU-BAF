const fs = require('fs');

function replaceName(file, isPrintableModal = false) {
    if(!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');

    // The export filename logic usually looks like this:
    // const fileName = `Night_Count_State_${finalUnitLabel.replace(/\s+/g, '_')}_${startStr}_to_${endStr}.docx`;
    
    // We can replace the fileName creation logic with the custom one based on userFlight and dates.
    // For ParadeStateFormattedView we already did. Let's do PrintableNightCountModal & PrintableParadeStateModal
    
    const regex = /const fileName = `[^`]+`;/g;
    const replacement = `const fileName = \`Parade State - \${userFlight === 'Overall' ? '155 UASU BAF' : userFlight + ' Flt'} (\${dateRangeHeader.replace(/ To /g, ' - ')}).\${format || 'pdf'}\`;`;
    // Wait, the formatting inside those files might vary. Let's inspect PrintableParadeStateModal.tsx
}

// Just checking printable modal first.
