const fs = require('fs');
const authPath = 'src/utils/authSession.ts';

if (fs.existsSync(authPath)) {
  let content = fs.readFileSync(authPath, 'utf8');

  // Insert import at top if needed
  if (!content.includes("import { supabase } from '../supabase';")) {
    content = "import { supabase } from '../supabase';\n" + content;
  }

  // Restore saveDetailedUsers
  const saveDetailedRegex = /\(localDb as any\)\.db\.detailedUsers = users;\s*localDb\.forceSave\(\);\s*\}/;
  const saveDetailedNew = `(localDb as any).db.detailedUsers = users;
    localDb.forceSave();

    // Async sync to Supabase
    (async () => {
      try {
        const supaPayload = users.filter(u => u && u.bdNo).map(u => ({
          bd_no: String(u.bdNo).toLowerCase(),
          airman_id: u.airmanId || null,
          name: u.name || String(u.bdNo),
          rank: u.rank || null,
          flight_name: u.flightName || null,
          trade: u.trade || null,
          role: u.role || 'USER',
          'User Login PIN': (u.password && u.password.trim() !== '') ? Number(u.password) : null,
          'Admin Login PIN': (u.adminPass && u.adminPass.trim() !== '') ? Number(u.adminPass) : null,
          status: u.status || 'ACTIVE',
          detail_order: u.detailOrder || null
        }));
        
        // Upsert users to Supabase
        const { error } = await supabase.from('user_profiles').upsert(supaPayload, { onConflict: 'bd_no' });
        if (error) console.error("Error syncing to Supabase:", error);
      } catch (err) {
        console.error("Supabase async sync failed:", err);
      }
    })();

  }`;
  if (!content.includes("Upsert users to Supabase")) {
    content = content.replace(saveDetailedRegex, saveDetailedNew);
  }

  // Restore removeDetailedUser
  const removeDetailedRegex = /saveDetailedUsers\(filtered\);\s*\}/;
  const removeDetailedNew = `saveDetailedUsers(filtered);
  // Async delete from Supabase
  supabase.from('user_profiles').delete().eq('bd_no', clean).then(({ error }) => {
    if (error) console.error("Error deleting user from Supabase:", error);
  });
}`;
  if (!content.includes("Async delete from Supabase")) {
    content = content.replace(removeDetailedRegex, removeDetailedNew);
  }

  // Find validateUserLogin location and replace manually using index instead of regex to avoid syntax error
  const marker = "export const validateUserLogin = async (";
  const startIdx = content.indexOf(marker);
  
  if (startIdx !== -1 && !content.includes("Check Supabase first")) {
    const nextFunction = content.indexOf("export const setUserSession =", startIdx);
    if (nextFunction !== -1) {
       const validateFuncStr = content.substring(startIdx, nextFunction);
       const searchStr = `  if (!cleanInput) {
    return { success: false, message: 'Please enter your User ID.' };
  }`;
       const replaceStr = searchStr + `

  // Check Supabase first
  try {
    const { data: supaUser, error: supaErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('bd_no', cleanInput)
      .single();
      
    if (supaUser) {
      if (supaUser.status === 'DISABLED') {
        return { success: false, message: 'You are not authorized to access the portal. User ID is disabled. Please contact administrator.' };
      }
      if (supaUser.status === 'SUSPENDED') {
        return { success: false, message: 'You are not authorized to access the portal. User ID is temporarily suspended.' };
      }
      
      const expectedPassword = supaUser['User Login PIN']?.toString() || supaUser.password || supaUser.bd_no;
      if (passwordInput !== expectedPassword) {
         return { success: false, message: 'Invalid User ID or PIN. Please try again.' };
      }
      
      const mappedUser: DetailedUserLogin = {
        id: supaUser.id || \`user-\${supaUser.bd_no}\`,
        airmanId: supaUser.airman_id || 'unknown',
        bdNo: supaUser.bd_no,
        rank: supaUser.rank || '',
        name: supaUser.name,
        flightName: supaUser.flight_name || '',
        trade: supaUser.trade || '',
        role: supaUser.role as UserLoginRole,
        password: expectedPassword,
        status: supaUser.status as UserLoginStatus,
        detailOrder: supaUser.detail_order || '',
        detailedAt: supaUser.created_at || new Date().toISOString(),
        detailedBy: 'Supabase'
      };
      
      let nominalMatch = nominalAirmen.find(a => a.id === supaUser.airman_id || a.bdNo.toLowerCase() === cleanInput);
      
      if (!nominalMatch) {
         nominalMatch = {
           id: supaUser.airman_id || \`airman-\${supaUser.bd_no}\`,
           serNo: 99,
           code: \`\${supaUser.rank || ''}-\${(supaUser.name || '').slice(0, 3).toUpperCase()}\`,
           bdNo: \`BD/\${supaUser.bd_no}\`,
           rank: supaUser.rank as any,
           name: supaUser.name,
           trade: supaUser.trade || 'General',
           addressBlock: '155 UASU',
           mobileNo: '',
           flightName: supaUser.flight_name as any || 'Admin',
           remarks: '',
           active: true,
         };
      }
      
      return { success: true, airman: nominalMatch, detailedUser: mappedUser, message: \`Access granted for \${supaUser.rank} \${supaUser.name}\` };
    }
  } catch(e) {
    console.error("Supabase login check failed, falling back to local DB", e);
  }`;
       
       let newValidateFuncStr = validateFuncStr.replace(searchStr, replaceStr);
       content = content.substring(0, startIdx) + newValidateFuncStr + content.substring(nextFunction);
    }
  }

  fs.writeFileSync(authPath, content);
}
