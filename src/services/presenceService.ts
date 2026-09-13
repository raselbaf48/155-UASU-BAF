import { supabase } from '../supabase';


// Call this when user logs in
const isQuotaExceeded = () => typeof window !== 'undefined' && window.localStorage.getItem('firebase_quota_exceeded') === new Date().toDateString();

export const logUserLogin = async (user: Omit<UserPresence, 'lastActive' | 'status' | 'deviceInfo'>) => {
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
};

// Call this periodically to update last active OR on logout
export const updatePresence = async (bdNo: string, isLogout: boolean = false, activity: string = '') => {
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
};

export const subscribeToActiveUsers = (callback: (users: any[]) => void) => {
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
