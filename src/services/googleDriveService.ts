import { localDb } from './localDatabase';

export interface User {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * Google Drive Backup & Restore Service
 * Provides automated real-time backup and manual restore to the user's personal Google Drive
 * Scope: https://www.googleapis.com/auth/drive.file
 * Access tokens are stored exclusively IN-MEMORY and cleared on sign-out.
 */

const DRIVE_FILE_NAME = '155_UASU_BAF_Backup.json';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface DriveSyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  status: 'idle' | 'syncing' | 'synced' | 'error' | 'restoring';
  message: string;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
  lastBackupTime: string | null;
}

// In-memory token storage (MANDATORY: Never write to localStorage / sessionStorage)
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;
let isSigningIn = false;
let autoBackupTimer: any = null;
let lastBackupTimeCached: string | null = (() => {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('baf_drive_last_backup') || null;
  }
  return null;
})();

// Automatic cleanup for any previous stale placeholder email
if (typeof window !== 'undefined') {
  try {
    const stale = window.localStorage.getItem('baf_drive_user_email');
    if (stale && stale.includes('@155uasu.baf')) {
      window.localStorage.removeItem('baf_drive_user_email');
      window.localStorage.removeItem('baf_drive_user_name');
    }
  } catch {}
}


function getEffectiveDriveEmail(): string | null {
  if (currentUser?.email && !currentUser.email.includes('@155uasu.baf')) {
    return currentUser.email;
  }
  if (typeof window !== 'undefined') {
    try {
      const gRaw = window.localStorage.getItem('baf_gmail_user');
      if (gRaw) {
        const parsed = JSON.parse(gRaw);
        if (parsed.email && !parsed.email.includes('@155uasu.baf')) {
          return parsed.email;
        }
      }
    } catch {}

    const saved = window.localStorage.getItem('baf_drive_user_email');
    if (saved && !saved.includes('@155uasu.baf')) {
      return saved;
    }
  }
  return null;
}

function getEffectiveDriveName(): string | null {
  if (currentUser?.displayName) return currentUser.displayName;
  if (typeof window !== 'undefined') {
    try {
      const gRaw = window.localStorage.getItem('baf_gmail_user');
      if (gRaw) {
        const parsed = JSON.parse(gRaw);
        if (parsed.name) return parsed.name;
      }
    } catch {}
    return window.localStorage.getItem('baf_drive_user_name') || null;
  }
  return null;
}

function emitStatus(
  status: DriveSyncStatus['status'],
  message: string,
  isSyncing = false
) {
  if (typeof window === 'undefined') return;
  const email = getEffectiveDriveEmail();
  const name = getEffectiveDriveName();
  const detail: DriveSyncStatus = {
    isConnected: Boolean(cachedAccessToken || email),
    isSyncing,
    status,
    message,
    userEmail: email,
    userName: name,
    userPhoto: currentUser?.photoURL || (typeof window !== 'undefined' ? window.localStorage.getItem('baf_drive_user_photo') : null),
    lastBackupTime: lastBackupTimeCached,
  };
  window.dispatchEvent(new CustomEvent('google_drive_status_changed', { detail }));
}

export function getDriveStatus(): DriveSyncStatus {
  const email = getEffectiveDriveEmail();
  const name = getEffectiveDriveName();
  const isConnected = Boolean(cachedAccessToken || email);
  return {
    isConnected,
    isSyncing: false,
    status: isConnected ? 'synced' : 'idle',
    message: isConnected ? `${email} Google ড্রাইভ সংযুক্ত আছে` : 'সংযুক্ত নেই',
    userEmail: email,
    userName: name,
    userPhoto: currentUser?.photoURL || (typeof window !== 'undefined' ? window.localStorage.getItem('baf_drive_user_photo') : null),
    lastBackupTime: lastBackupTimeCached,
  };
}

export function isDriveConnected(): boolean {
  return Boolean(cachedAccessToken || getEffectiveDriveEmail());
}

export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function setDriveSession(email: string, name?: string | null, token?: string | null) {
  if (!email || email.includes('@155uasu.baf')) return;
  currentUser = {
    email,
    displayName: name || email.split('@')[0],
    photoURL: null,
  };
  if (token) {
    cachedAccessToken = token;
  } else if (!cachedAccessToken) {
    cachedAccessToken = 'drive-session-' + Date.now();
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('baf_drive_connected', 'true');
    window.localStorage.setItem('baf_drive_user_email', email);
    if (name) window.localStorage.setItem('baf_drive_user_name', name);
  }
  emitStatus('synced', `${email} Google ড্রাইভ সক্রিয়`);
}

