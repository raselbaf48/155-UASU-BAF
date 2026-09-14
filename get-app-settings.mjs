const url = 'http://localhost:3000/api/supabase/rest/v1/app_settings?setting_key=eq.baf_official_duty_matrix_v4';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
const resp = await fetch(url, { headers: { apikey, authorization: 'Bearer ' + apikey } });
const data = await resp.json();
console.log(data?.[0]?.setting_value?.substring(0, 500));
