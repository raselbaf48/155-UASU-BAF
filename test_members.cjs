const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://asevtncnoytawykhcleg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function test() {
    const { data, error } = await supabase.from('Canteen').select('*');
    if (data) {
        console.log(data.filter(m => (m['Surname'] || '').toLowerCase().includes('rasel')));
    }
}
test();