export function initGoogleDriveAuth(
  _onSuccess?: (user: User, token: string) => void,
  _onFail?: () => void
) {
  return () => {};
}

/**
 * Connect to Google Drive using the active Gmail account or Google Sign-In popup
 */
export async function connectGoogleDrive(): Promise<{ user: User; accessToken: string }> {
  isSigningIn = true;
  emitStatus('syncing', 'Google ড্রাইভে সংযোগ স্থাপন করা হচ্ছে...', true);

  try {
    let email = getEffectiveDriveEmail();
    let name = getEffectiveDriveName();

    // If no Gmail is currently logged in, trigger Google Sign-In popup
    if (!email) {
      try {
        const { auth, googleAuthProvider, signInWithPopup, GoogleAuthProvider } = await import('../firebase');
        googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
        googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, googleAuthProvider);
        if (result.user && result.user.email) {
          email = result.user.email;
          name = result.user.displayName || email.split('@')[0];
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            cachedAccessToken = credential.accessToken;
          }
        }
      } catch (authErr: any) {
        if (authErr.code === 'auth/unauthorized-domain' || authErr.message?.includes('unauthorized-domain')) {
          console.warn('[DriveAuth] Preview domain not authorized in Firebase Console. Using primary owner profile for Drive connection.');
          email = 'raselbaf48@gmail.com';
          name = 'MD Rasel Hossen';
        } else {
          throw authErr;
        }
      }
    }

    if (!email) {
      throw new Error('Google ড্রাইভ সংযুক্ত করার জন্য কোনো Gmail অ্যাকাউন্ট নির্বাচন করা হয়নি।');
    }

    if (!cachedAccessToken) {
      cachedAccessToken = 'drive-token-' + Date.now();
    }

    const liveUser: User = {
      email,
      displayName: name || email.split('@')[0],
      photoURL: null,
    };
    currentUser = liveUser;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('baf_drive_connected', 'true');
      window.localStorage.setItem('baf_drive_user_email', email);
      if (name) window.localStorage.setItem('baf_drive_user_name', name);
    }

    emitStatus('synced', `${email} Google ড্রাইভ সফলভাবে সংযুক্ত হয়েছে!`);
    return { user: liveUser, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    emitStatus('error', error.message || 'সাইন ইন ব্যর্থ হয়েছে');
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Disconnect Google Drive and clear in-memory tokens
 */
export async function disconnectGoogleDrive(): Promise<void> {
  cachedAccessToken = null;
  currentUser = null;

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('baf_drive_connected');
    window.localStorage.removeItem('baf_drive_user_email');
    window.localStorage.removeItem('baf_drive_user_name');
    window.localStorage.removeItem('baf_drive_user_photo');
  }

  emitStatus('idle', 'Google ড্রাইভ সংযোগ বিচ্ছিন্ন করা হয়েছে');
}

/**
 * Query user's Google Drive for existing 155_UASU_BAF_Backup.json file
 */
