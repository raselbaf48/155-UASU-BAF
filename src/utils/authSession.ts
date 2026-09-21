import { supabase, isSupabaseConfigured } from '../supabase';
import { localDb } from '../services/localDatabase';
import { logUserLogin, updatePresence } from '../services/presenceService';
import { Airman, DetailedUserLogin, UserLoginRole, UserLoginStatus } from '../types';

export interface UserLoginLog {
  id: string;
  bdNo: string;
  rank: string;
  name: string;
  flightName: string;
  timestamp: string;
  timeFormatted: string;
  role?: string;
  deviceInfo: string;
}

export interface UserSession {
  airmanId: string;
  bdNo: string;
  rank: string;
  name: string;
  flightName?: string;
  trade?: string;
  loginTimestamp: string;
  assignedRole?: string;
  systemRole?: string;
  adminPass?: string;
  ownerPass?: string;
}

const SESSION_KEY = 'baf_user_session';
const HISTORY_KEY = 'baf_user_login_history';
const DETAILED_USERS_KEY = 'baf_detailed_user_logins';

// In-memory cache of login history
let cachedLoginHistory: UserLoginLog[] = [];

/**
 * Format timestamp nicely
 */
export const formatLogTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-GB', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

/**
 * Get current active user session (Client device local session)
 */
export const getCurrentUserSession = (): UserSession | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession;
    const cleanBd = (session.bdNo || "").replace(/^BD\/?/i, '').trim();
    if (cleanBd === '48456' && session.assignedRole !== 'OWNER') {
      session.assignedRole = 'OWNER';
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return session;
  } catch {
    return null;
  }
};

/**
 * Get all detailed/authorized login users
 */
const SYSTEM_OWNER: DetailedUserLogin = {
  id: 'user-login-deleted_admin',
  airmanId: 'system-owner',
  bdNo: 'deleted_admin',
  rank: 'Civil',
  name: 'System Owner',
  flightName: 'Admin',
  trade: 'System Admin',
  role: 'SUPER_ADMIN',
  password: '54549919',
  adminPass: '1124',
  ownerPass: '1124',
  status: 'ACTIVE',
  detailOrder: 'SYSTEM_OWNER_01',
  detailedAt: new Date().toISOString(),
  detailedBy: 'System',
  remarks: 'Mobile No: 01760369685',
};

