import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://asevtncnoytawykhcleg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');

async function fix() {
  const { data: settings } = await supabase.from('app_settings').select('*').eq('setting_key', 'baf_155_uasu_v2_db').single();
  const val = JSON.parse(settings.setting_value);
  const idMap = {};
  val.airmen.forEach(a => {
    const bdNo = String(a.bdNo || '').replace(/[^0-9]/g, '');
    if (bdNo) idMap[a.id] = `BD/${bdNo}`;
  });

  console.log("ID Map size:", Object.keys(idMap).length);

  // We need to fetch all duties (pagination)
  let allDuties = [];
  let page = 0;
  while(true) {
    const { data, error } = await supabase.from('duty_rosters').select('*').range(page*1000, (page+1)*1000-1);
    if (!data || data.length === 0) break;
    allDuties = allDuties.concat(data);
    page++;
  }
  
  console.log(`Fetched ${allDuties.length} total duties`);
  
  const dutiesToInsert = [];
  const dutiesToDelete = [];

  for (const d of allDuties) {
    if (idMap[d.airman_id]) {
      const newId = idMap[d.airman_id];
      if (newId !== d.airman_id) {
         dutiesToDelete.push(d.assignment_id);
         const newAsnId = d.assignment_id.replace(d.airman_id, newId);
         dutiesToInsert.push({ ...d, airman_id: newId, assignment_id: newAsnId });
      }
    }
  }

  console.log(`Need to update ${dutiesToInsert.length} duties`);

  if (dutiesToInsert.length > 0) {
     for (let i = 0; i < dutiesToInsert.length; i += 500) {
       const {error} = await supabase.from('duty_rosters').upsert(dutiesToInsert.slice(i, i+500));
       if (error) console.error("Upsert err:", error);
     }
     for (let i = 0; i < dutiesToDelete.length; i += 500) {
       await supabase.from('duty_rosters').delete().in('assignment_id', dutiesToDelete.slice(i, i+500));
     }
  }
  console.log("Duty migration complete!");
}

fix();
