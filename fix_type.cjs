const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix the Object.entries(customDisposalsMap).map part
    content = content.replace(
        /Object\.entries\(customDisposalsMap\)\.map\(\s*\(\[title, items\]\) =>/g,
        'Object.entries(customDisposalsMap).map(([title, items]: [string, any]) =>'
    );

    // Also for the other usages of items.map
    content = content.replace(
        /airmen: items\.map\(\(i\) => i\.airman\)/g,
        'airmen: items.map((i: any) => i.airman)'
    );
    
    // Also in PrintableNightCountModal.tsx:
    content = content.replace(
        /Object\.entries\(customDisposalsMap\)\.map\(\s*\(\[catName, airmenList\]\) =>/g,
        'Object.entries(customDisposalsMap).map(([catName, airmenList]: [string, any]) =>'
    );

    fs.writeFileSync(file, content);
}

fix('src/components/NightCountStateView.tsx');
fix('src/components/PrintableNightCountModal.tsx');
console.log('Fixed types');
