const fs = require('fs');
let code = fs.readFileSync('src/services/apiBridge.ts', 'utf8');

code = code.replace(/              const \{ supabase \} = await import\('\.\.\/supabase'\);\n              if \(supabase\) \{\n                 await supabase\.from\('duty_rosters'\)\.delete\(\)\.eq\('airman_id', id\);\n                 await supabase\.from\('staff'\)\.delete\(\)\.eq\('airman_id', id\);\n                 if \(target && target\.bdNo\) \{\n                    await supabase\.from\('user_profiles'\)\.delete\(\)\.eq\('bd_no', target\.bdNo\);\n                 \}\n              \}\n/g, '');

code = code.replace(/             const \{ supabase \} = await import\('\.\.\/supabase'\);\n             if \(supabase\) \{\n                await supabase\.from\('user_profiles'\)\.delete\(\)\.eq\('bd_no', bdNo\);\n             \}\n/g, '');

fs.writeFileSync('src/services/apiBridge.ts', code);
