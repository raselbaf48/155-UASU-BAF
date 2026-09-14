const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const payload = [
  { id: 'uuid-1', 'User ID': '111', airman_id: null },
  { id: 'uuid-2', 'User ID': '222', airman_id: null }
];
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
