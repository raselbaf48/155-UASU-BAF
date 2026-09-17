const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data } = await supabase.from('Canteen_Inventory').select('*');
    const fs = require('fs');
    fs.writeFileSync('mock_data.json', JSON.stringify(data, null, 2));
}
run();
