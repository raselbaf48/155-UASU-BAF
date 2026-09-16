const fs = require('fs');
let code = fs.readFileSync('src/supabase.ts', 'utf8');
code = code.replace(
    /let supabaseUrl = 'http:\/\/localhost:3000\/api\/supabase';[\s\S]*?if \(!supabaseUrl\.startsWith\('http'\)\) \{[\s\S]*?\}/,
    `let supabaseUrl = DIRECT_SUPABASE_URL;`
);
fs.writeFileSync('src/supabase.ts', code);
