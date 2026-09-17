const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://asevtncnoytawykhcleg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

const supabase = createClient(supabaseUrl, key);
supabase.from('Canteen').select('*').ilike('Surname', '%Guest%').then(res => console.log(res.data));
