const fs = require('fs');
let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

// Injection 1: Settings Pull
const pullInjectionPoint = `         newDb.detailedUsers = parsedUsers;
         dataChanged = true;
      }`;

const settingsPullStr = `         newDb.detailedUsers = parsedUsers;
         dataChanged = true;
      }
      
      // 5. Pull App Settings
      let settingsData, settingsErr;
      try {
         settingsData = await fetchAll('app_settings');
      } catch(e) { settingsErr = e; }
      
      if (!settingsErr && settingsData && settingsData.length > 0) {
         if (typeof window !== 'undefined') {
            let settingsChanged = false;
            settingsData.forEach((row: any) => {
               if (row.setting_key && row.setting_value) {
                  const currentVal = window.localStorage.getItem(row.setting_key);
                  if (currentVal !== row.setting_value) {
                     window.localStorage.setItem(row.setting_key, row.setting_value);
                     settingsChanged = true;
                  }
               }
            });
            if (settingsChanged) {
               window.dispatchEvent(new CustomEvent('baf_settings_updated'));
            }
         }
      }`;

content = content.replace(pullInjectionPoint, settingsPullStr);

// Injection 2: Settings Push
const pushInjectionPoint = `        if (hasError) {
           emitSyncProgress(0, "Sync Failed!");`;

const settingsPushStr = `        // 5. Sync Settings / Configurations
        const settingsPayload: any[] = [];
        const SETTING_PREFIXES = ['baf_', 'savedDisposalKeys', 'parade_historical', 'flg_wg_'];
        const IGNORED_KEYS = ['baf_database_v2', 'baf_sync_logs', 'baf_pending_sync', 'baf_presence', 'baf_user_login_history', 'baf_recent_logins', 'baf_theme_pref', 'baf_last_used_id', 'baf_dismissed_notice_sig', 'baf_cleared_notices_v4'];
        
        if (typeof window !== 'undefined') {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (!key) continue;
            
            if (IGNORED_KEYS.includes(key)) continue;
            
            const isMatch = SETTING_PREFIXES.some(prefix => key.startsWith(prefix));
            
            if (isMatch) {
              const val = window.localStorage.getItem(key);
              if (val) {
                settingsPayload.push({
                  setting_key: key,
                  setting_value: val,
                  updated_at: new Date().toISOString()
                });
              }
            }
          }
        }

        if (settingsPayload.length > 0) {
           const { error: settingsErr } = await supabase.from('app_settings').upsert(settingsPayload, { onConflict: 'setting_key' });
           if (settingsErr) {
              console.warn("Could not sync settings. (app_settings table might not exist yet)", settingsErr);
           }
        }

        if (hasError) {
           emitSyncProgress(0, "Sync Failed!");`;

content = content.replace(pushInjectionPoint, settingsPushStr);

fs.writeFileSync('src/services/localDatabase.ts', content);
