const fs = require('fs');
let code = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

// Replace the throw new Error with console.warn and return null
code = code.replace(
    /throw new Error\("Failed to fetch staff from Cloud: " \+ e\.message\);/,
    `console.warn("Failed to fetch staff from Cloud: " + e.message);
         staffData = null;`
);

// Replace the generic Supabase Pull Error to warn
code = code.replace(
    /console\.error\("Supabase Pull Error:", err\);/,
    `console.warn("Supabase Pull Error (offline?):", err.message);`
);

fs.writeFileSync('src/services/localDatabase.ts', code);
