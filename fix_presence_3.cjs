const fs = require('fs');
const path = 'src/services/presenceService.ts';
let content = fs.readFileSync(path, 'utf8');

const marker = "export const subscribeToActiveUsers";
const idx = content.indexOf(marker);

if (idx !== -1) {
  content = content.substring(0, idx) + `export const subscribeToActiveUsers = (callback: (users: any[]) => void) => {
  const handleLocal = (e: any) => callback(e.detail || []);
  window.addEventListener('baf_presence_updated', handleLocal);
  
  callback(JSON.parse(localStorage.getItem('baf_presence') || '[]'));
  
  return () => {
    window.removeEventListener('baf_presence_updated', handleLocal);
  };
};

export const subscribeToLoginHistory = (callback: (logs: any[]) => void) => {
  const handleLocal = (e: any) => callback(e.detail || []);
  window.addEventListener('baf_login_history_updated', handleLocal);
  
  callback(JSON.parse(localStorage.getItem('baf_user_login_history') || '[]'));
  
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
}

fs.writeFileSync(path, content);
