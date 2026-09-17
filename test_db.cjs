const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check() {
    try {
        const bridgeFile = 'src/services/apiBridge.ts';
        let bridgeCode = fs.readFileSync(bridgeFile, 'utf8');
        console.log("Found bridge code");
    } catch(e) { console.log(e.message); }
}
check();
