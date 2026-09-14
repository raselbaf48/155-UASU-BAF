const url = 'http://localhost:3000/api/supabase/rest/v1/user_profiles';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

const supaPayload = [{
  'User ID': '12345',
  'Name': 'Test'
}];

const resp = await fetch(url + '?on_conflict=User ID', { 
  method: 'POST',
  headers: { 
    apikey, 
    authorization: 'Bearer ' + apikey,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },
  body: JSON.stringify(supaPayload)
});
console.log(await resp.text());