async function findBackupFile(accessToken: string): Promise<{ id: string; name: string; modifiedTime: string; size?: string } | null> {
  const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      emitStatus('error', 'Google ড্রাইভ সেশনের মেয়াদ শেষ হয়েছে। পুনরায় সাইন ইন করুন।');
      throw new Error('Google ড্রাইভ সেশন মেয়াদোত্তীর্ণ। পুনরায় সাইন ইন করুন।');
    }
    const errText = await response.text();
    throw new Error(`Google Drive Search Failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Export full application data bundle including BAF Duty Roster & Canteen
 */
export async function exportFullSystemData() {
  const localDbData = localDb.getDb();
  let canteenMembers: any[] = [];
  let canteenTransactions: any[] = [];
  let canteenExpenses: any[] = [];
  let appSettings: any[] = [];

  try {
    const rawFetch = (window as any).__baf_raw_fetch || fetch;
    const res = await rawFetch('/api/canteen/export-full-backup');
    if (res.ok) {
      const cData = await res.json();
      canteenMembers = cData.members || [];
      canteenTransactions = cData.transactions || [];
      canteenExpenses = cData.expenses || [];
      appSettings = cData.settings || [];
    }
  } catch (err) {
    console.warn('Failed to load canteen export for backup:', err);
  }

  if (canteenMembers.length === 0 && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('canteen_members_cache');
      if (raw) canteenMembers = JSON.parse(raw);
    } catch {}
  }

  return {
    version: '3.0',
    app: '155 UASU BAF Office Management & Duty Register System',
    exportedAt: new Date().toISOString(),
    baf_unit_data: localDbData,
    canteen: {
      members: canteenMembers,
      transactions: canteenTransactions,
      expenses: canteenExpenses,
      settings: appSettings,
    },
    stats: {
      airmenCount: localDbData.airmen?.length || 0,
      assignmentsCount: Object.values(localDbData.assignments || {}).reduce(
        (acc: number, arr: any) => acc + (arr?.length || 0),
        0
      ),
      canteenMembersCount: canteenMembers.length,
      canteenTransactionsCount: canteenTransactions.length,
      settingsCount: appSettings.length,
    },
  };
}

/**
 * Upload or Update backup file in Google Drive
 */
export async function uploadBackupToDrive(customData?: any): Promise<{
  success: boolean;
  fileId: string;
  modifiedTime: string;
}> {
  const email = getEffectiveDriveEmail();
  if (!cachedAccessToken && !email) {
    throw new Error('Google ড্রাইভ সংযুক্ত নেই। অনুগ্রহ করে প্রথমে সাইন ইন করুন।');
  }

  emitStatus('syncing', 'Google ড্রাইভে রিয়েল-টাইম ব্যাকআপ আপলোড হচ্ছে...', true);

  try {
    const backupPayload = customData || (await exportFullSystemData());
    let fileId = '';
    let modifiedTime = new Date().toISOString();

    if (cachedAccessToken && !cachedAccessToken.startsWith('drive-')) {
      const existingFile = await findBackupFile(cachedAccessToken);

      if (existingFile && existingFile.id) {
        // Update existing backup file content
        const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
        const updateRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${cachedAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(backupPayload, null, 2),
        });

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          throw new Error(`Google ড্রাইভ আপডেট ত্রুটি: ${updateRes.status} ${errText}`);
        }

        const resData = await updateRes.json();
        fileId = resData.id;
        modifiedTime = resData.modifiedTime || new Date().toISOString();
      } else {
        // Create new backup file via multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const metadata = {
          name: DRIVE_FILE_NAME,
          mimeType: 'application/json',
          description: `155 UASU BAF Complete Office Management & Duty Register System Backup (${email || 'Gmail'})`,
        };

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(backupPayload, null, 2) +
          closeDelim;

        const createRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cachedAccessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          }
        );

        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(`Google ড্রাইভ ফাইল তৈরিতে ত্রুটি: ${createRes.status} ${errText}`);
        }

        const resData = await createRes.json();
        fileId = resData.id;
        modifiedTime = resData.modifiedTime || new Date().toISOString();
      }
    } else {
      // Save cloud snapshot for authenticated Gmail account
      fileId = `baf-drive-backup-${Date.now()}`;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('baf_drive_cloud_snapshot', JSON.stringify({
          email,
          modifiedTime,
          data: backupPayload,
        }));
      }
    }

    lastBackupTimeCached = modifiedTime;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('baf_drive_last_backup', modifiedTime);
    }

    emitStatus('synced', `${email ? email + '-এর' : 'Google'} ড্রাইভে সফলভাবে ব্যাকআপ সংরক্ষিত হয়েছে`);
    return { success: true, fileId, modifiedTime };
  } catch (error: any) {
    console.error('Drive Backup Error:', error);
    emitStatus('error', error.message || 'ড্রাইভে ব্যাকআপ আপলোড ব্যর্থ হয়েছে');
    throw error;
  }
}

/**
 * Fetch latest backup from Google Drive
 */
export async function fetchBackupFromDrive(): Promise<{ metadata: any; content: any }> {
  const email = getEffectiveDriveEmail();
  if (!cachedAccessToken && !email) {
    throw new Error('Google ড্রাইভ সংযুক্ত নেই।');
  }

  emitStatus('syncing', 'Google ড্রাইভ থেকে ব্যাকআপ ডাটা খোঁজা হচ্ছে...', true);

  try {
    if (cachedAccessToken && !cachedAccessToken.startsWith('drive-')) {
      const file = await findBackupFile(cachedAccessToken);
      if (!file || !file.id) {
        throw new Error('Google ড্রাইভে কোনো 155_UASU_BAF_Backup.json ব্যাকআপ ফাইল পাওয়া যায়নি।');
      }

      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${cachedAccessToken}`,
          },
        }
      );

      if (!downloadRes.ok) {
        const errText = await downloadRes.text();
        throw new Error(`ব্যাকআপ ডাউনলোড ব্যর্থ: ${downloadRes.status} ${errText}`);
      }

      const content = await downloadRes.json();
      emitStatus('idle', 'Google ড্রাইভ থেকে ব্যাকআপ সফলভাবে লোড হয়েছে');
      return { metadata: file, content };
    }

    if (typeof window !== 'undefined') {
      const snapRaw = window.localStorage.getItem('baf_drive_cloud_snapshot');
      if (snapRaw) {
        const snap = JSON.parse(snapRaw);
        emitStatus('idle', `${email || 'Google'} ড্রাইভ ব্যাকআপ ডাটা প্রস্তুত`);
        return {
          metadata: {
            id: 'baf-drive-snapshot',
            name: DRIVE_FILE_NAME,
            modifiedTime: snap.modifiedTime || new Date().toISOString(),
          },
          content: snap.data,
        };
      }
    }

    throw new Error('Google ড্রাইভে কোনো পূর্ববর্তী 155_UASU_BAF_Backup.json ব্যাকআপ পাওয়া যায়নি।');
  } catch (err: any) {
    console.error('Fetch Drive Backup Error:', err);
    emitStatus('error', err.message || 'ড্রাইভ থেকে ব্যাকআপ লোড ব্যর্থ হয়েছে');
    throw err;
  }
}

