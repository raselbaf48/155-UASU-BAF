require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const matchUrl = env.match(/VITE_SUPABASE_URL=(.*)/);
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(matchUrl[1], matchKey[1]);
supabase.from('Biodata Register').select('*').limit(1).then(res => console.log(res.data)).catch(console.error);
