const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Replace the bad filter logic
    const oldFilter = `if (block.includes('qtr') || block.includes('quarter') || block.includes('outside') || block.includes('maizpara') || block.includes('ghat') || block.includes('l/o') || block.includes('lo')) return false;`;
    
    // Some lines might be formatted differently, we will just use regex to replace it
    content = content.replace(
        /block\.includes\('qtr'\) \|\| block\.includes\('quarter'\) \|\| block\.includes\('outside'\) \|\| block\.includes\('maizpara'\) \|\| block\.includes\('ghat'\) \|\| block\.includes\('l\/o'\) \|\| block\.includes\('lo'\)/g,
        "block.includes('qtr') || block.includes('quarter') || block.includes('outside') || block.includes('maizpara') || block.includes('dhaka') || block.includes('mirpur') || block.includes('cantt') || block.includes('ghat') || block.includes('l/o') || block.includes('l/out') || block.includes('living out') || block === 'lo' || block === 'l o'"
    );

    // Also let's check for the multiline one:
    const multiLineMatch = `const isLOut = block.includes('qtr') || 
                   block.includes('quarter') || 
                   block.includes('outside') || block.includes('maizpara') ||
                   block.includes('l/o') ||
                   block.includes('l/out') ||
                   block.includes('living out') ||
                   block.includes('dhaka') ||
                   block.includes('mirpur') ||
                   block.includes('cantt') ||
                   block.includes('ghat') ||
                   block === 'lo' || 
                   block === 'l o';`;

    // Wait, let's just make a generic replace function that works safely.
    fs.writeFileSync(file, content);
}

fix('src/components/NightCountStateView.tsx');
fix('src/components/PrintableNightCountModal.tsx');
console.log('Fixed block filter');
