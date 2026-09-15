import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://asevtncnoytawykhcleg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');

async function run() {
  const lutfar = {
    airman_id: 'airman-7',
    'BD No': '465917',
    'Rank': 'WO',
    'Surname': 'Lutfar',
    'Full Name': 'Md Lutfar Rahman', // guesswork or just Lutfar
    'Flight': 'Avionics',
    'Trade': 'E&I Fitt',
    'Mobile No': '01711465917',
    'Address': "Sgt's Mess",
    'Status': 'ACTIVE'
  };
  const { data, error } = await supabase.from('staff').insert([lutfar]);
  if (error) console.error("Error inserting:", error);
  else console.log("Lutfar restored successfully!");
}
run();
