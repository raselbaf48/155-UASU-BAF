import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import {
  db,
  isFirebaseConfigured,
  isFirestoreQuotaExceeded,
  isQuotaExceededError,
  setFirestoreQuotaExceeded,
  CLIENT_SESSION_ID,
} from '../firebase';
import { Rank, FlightName } from '../types';

export interface UserPresence {
  bdNo: string;
  sessionId?: string;
  name: string;
  rank: Rank | string;
  flightName: FlightName | string;
  role?: string;
  lastActive?: string;
  status?: 'online' | 'offline' | string;
  deviceInfo?: string;
  page?: string;
  currentActivity?: string;
}

const PRESENCE_STORAGE_KEY = 'baf_presence';
const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes considered online

const sanitizeDocId = (raw: string): string => {
  const cleaned = String(raw || 'unknown')
    .replace(/^BD\/?/i, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return (cleaned || 'unknown').slice(0, 120);
};

let cachedActiveUsers: UserPresence[] = (() => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
})();

let currentLoggedBdNo: string | null = null;
let lastBroadcastCount: number = -1;
let firestorePresenceUnsub: (() => void) | null = null;
let heartbeatTimer: any = null;
let cleanupTimer: any = null;

function filterRecentlyOnlineUsers(list: UserPresence[]): UserPresence[] {
  const now = Date.now();
  return (list || []).filter((u) => {
    if (!u || !u.bdNo) return false;
    if (u.status === 'offline') return false;
    const t = u.lastActive ? Date.parse(u.lastActive) : 0;
    if (!t || isNaN(t)) return false;
    return now - t <= ACTIVE_WINDOW_MS;
  });
}

function broadcastPresence(list: UserPresence[]) {
  const onlineList = filterRecentlyOnlineUsers(list);
  cachedActiveUsers = onlineList;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(onlineList));
    } catch {}
    window.dispatchEvent(new CustomEvent('baf_presence_updated', { detail: onlineList }));

    const uniqueOnlineCount = new Set(onlineList.map((u) => sanitizeDocId(u.bdNo).toLowerCase())).size;
    if (uniqueOnlineCount !== lastBroadcastCount) {
      lastBroadcastCount = uniqueOnlineCount;
      window.dispatchEvent(
        new CustomEvent('baf_active_users_changed', {
          detail: { count: uniqueOnlineCount, users: onlineList },
        })
      );
    }
  }
}

export function getActiveUsersCount(): number {
  const online = filterRecentlyOnlineUsers(cachedActiveUsers);
  const uniqueIds = new Set(online.map((u) => sanitizeDocId(u.bdNo).toLowerCase()));
  return uniqueIds.size;
}

export function isMultiUserMode(): boolean {
  return getActiveUsersCount() >= 2;
}

function ensurePresenceRealtimeSubscription() {
  if (typeof window === 'undefined') return;
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return;
  if (firestorePresenceUnsub) return;

  try {
    const presenceCol = collection(db, 'presence');
    firestorePresenceUnsub = onSnapshot(
      presenceCol,
      (snapshot) => {
        const cloudUsers: UserPresence[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (d && d.bdNo) {
            cloudUsers.push({
              bdNo: String(d.bdNo),
              sessionId: d.sessionId ? String(d.sessionId) : undefined,
              name: String(d.name || 'User'),
              rank: String(d.rank || ''),
              flightName: String(d.flightName || ''),
              role: d.role ? String(d.role) : 'USER',
              status: d.status === 'offline' ? 'offline' : 'online',
              page: d.page ? String(d.page) : '',
              deviceInfo: d.deviceInfo ? String(d.deviceInfo) : '',
              lastActive: String(d.lastActive || ''),
            });
          }
        });
        broadcastPresence(cloudUsers);
      },
      (err) => {
        if (isQuotaExceededError(err)) {
          setFirestoreQuotaExceeded(true, err?.message || 'Quota exceeded in presence listener');
        }
        stopPresenceRealtimeSubscription();
      }
    );

    if (!cleanupTimer) {
      cleanupTimer = setInterval(() => {
        broadcastPresence(cachedActiveUsers);
      }, 60 * 1000);
    }
  } catch (err) {
    console.warn('[Presence] Snapshot setup warning:', err);
  }
}

export function stopPresenceRealtimeSubscription() {
  if (firestorePresenceUnsub) {
    try {
      firestorePresenceUnsub();
    } catch {}
    firestorePresenceUnsub = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

function startPresenceHeartbeat(bdNo: string) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (currentLoggedBdNo) {
      updatePresence(currentLoggedBdNo, false, '');
    }
  }, 240 * 1000); // lightweight heartbeat every 4 minutes while active
}

