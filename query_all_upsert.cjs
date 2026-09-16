const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://asevtncnoytawykhcleg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');
async function test() {
  const { data } = await supabase.from('Biodata Register').select('*');
  if(!data) return;
  const { error } = await supabase.from('Biodata Register').upsert(data, { onConflict: 'airman_id' });
  if (error) console.error("UPSERT ERROR:", error);
  else console.log("UPSERT SUCCESS");
}
test();