export const getDetailedUsers = (nominalAirmen: Airman[] = []): DetailedUserLogin[] => {
  let parsed: DetailedUserLogin[] = [];
  try {
    const raw = localStorage.getItem(DETAILED_USERS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length > 0) {
        parsed = p.map(u => ({
          ...u,
          status: u.status === 'SUSPENDED' && nominalAirmen.find(a => (a.bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase() === u.bdNo.toLowerCase())?.active !== false ? 'ACTIVE' : u.status
        }));
      }
    }
  } catch (e) {
    console.warn('Failed to parse detailed user logins:', e);
  }

  
  let modified = false;

  // Force remove specific user 53539919 and old System Owner
  const beforeCount = parsed.length;
  parsed = parsed.filter(u => 
    u.bdNo !== '53539919' && 
    u.bdNo !== 'deleted_admin' &&
    !(u.bdNo === '48456' && u.name === 'System Owner' && u.rank === 'Civil')
  );
  if (parsed.length !== beforeCount) {
    modified = true;
  }
  
  // Force 48456 to be OWNER
  const ownerIdx = parsed.findIndex(u => (u.bdNo || "").replace(/^BD\/?/i, '').trim() === '48456');
  if (ownerIdx >= 0) {
    if (parsed[ownerIdx].role !== 'OWNER') {
      parsed[ownerIdx].role = 'OWNER';
      modified = true;
    }
  } else {
    // If 48456 does not exist in detailed users, let's create a placeholder or wait for them to log in.
    parsed.push({
      id: 'user-login-48456',
      airmanId: 'airman-48456',
      bdNo: '48456',
      rank: 'LAC',
      name: 'Rasel',
      flightName: 'Avionics',
      trade: 'E&I Fitt',
      role: 'OWNER',
      password: '48456',
      adminPass: '1124',
      status: 'ACTIVE',
      detailOrder: 'DO-155/ADMIN/01',
      detailedAt: new Date().toISOString(),
      detailedBy: 'System',
      remarks: 'Primary Admin User ID (LAC Rasel)'
    });
    modified = true;
  }
  
  if (modified) {
    try { localStorage.setItem(DETAILED_USERS_KEY, JSON.stringify(parsed)); } catch {}
  }

  // Enforce System Owners
  const enforceOwner = (owner: DetailedUserLogin, bdNo: string, pass: string, adminPass: string) => {
    const idx = parsed.findIndex(u => u.bdNo === bdNo);
    if (idx === -1) {
      parsed.push(owner);
      modified = true;
    } else {
      if (parsed[idx].role !== owner.role) {
        parsed[idx].role = owner.role;
        modified = true;
      }
    }
  };

  // Auto-sync Nominal Roll users into User Management
  if (nominalAirmen && nominalAirmen.length > 0) {
    nominalAirmen.forEach((a) => {
      const cleanBd = (a.bdNo || "").replace(/^BD\/?/i, '').trim();
      const idx = parsed.findIndex(u => u.bdNo.toLowerCase() === cleanBd.toLowerCase());
      
      if (idx === -1) {
        // Create auto profile for nominal roll airman
        const isPrimary = cleanBd === '48456';
        parsed.push({
          id: `user-login-${cleanBd}`,
          airmanId: a.id,
          bdNo: cleanBd,
          rank: a.rank,
          name: a.name,
          mobileNo: a.mobileNo,
          flightName: a.flightName,
          trade: a.trade,
          role: isPrimary ? 'OWNER' : 'USER',
          password: cleanBd,
          adminPass: isPrimary ? '1124' : '',
          status: a.active === false ? 'SUSPENDED' : 'ACTIVE',
          detailOrder: isPrimary ? 'DO-155/ADMIN/01' : 'DO-155/GEN/2026',
          detailedAt: new Date().toISOString(),
          detailedBy: 'System Auto Sync',
          remarks: 'Auto-synced from Nominal Roll',
        });
        modified = true;
      } else {
        let detailModified = false;
        
        // Sync status based on nominal roll activity
        if (!a.active && parsed[idx].status === 'ACTIVE') {
          parsed[idx].status = 'SUSPENDED';
          detailModified = true;
        } else if (a.active && parsed[idx].status === 'SUSPENDED') {
          parsed[idx].status = 'ACTIVE';
          detailModified = true;
        }
        
        if (detailModified) modified = true;
      }
    });
  }

  if (modified) {
    try { localStorage.setItem(DETAILED_USERS_KEY, JSON.stringify(parsed)); } catch {}
  }

  if (parsed.length > 0) {
    return parsed;
  }

  // Fallback single primary user
  const primaryFallback: DetailedUserLogin[] = [
    {
      id: 'user-login-474455',
      bdNo: '48456',
      rank: 'LAC',
      name: 'Rasel',
      flightName: 'Avionics',
      trade: 'E&I Fitt',
      role: 'OWNER',
      password: '48456',
      status: 'ACTIVE',
      detailOrder: 'DO-155/ADMIN/01',
      detailedAt: new Date().toISOString(),
      detailedBy: '155 UASU Unit HQ',
      remarks: 'Primary Admin User ID (LAC Rasel)',
    },
   SYSTEM_OWNER];
  return primaryFallback;
};

/**
 * Save detailed user logins
 */
