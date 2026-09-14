const url = 'http://localhost:3000/api/supabase/rest/v1/staff?limit=1';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const resp = await fetch(url, { headers: { apikey, authorization: 'Bearer ' + apikey } });
const data = await resp.json();
if (data.length > 0) {
  console.log("Keys:", Object.keys(data[0]));
} else {
  console.log("No data, testing preflight or looking at error:", data);
}
