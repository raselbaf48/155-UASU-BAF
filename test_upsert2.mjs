import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://asevtncnoytawykhcleg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const payload = [{ 'User ID': '474455', Name: 'Rasel Updated' }];
  const { data, error } = await supabase.from('user_profiles').upsert(payload, { onConflict: '"User ID"' }).select();
  console.log('Error:', error);
}
test();