export const saveDetailedUsers = (users: DetailedUserLogin[]): void => {
  try {
    localStorage.setItem(DETAILED_USERS_KEY, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('baf_detailed_users_changed', { detail: users }));
    
    (localDb as any).db.detailedUsers = users;
    localDb.forceSave();

    // Async sync to Supabase
    (async () => {
      try {
        const supaPayload = users.filter(u => u && u.bdNo).map(u => ({
          'User ID': String(u.bdNo).toLowerCase(),
          airman_id: u.airmanId || null,
          'Name': u.name || String(u.bdNo),
          'Rank': u.rank || null,
          'Flight': u.flightName || null,
          'Trade': u.trade || null,
          'Role': u.role || 'USER',
          'User Login PIN': (u.password && u.password.trim() !== '') ? Number(u.password) : null,
          'Admin Login PIN': (u.adminPass && u.adminPass.trim() !== '') ? Number(u.adminPass) : null,
          'Status': u.status || 'ACTIVE',
          detail_order: u.detailOrder || null
        }));
        
        // Upsert users to Supabase
        if (isSupabaseConfigured) {
          const { error } = await supabase.from('user_profiles').upsert(supaPayload, { onConflict: '"User ID"' });
          if (error) {
            if (error.message?.includes('Failed to fetch') || (error as any)?.details?.includes('Failed to fetch')) {
              console.warn("Supabase sync currently offline or blocked; local changes preserved.");
            } else {
              console.warn("Supabase user sync notice:", error.message || error);
            }
          }
        }
      } catch (err: any) {
        console.warn("Supabase async sync notice:", err?.message || err);
      }
    })();

  } catch (e) {
    console.error('Failed to save detailed user logins:', e);
  }
};

/**
 * Detail an individual airman for user login
 */
export const detailAirmanForLogin = (
  airman: Airman,
  role: UserLoginRole = 'USER',
  status: UserLoginStatus = 'ACTIVE',
  detailOrder: string = '',
  remarks: string = ''
): DetailedUserLogin => {
  const current = getDetailedUsers();
  const cleanBd = (airman.bdNo || "").replace(/^BD\/?/i, '').trim();

  const existingIndex = current.findIndex(
    (u) => u.bdNo.toLowerCase() === cleanBd.toLowerCase() || (u.airmanId && u.airmanId === airman.id)
  );

  const newEntry: DetailedUserLogin = {
    id: existingIndex >= 0 ? current[existingIndex].id : `user-login-${cleanBd}-${Date.now()}`,
    airmanId: airman.id,
    bdNo: cleanBd,
    rank: airman.rank,
    name: airman.name,
    flightName: airman.flightName,
    trade: airman.trade,
    role,
    status,
    detailOrder: detailOrder.trim() || `DO-155/DTL/${cleanBd}`,
    detailedAt: new Date().toISOString(),
    detailedBy: '155 UASU Admin',
    remarks: remarks.trim() || `Detailed from Nominal Roll (${airman.rank} ${airman.name})`,
    lastLoginAt: existingIndex >= 0 ? current[existingIndex].lastLoginAt : undefined,
  };

  if (existingIndex >= 0) {
    current[existingIndex] = newEntry;
  } else {
    current.unshift(newEntry);
  }

  saveDetailedUsers(current);
  return newEntry;
};

/**
 * Batch detail all airmen from nominal roll
 */
