import fs from 'fs';

const url = 'http://localhost:3000/api/supabase/rest/v1/duty_ratio_matrix';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

const matrixPayload = JSON.parse(fs.readFileSync('parsed_matrix.json', 'utf8'));

const insertResp = await fetch(url, { 
   method: 'POST',
   headers: { 
       apikey, 
       authorization: 'Bearer ' + apikey,
       'Content-Type': 'application/json',
       'Prefer': 'resolution=merge-duplicates'
   },
   body: JSON.stringify(matrixPayload)
});

console.log("Status:", insertResp.status);
console.log("Response:", await insertResp.text());
