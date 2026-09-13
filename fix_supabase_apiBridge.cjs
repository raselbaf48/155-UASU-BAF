const fs = require('fs');

const apiBridgePath = 'src/services/apiBridge.ts';
if (fs.existsSync(apiBridgePath)) {
  let content = fs.readFileSync(apiBridgePath, 'utf8');

  // Insert imports at the top
  if (!content.includes("import { supabase } from '../supabase';")) {
    content = "import { supabase } from '../supabase';\n" + content;
  }

  // Rewrite delete staff logic
  const delStaffRegex = /if\s*\(!hasErrors\)\s*\{\s*addSyncLog\(\{ timestamp: new Date\(\)\.toISOString\(\), type: "DELETE", status: "SUCCESS", message: `Airman \${id} and all related assignments deleted successfully.` \}\);\s*\}/s;
  
  const newDelStaffLogic = `if (!hasErrors) {
              const { supabase } = await import('../supabase');
              if (supabase) {
                 await supabase.from('duty_rosters').delete().eq('airman_id', id);
                 await supabase.from('staff').delete().eq('airman_id', id);
                 if (target && target.bdNo) {
                    await supabase.from('user_profiles').delete().eq('bd_no', target.bdNo);
                 }
              }
              addSyncLog({ timestamp: new Date().toISOString(), type: "DELETE", status: "SUCCESS", message: \`Airman \${id} and all related assignments deleted successfully.\` });
           }`;
           
  if (!content.includes("await supabase.from('duty_rosters').delete().eq('airman_id', id);")) {
     content = content.replace(delStaffRegex, newDelStaffLogic);
  }

  // Rewrite delete user logic
  const delUserRegex = /authSession\.removeDetailedUser\(bdNo\);\s*addSyncLog\(\{ timestamp: new Date\(\)\.toISOString\(\), type: "DELETE", status: "SUCCESS", message: `User login access revoked for \${bdNo}` \}\);/s;
  
  const newDelUserLogic = `authSession.removeDetailedUser(bdNo);
             const { supabase } = await import('../supabase');
             if (supabase) {
                await supabase.from('user_profiles').delete().eq('bd_no', bdNo);
             }
             addSyncLog({ timestamp: new Date().toISOString(), type: "DELETE", status: "SUCCESS", message: \`User login access revoked for \${bdNo}\` });`;
             
  if (!content.includes("await supabase.from('user_profiles').delete().eq('bd_no', bdNo);")) {
     content = content.replace(delUserRegex, newDelUserLogic);
  }

  fs.writeFileSync(apiBridgePath, content);
}