export const batchDetailAllAirmen = (airmen: Airman[]): DetailedUserLogin[] => {
  const current = getDetailedUsers();
  const updatedList: DetailedUserLogin[] = [...current];

  airmen.forEach((airman) => {
    const cleanBd = (airman.bdNo || "").replace(/^BD\/?/i, '').trim();
    const idx = updatedList.findIndex((u) => u.bdNo.toLowerCase() === cleanBd.toLowerCase());
    const isPrimary = cleanBd === '48456';

    const entry: DetailedUserLogin = {
      id: idx >= 0 ? updatedList[idx].id : `user-login-${cleanBd}`,
      airmanId: airman.id,
      bdNo: cleanBd,
      rank: airman.rank,
      name: airman.name,
      flightName: airman.flightName,
      trade: airman.trade,
      role: idx >= 0 ? updatedList[idx].role : (isPrimary ? 'OWNER' : 'USER'),
      password: idx >= 0 && updatedList[idx].password ? updatedList[idx].password : cleanBd,
      status: idx >= 0 ? updatedList[idx].status : 'ACTIVE',
      detailOrder: idx >= 0 && updatedList[idx].detailOrder ? updatedList[idx].detailOrder : `DO-155/NR/${cleanBd}`,
      detailedAt: idx >= 0 ? updatedList[idx].detailedAt : new Date().toISOString(),
      detailedBy: '155 UASU HQ Batch Detail',
      remarks: idx >= 0 && updatedList[idx].remarks ? updatedList[idx].remarks : `Detailed from Nominal Roll (${airman.flightName} Flight)`,
      lastLoginAt: idx >= 0 ? updatedList[idx].lastLoginAt : undefined,
    };

    if (idx >= 0) {
      updatedList[idx] = entry;
    } else {
      updatedList.push(entry);
    }
  });

  saveDetailedUsers(updatedList);
  return updatedList;
};

/**
 * Remove or Revoke login access for a BD number
 */
