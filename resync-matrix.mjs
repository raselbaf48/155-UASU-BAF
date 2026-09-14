const url = 'http://localhost:3000/api/supabase/rest/v1/duty_ratio_matrix';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

const settingsUrl = 'http://localhost:3000/api/supabase/rest/v1/app_settings?setting_key=eq.baf_official_duty_matrix_v4';
const resp = await fetch(settingsUrl, { headers: { apikey, authorization: 'Bearer ' + apikey } });
const settings = await resp.json();

if (settings && settings.length > 0 && settings[0].setting_value) {
    const matrix = JSON.parse(settings[0].setting_value);
    
    const matrixPayload = [];
    matrix.forEach(m => {
       const flights = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
       flights.forEach(f => {
           const days = m.data?.[f] || Array(31).fill(0);
           const flightTotal = days.reduce((sum, val) => sum + val, 0);
           const row = {
               id: `${m.id || m.dutyCode}_${f}`,
               duty_id: m.id || m.dutyCode || 'unknown',
               duty_title: m.title || m.dutyCode || 'Unknown Duty',
               duty_code: m.dutyCode || 'UNKNOWN',
               shift_label: m.shiftLabel || null,
               flight: f,
               flight_total: flightTotal,
               duty_total_daily: m.totalRequiredDaily || 0,
               is_disabled: m.isDisabled || false
           };
           for (let i = 0; i < 31; i++) {
               row[`day_${i + 1}`] = days[i] || 0;
           }
           matrixPayload.push(row);
       });
    });
   
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
   console.log("Import result:", insertResp.status, await insertResp.text());
} else {
    console.log("No existing data found in app_settings");
}
