const fs = require('fs');

const path = 'src/services/presenceService.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');

  // Replace import
  content = content.replace("import { db } from '../firebase';", "import { supabase } from '../supabase';");
  content = content.replace("import { doc, setDoc, onSnapshot, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore';", "");
  
  // Update logUserLogin to use Supabase
  const logUserLoginRegex = /export const logUserLogin = async \([\s\S]*?\};/m;
  const newLogUserLogin = `export const logUserLogin = async (user: Omit<UserPresence, 'lastActive' | 'status' | 'deviceInfo'>) => {
  try {
    const isMobile = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile');
    
    // In Supabase we'd write to a presence table or update user_profiles
    // We'll update the user_profiles status instead since there's no presence table in Supabase schema requested
    if (supabase) {
       await supabase.from('user_profiles').update({ status: 'ACTIVE' }).eq('bd_no', user.bdNo);
    }
    
    // Also save locally
    const existing = JSON.parse(localStorage.getItem('baf_presence') || '[]');
    const newPresence = {
      ...user,
      lastActive: new Date().toISOString(),
      status: 'online',
      deviceInfo: isMobile ? 'Mobile App' : 'Web Portal'
    };
    const updated = [newPresence, ...existing.filter((p: any) => p.bdNo !== user.bdNo)];
    localStorage.setItem('baf_presence', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('baf_presence_updated', { detail: updated }));
  } catch (err) {
    console.error('Failed to log presence:', err);
  }
};`;
  if (!content.includes("await supabase.from('user_profiles').update({ status: 'ACTIVE' })")) {
    content = content.replace(logUserLoginRegex, newLogUserLogin);
  }

  // Update updatePresence
  const updatePresenceRegex = /export const updatePresence = async \([\s\S]*?\};/m;
  const newUpdatePresence = `export const updatePresence = async (bdNo: string, isLogout: boolean = false, activity: string = '') => {
  try {
    if (supabase) {
       if (isLogout) {
          // You could set status offline if we had a column, but 'ACTIVE' is the access status.
          // In this case, we just ignore cloud presence for logout if there's no column.
       }
    }
    const existing = JSON.parse(localStorage.getItem('baf_presence') || '[]');
    const idx = existing.findIndex((p: any) => p.bdNo === bdNo);
    if (idx !== -1) {
      if (isLogout) {
        existing.splice(idx, 1);
      } else {
        existing[idx].lastActive = new Date().toISOString();
        if (activity) existing[idx].currentActivity = activity;
      }
      localStorage.setItem('baf_presence', JSON.stringify(existing));
      window.dispatchEvent(new CustomEvent('baf_presence_updated', { detail: existing }));
    }
  } catch (err) {
    console.error('Failed to update presence:', err);
  }
};`;
  if (!content.includes("export const updatePresence = async (bdNo: string, isLogout: boolean = false")) {
    content = content.replace(updatePresenceRegex, newUpdatePresence);
  }

  // Update subscribeToPresence
  const subscribePresenceRegex = /export const subscribeToPresence = \([\s\S]*?\};/m;
  const newSubscribePresence = `export const subscribeToPresence = (callback: (users: UserPresence[]) => void) => {
  // Use local storage event as fallback
  const handleLocal = (e: any) => callback(e.detail || []);
  window.addEventListener('baf_presence_updated', handleLocal);
  
  // Return initial
  callback(JSON.parse(localStorage.getItem('baf_presence') || '[]'));
  
  return () => {
    window.removeEventListener('baf_presence_updated', handleLocal);
  };
};`;
  if (!content.includes("handleLocal = (e: any) => callback")) {
    content = content.replace(subscribePresenceRegex, newSubscribePresence);
  }

  fs.writeFileSync(path, content);
}