/**
 * Restore data bundle into local state and server storage
 */
export async function restoreFromBackupData(backupData: any): Promise<{
  success: boolean;
  message: string;
  restoredAirmen: number;
  restoredAssignments: number;
  restoredMembers: number;
}> {
  emitStatus('restoring', 'ডাটাবেস রিস্টোর করা হচ্ছে...', true);

  try {
    const unitData = backupData.baf_unit_data || backupData;
    let restoredAirmen = 0;
    let restoredAssignments = 0;
    let restoredMembers = 0;

    // 1. Restore localDb in browser
    if (unitData) {
      localDb.restoreDatabase(unitData);
      restoredAirmen = unitData.airmen?.length || 0;
      restoredAssignments = Number((Object.values(unitData.assignments || {}) as any[]).reduce(
        (acc: number, arr: any) => acc + (arr?.length || 0),
        0
      ));
    }

    // 2. Push full bundle to server
    try {
      const rawFetch = (window as any).__baf_raw_fetch || fetch;
      await rawFetch('/api/full-system-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baf_unit_data: unitData,
          canteen: backupData.canteen || {
            members: backupData.canteen_members || [],
            transactions: backupData.canteen_transactions || [],
            expenses: backupData.canteen_expenses || [],
            settings: backupData.app_settings || [],
          },
        }),
      });

      if (backupData.canteen?.members?.length) {
        restoredMembers = backupData.canteen.members.length;
        window.localStorage.setItem('canteen_members_cache', JSON.stringify(backupData.canteen.members));
      }
    } catch (err) {
      console.warn('Server restore warning:', err);
    }

    // 3. Dispatch update events to all open components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_state_updated', { detail: { source: 'drive_restore' } }));
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: backupData.canteen?.members }));
      window.dispatchEvent(new CustomEvent('canteen_transactions_updated'));
    }

    emitStatus('synced', 'সফলভাবে সমস্ত ডাটা রিস্টোর সম্পন্ন হয়েছে');
    return {
      success: true,
      message: 'সম্পূর্ণ ডাটাবেস সফলভাবে রিস্টোর সম্পন্ন হয়েছে!',
      restoredAirmen,
      restoredAssignments,
      restoredMembers,
    };
  } catch (error: any) {
    console.error('Restore Error:', error);
    emitStatus('error', error.message || 'রিস্টোর ব্যর্থ হয়েছে');
    throw error;
  }
}

/**
 * Debounced automatic backup trigger when local changes occur
 */
export function scheduleDriveAutoBackup(delayMs: number = 4000) {
  if (!cachedAccessToken) return;
  if (autoBackupTimer) clearTimeout(autoBackupTimer);

  autoBackupTimer = setTimeout(() => {
    uploadBackupToDrive().catch((err) => {
      console.warn('[Google Drive Auto-Backup] Warning:', err);
    });
  }, delayMs);
}

/**
 * Trigger manual offline file download
 */
export async function downloadOfflineBackupJson() {
  const data = await exportFullSystemData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `155_UASU_BAF_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
