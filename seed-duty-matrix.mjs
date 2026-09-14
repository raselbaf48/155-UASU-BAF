import fs from 'fs';

const url = 'http://localhost:3000/api/supabase/rest/v1/duty_ratio_matrix';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

// Get current setting from Supabase app_settings
const settingsUrl = 'http://localhost:3000/api/supabase/rest/v1/app_settings?setting_key=eq.baf_official_duty_matrix_v4';
const resp = await fetch(settingsUrl, { headers: { apikey, authorization: 'Bearer ' + apikey } });
const settings = await resp.json();

if (settings && settings.length > 0 && settings[0].setting_value) {
    const matrix = JSON.parse(settings[0].setting_value);
    
    const matrixPayload = matrix.map(m => ({
       id: m.id,
       title: m.title,
       duty_code: m.dutyCode,
       shift_label: m.shiftLabel || null,
       total_required_month: m.totalRequiredMonth || 0,
       total_required_daily: m.totalRequiredDaily || 0,
       is_disabled: m.isDisabled || false,
       data_mechanics: m.data?.Mechanics || Array(31).fill(0),
       data_avionics: m.data?.Avionics || Array(31).fill(0),
       data_gcs: m.data?.GCS || Array(31).fill(0),
       data_admin: m.data?.Admin || Array(31).fill(0)
   }));
   
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
