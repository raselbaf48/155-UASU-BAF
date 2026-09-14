const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const fetchSupabase = async (table) => {
  const r = await fetch(`http://localhost:3000/api/supabase/rest/v1/${table}?limit=1`, {
    headers: { apikey, authorization: 'Bearer ' + apikey }
  });
  console.log(`${table}: ${r.status}`);
};

fetchSupabase('staff');
fetchSupabase('duty_rosters');
fetchSupabase('parade_states');
fetchSupabase('user_profiles');
fetchSupabase('app_settings');
fetchSupabase('duty_ratio_matrix');
