const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://asevtncnoytawykhcleg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');
supabase.from('Biodata Register').upsert([{
    airman_id: 'BD/472206',
    'BD No': '472206',
    'Dt of Posting': ' '
}], { onConflict: 'airman_id' }).then(res => console.log(res)).catch(console.error);
