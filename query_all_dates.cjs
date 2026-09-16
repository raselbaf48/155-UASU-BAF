const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://asevtncnoytawykhcleg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');
async function test() {
  const { data, error } = await supabase.from('Biodata Register').select('airman_id, "Dt of Posting", "Unit Left date"');
  if (error) console.error(error);
  else console.log("Invalid dates found:", data.filter(d => d['Dt of Posting'] && d['Dt of Posting'].trim() === ''));
}
test();