export const removeDetailedUser = (bdNo: string): void => {
  const clean = (bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase();
  const current = getDetailedUsers();
  const filtered = current.filter((u) => u.bdNo.toLowerCase() !== clean);
  saveDetailedUsers(filtered);
  // Async delete from Supabase
  if (isSupabaseConfigured) {
    supabase.from('user_profiles').delete().eq('User ID', clean).then(({ error }) => {
      if (error) console.error("Error deleting user from Supabase:", error);
    });
  }
};

/**
 * Toggle active / suspended / disabled status
 */
export const toggleUserLoginStatus = (bdNo: string, newStatus: UserLoginStatus): DetailedUserLogin | null => {
  const clean = (bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase();
  const current = getDetailedUsers();
  const idx = current.findIndex((u) => u.bdNo.toLowerCase() === clean);
  if (idx === -1) return null;

  current[idx].status = newStatus;
  saveDetailedUsers(current);
  return current[idx];
};

/**
 * Validate User Login Attempt
 */
export const validateUserLogin = async (
  bdInput: string,
  passwordInput: string,
  nominalAirmen: Airman[]
): Promise<{ success: boolean; airman?: Airman; detailedUser?: DetailedUserLogin; message: string }> => {
  const cleanInput = (bdInput || "").trim().replace(/^BD\/?/i, '').replace(/\s+/g, '').toLowerCase();

  if (!cleanInput) {
    return { success: false, message: 'Please enter your User ID.' };
  }

  // 1. Instant Local Verification (Zero latency check)
  const detailedList = getDetailedUsers(nominalAirmen);
  const matchedDetail = detailedList.find((u) => u.bdNo.toLowerCase() === cleanInput);

  if (matchedDetail) {
    const expectedPassword = matchedDetail.password || matchedDetail.bdNo;
    if (passwordInput.trim() === expectedPassword?.toString().trim()) {
      if (matchedDetail.status === 'DISABLED') {
        return {
          success: false,
          message: 'You are not authorized to access the portal. User ID is disabled. Please contact administrator.',
        };
      }
      if (matchedDetail.status === 'SUSPENDED') {
        return {
          success: false,
          message: 'You are not authorized to access the portal. User ID is temporarily suspended.',
        };
      }

      // Find corresponding airman or construct one
      let airman = nominalAirmen.find(
        (a) => (a.bdNo || "").trim().replace(/^BD\/?/i, '').toLowerCase() === cleanInput || a.id === matchedDetail.airmanId
      );

      if (!airman) {
        airman = {
          id: (matchedDetail.airmanId && matchedDetail.airmanId !== "airman-undefined") ? matchedDetail.airmanId : `airman-${matchedDetail.bdNo && matchedDetail.bdNo !== "undefined" ? matchedDetail.bdNo : Math.random().toString(36).slice(2, 10)}`,
          serNo: 99,
          code: `${matchedDetail.rank}-${matchedDetail.name.slice(0, 3).toUpperCase()}`,
          bdNo: `BD/${matchedDetail.bdNo}`,
          rank: matchedDetail.rank as any,
          name: matchedDetail.name,
          trade: matchedDetail.trade || 'General',
          addressBlock: '155 UASU',
          mobileNo: '',
          flightName: (matchedDetail.flightName as any) || 'Admin',
          remarks: matchedDetail.remarks || '',
          active: true,
        };
      }

      // Update lastLoginAt
      matchedDetail.lastLoginAt = new Date().toISOString();
      saveDetailedUsers(detailedList);

      // Non-blocking background sync with Supabase
      if (isSupabaseConfigured) {
        (async () => {
          try {
            await supabase
              .from('user_profiles')
              .update({ last_login_at: new Date().toISOString() })
              .eq('User ID', cleanInput);
          } catch (e) {
            // silent catch
          }
        })();
      }

      return {
        success: true,
        airman,
        detailedUser: matchedDetail,
        message: `Access granted for ${matchedDetail.rank} ${matchedDetail.name}`,
      };
    }
  }

  // 2. Cloud Fallback (if local check failed or PIN was updated on another device)
  try {
    if (isSupabaseConfigured) {
      const fetchPromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('User ID', cleanInput)
        .single();
        
      // Max 1.2s timeout so the UI never hangs
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 1200)
      );

      const { data: supaUser, error: supaErr } = await Promise.race([fetchPromise, timeoutPromise]);
        
      if (supaUser) {
        if (supaUser['Status'] === 'DISABLED') {
          return { success: false, message: 'You are not authorized to access the portal. User ID is disabled. Please contact administrator.' };
        }
        if (supaUser['Status'] === 'SUSPENDED') {
          return { success: false, message: 'You are not authorized to access the portal. User ID is temporarily suspended.' };
        }
        
        const expectedPassword = supaUser['User Login PIN']?.toString() || supaUser.password || supaUser['User ID'];
        if (passwordInput.trim() !== expectedPassword?.toString().trim()) {
           return { success: false, message: `Invalid User ID or PIN.` };
        }
        
        const mappedUser: DetailedUserLogin = {
          id: supaUser.id || `user-${supaUser['User ID']}`,
          airmanId: supaUser.airman_id || 'unknown',
          bdNo: supaUser['User ID'],
          rank: supaUser['Rank'] || '',
          name: supaUser['Name'] || '',
          flightName: supaUser['Flight'] || '',
          trade: supaUser['Trade'] || '',
          role: supaUser['Role'] as UserLoginRole,
          password: expectedPassword,
          status: supaUser['Status'] as UserLoginStatus,
          detailOrder: supaUser.detail_order || '',
          detailedAt: supaUser.created_at || new Date().toISOString(),
          detailedBy: 'Supabase'
        };
        
        let nominalMatch = nominalAirmen.find(a => a.id === supaUser.airman_id || a.bdNo.toLowerCase() === cleanInput);
        
        if (!nominalMatch) {
           nominalMatch = {
             id: (supaUser.airman_id && supaUser.airman_id !== "airman-undefined") ? supaUser.airman_id : `airman-${supaUser['User ID'] && supaUser['User ID'] !== "undefined" ? supaUser['User ID'] : Math.random().toString(36).slice(2, 10)}`,
             serNo: 99,
             code: `${supaUser['Rank'] || ''}-${(supaUser['Name'] || '').slice(0, 3).toUpperCase()}`,
             bdNo: `BD/${supaUser['User ID']}`,
             rank: supaUser['Rank'] as any,
             name: supaUser['Name'] || '',
             trade: supaUser['Trade'] || 'General',
             addressBlock: '155 UASU',
             mobileNo: '',
             flightName: supaUser['Flight'] as any || 'Admin',
             remarks: '',
             active: true,
           };
        }
        
        return { success: true, airman: nominalMatch, detailedUser: mappedUser, message: `Access granted for ${supaUser['Rank']} ${supaUser['Name']}` };
      }
    }
  } catch(e) {
    console.error("Supabase login check failed, falling back to local DB", e);
  }

  // If user was registered in detailed users but credentials failed local and cloud checks
  if (matchedDetail) {
    return { success: false, message: 'Invalid User ID or PIN.' };
  }

  // 2. If not explicitly in detailed list, check nominal roll
  const matchedAirman = nominalAirmen.find((a) => {
    const airmanBd = (a.bdNo || "").trim().replace(/^BD\/?/i, '').replace(/\s+/g, '').toLowerCase();
    return airmanBd === cleanInput;
  });

  if (matchedAirman) {
    // For auto-detailed airman, password is their BD No
    const expectedPassword = (matchedAirman.bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase();
    if (passwordInput.trim().toLowerCase() !== expectedPassword) {
      return { success: false, message: `Invalid User ID or PIN.` };
    }
    // Auto-detail this airman and allow login
    const isPrimary = cleanInput === '48456';
    const newDetail = detailAirmanForLogin(
      matchedAirman,
      isPrimary ? 'OWNER' : 'USER',
      'ACTIVE',
      `DO-155/AUTO/${matchedAirman.bdNo}`,
      'Automatic Detail on Nominal Match'
    );

    return {
      success: true,
      airman: matchedAirman,
      detailedUser: newDetail,
      message: `Welcome, ${matchedAirman.rank} ${matchedAirman.name}`,
    };
  }

  return {
    success: false,
    message: 'You are not authorized to access the portal. User ID error, please enter correct User ID.',
  };
};

/**
 * Record a user login and save session
 */
export const setUserSession = (airman: Airman, assignedRole: UserLoginRole = 'USER', detailedUser?: DetailedUserLogin): UserSession => {
  const cleanBd = (airman.bdNo || "").replace(/^BD\/?/i, '').trim();
  const session: UserSession = {
    airmanId: airman.id,
    bdNo: cleanBd,
    rank: airman.rank,
    name: airman.name,
    flightName: airman.flightName,
    trade: airman.trade,
    loginTimestamp: new Date().toISOString(),
    assignedRole: assignedRole,
    systemRole: detailedUser?.role || (cleanBd === '48456' ? 'OWNER' : 'USER'),
    adminPass: detailedUser?.adminPass || (cleanBd === '48456' ? '1124' : undefined),
    ownerPass: detailedUser?.ownerPass
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save user session:', e);
  }

  // Record into history log in local storage & D1
  recordLoginLog(airman, assignedRole);
  // Realtime Presence Sync
  logUserLogin({
    bdNo: (airman.bdNo || "").replace(/^BD\/?/i, '').trim(),
    name: airman.name,
    rank: airman.rank,
    flightName: airman.flightName,
    role: assignedRole
  });

  // Dispatch event
  window.dispatchEvent(new CustomEvent('baf_user_session_changed', { detail: session }));

  return session;
};

/**
 * Clear user session (Logout)
 */
export const clearUserSession = (): void => {
  try {
    
    const session = getCurrentUserSession();
    if (session) {
      updatePresence(session.bdNo, true, ''); // logout
    }
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('baf_user_role');
  } catch (e) {
    console.error('Failed to clear user session:', e);
  }
  window.dispatchEvent(new CustomEvent('baf_user_session_changed', { detail: null }));
};

/**
 * Retrieve all login history entries
 */
export const getLoginHistory = (): UserLoginLog[] => {
  if (cachedLoginHistory.length > 0) {
    return cachedLoginHistory;
  }
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      cachedLoginHistory = JSON.parse(raw) as UserLoginLog[];
      return cachedLoginHistory;
    }
  } catch {
    // fallback
  }
  return [];
};

