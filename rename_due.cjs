const fs = require('fs');

function replaceFile(path) {
    if (!fs.existsSync(path)) return;
    let code = fs.readFileSync(path, 'utf8');
    
    // UI string replacements
    code = code.replace(/NEW BAKI/g, 'NEW DUE');
    code = code.replace(/Total Baki/g, 'Total Due');
    code = code.replace(/TOTAL BAKI/g, 'TOTAL DUE');
    code = code.replace(/BAKI reversed/g, 'DUE reversed');
    code = code.replace(/reverse Baki/g, 'reverse Due');
    code = code.replace(/member BAKI/g, 'member DUE');
    code = code.replace(/Reverse Baki/g, 'Reverse Due');
    
    // Only replacing the explicit "BAKI" in mock data if we want. Let's do it for 'gateway' string if necessary, but it's safe to leave as 'BAKI' internally if it breaks logic. Wait, let's keep internal keys 'baki' untouched, but replace UI strings.
    code = code.replace(/>BAKI</g, '>DUE<');
    code = code.replace(/'BAKI'/g, "'DUE'"); // Only for mock data gateways
    
    fs.writeFileSync(path, code);
}

replaceFile('src/features/canteen/pages/CanteenReports.tsx');
replaceFile('src/features/canteen/pages/MemberDB.tsx');
replaceFile('src/features/canteen/pages/PosSales.tsx');
