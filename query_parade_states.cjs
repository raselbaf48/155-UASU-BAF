const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://asevtncnoytawykhcleg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');
async function test() {
  const { data, error } = await supabase.from('parade_states').select('*').limit(1);
  if(data && data.length > 0) {
     const { error: insErr } = await supabase.from('parade_states').insert([data[0]]);
     console.log("Insert Error:", insErr);
  }
}
test();
