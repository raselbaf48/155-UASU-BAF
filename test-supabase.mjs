import { createClient } from '@supabase/supabase-js';
const supabase = createClient('http://localhost:3000/api/supabase', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');
async function test() {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('bd_no', '48456').single();
  console.log("Data:", data);
  console.log("Error:", error);
}
test();
