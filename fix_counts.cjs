const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    const badLine = "} else if (isBake || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {\n          koReceptionCount++;";
    const goodLine = "} else if (isBake) {\n          bakeBiteCount++;";
    
    // Using generic regex in case whitespace is different
    content = content.replace(/\} else if \(isBake \|\| codeUpper === 'CANTEEN'[\s\S]*?koReceptionCount\+\+;/g, "} else if (isBake) {\n          bakeBiteCount++;");
    
    // Wait, in `totalOutPt` calculation:
    // const totalOutPt = leaveCount + detTdyCount + koReceptionCount + essnCount + hospitalCount + sickExCount + adminCommCount + gamesCount + classTrgCount + absentCount + othersCount + airFdDutyCount;
    // Replace koReceptionCount with bakeBiteCount
    content = content.replace(/koReceptionCount \+ essnCount/g, "bakeBiteCount + essnCount");
    
    fs.writeFileSync(file, content);
}

fix('src/components/NightCountStateView.tsx');
fix('src/components/PrintableNightCountModal.tsx');
console.log('Fixed counts');