/**
 * Add a record to login history
 */
export const recordLoginLog = async (airman: Airman, role: string = 'USER'): Promise<void> => {
  try {
    const nowIso = new Date().toISOString();
    const cleanBd = (airman.bdNo || "").replace(/^BD\/?/i, '').trim();
    const newLog: UserLoginLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bdNo: `BD/${cleanBd}`,
      rank: airman.rank,
      name: airman.name,
      flightName: airman.flightName,
      role: role || 'USER',
      timestamp: nowIso,
      timeFormatted: formatLogTime(nowIso),
      deviceInfo: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop / Web Workstation',
    };

    // Update in-memory & local cache immediately
    const existing = getLoginHistory();
    cachedLoginHistory = [newLog, ...existing.filter(item => item.id !== newLog.id)];
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(cachedLoginHistory));
    } catch {}

    // Dispatch event so active listeners update immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_login_history_updated', { detail: cachedLoginHistory }));
    }

    // Sync to Supabase app_settings if configured
    if (isSupabaseConfigured) {
      localDb.syncSettingToCloud('baf_user_login_history', JSON.stringify(cachedLoginHistory.slice(0, 100))).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to record login log:', e);
  }
};

/**
 * Clear all login logs
 */
export const clearLoginHistory = async (): Promise<void> => {
  cachedLoginHistory = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_login_history_updated', { detail: [] }));
    }
    if (isSupabaseConfigured) {
      localDb.syncSettingToCloud('baf_user_login_history', JSON.stringify([])).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to clear login history locally:', e);
  }
};



