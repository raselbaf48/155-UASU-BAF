const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

if (!code.includes('CanteenFund')) {
    code = code.replace(
        /import \{ CanteenSettings \} from '\.\.\/pages\/CanteenSettings';/,
        `import { CanteenSettings } from '../pages/CanteenSettings';\nimport { CanteenFund } from '../pages/CanteenFund';`
    );
}

if (!code.includes("id: 'fund'")) {
    const navItemString = "{ id: 'settings', name: 'Settings', icon: SettingsIcon }";
    code = code.replace(
        navItemString,
        `{ id: 'fund', name: 'Fund', icon: Wallet },\n    ${navItemString}`
    );
    
    // Add Wallet to lucide imports
    if (!code.includes('Wallet')) {
        code = code.replace(/LogOut, Menu \}/, 'LogOut, Menu, Wallet }');
        code = code.replace(/UserCircle, X, Menu \}/, 'UserCircle, X, Menu, Wallet }');
    }
}

if (!code.includes("<CanteenFund />")) {
    code = code.replace(
        /case 'settings': return <CanteenSettings \/>;/,
        `case 'fund': return <CanteenFund />;\n      case 'settings': return <CanteenSettings />;`
    );
}

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