export const logUserLogin = async (
  user: Omit<UserPresence, 'lastActive' | 'status' | 'deviceInfo'>
) => {
  try {
    const isMobile = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile');
    const cleanBd = sanitizeDocId(user.bdNo);
    currentLoggedBdNo = cleanBd;
    const nowIso = new Date().toISOString();

    const newPresence: UserPresence = {
      bdNo: cleanBd,
      sessionId: CLIENT_SESSION_ID,
      name: String(user.name || 'User').slice(0, 200),
      rank: String(user.rank || '').slice(0, 64),
      flightName: String(user.flightName || '').slice(0, 64),
      role: String(user.role || 'USER').slice(0, 32),
      lastActive: nowIso,
      status: 'online',
      page: 'Portal',
      deviceInfo: isMobile ? 'Mobile App' : 'Web Portal',
    };

    const existing = filterRecentlyOnlineUsers(cachedActiveUsers);
    const updated = [newPresence, ...existing.filter((p) => sanitizeDocId(p.bdNo) !== cleanBd)];
    broadcastPresence(updated);

    startPresenceHeartbeat(cleanBd);
    ensurePresenceRealtimeSubscription();

    if (isFirebaseConfigured && db && !isFirestoreQuotaExceeded()) {
      try {
        await setDoc(doc(db, 'presence', cleanBd), {
          bdNo: newPresence.bdNo,
          sessionId: CLIENT_SESSION_ID,
          name: newPresence.name,
          rank: newPresence.rank,
          flightName: newPresence.flightName,
          role: newPresence.role,
          status: 'online',
          page: newPresence.page,
          deviceInfo: newPresence.deviceInfo,
          lastActive: nowIso,
        });
      } catch (fbErr) {
        if (isQuotaExceededError(fbErr)) {
          setFirestoreQuotaExceeded(true, (fbErr as any)?.message);
        }
      }
    }
  } catch (err) {
    console.error('Failed to log presence:', err);
  }
};

// Call periodically to keep last active fresh OR on logout / close
export const updatePresence = async (
  bdNo: string,
  isLogout: boolean = false,
  activity: string = ''
) => {
  try {
    const cleanBd = sanitizeDocId(bdNo);
    if (!cleanBd || cleanBd === 'unknown') return;
    const nowIso = new Date().toISOString();

    const existing = [...cachedActiveUsers];
    const idx = existing.findIndex((p) => sanitizeDocId(p.bdNo) === cleanBd);
    let targetRecord: UserPresence | null = idx !== -1 ? { ...existing[idx] } : null;

    if (isLogout) {
      if (idx !== -1) existing.splice(idx, 1);
      if (currentLoggedBdNo === cleanBd) {
        currentLoggedBdNo = null;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      }
      broadcastPresence(existing);
    } else if (targetRecord) {
      targetRecord.lastActive = nowIso;
      targetRecord.status = 'online';
      if (activity) targetRecord.page = String(activity).slice(0, 128);
      existing[idx] = targetRecord;
      broadcastPresence(existing);
    }

    if (isFirebaseConfigured && db && !isFirestoreQuotaExceeded()) {
      try {
        await setDoc(doc(db, 'presence', cleanBd), {
          bdNo: cleanBd,
          sessionId: CLIENT_SESSION_ID,
          name: String(targetRecord?.name || 'User').slice(0, 200),
          rank: String(targetRecord?.rank || '').slice(0, 64),
          flightName: String(targetRecord?.flightName || '').slice(0, 64),
          role: String(targetRecord?.role || 'USER').slice(0, 32),
          status: isLogout ? 'offline' : 'online',
          page: String(activity || targetRecord?.page || 'Portal').slice(0, 128),
          deviceInfo: String(targetRecord?.deviceInfo || 'Web Portal').slice(0, 128),
          lastActive: nowIso,
        });
      } catch (fbErr) {
        if (isQuotaExceededError(fbErr)) {
          setFirestoreQuotaExceeded(true, (fbErr as any)?.message);
        }
      }
    }
  } catch (err) {
    console.error('Failed to update presence:', err);
  }
};

export const subscribeToActiveUsers = (callback: (users: any[]) => void) => {
  const handleLocal = (e: any) => callback(e.detail || []);
  window.addEventListener('baf_presence_updated', handleLocal);

  if (isFirebaseConfigured && db && !isFirestoreQuotaExceeded()) {
    ensurePresenceRealtimeSubscription();
  }

  callback(filterRecentlyOnlineUsers(cachedActiveUsers));

  return () => {
    window.removeEventListener('baf_presence_updated', handleLocal);
  };
};

export const subscribeToLoginHistory = (callback: (logs: any[]) => void) => {
  const getLocalLogs = () => {
    try {
      const raw = localStorage.getItem('baf_user_login_history');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  };

  const handleLocal = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    } else {
      callback(getLocalLogs());
    }
  };

  window.addEventListener('baf_login_history_updated', handleLocal);

  const initialLogs = getLocalLogs();
  callback(initialLogs);

  // Pull from Firestore app_settings/baf_user_login_history
  if (isFirebaseConfigured && db && !isFirestoreQuotaExceeded()) {
    getDoc(doc(db, 'app_settings', 'baf_user_login_history'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          let cloudLogs: any[] = [];
          if (Array.isArray(data?.value)) {
            cloudLogs = data.value;
          } else if (typeof data?.value === 'string') {
            try {
              cloudLogs = JSON.parse(data.value);
            } catch {}
          }
          if (Array.isArray(cloudLogs) && cloudLogs.length > 0) {
            const local = getLocalLogs();
            const map = new Map();
            [...local, ...cloudLogs].forEach((item: any) => {
              if (item && item.id && !map.has(item.id)) {
                map.set(item.id, item);
              }
            });
            const merged = Array.from(map.values())
              .sort((a: any, b: any) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
              })
              .slice(0, 50);
            try {
              localStorage.setItem('baf_user_login_history', JSON.stringify(merged));
            } catch {}
            callback(merged);
          }
        }
      })
      .catch((err) => {
        if (isQuotaExceededError(err)) {
          setFirestoreQuotaExceeded(true, err?.message);
        }
      });
  }

  return () => {
    window.removeEventListener('baf_login_history_updated', handleLocal);
  };
};

if (typeof window !== 'undefined') {
  window.addEventListener('baf_firebase_quota_status', (e: any) => {
    if (e?.detail?.exceeded) {
      stopPresenceRealtimeSubscription();
    } else if (currentLoggedBdNo) {
      ensurePresenceRealtimeSubscription();
    }
  });
}