/**
 * Change a user's password
 */
export const changeUserPassword = (bdNo: string, currentPass: string, newPass: string, isSuperAdmin: boolean = false): { success: boolean; message: string } => {
  const clean = (bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase();
  const current = getDetailedUsers();
  const idx = current.findIndex((u) => u.bdNo.toLowerCase() === clean);
  
  if (idx === -1) {
    return { success: false, message: 'User not found in system.' };
  }

  const expectedPass = current[idx].password || current[idx].bdNo;
  
  if (!isSuperAdmin && currentPass !== expectedPass) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  current[idx].password = newPass;
  saveDetailedUsers(current);
  return { success: true, message: 'PIN updated successfully.' };
};

/**
 * Change a user's role
 */
export const changeAdminPassword = (bdNo: string, currentPass: string, newPass: string, isSuperAdmin: boolean = false): { success: boolean; message: string } => {
  const clean = (bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase();
  const current = getDetailedUsers();
  const idx = current.findIndex((u) => u.bdNo.toLowerCase() === clean);
  
  if (idx === -1) {
    return { success: false, message: 'User not found in system.' };
  }

  const expectedPass = current[idx].adminPass || (clean === '48456' ? '1124' : '');
  
  if (!isSuperAdmin && currentPass !== expectedPass) {
    return { success: false, message: 'Current admin password is incorrect.' };
  }

  current[idx].adminPass = newPass;
  saveDetailedUsers(current);
  return { success: true, message: 'Admin PIN updated successfully.' };
};

export const changeUserRole = (bdNo: string, newRole: UserLoginRole): DetailedUserLogin | null => {
  const clean = (bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase();
  const current = getDetailedUsers();
  const idx = current.findIndex((u) => u.bdNo.toLowerCase() === clean);
  
  if (idx === -1) return null;

  current[idx].role = newRole;
  saveDetailedUsers(current);
  return current[idx];
};


export const updateUserDetails = (bdNo: string, updates: { name?: string, rank?: string, flightName?: string, mobileNo?: string }): DetailedUserLogin | null => {
  const clean = (bdNo || "").replace(/^BD\/?/i, '').trim().toLowerCase();
  const current = getDetailedUsers();
  const idx = current.findIndex((u) => u.bdNo.toLowerCase() === clean);
  
  if (idx === -1) return null;

  if (updates.name !== undefined) current[idx].name = updates.name;
  if (updates.rank !== undefined) current[idx].rank = updates.rank;
  if (updates.flightName !== undefined) current[idx].flightName = updates.flightName;
  if (updates.mobileNo !== undefined) current[idx].mobileNo = updates.mobileNo;
  
  saveDetailedUsers(current);
  return current[idx];
};
