const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const payload = [{ id: '7ab5d489-6298-4ba4-9e7c-3f018063f290', 'User ID': '474455', Name: 'Rasel', Rank: 'LAC', Flight: 'Avionics', Trade: 'E&I Fitt', Role: 'USER' }];
fetch('http://localhost:3000/api/supabase/rest/v1/user_profiles', {
  method: 'POST',
  headers: {
    apikey,
    authorization: 'Bearer ' + apikey,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },
  body: JSON.stringify(payload)
}).then(async r => console.log(r.status, await r.text()));
