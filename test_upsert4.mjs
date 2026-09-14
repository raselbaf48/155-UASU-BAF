const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const payload = [
  { 'User ID': '111', airman_id: null, Name: 'Test 1' },
  { 'User ID': '222', airman_id: null, Name: 'Test 2' }
];
fetch('http://localhost:3000/api/supabase/rest/v1/user_profiles?on_conflict=%22User%20ID%22', {
  method: 'POST',
  headers: {
    apikey,
    authorization: 'Bearer ' + apikey,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },
  body: JSON.stringify(payload)
}).then(async r => console.log(r.status, await r.text()));
