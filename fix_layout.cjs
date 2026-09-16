const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// I might have messed up the Wallet import if it wasn't added correctly
if (!code.includes('Wallet,')) {
    code = code.replace(/import \{ LayoutDashboard/, 'import { Wallet, LayoutDashboard');
}

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
