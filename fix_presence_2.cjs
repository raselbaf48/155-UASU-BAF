const fs = require('fs');
const path = 'src/services/presenceService.ts';
let content = fs.readFileSync(path, 'utf8');

const activeUsersRegex = /export const subscribeToActiveUsers = \([\s\S]*?\};\n/m;
const newActiveUsers = `export const subscribeToActiveUsers = (callback: (users: any[]) => void) => {
  // We'll use local presence array for active users.
  // Real-time Supabase presence could be added using channels if needed.
  const handleLocal = (e: any) => callback(e.detail || []);
  window.addEventListener('baf_presence_updated', handleLocal);
  
  callback(JSON.parse(localStorage.getItem('baf_presence') || '[]'));
  
  return () => {
    window.removeEventListener('baf_presence_updated', handleLocal);
  };
};
`;

content = content.replace(activeUsersRegex, newActiveUsers);

const loginHistoryRegex = /export const subscribeToLoginHistory = \([\s\S]*?\};\n/m;
const newLoginHistory = `export const subscribeToLoginHistory = (callback: (logs: any[]) => void) => {
  // Use local history as fallback
  const handleLocal = (e: any) => callback(e.detail || []);
  window.addEventListener('baf_login_history_updated', handleLocal);
  
  callback(JSON.parse(localStorage.getItem('baf_user_login_history') || '[]'));
  
  // Also try to fetch from Supabase if we have a table
  if (supabase) {
    supabase.from('parade_states').select('*').eq('type', 'SYSTEM').order('created_at', { ascending: false }).limit(100).then(({ data, error }) => {
      if (!error && data) {
         callback(data);
      }
    });
  }
  
  return () => {
    window.removeEventListener('baf_login_history_updated', handleLocal);
  };
};
`;

content = content.replace(loginHistoryRegex, newLoginHistory);

fs.writeFileSync(path, content);
