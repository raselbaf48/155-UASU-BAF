import {
  Airman,
  DutyAssignment,
  FlightName,
  ParadeShift,
  ActivityHistoryItem,
  DutyCategoryCode,
  IDAShift,
  ImportHistoryBatch,
  ParadeStateResponse,
  AirmanDutyStats,
  ConflictAlert,
} from '../types';
import { INITIAL_AIRMEN } from '../data/initialAirmen';
import { DUTY_TYPES } from '../data/dutyTypes';
import { generateOfficialMonthAssignments, getOfficialParadeStateDocument } from '../data/officialJulyAugustData';
import { calculateDutyStats, detectConflicts, getDaysInMonth } from '../data/rosterGenerator';
import { DutyRatioTable, INITIAL_OFFICIAL_DUTY_MATRIX, getStoredDutyMatrix, saveDutyMatrix } from '../data/officialDutyRatioMatrix';
import { findBestAirmanMatch as matchAirmanRankFirst, parseRosterTextHeuristically } from '../utils/airmanMatcher';
import { sortAirmenBySeniority, normalizeAirmenSeniority, reorderAirmanSeniority } from '../utils/seniority';
import {
  isFirebaseConfigured,
  isFirestoreQuotaExceeded,
  isQuotaExceededError,
  getQuotaConsoleUpgradeUrl,
  CLIENT_SESSION_ID,
} from '../firebase';
import {
  fetchAirmenFromFirebase,
  pushAirmenToFirebase,
  fetchDutyAssignmentsFromFirebase,
  pushDutyAssignmentsToFirebase,
  softDeleteDutyAssignmentsInFirebase,
  fetchParadeStatesFromFirebase,
  pushParadeStatesToFirebase,
  fetchUserProfilesFromFirebase,
  pushUserProfilesToFirebase,
  fetchAppSettingsFromFirebase,
  fetchAppSettingsWithMetaFromFirebase,
  pushAppSettingsToFirebase,
  pushCanteenMembersToFirebase,
  executeFullMigrationToFirebase,
  publishSyncManifest,
  subscribeToSyncManifest,
  probeFirebaseConnectionAndQuota,
  getAssignmentDocId,
  getAirmanDocId,
  getPendingDeltaQueue,
  recordPendingDeltas,
  clearPendingDeltas,
  hasPendingDeltas,
  sanitizeDocId,
  FirebaseMigrationResult
} from './firebaseFirestoreService';
import { getActiveUsersCount, isMultiUserMode } from './presenceService';
import { scheduleDriveAutoBackup } from './googleDriveService';
import { getCustomDutyName, getCustomDuties } from '../utils/customDuties';

export interface LocalStorageDB {
  airmen: Airman[];
  assignments: Record<string, DutyAssignment[]>; // monthKey YYYY-MM -> DutyAssignment[]
  activityHistory: ActivityHistoryItem[];
  adminPasscode: string;
  detailedUsers?: any[];
  importHistory: ImportHistoryBatch[];
  lastUpdated: string;
}


export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'PULL' | 'PUSH' | 'MANUAL';
  status: 'SUCCESS' | 'ERROR';
  message: string;
}
export interface FirebaseSyncStatusState {
  isConfigured: boolean;
  status: 'idle' | 'syncing' | 'connected' | 'error' | 'unconfigured';
  lastSyncTime: string | null;
  d1Active: boolean;
}

let isSyncingActive: boolean = false;
const lastSyncedSettingsMap = new Map<string, string>();
let lastSyncedMatrixRaw: string = '';
let firebaseConnected: boolean = (() => {
  if (isFirebaseConfigured) return true;
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('baf_cloud_connected') === 'true';
  }
  return false;
})();
let firebaseLastSyncTime: string | null = (() => {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('baf_cloud_last_sync') || null;
  }
  return null;
})();
const SYNC_LOGS_KEY = "baf_firebase_sync_logs_v1";
const LOCAL_CLOUD_LOGS_KEY = "baf_local_cloud_sync_logs_v1";

let syncLogs: SyncLog[] = (() => {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(SYNC_LOGS_KEY) ||
      window.sessionStorage.getItem("baf_sync_logs") ||
      window.localStorage.getItem("baf_sync_logs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
})();

let localCloudSyncLogs: SyncLog[] = (() => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CLOUD_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
})();

export const getSyncLogs = () => syncLogs;

export const getLocalCloudSyncLogs = () => localCloudSyncLogs;

export const clearSyncLogs = () => {
  syncLogs = [];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SYNC_LOGS_KEY);
      window.sessionStorage.removeItem("baf_sync_logs");
      window.localStorage.removeItem("baf_sync_logs");
    } catch {}
    window.dispatchEvent(new CustomEvent("baf_sync_logs_updated", { detail: syncLogs }));
  }
};

export const clearLocalCloudSyncLogs = () => {
  localCloudSyncLogs = [];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LOCAL_CLOUD_LOGS_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent("baf_local_cloud_logs_updated", { detail: localCloudSyncLogs }));
  }
};

export const emitSyncProgress = (percentage: number, message: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('baf_sync_progress', { detail: { percentage, message } }));
  }
};

export const addSyncLog = (log: Omit<SyncLog, "id">) => {
  const newLog = { ...log, id: "sync-" + Date.now() + Math.random().toString(36).slice(2, 6) };
  syncLogs = [newLog, ...syncLogs].slice(0, 40);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(syncLogs));
      window.sessionStorage.setItem("baf_sync_logs", JSON.stringify(syncLogs));
    } catch {
      // Ignore storage quota errors
    }
    window.dispatchEvent(new CustomEvent("baf_sync_logs_updated", { detail: syncLogs }));
  }
};

export const addLocalCloudSyncLog = (log: Omit<SyncLog, "id">) => {
  const newLog = { ...log, id: "local-sync-" + Date.now() + Math.random().toString(36).slice(2, 6) };
  localCloudSyncLogs = [newLog, ...localCloudSyncLogs].slice(0, 40);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_CLOUD_LOGS_KEY, JSON.stringify(localCloudSyncLogs));
    } catch {
      // Ignore storage quota errors
    }
    window.dispatchEvent(new CustomEvent("baf_local_cloud_logs_updated", { detail: localCloudSyncLogs }));
  }
};


export const getFirebaseSyncState = (): FirebaseSyncStatusState => {
  const configured = Boolean(isFirebaseConfigured);
  let status: 'idle' | 'syncing' | 'connected' | 'error' | 'unconfigured' = 'idle';
  if (!configured) {
    status = 'unconfigured';
  } else if (isSyncingActive) {
    status = 'syncing';
  } else if (firebaseConnected) {
    status = 'connected';
  } else {
    status = 'connected';
  }

  return {
    isConfigured: configured,
    status,
    lastSyncTime: firebaseLastSyncTime,
    d1Active: configured || firebaseConnected,
  };
};

export function broadcastSyncState(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('d1_sync_update', {
        detail: getFirebaseSyncState(),
      })
    );
  }
}

const STORAGE_KEY = 'baf_155_uasu_v2_db';
const DEFAULT_ADMIN_PASSCODE = '1124';

function getDatesInRange(fromDateStr: string, toDateStr: string): string[] {
  const dates: string[] = [];
  const [fY, fM, fD] = fromDateStr.split('-').map(Number);
  const [tY, tM, tD] = toDateStr.split('-').map(Number);

  if (!fY || !fM || !fD || !tY || !tM || !tD) return dates;

  const current = new Date(Date.UTC(fY, fM - 1, fD));
  const end = new Date(Date.UTC(tY, tM - 1, tD));

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function getYesterdayDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const SINGLE_USER_BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MULTI_USER_BACKUP_INTERVAL_MS = 10 * 1000; // 10 seconds
const LAST_FIREBASE_PULL_KEY = 'baf_last_firebase_pull_at';
const SETTING_PREFIXES = ['baf_', 'savedDisposalKeys', 'parade_historical', 'flg_wg_'];
const IGNORED_SETTING_KEYS = new Set<string>([
  'baf_155_uasu_v2_db',
  'baf_database_v2',
  'baf_sync_logs',
  'baf_firebase_sync_logs_v1',
  'baf_local_cloud_sync_logs_v1',
  'canteen_sync_logs',
  'baf_pending_sync',
  'baf_pending_delta_queue_v1',
  'baf_presence',
  'baf_user_login_history',
  'baf_recent_logins',
  'baf_canteen_recent_logins',
  'baf_theme_pref',
  'baf_last_used_id',
  'baf_canteen_last_used_id',
  'baf_office_last_used_id',
  'baf_last_used_login_portal',
  'baf_dismissed_notice_sig',
  'baf_cleared_notices_v4',
  'baf_firebase_quota_exceeded_at',
  'baf_firebase_quota_error_msg',
  'baf_cloud_connected',
  'baf_cloud_last_sync',
  'baf_last_firebase_pull_at',
  'baf_local_storage_snapshot',
  'baf_local_snapshot_time',
  'baf_drive_cloud_snapshot',
  'baf_backup_restore_history_v1',
  'baf_client_session_id',
]);

function isSyncableSettingKey(key: string): boolean {
  if (!key || IGNORED_SETTING_KEYS.has(key) || key.endsWith('_db')) return false;
  return SETTING_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export class LocalDatabaseEngine {
  public db: LocalStorageDB;
  private isFirebaseSyncing: boolean = false;
  public isInitialPullDone: boolean = false;
  private isPushing: boolean = false;
  private saveTimeout: any = null;
  private scheduledMode: 'single' | 'multi' | null = null;
  private lastSyncedDbStr: string = '';
  private lastPullAt: string = '';
  private manifestUnsub: (() => void) | null = null;
  private lastHandledRevision: number = 0;

  public getDb(): LocalStorageDB {
    return this.db;
  }

  constructor() {
    this.db = this.loadInitialLocalState();
    this.lastSyncedDbStr = JSON.stringify(this.db);
    if (typeof window !== 'undefined') {
      this.lastPullAt = window.localStorage.getItem(LAST_FIREBASE_PULL_KEY) || '';
      window.localStorage.removeItem('baf_pending_sync');
      this.pullDatabaseFromServer();
      this.pullAllSettingsFromServer();
      if (!this.db.activityHistory || this.db.activityHistory.length < 25) {
        fetch('/api/server-history')
          .then((r) => r.json())
          .then((d) => {
            if (d && Array.isArray(d.history) && d.history.length > 0) {
              this.mergeHistory(d.history);
            }
          })
          .catch(() => {});
      }
      setTimeout(() => {
        this.syncFromFirebase({ isLoginSync: false });
        this.attachManifestListener();
      }, 1000);

      window.addEventListener("baf_idac_settings_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db, false); });
      window.addEventListener("baf_duty_ratio_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db, false); });
      window.addEventListener("baf_sync_duty_matrix_cloud", (e: any) => {
        this.syncDutyMatrixToCloud(e.detail?.matrix);
      });
      window.addEventListener("baf_signatures_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db, false); });
      window.addEventListener("baf_logo_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db, false); });

      // React to active user count switching between single (30m) and multi (10s)
      window.addEventListener('baf_active_users_changed', () => {
        if (this.saveTimeout || this.hasUnsyncedDifferences(this.db)) {
          const desiredMode = isMultiUserMode() ? 'multi' : 'single';
          if (this.scheduledMode !== desiredMode) {
            if (this.saveTimeout) {
              clearTimeout(this.saveTimeout);
              this.saveTimeout = null;
            }
            this.saveToFirebase(this.db, false);
          }
        }
      });

      // Flush pending changes to Firebase right before app hides/closes or logs out
      const flushBeforeClose = () => {
        if (this.saveTimeout || this.hasUnsyncedDifferences(this.db)) {
          this.saveToFirebase(this.db, true);
        }
      };
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          flushBeforeClose();
        }
      });
      window.addEventListener('pagehide', flushBeforeClose);
      window.addEventListener('beforeunload', flushBeforeClose);
      window.addEventListener('baf_before_user_logout', flushBeforeClose);

      // Re-attach manifest listener when quota recovers
      window.addEventListener('baf_firebase_quota_status', (e: any) => {
        if (e?.detail?.exceeded) {
          if (this.manifestUnsub) {
            this.manifestUnsub();
            this.manifestUnsub = null;
          }
        } else {
          this.attachManifestListener();
        }
      });

      // Multi-user 10-second polling backup check (only runs when activeUsers >= 2 AND actual changes exist)
      setInterval(() => {
        if (isFirestoreQuotaExceeded()) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        if (this.isFirebaseSyncing || this.isPushing || !this.isInitialPullDone) return;
        if (!isMultiUserMode()) return;

        if (this.hasUnsyncedDifferences(this.db)) {
          this.saveToFirebase(this.db, true);
        }
      }, MULTI_USER_BACKUP_INTERVAL_MS);

      // Quota Recovery & Retry Ticker (every 5 minutes when quota is exhausted + pending offline deltas exist)
      setInterval(async () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        if (this.isFirebaseSyncing || this.isPushing) return;

        if (isFirestoreQuotaExceeded()) {
          if (hasPendingDeltas()) {
            const probe = await probeFirebaseConnectionAndQuota(true);
            if (probe.ok && !probe.quotaExceeded) {
              await this.syncFromFirebase({ isQuotaRecovery: true });
              window.dispatchEvent(new CustomEvent('baf_firebase_quota_recovered'));
            }
          }
          return;
        }

        if (hasPendingDeltas() && !this.saveTimeout) {
          this.saveToFirebase(this.db, true);
        }
      }, 5 * 60 * 1000);
    }
  }

  private attachManifestListener() {
    if (!isFirebaseConfigured || isFirestoreQuotaExceeded() || this.manifestUnsub) return;
    this.manifestUnsub = subscribeToSyncManifest((manifest) => {
      if (!manifest || !manifest.updatedAt) return;
      if (manifest.updatedBySessionId === CLIENT_SESSION_ID) return;
      if (manifest.revision && manifest.revision <= this.lastHandledRevision) return;
      this.lastHandledRevision = manifest.revision || Date.now();
      // Only pull changed collections incrementally
      this.pullIncrementalFromFirebase(manifest.changedCollections);
    });
  }

  private getSyncableSettingsSnapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    if (typeof window === 'undefined') return out;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !isSyncableSettingKey(k)) continue;
      const v = window.localStorage.getItem(k);
      if (v !== null && v.length < 700000) {
        out[k] = v;
      }
    }
    return out;
  }

  private hasUnsyncedDifferences(dbToCheck: LocalStorageDB = this.db): boolean {
    if (hasPendingDeltas()) return true;
    const curDbStr = JSON.stringify(dbToCheck);
    if (this.lastSyncedDbStr && this.lastSyncedDbStr !== curDbStr) return true;
    if (typeof window !== 'undefined') {
      const snap = this.getSyncableSettingsSnapshot();
      for (const [k, v] of Object.entries(snap)) {
        if (lastSyncedSettingsMap.get(k) !== v) return true;
      }
    }
    return false;
  }

  public async pullAllSettingsFromServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const rawFetch = (window as any).__baf_raw_fetch || fetch;
      const res = await rawFetch('/api/canteen/all-settings');
      if (!res.ok) return false;
      const settings = await res.json();
      if (Array.isArray(settings) && settings.length > 0) {
        settings.forEach((s: any) => {
          if (s && s.setting_key && s.setting_value !== undefined) {
            const val = typeof s.setting_value === 'string' ? s.setting_value : JSON.stringify(s.setting_value);
            localStorage.setItem(s.setting_key, val);
            if (!this.isInitialPullDone && isSyncableSettingKey(s.setting_key)) {
              lastSyncedSettingsMap.set(s.setting_key, val);
            }
          }
        });
        window.dispatchEvent(new CustomEvent('baf_settings_synced'));
        return true;
      }
    } catch (e) {
      console.warn('[localDatabase] Failed to pull settings from server:', e);
    }
    return false;
  }

  public async pullDatabaseFromServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const rawFetch = (window as any).__baf_raw_fetch || fetch;
      const res = await rawFetch('/api/database');
      if (!res.ok) return false;
      const srvDb = await res.json();
      if (!srvDb) return false;
      let changed = false;

      // 1. Airmen: merge by canonical BD digits to prevent duplication
      if (Array.isArray(srvDb.airmen) && srvDb.airmen.length > 0) {
        const getAirmanKey = (a: any) => String(a.bdNo || a.id || '').replace(/\D/g, '');
        const mergedAirmen: any[] = [];
        const seenKeys = new Set<string>();

        // Priority 1: keep local airmen edits
        (this.db.airmen || []).forEach((a: any) => {
          const k = getAirmanKey(a);
          if (k && !seenKeys.has(k)) {
            seenKeys.add(k);
            mergedAirmen.push(a);
          }
        });

        // Priority 2: add any missing server airmen
        srvDb.airmen.forEach((sa: any) => {
          const k = getAirmanKey(sa);
          if (k && !seenKeys.has(k)) {
            seenKeys.add(k);
            mergedAirmen.push(sa);
            changed = true;
          }
        });

        if (this.db.airmen.length !== mergedAirmen.length) changed = true;
        this.db.airmen = normalizeAirmenSeniority(mergedAirmen);
      }

      // 2. Duty Assignments: authoritative sync from server
      if (srvDb.assignments && typeof srvDb.assignments === 'object') {
        if (!this.db.assignments) this.db.assignments = {};
        Object.keys(srvDb.assignments).forEach((mKey) => {
          this.db.assignments[mKey] = srvDb.assignments[mKey] || [];
          changed = true;
        });
      }

      // 3. Activity History
      if (Array.isArray(srvDb.activityHistory) && srvDb.activityHistory.length > 0) {
        this.mergeHistory(srvDb.activityHistory);
        changed = true;
      }

      // 4. Admin Passcode
      if (srvDb.adminPasscode && srvDb.adminPasscode !== this.db.adminPasscode) {
        this.db.adminPasscode = srvDb.adminPasscode;
        changed = true;
      }

      if (changed) {
        this.db.lastUpdated = new Date().toISOString();
        this.saveToStorage(this.db, true, false, false);
        if (!this.isInitialPullDone && !hasPendingDeltas()) {
          this.lastSyncedDbStr = JSON.stringify(this.db);
        }
        window.dispatchEvent(new CustomEvent('baf_data_updated'));
        window.dispatchEvent(new CustomEvent('baf_duty_distribution_updated'));
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
      }
      return true;
    } catch (e) {
      console.warn('[localDatabase] Failed to pull database from server:', e);
      return false;
    }
  }

  public async pushAllToLocalServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const rawFetch = (window as any).__baf_raw_fetch || fetch;
      const dbRes = await rawFetch('/api/database/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.db),
      });
      if (!dbRes.ok) {
        throw new Error(`Local server returned ${dbRes.status}`);
      }

      const settingsSnap = this.getSyncableSettingsSnapshot();
      const canteenKeys = ['canteen_txs', 'canteen_expenses', 'canteen_bazar_advances', 'canteen_daily_menu', 'canteen_pre_orders', 'canteen_members_cache'];
      canteenKeys.forEach((ck) => {
        const val = window.localStorage.getItem(ck);
        if (val !== null) settingsSnap[ck] = val;
      });

      const entries = Object.entries(settingsSnap);
      await Promise.allSettled(
        entries.map(([k, v]) =>
          rawFetch('/api/canteen/save-setting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setting_key: k, setting_value: v }),
          })
        )
      );

      const totalAssignments = Object.values(this.db.assignments || {}).reduce(
        (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
        0
      );
      addLocalCloudSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PUSH',
        status: 'SUCCESS',
        message: `Uploaded ${this.db.airmen.length} airmen, ${totalAssignments.toLocaleString()} duties & ${entries.length} settings to Local Cloud server.`,
      });
      return true;
    } catch (err: any) {
      addLocalCloudSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PUSH',
        status: 'ERROR',
        message: `Local Cloud upload failed: ${err?.message || 'Server unreachable'}`,
      });
      return false;
    }
  }

  public async pullAllFromLocalServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const [dbOk, settingsOk] = await Promise.all([
        this.pullDatabaseFromServer(),
        this.pullAllSettingsFromServer(),
      ]);

      if (!dbOk && !settingsOk) {
        throw new Error('Could not reach Local Cloud server endpoints.');
      }

      const totalAssignments = Object.values(this.db.assignments || {}).reduce(
        (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
        0
      );
      addLocalCloudSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PULL',
        status: 'SUCCESS',
        message: `Downloaded ${this.db.airmen.length} airmen & ${totalAssignments.toLocaleString()} duties from Local Cloud server.`,
      });
      return true;
    } catch (err: any) {
      addLocalCloudSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PULL',
        status: 'ERROR',
        message: `Local Cloud download failed: ${err?.message || 'Server unreachable'}`,
      });
      return false;
    }
  }

  private parseTimeMs(val: any): number {
    if (!val) return 0;
    const t = Date.parse(String(val));
    return isNaN(t) ? 0 : t;
  }

  private mergeDutyMatrices(
    localStr: string | null,
    cloudStr: string,
    localUpdatedAt?: string,
    cloudUpdatedAt?: string
  ): { mergedStr: string; changedFromCloud: boolean } {
    if (!localStr) return { mergedStr: cloudStr, changedFromCloud: false };
    try {
      const localList = JSON.parse(localStr);
      const cloudList = JSON.parse(cloudStr);
      if (!Array.isArray(localList) || !Array.isArray(cloudList)) {
        const lMs = this.parseTimeMs(localUpdatedAt);
        const cMs = this.parseTimeMs(cloudUpdatedAt);
        return lMs >= cMs
          ? { mergedStr: localStr, changedFromCloud: localStr !== cloudStr }
          : { mergedStr: cloudStr, changedFromCloud: false };
      }

      const lSettingMs = this.parseTimeMs(localUpdatedAt || (typeof window !== 'undefined' ? window.localStorage.getItem('baf_matrix_last_modified') : 0));
      const cSettingMs = this.parseTimeMs(cloudUpdatedAt);
      const resultMap = new Map<string, any>();
      cloudList.forEach((c: any) => {
        if (c && (c.id || c.dutyCode)) resultMap.set(String(c.id || c.dutyCode), c);
      });

      let changedFromCloud = false;
      localList.forEach((l: any) => {
        if (!l || (!l.id && !l.dutyCode)) return;
        const key = String(l.id || l.dutyCode);
        const c = resultMap.get(key);
        if (!c) {
          if (lSettingMs >= cSettingMs) {
            resultMap.set(key, l);
            changedFromCloud = true;
          }
          return;
        }
        const mergedDuty = { ...c };
        const flights = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
        const mergedData: Record<string, number[]> = {
          ...(c.data || {}),
        };
        const lDutyMs = this.parseTimeMs(l.updatedAt || lSettingMs);
        const cDutyMs = this.parseTimeMs(c.updatedAt || cSettingMs);

        flights.forEach((f) => {
          const lArr = l.data?.[f];
          const cArr = c.data?.[f];
          if (Array.isArray(lArr) && JSON.stringify(lArr) !== JSON.stringify(cArr)) {
            const lfMs = this.parseTimeMs(l.flightUpdatedAt?.[f] || lDutyMs);
            const cfMs = this.parseTimeMs(c.flightUpdatedAt?.[f] || cDutyMs);
            if (lfMs >= cfMs) {
              mergedData[f] = lArr;
              changedFromCloud = true;
            }
          }
        });

        if (lDutyMs > cDutyMs) {
          Object.assign(mergedDuty, l, { data: mergedData });
          changedFromCloud = true;
        } else {
          mergedDuty.data = mergedData;
        }
        resultMap.set(key, mergedDuty);
      });

      const mergedStr = JSON.stringify(Array.from(resultMap.values()));
      return { mergedStr, changedFromCloud };
    } catch {
      return { mergedStr: localStr, changedFromCloud: localStr !== cloudStr };
    }
  }

  /**
   * Synchronize database with Firebase Firestore (Full pull + Pending Delta Reconciliation)
   */
  public async syncFromFirebase(options?: { isLoginSync?: boolean; isQuotaRecovery?: boolean }): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!isFirebaseConfigured) {
      await this.pullDatabaseFromServer();
      await this.pullAllSettingsFromServer();
      this.isInitialPullDone = true;
      return true;
    }

    if (this.isFirebaseSyncing) return false;

    this.isFirebaseSyncing = true;
    isSyncingActive = true;
    broadcastSyncState();
    addSyncLog({ timestamp: new Date().toISOString(), type: 'PULL', status: 'SUCCESS', message: 'Fetching latest data from Firebase Firestore...' });

    try {
      // On login or manual sync, verify Firebase health & quota live from server
      if (options?.isLoginSync || options?.isQuotaRecovery || isFirestoreQuotaExceeded()) {
        const probe = await probeFirebaseConnectionAndQuota(Boolean(options?.isLoginSync || options?.isQuotaRecovery));
        if (probe.quotaExceeded || isFirestoreQuotaExceeded()) {
          await this.pullDatabaseFromServer();
          await this.pullAllSettingsFromServer();
          this.isInitialPullDone = true;
          this.isFirebaseSyncing = false;
          isSyncingActive = false;
          broadcastSyncState();
          if (options?.isLoginSync) {
            window.dispatchEvent(
              new CustomEvent('baf_login_quota_exceeded_popup', {
                detail: {
                  source: 'login',
                  message: probe.errorMsg || 'Firebase daily quota exceeded. Using Local Cloud Storage.',
                  upgradeUrl: getQuotaConsoleUpgradeUrl(),
                },
              })
            );
          }
          addSyncLog({
            timestamp: new Date().toISOString(),
            type: 'PULL',
            status: 'ERROR',
            message: 'Firebase Quota Exceeded — operating seamlessly on Local Cloud Storage.',
          });
          return true;
        }
      }

      emitSyncProgress(15, 'Connecting to Firebase Firestore...');

      const [fbAirmen, fbAssignments, fbHistory, fbUsers, fbSettingsMeta] = await Promise.all([
        fetchAirmenFromFirebase(),
        fetchDutyAssignmentsFromFirebase(),
        fetchParadeStatesFromFirebase(),
        fetchUserProfilesFromFirebase(),
        fetchAppSettingsWithMetaFromFirebase(),
      ]);

      emitSyncProgress(55, 'Reconciling cloud & local records...');

      // First-time seed: Firebase is empty while local DB already has data
      if (fbAirmen.length === 0 && fbAssignments.length === 0 && this.db.airmen.length > 0) {
        emitSyncProgress(70, 'Seeding initial database to Firebase...');
        await this.pushAllToFirebaseInternal(this.db, 'initial_seed');
        const qSnap = getPendingDeltaQueue();
        clearPendingDeltas({
          airmenIds: Object.keys(qSnap.airmen || {}),
          assignmentDocIds: Object.keys(qSnap.assignments || {}),
          historyIds: Object.keys(qSnap.history || {}),
          userIds: Object.keys(qSnap.users || {}),
          settingKeys: Object.keys(qSnap.settings || {}),
        });
        window.localStorage.removeItem('baf_pending_sync');
        const nowIso = new Date().toISOString();
        this.lastPullAt = nowIso;
        window.localStorage.setItem(LAST_FIREBASE_PULL_KEY, nowIso);
        this.lastSyncedDbStr = JSON.stringify(this.db);
        firebaseConnected = true;
        firebaseLastSyncTime = nowIso;
        window.localStorage.setItem('baf_cloud_connected', 'true');
        window.localStorage.setItem('baf_cloud_last_sync', firebaseLastSyncTime);
        this.isInitialPullDone = true;
        emitSyncProgress(100, 'Firebase initial sync complete!');
        addSyncLog({ timestamp: nowIso, type: 'PUSH', status: 'SUCCESS', message: `Initialized Firebase Firestore (${this.db.airmen.length} airmen).` });
        return true;
      }

      const pendingQueue = getPendingDeltaQueue();
      const pushBackAirmen: any[] = [];
      const pushBackAssignments: any[] = [];
      const pushBackDeletedAssignments: any[] = [];
      const pushBackHistory: any[] = [];
      const pushBackUsers: any[] = [];
      const pushBackSettings: Array<{ settingKey: string; value: any; updatedAt?: string }> = [];

      const pushedAirmenIds: string[] = [];
      const pushedAssignmentDocIds: string[] = [];
      const pushedHistoryIds: string[] = [];
      const pushedUserIds: string[] = [];
      const pushedSettingKeys: string[] = [];

      const newDb: LocalStorageDB = {
        ...this.db,
        airmen: [...(this.db.airmen || [])],
        assignments: { ...(this.db.assignments || {}) },
        activityHistory: [...(this.db.activityHistory || [])],
        detailedUsers: [...(this.db.detailedUsers || [])],
      };

      // 1. Reconcile Airmen
      const airmenMap = new Map<string, any>();
      const getCanonicalAirKey = (a: any) => {
        const cleanBd = String(a?.bdNo || a?.id || '').replace(/\D/g, '');
        return cleanBd || String(a?.id || '');
      };

      fbAirmen.forEach((a: any) => {
        const k = getCanonicalAirKey(a);
        if (k) airmenMap.set(k, a);
      });

      (this.db.airmen || []).forEach((localA: any) => {
        const k = getCanonicalAirKey(localA);
        const docId = getAirmanDocId(localA);
        const pendingTime = pendingQueue.airmen[docId];
        const cloudA = k ? airmenMap.get(k) : undefined;
        if (pendingTime) {
          const lMs = this.parseTimeMs((localA as any).updatedAt || pendingTime);
          const cMs = this.parseTimeMs(cloudA?.updatedAt);
          if (!cloudA || lMs >= cMs) {
            airmenMap.set(k, { ...cloudA, ...localA, updatedAt: (localA as any).updatedAt || pendingTime });
            pushBackAirmen.push(airmenMap.get(k));
          }
          pushedAirmenIds.push(docId);
        } else if (!cloudA && fbAirmen.length === 0) {
          airmenMap.set(k, localA);
        }
      });

      if (airmenMap.size > 0) {
        newDb.airmen = normalizeAirmenSeniority(Array.from(airmenMap.values()));
      }

      // 2. Reconcile Duty Assignments (Per-Doc Timestamp + Non-overlapping Flight Combination)
      const mergedAsnMap = new Map<string, { item: any; isDeleted: boolean; updatedAtMs: number }>();
      fbAssignments.forEach((a: any) => {
        const docId = getAssignmentDocId(a);
        mergedAsnMap.set(docId, {
          item: a,
          isDeleted: Boolean(a.isDeleted),
          updatedAtMs: this.parseTimeMs(a.updatedAt),
        });
      });

      // Overlay any local assignments that aren't in cloud ONLY if cloud was completely empty or local has pending delta
      Object.values(pendingQueue.assignments || {}).forEach((delta) => {
        if (!delta || !delta.docId) return;
        const lMs = this.parseTimeMs(delta.updatedAt);
        const cloudEntry = mergedAsnMap.get(delta.docId);
        if (!cloudEntry || lMs >= cloudEntry.updatedAtMs) {
          mergedAsnMap.set(delta.docId, {
            item: delta.assignment,
            isDeleted: Boolean(delta.isDeleted),
            updatedAtMs: lMs,
          });
          if (delta.isDeleted && delta.assignment) {
            pushBackDeletedAssignments.push(delta.assignment);
          } else if (delta.assignment) {
            pushBackAssignments.push(delta.assignment);
          }
        }
        pushedAssignmentDocIds.push(delta.docId);
      });

      const assignmentsByMonth: Record<string, DutyAssignment[]> = {};
      mergedAsnMap.forEach((entry) => {
        if (entry.isDeleted || !entry.item) return;
        const a = { ...entry.item };
        delete a.isDeleted;
        const dateStr = String(a.date || '');
        if (dateStr.length >= 7) {
          const ym = dateStr.slice(0, 7);
          if (!assignmentsByMonth[ym]) assignmentsByMonth[ym] = [];
          assignmentsByMonth[ym].push(a);
        }
      });
      if (fbAssignments.length > 0 || Object.keys(pendingQueue.assignments).length > 0) {
        newDb.assignments = assignmentsByMonth;
      }

      // 3. Reconcile Parade States / Activity History
      const histMap = new Map<string, ActivityHistoryItem>();
      fbHistory.forEach((h: any) => {
        if (h && h.id) histMap.set(h.id, h);
      });
      (this.db.activityHistory || []).forEach((localH: any) => {
        if (!localH || !localH.id) return;
        const docId = sanitizeDocId(localH.id);
        const pendingTime = pendingQueue.history[docId];
        const cloudH = histMap.get(localH.id);
        if (pendingTime) {
          const lMs = this.parseTimeMs(localH.updatedAt || localH.timestamp || pendingTime);
          const cMs = this.parseTimeMs((cloudH as any)?.updatedAt || cloudH?.timestamp);
          if (!cloudH || lMs >= cMs) {
            histMap.set(localH.id, localH);
            pushBackHistory.push(localH);
          }
          pushedHistoryIds.push(docId);
        } else if (!cloudH) {
          histMap.set(localH.id, localH);
        }
      });
      newDb.activityHistory = Array.from(histMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // 4. Reconcile User Profiles
      const userMap = new Map<string, any>();
      const getUserBdKey = (u: any) => String(u?.bdNo || u?.id || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      fbUsers.forEach((u: any) => {
        const k = getUserBdKey(u);
        if (k) userMap.set(k, u);
      });
      (this.db.detailedUsers || []).forEach((localU: any) => {
        const k = getUserBdKey(localU);
        const docId = sanitizeDocId(localU?.id || `user_login_${localU?.bdNo || 'u'}`);
        const pendingTime = pendingQueue.users[docId];
        const cloudU = k ? userMap.get(k) : undefined;
        if (pendingTime) {
          const lMs = this.parseTimeMs(localU.updatedAt || pendingTime);
          const cMs = this.parseTimeMs(cloudU?.updatedAt);
          if (!cloudU || lMs >= cMs) {
            userMap.set(k, localU);
            pushBackUsers.push(localU);
          }
          pushedUserIds.push(docId);
        } else if (!cloudU && fbUsers.length === 0) {
          userMap.set(k, localU);
        }
      });
      if (userMap.size > 0) {
        newDb.detailedUsers = Array.from(userMap.values());
      }

      // 5. Reconcile App Settings
      let settingsChangedFromCloud = false;
      Object.entries(fbSettingsMeta).forEach(([k, info]) => {
        if (!isSyncableSettingKey(k)) return;
        const pendingTime = pendingQueue.settings[k];
        const localValStr = window.localStorage.getItem(k);

        if (pendingTime && localValStr !== null) {
          if (k === 'baf_official_duty_matrix_v4') {
            const { mergedStr, changedFromCloud } = this.mergeDutyMatrices(localValStr, info.valueStr, pendingTime, info.updatedAt);
            window.localStorage.setItem(k, mergedStr);
            lastSyncedSettingsMap.set(k, mergedStr);
            if (changedFromCloud) {
              pushBackSettings.push({ settingKey: k, value: mergedStr, updatedAt: new Date().toISOString() });
            } else if (mergedStr !== localValStr) {
              settingsChangedFromCloud = true;
            }
          } else {
            const lMs = this.parseTimeMs(pendingTime);
            const cMs = this.parseTimeMs(info.updatedAt);
            if (lMs >= cMs) {
              pushBackSettings.push({ settingKey: k, value: localValStr, updatedAt: pendingTime });
              lastSyncedSettingsMap.set(k, localValStr);
            } else {
              if (localValStr !== info.valueStr) settingsChangedFromCloud = true;
              window.localStorage.setItem(k, info.valueStr);
              lastSyncedSettingsMap.set(k, info.valueStr);
            }
          }
          pushedSettingKeys.push(k);
        } else {
          if (localValStr !== info.valueStr) settingsChangedFromCloud = true;
          window.localStorage.setItem(k, info.valueStr);
          lastSyncedSettingsMap.set(k, info.valueStr);
        }
      });

      // Settings that exist ONLY in local pendingQueue (not yet in Firebase)
      Object.entries(pendingQueue.settings || {}).forEach(([k, updatedIso]) => {
        if (!fbSettingsMeta[k] && isSyncableSettingKey(k)) {
          const val = window.localStorage.getItem(k);
          if (val !== null) {
            pushBackSettings.push({ settingKey: k, value: val, updatedAt: updatedIso });
            pushedSettingKeys.push(k);
          }
        }
      });

      // Push winning local deltas back to Firebase after quota recovery / login
      const changedCollections: string[] = [];
      if (pushBackAirmen.length > 0) {
        await pushAirmenToFirebase(pushBackAirmen);
        changedCollections.push('airmen');
      }
      if (pushBackAssignments.length > 0) {
        await pushDutyAssignmentsToFirebase(pushBackAssignments);
        changedCollections.push('duty_assignments');
      }
      if (pushBackDeletedAssignments.length > 0) {
        await softDeleteDutyAssignmentsInFirebase(pushBackDeletedAssignments);
        changedCollections.push('duty_assignments');
      }
      if (pushBackHistory.length > 0) {
        await pushParadeStatesToFirebase(pushBackHistory);
        changedCollections.push('parade_states');
      }
      if (pushBackUsers.length > 0) {
        await pushUserProfilesToFirebase(pushBackUsers);
        changedCollections.push('user_profiles');
      }
      if (pushBackSettings.length > 0) {
        await pushAppSettingsToFirebase(pushBackSettings);
        pushBackSettings.forEach((s) => lastSyncedSettingsMap.set(s.settingKey, typeof s.value === 'string' ? s.value : JSON.stringify(s.value)));
        changedCollections.push('app_settings');
      }
      if (changedCollections.length > 0) {
        await publishSyncManifest(Array.from(new Set(changedCollections)), options?.isQuotaRecovery ? 'quota_recovery_merge' : 'login_delta_merge');
      }

      if (
        pushedAirmenIds.length > 0 ||
        pushedAssignmentDocIds.length > 0 ||
        pushedHistoryIds.length > 0 ||
        pushedUserIds.length > 0 ||
        pushedSettingKeys.length > 0
      ) {
        clearPendingDeltas({
          airmenIds: pushedAirmenIds,
          assignmentDocIds: pushedAssignmentDocIds,
          historyIds: pushedHistoryIds,
          userIds: pushedUserIds,
          settingKeys: pushedSettingKeys,
        });
      }

      const curMatrix = window.localStorage.getItem('baf_official_duty_matrix_v4');
      if (curMatrix) lastSyncedMatrixRaw = curMatrix;

      newDb.lastUpdated = new Date().toISOString();
      this.db = newDb;
      this.saveToStorage(newDb, false, false, false);
      window.localStorage.removeItem('baf_pending_sync');
      this.lastSyncedDbStr = JSON.stringify(newDb);
      const nowIso = new Date().toISOString();
      this.lastPullAt = nowIso;
      window.localStorage.setItem(LAST_FIREBASE_PULL_KEY, nowIso);

      firebaseConnected = true;
      firebaseLastSyncTime = nowIso;
      window.localStorage.setItem('baf_cloud_connected', 'true');
      window.localStorage.setItem('baf_cloud_last_sync', nowIso);
      this.isInitialPullDone = true;

      window.dispatchEvent(new CustomEvent('baf_db_updated', { detail: { source: 'firebase' } }));
      window.dispatchEvent(new CustomEvent('baf_state_updated', { detail: { source: 'firebase' } }));
      window.dispatchEvent(new CustomEvent('baf_duty_distribution_updated', { detail: { source: 'firebase' } }));
      if (settingsChangedFromCloud) {
        window.dispatchEvent(new CustomEvent('baf_settings_updated', { detail: { source: 'firebase' } }));
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { source: 'firebase' } }));
      }

      emitSyncProgress(100, 'Firebase sync complete!');
      addSyncLog({
        timestamp: nowIso,
        type: 'PULL',
        status: 'SUCCESS',
        message: `Synced from Firebase Firestore (${newDb.airmen.length} airmen${changedCollections.length ? ', merged local edits' : ''}).`,
      });
      return true;
    } catch (err: any) {
      const msg = err?.message || String(err);
      const quotaHit = isQuotaExceededError(err) || isFirestoreQuotaExceeded();
      console.warn('[localDatabase] Firebase sync fallback to Local Cloud:', msg);
      await this.pullDatabaseFromServer();
      await this.pullAllSettingsFromServer();
      if (quotaHit && options?.isLoginSync) {
        window.dispatchEvent(
          new CustomEvent('baf_login_quota_exceeded_popup', {
            detail: {
              source: 'login',
              message: msg,
              upgradeUrl: getQuotaConsoleUpgradeUrl(),
            },
          })
        );
      }
      addSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PULL',
        status: 'ERROR',
        message: quotaHit ? 'Firebase Quota Exceeded — using Local Cloud Storage.' : `Firebase pull error: ${msg}`,
      });
      return quotaHit;
    } finally {
      this.isFirebaseSyncing = false;
      isSyncingActive = false;
      this.isInitialPullDone = true;
      broadcastSyncState();
    }
  }

  /**
   * Incremental pull triggered by sync_manifest for multi-user real-time collaboration
   */
  public async pullIncrementalFromFirebase(changedCollections?: string[]): Promise<boolean> {
    if (typeof window === 'undefined' || !isFirebaseConfigured || isFirestoreQuotaExceeded()) return false;
    if (this.isFirebaseSyncing || this.isPushing) return false;

    const since = this.lastPullAt || undefined;
    const targets = changedCollections && changedCollections.length > 0
      ? changedCollections
      : ['airmen', 'duty_assignments', 'parade_states', 'user_profiles', 'app_settings'];

    try {
      const pendingQueue = getPendingDeltaQueue();
      let dbChanged = false;
      let settingsChanged = false;
      const newDb: LocalStorageDB = {
        ...this.db,
        airmen: [...(this.db.airmen || [])],
        assignments: { ...(this.db.assignments || {}) },
        activityHistory: [...(this.db.activityHistory || [])],
        detailedUsers: [...(this.db.detailedUsers || [])],
      };

      if (targets.includes('airmen')) {
        const incAirmen = await fetchAirmenFromFirebase(since);
        if (incAirmen.length > 0) {
          const map = new Map<string, any>();
          const getKey = (a: any) => String(a?.bdNo || a?.id || '').replace(/\D/g, '') || String(a?.id || '');
          newDb.airmen.forEach((a) => map.set(getKey(a), a));
          incAirmen.forEach((ca: any) => {
            const docId = getAirmanDocId(ca);
            if (pendingQueue.airmen[docId]) return;
            const k = getKey(ca);
            map.set(k, { ...map.get(k), ...ca });
            dbChanged = true;
          });
          newDb.airmen = normalizeAirmenSeniority(Array.from(map.values()));
        }
      }

      if (targets.includes('duty_assignments')) {
        const incAsn = await fetchDutyAssignmentsFromFirebase(since);
        if (incAsn.length > 0) {
          const byId = new Map<string, any>();
          Object.values(newDb.assignments || {}).forEach((list) => {
            (list || []).forEach((a) => byId.set(getAssignmentDocId(a), a));
          });
          incAsn.forEach((ca: any) => {
            const docId = getAssignmentDocId(ca);
            if (pendingQueue.assignments[docId]) return;
            if (ca.isDeleted) {
              if (byId.has(docId)) {
                byId.delete(docId);
                dbChanged = true;
              }
            } else {
              const clean = { ...ca };
              delete clean.isDeleted;
              byId.set(docId, clean);
              dbChanged = true;
            }
          });
          const rebuilt: Record<string, DutyAssignment[]> = {};
          byId.forEach((a) => {
            const ym = String(a?.date || '').slice(0, 7);
            if (ym.length === 7) {
              if (!rebuilt[ym]) rebuilt[ym] = [];
              rebuilt[ym].push(a);
            }
          });
          newDb.assignments = rebuilt;
        }
      }

      if (targets.includes('parade_states')) {
        const incHist = await fetchParadeStatesFromFirebase(since);
        if (incHist.length > 0) {
          const hMap = new Map<string, ActivityHistoryItem>();
          (newDb.activityHistory || []).forEach((h) => h?.id && hMap.set(h.id, h));
          incHist.forEach((ch: any) => {
            if (ch?.id && !pendingQueue.history[sanitizeDocId(ch.id)]) {
              hMap.set(ch.id, ch);
              dbChanged = true;
            }
          });
          newDb.activityHistory = Array.from(hMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }
      }

      if (targets.includes('user_profiles')) {
        const incUsers = await fetchUserProfilesFromFirebase(since);
        if (incUsers.length > 0) {
          const uMap = new Map<string, any>();
          const getUk = (u: any) => String(u?.bdNo || u?.id || '').replace(/^BD\/?/i, '').trim().toLowerCase();
          (newDb.detailedUsers || []).forEach((u) => uMap.set(getUk(u), u));
          incUsers.forEach((cu: any) => {
            const docId = sanitizeDocId(cu?.id || `user_login_${cu?.bdNo || 'u'}`);
            if (!pendingQueue.users[docId]) {
              uMap.set(getUk(cu), cu);
              dbChanged = true;
            }
          });
          newDb.detailedUsers = Array.from(uMap.values());
        }
      }

      if (targets.includes('app_settings')) {
        const incSettings = await fetchAppSettingsWithMetaFromFirebase(since);
        Object.entries(incSettings).forEach(([k, info]) => {
          if (!isSyncableSettingKey(k)) return;
          if (pendingQueue.settings[k]) return;
          const prev = window.localStorage.getItem(k);
          if (prev !== info.valueStr) {
            window.localStorage.setItem(k, info.valueStr);
            lastSyncedSettingsMap.set(k, info.valueStr);
            settingsChanged = true;
          }
        });
      }

      const nowIso = new Date().toISOString();
      this.lastPullAt = nowIso;
      window.localStorage.setItem(LAST_FIREBASE_PULL_KEY, nowIso);

      if (dbChanged) {
        newDb.lastUpdated = nowIso;
        this.db = newDb;
        this.saveToStorage(newDb, false, false, false);
        this.lastSyncedDbStr = JSON.stringify(newDb);
        window.dispatchEvent(new CustomEvent('baf_db_updated', { detail: { source: 'firebase' } }));
        window.dispatchEvent(new CustomEvent('baf_state_updated', { detail: { source: 'firebase' } }));
        window.dispatchEvent(new CustomEvent('baf_duty_distribution_updated', { detail: { source: 'firebase' } }));
      }
      if (settingsChanged) {
        window.dispatchEvent(new CustomEvent('baf_settings_updated', { detail: { source: 'firebase' } }));
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { source: 'firebase' } }));
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Directly sync a single app setting key-value pair to Firebase Firestore (or queue offline if quota full)
   */
  public async syncSettingToCloud(key: string, value: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!isSyncableSettingKey(key) && key !== 'baf_user_login_history') return false;
    const nowIso = new Date().toISOString();
    recordPendingDeltas({ settingKeys: [key] });

    if (!isFirebaseConfigured || isFirestoreQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return true;
    }

    try {
      await pushAppSettingsToFirebase([{ settingKey: key, value, updatedAt: nowIso }]);
      lastSyncedSettingsMap.set(key, value);
      clearPendingDeltas({ settingKeys: [key] });
      await publishSyncManifest(['app_settings'], `setting_${key}`);
      return true;
    } catch (e: any) {
      if (!isQuotaExceededError(e)) {
        console.warn(`Error syncing setting "${key}" to Firebase:`, e?.message || e);
      }
      return false;
    }
  }

  private async pushAllToFirebaseInternal(dbToPush: LocalStorageDB, reason: string): Promise<void> {
    const flatAssignments: any[] = [];
    Object.values(dbToPush.assignments || {}).forEach((list) => {
      if (Array.isArray(list)) list.forEach((a) => flatAssignments.push(a));
    });
    const settingsSnap = this.getSyncableSettingsSnapshot();
    const settingInputs = Object.entries(settingsSnap).map(([k, v]) => ({ settingKey: k, value: v }));

    await Promise.all([
      pushAirmenToFirebase(dbToPush.airmen || []),
      pushDutyAssignmentsToFirebase(flatAssignments),
      pushParadeStatesToFirebase((dbToPush.activityHistory || []).slice(0, 300)),
      pushUserProfilesToFirebase(dbToPush.detailedUsers || []),
      pushAppSettingsToFirebase(settingInputs),
    ]);
    settingInputs.forEach((s) => lastSyncedSettingsMap.set(s.settingKey, String(s.value)));
    await publishSyncManifest(['airmen', 'duty_assignments', 'parade_states', 'user_profiles', 'app_settings'], reason);
  }

  /**
   * Granular delta backup to Firebase Firestore:
   * - Only changed items upload (Requirement 5)
   * - Multi-user: 10s interval when differences exist; 0 writes when unchanged (Requirement 2)
   * - Single-user: 30m interval + immediate flush on app close/logout (Requirement 1)
   * - Quota exceeded / offline: queues deltas persistently in Local Storage until reset (Requirement 4)
   */
  public async saveToFirebase(_dbToSave: LocalStorageDB, immediate = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Wait until initial Firebase pull/seed establishes baseline before computing diffs
    // (prevents thousands of preloaded records from falsely queuing as 4,400+ pending edits)
    if (!immediate && (!this.isInitialPullDone || this.isFirebaseSyncing)) {
      return false;
    }

    const computeDiff = () => {
      const currDb = this.db;
      let lastSyncedDb: any = {};
      try {
        lastSyncedDb = JSON.parse(this.lastSyncedDbStr || '{}');
      } catch {}

      const changedAirmen = (currDb.airmen || []).filter((a) => {
        if (!lastSyncedDb.airmen) return true;
        const cleanBd = String(a.bdNo || '').replace(/\D/g, '');
        const prev = lastSyncedDb.airmen.find(
          (p: any) => p.id === a.id || (cleanBd && p.bdNo && String(p.bdNo).replace(/\D/g, '') === cleanBd)
        );
        return !prev || JSON.stringify(prev) !== JSON.stringify(a);
      });

      const changedAssignments: any[] = [];
      const deletedAssignments: any[] = [];
      const prevAsnMap = new Map<string, any>();
      Object.values(lastSyncedDb.assignments || {}).forEach((monthList: any) => {
        if (Array.isArray(monthList)) {
          monthList.forEach((prevA: any) => prevAsnMap.set(getAssignmentDocId(prevA), prevA));
        }
      });

      const currAsnMap = new Map<string, any>();
      Object.values(currDb.assignments || {}).forEach((monthList: any) => {
        if (Array.isArray(monthList)) {
          monthList.forEach((currA: any) => currAsnMap.set(getAssignmentDocId(currA), currA));
        }
      });

      prevAsnMap.forEach((prevA, docId) => {
        if (!currAsnMap.has(docId)) deletedAssignments.push(prevA);
      });
      currAsnMap.forEach((currA, docId) => {
        const prevA = prevAsnMap.get(docId);
        if (!prevA || JSON.stringify(prevA) !== JSON.stringify(currA)) {
          changedAssignments.push(currA);
        }
      });

      const changedHistory = (currDb.activityHistory || []).filter((h) => {
        if (!lastSyncedDb.activityHistory) return true;
        const prev = lastSyncedDb.activityHistory.find((p: any) => p.id === h.id);
        return !prev || JSON.stringify(prev) !== JSON.stringify(h);
      });

      const changedUsers = (currDb.detailedUsers || []).filter((u) => {
        if (!lastSyncedDb.detailedUsers) return true;
        const prev = lastSyncedDb.detailedUsers.find((p: any) => p.id === u.id);
        return !prev || JSON.stringify(prev) !== JSON.stringify(u);
      });

      const settingsSnap = this.getSyncableSettingsSnapshot();
      const changedSettings: Array<{ settingKey: string; value: string }> = [];
      Object.entries(settingsSnap).forEach(([k, val]) => {
        if (lastSyncedSettingsMap.get(k) !== val) {
          changedSettings.push({ settingKey: k, value: val });
        }
      });

      return {
        changedAirmen,
        changedAssignments,
        deletedAssignments,
        changedHistory,
        changedUsers,
        changedSettings,
      };
    };

    const diffNow = computeDiff();
    const hasNewDiffs =
      diffNow.changedAirmen.length > 0 ||
      diffNow.changedAssignments.length > 0 ||
      diffNow.deletedAssignments.length > 0 ||
      diffNow.changedHistory.length > 0 ||
      diffNow.changedUsers.length > 0 ||
      diffNow.changedSettings.length > 0;

    // Persist any detected deltas immediately to offline delta queue (survives quota limit, close, refresh)
    if (hasNewDiffs && this.isInitialPullDone) {
      recordPendingDeltas({
        airmen: diffNow.changedAirmen,
        assignments: diffNow.changedAssignments,
        deletedAssignments: diffNow.deletedAssignments,
        history: diffNow.changedHistory,
        users: diffNow.changedUsers,
        settingKeys: diffNow.changedSettings.map((s) => s.settingKey),
      });
    }

    if (!hasNewDiffs && !hasPendingDeltas()) {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
        this.scheduledMode = null;
      }
      window.localStorage.removeItem('baf_pending_sync');
      return true;
    }

    if (!isFirebaseConfigured || isFirestoreQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      window.localStorage.setItem('baf_pending_sync', 'true');
      return true;
    }

    if (!immediate && (!this.isInitialPullDone || this.isFirebaseSyncing)) {
      return false;
    }

    const doSave = async (): Promise<boolean> => {
      if (this.isPushing) return false;
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
        this.scheduledMode = null;
      }
      if (isFirestoreQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return true;
      }

      const d = computeDiff();
      const pending = getPendingDeltaQueue();

      // Merge diffNow + persisted pendingDeltaQueue so no offline edit is missed
      const airmenToPushMap = new Map<string, any>();
      d.changedAirmen.forEach((a) => airmenToPushMap.set(getAirmanDocId(a), a));
      Object.keys(pending.airmen || {}).forEach((docId) => {
        if (!airmenToPushMap.has(docId)) {
          const found = (this.db.airmen || []).find((a) => getAirmanDocId(a) === docId);
          if (found) airmenToPushMap.set(docId, found);
        }
      });

      const assignToPushMap = new Map<string, any>();
      const assignToDelMap = new Map<string, any>();
      d.changedAssignments.forEach((a) => assignToPushMap.set(getAssignmentDocId(a), a));
      d.deletedAssignments.forEach((a) => assignToDelMap.set(getAssignmentDocId(a), a));
      Object.values(pending.assignments || {}).forEach((p) => {
        if (!p || !p.docId) return;
        if (p.isDeleted) {
          if (!assignToPushMap.has(p.docId) && p.assignment) assignToDelMap.set(p.docId, p.assignment);
        } else if (p.assignment && !assignToDelMap.has(p.docId) && !assignToPushMap.has(p.docId)) {
          assignToPushMap.set(p.docId, p.assignment);
        }
      });

      const histToPushMap = new Map<string, any>();
      d.changedHistory.forEach((h) => histToPushMap.set(sanitizeDocId(h.id), h));
      Object.keys(pending.history || {}).forEach((docId) => {
        if (!histToPushMap.has(docId)) {
          const found = (this.db.activityHistory || []).find((h) => sanitizeDocId(h.id) === docId);
          if (found) histToPushMap.set(docId, found);
        }
      });

      const usersToPushMap = new Map<string, any>();
      d.changedUsers.forEach((u) => usersToPushMap.set(sanitizeDocId(u?.id || `user_login_${u?.bdNo || 'u'}`), u));
      Object.keys(pending.users || {}).forEach((docId) => {
        if (!usersToPushMap.has(docId)) {
          const found = (this.db.detailedUsers || []).find(
            (u) => sanitizeDocId(u?.id || `user_login_${u?.bdNo || 'u'}`) === docId
          );
          if (found) usersToPushMap.set(docId, found);
        }
      });

      const settingsToPushMap = new Map<string, { settingKey: string; value: string }>();
      d.changedSettings.forEach((s) => settingsToPushMap.set(s.settingKey, s));
      Object.keys(pending.settings || {}).forEach((k) => {
        if (!settingsToPushMap.has(k) && isSyncableSettingKey(k)) {
          const v = window.localStorage.getItem(k);
          if (v !== null) settingsToPushMap.set(k, { settingKey: k, value: v });
        }
      });

      const airmenList = Array.from(airmenToPushMap.values());
      const assignUpsertList = Array.from(assignToPushMap.values());
      const assignDelList = Array.from(assignToDelMap.values());
      const histList = Array.from(histToPushMap.values());
      const userList = Array.from(usersToPushMap.values());
      const settingsList = Array.from(settingsToPushMap.values());

      if (
        airmenList.length === 0 &&
        assignUpsertList.length === 0 &&
        assignDelList.length === 0 &&
        histList.length === 0 &&
        userList.length === 0 &&
        settingsList.length === 0
      ) {
        window.localStorage.removeItem('baf_pending_sync');
        return true;
      }

      this.isPushing = true;
      isSyncingActive = true;
      broadcastSyncState();
      emitSyncProgress(10, 'Uploading changed items to Firebase...');

      try {
        const changedCollections: string[] = [];

        if (airmenList.length > 0) {
          await pushAirmenToFirebase(airmenList);
          changedCollections.push('airmen');
        }
        emitSyncProgress(35, 'Syncing duty updates...');
        if (assignDelList.length > 0) {
          await softDeleteDutyAssignmentsInFirebase(assignDelList);
          changedCollections.push('duty_assignments');
        }
        if (assignUpsertList.length > 0) {
          await pushDutyAssignmentsToFirebase(assignUpsertList);
          changedCollections.push('duty_assignments');
        }
        emitSyncProgress(60, 'Syncing history & user profiles...');
        if (histList.length > 0) {
          await pushParadeStatesToFirebase(histList);
          changedCollections.push('parade_states');
        }
        if (userList.length > 0) {
          await pushUserProfilesToFirebase(userList);
          changedCollections.push('user_profiles');
        }
        emitSyncProgress(85, 'Syncing changed settings...');
        if (settingsList.length > 0) {
          await pushAppSettingsToFirebase(settingsList);
          settingsList.forEach((s) => lastSyncedSettingsMap.set(s.settingKey, s.value));
          changedCollections.push('app_settings');
        }

        if (changedCollections.length > 0) {
          await publishSyncManifest(Array.from(new Set(changedCollections)), 'delta_sync');
        }

        clearPendingDeltas({
          airmenIds: Array.from(airmenToPushMap.keys()),
          assignmentDocIds: [...Array.from(assignToPushMap.keys()), ...Array.from(assignToDelMap.keys())],
          historyIds: Array.from(histToPushMap.keys()),
          userIds: Array.from(usersToPushMap.keys()),
          settingKeys: Array.from(settingsToPushMap.keys()),
        });

        this.lastSyncedDbStr = JSON.stringify(this.db);
        const curMatrix = window.localStorage.getItem('baf_official_duty_matrix_v4');
        if (curMatrix) lastSyncedMatrixRaw = curMatrix;

        const nowIso = new Date().toISOString();
        this.lastPullAt = nowIso;
        window.localStorage.setItem(LAST_FIREBASE_PULL_KEY, nowIso);
        window.localStorage.removeItem('baf_pending_sync');
        firebaseConnected = true;
        firebaseLastSyncTime = nowIso;
        window.localStorage.setItem('baf_cloud_connected', 'true');
        window.localStorage.setItem('baf_cloud_last_sync', nowIso);

        emitSyncProgress(100, 'Synced changed items to Firebase!');
        addSyncLog({
          timestamp: nowIso,
          type: 'PUSH',
          status: 'SUCCESS',
          message: `Synced ${airmenList.length} airmen, ${assignUpsertList.length + assignDelList.length} duties, ${histList.length} logs, ${settingsList.length} settings.`,
        });
        return true;
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isQuota = isQuotaExceededError(err) || isFirestoreQuotaExceeded();
        addSyncLog({
          timestamp: new Date().toISOString(),
          type: 'PUSH',
          status: 'ERROR',
          message: isQuota
            ? 'Firebase quota exceeded — changes safely saved in Local Cloud queue.'
            : `Firebase push error: ${msg}`,
        });
        window.localStorage.setItem('baf_pending_sync', 'true');
        return false;
      } finally {
        this.isPushing = false;
        isSyncingActive = false;
        broadcastSyncState();
      }
    };

    if (immediate) {
      return doSave();
    }

    const desiredMode: 'single' | 'multi' = isMultiUserMode() ? 'multi' : 'single';
    const intervalMs = desiredMode === 'multi' ? MULTI_USER_BACKUP_INTERVAL_MS : SINGLE_USER_BACKUP_INTERVAL_MS;

    // Keep existing timer if mode hasn't changed so 30-min/10-sec backup triggers reliably
    if (this.saveTimeout && this.scheduledMode === desiredMode) {
      return true;
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.scheduledMode = desiredMode;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.scheduledMode = null;
      doSave();
    }, intervalMs);

    return true;
  }

  /**
   * Migrate all local data to Firebase Firestore
   */
  public async migrateToFirebase(): Promise<FirebaseMigrationResult> {
    return await executeFullMigrationToFirebase(this.db);
  }

  public async syncDutyMatrixToCloud(providedMatrix?: any[]): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const raw = providedMatrix ? JSON.stringify(providedMatrix) : window.localStorage.getItem('baf_official_duty_matrix_v4');
      if (!raw) return false;
      const matrix = JSON.parse(raw);
      if (!Array.isArray(matrix)) return false;

      const nowIso = new Date().toISOString();
      window.localStorage.setItem('baf_official_duty_matrix_v4', JSON.stringify(matrix));
      window.localStorage.setItem('baf_matrix_last_modified', String(Date.now()));

      recordPendingDeltas({
        settingKeys: ['baf_official_duty_matrix_v4'],
      });

      if (!isFirebaseConfigured || isFirestoreQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return true;
      }

      const pushed = await pushAppSettingsToFirebase([
        {
          settingKey: 'baf_official_duty_matrix_v4',
          value: JSON.stringify(matrix),
          updatedAt: nowIso,
        },
      ]);

      if (pushed > 0) {
        lastSyncedSettingsMap.set('baf_official_duty_matrix_v4', JSON.stringify(matrix));
        lastSyncedMatrixRaw = JSON.stringify(matrix);
        clearPendingDeltas({ settingKeys: ['baf_official_duty_matrix_v4'] });
        await publishSyncManifest(['app_settings'], 'duty_matrix_update');
        window.localStorage.removeItem('baf_pending_sync');
        emitSyncProgress(100, 'Duty Matrix synced to Firebase');
        addSyncLog({ timestamp: nowIso, type: 'PUSH', status: 'SUCCESS', message: 'Duty Matrix synced to Firebase Firestore.' });
      }
      return true;
    } catch (err: any) {
      console.warn('Failed to sync duty matrix to Firebase:', err);
      return false;
    }
  }

  private loadInitialLocalState(): LocalStorageDB {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.airmen) && parsed.airmen.length > 0) {
            
            // LOCAL ID MIGRATION TO BD FORMAT
            const idMap = new Map<string, string>();
            const migratedAirmen = parsed.airmen.map((a: any) => {
               const cleanBd = String(a.bdNo || '').replace(/[^0-9]/g, '');
               let newId = cleanBd ? `BD/${cleanBd}` : a.id;
               if (!newId || newId === "airman-undefined") {
                  newId = "airman-" + Math.random().toString(36).slice(2, 10);
               }
               if (a.id !== newId) idMap.set(a.id, newId);
               return { ...a, id: newId };
            });
            
            const migratedAssignments = parsed.assignments || {};
            if (idMap.size > 0) {
                Object.keys(migratedAssignments).forEach(month => {
                    migratedAssignments[month] = migratedAssignments[month].map((asn: any) => {
                        if (idMap.has(asn.airmanId)) {
                             asn.airmanId = idMap.get(asn.airmanId);
                             asn.id = `asn_${asn.airmanId}_${asn.date}_${asn.dutyCode}_${asn.idaShift || 'n'}_${asn.disposalScope || 'ALL'}`;
                        }
                        return asn;
                    });
                });
                
                if (typeof window !== 'undefined') {
                   window.localStorage.setItem('baf_pending_sync', 'true');
                }
            }

            if (!migratedAssignments['2026-07'] || migratedAssignments['2026-07'].length < 50) {
              migratedAssignments['2026-07'] = generateOfficialMonthAssignments(2026, 7);
            }
            if (!migratedAssignments['2026-08'] || migratedAssignments['2026-08'].length < 50) {
              migratedAssignments['2026-08'] = generateOfficialMonthAssignments(2026, 8);
            }

            const defaultInactiveIds = new Set(INITIAL_AIRMEN.filter(a => a.active === false).map(a => a.id));
            const syncedAirmen = (migratedAirmen || []).map((a: any) => {
              const initA = INITIAL_AIRMEN.find(i => (i.bdNo && i.bdNo === a.bdNo) || (i.id && i.id === a.id));
              const isActive = defaultInactiveIds.has(a.id) ? false : (a.active !== false);
              return {
                ...a,
                fullName: (a.fullName && a.fullName !== a.name) ? a.fullName : (initA?.fullName || a.fullName || a.name),
                flightName: a.flightName || a.flight || a.Flight || initA?.flightName || 'Admin',
                email: a.email || a.gmail || undefined,
                active: isActive,
              };
            });

            // DEDUPLICATE AIRMEN BY UNIQUE BD NUMBER DIGITS
            const seenBd = new Set<string>();
            const dedupedAirmen: any[] = [];
            syncedAirmen.forEach((a: any) => {
              const digits = String(a.bdNo || a.id || '').replace(/\D/g, '');
              const k = digits || a.id || a.bdNo;
              if (k && !seenBd.has(k)) {
                seenBd.add(k);
                dedupedAirmen.push(a);
              }
            });

            // DEDUPLICATE ASSIGNMENTS
            Object.keys(migratedAssignments).forEach((m) => {
              const list = migratedAssignments[m] || [];
              const seenAsn = new Set<string>();
              const cleanList: any[] = [];
              list.forEach((asn: any) => {
                const airDigits = String(asn.airmanId || '').replace(/\D/g, '');
                const shift = asn.idaShift || asn.shift || 'n';
                const scope = asn.disposalScope || 'ALL';
                const k = `${airDigits}_${asn.date}_${asn.dutyCode}_${shift}_${scope}`;
                if (!seenAsn.has(k)) {
                  seenAsn.add(k);
                  cleanList.push(asn);
                }
              });
              migratedAssignments[m] = cleanList;
            });

            const db: LocalStorageDB = {
              airmen: normalizeAirmenSeniority(dedupedAirmen),
              assignments: migratedAssignments,

              activityHistory: Array.isArray(parsed.activityHistory) ? parsed.activityHistory : [],
              adminPasscode: parsed.adminPasscode || DEFAULT_ADMIN_PASSCODE,
              detailedUsers: parsed.detailedUsers || [],
              importHistory: parsed.importHistory || [],
              lastUpdated: parsed.lastUpdated || new Date().toISOString(),
            };

            // If duplicates were purged from localStorage, immediately save the clean DB
            if (dedupedAirmen.length !== parsed.airmen.length) {
              try {
                if (typeof window !== 'undefined' && window.localStorage) {
                  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
                }
              } catch (e) {}
            }

            return db;
          }
        }
      }
    } catch (err) {
      console.warn('Could not read from localStorage, using initial state:', err);
    }

    // Default fresh DB with full official airmen and roster data
    const initialPasscode = DEFAULT_ADMIN_PASSCODE;
    const initialDb: LocalStorageDB = {
      airmen: normalizeAirmenSeniority([...INITIAL_AIRMEN]),
      assignments: {
        '2026-07': generateOfficialMonthAssignments(2026, 7),
        '2026-08': generateOfficialMonthAssignments(2026, 8),
      },
      activityHistory: [],
      adminPasscode: initialPasscode,
      detailedUsers: [],
      importHistory: [],
      lastUpdated: new Date().toISOString(),
    };

    this.saveToStorage(initialDb, false, false, true);
    return initialDb;
  }

  public forceSave() { this.saveToStorage(this.db, true, true, true); }
  public saveToStorage(dbToSave: LocalStorageDB = this.db, notify: boolean = true, pushToFirebase: boolean = true, updateTimestamp: boolean = true) {
    try {
      if (updateTimestamp) {
        dbToSave.lastUpdated = new Date().toISOString();
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dbToSave));
      }
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }

    // Persist to server local JSON storage (data/baf_unit_data.json)
    if (typeof window !== 'undefined') {
      try {
        const rawFetch = (window as any).__baf_raw_fetch || window.fetch;
        rawFetch('/api/database/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dbToSave),
        }).catch((err: any) => {
          console.warn('Server database sync warning:', err);
        });
      } catch (e) {
        console.warn('Server save dispatch error:', e);
      }

      // Automatically trigger debounced backup to user's Google Drive if connected
      try {
        scheduleDriveAutoBackup();
      } catch (e) {
        console.warn('Google Drive auto backup schedule warning:', e);
      }

      if (pushToFirebase) {
        this.saveToFirebase(dbToSave, false);
      }
    }

    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_state_updated', { detail: { source: 'localDatabase' } }));
    }
  }

  private recordActivity(action: Omit<ActivityHistoryItem, 'id' | 'timestamp'>) {
    if (!this.db.activityHistory) {
      this.db.activityHistory = [];
    }
    const air = this.db.airmen.find((a) => a.id === action.airmanId);
    const item: ActivityHistoryItem = {
      ...action,
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      airmanRank: air?.rank,
      airmanTrade: air?.trade,
    };
    this.db.activityHistory.unshift(item);
    if (this.db.activityHistory.length > 100) {
      // this.db.activityHistory = this.db.activityHistory.slice(0, 100);
    }
  }

  public logSystemAction(airmanId: string, airmanName: string, description: string) {
    this.recordActivity({
      actionType: 'SYSTEM_ACTION',
      airmanId,
      airmanName,
      description
    });
  }

  // --- AIRMEN CRUD ---
  public getAirmen(filters?: { flight?: string; rank?: string; search?: string }): Airman[] {
    let list = [...this.db.airmen];
    if (filters?.flight && filters.flight !== 'Overall') {
      list = list.filter((a) => a.flightName === filters.flight);
    }
    if (filters?.rank && filters.rank !== 'All') {
      list = list.filter((a) => a.rank === filters.rank);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.bdNo.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          a.trade.toLowerCase().includes(q) ||
          a.addressBlock.toLowerCase().includes(q)
      );
    }
    return sortAirmenBySeniority(list);
  }

  public clearAllAirmen(): void {
    this.db.airmen = [];
    this.saveToStorage();
    this.recordActivity({
      type: 'Airman_Status',
      airmanId: 'ALL',
      dutyCode: 'OFF',
      details: 'Cleared all airmen from Nominal Roll',
      timestamp: new Date().toISOString()
    } as any);
  }


  public addAirman(data: Partial<Airman>): Airman {
    const newSerNo = this.db.airmen.length > 0 ? Math.max(...this.db.airmen.map((a) => a.serNo)) + 1 : 1;
    const cleanBd = String(data.bdNo || '').replace(/[^0-9]/g, '');
    const id = cleanBd ? `BD/${cleanBd}` : `airman-${Date.now()}`;
    const newAirman: Airman = {
      id,
      serNo: newSerNo,
      seniority: (data.seniority !== undefined && data.seniority !== null && !isNaN(Number(data.seniority))) ? Number(data.seniority) : (this.db.airmen.length + 1),
      code: data.code || `${data.rank || 'LAC'}-${(data.name || 'AIR').slice(0, 3).toUpperCase()}`,
      bdNo: data.bdNo || `BD/${Date.now().toString().slice(-6)}`,
      rank: data.rank || 'LAC',
      fullName: data.fullName || data.name || 'Airman',
      name: data.name || data.fullName || 'Airman',
      trade: data.trade || 'General Tech',
      addressBlock: data.addressBlock || '',
      permanentAddress: data.permanentAddress || '',
      bloodGroup: data.bloodGroup || '',
      mobileNo: data.mobileNo || '01700000000',
      flightName: (data.flightName as FlightName) || 'Admin',
      remarks: data.remarks || 'Newly Enlisted',
      dateJoined: data.dateJoined || '',
      dateLeft: data.dateLeft || '',
      leaveReason: data.leaveReason || '',
      email: data.email || undefined,
      active: data.active !== undefined ? data.active : true,
    };

    this.db.airmen.push(newAirman);
    if (data.seniority !== undefined && data.seniority !== null && !isNaN(Number(data.seniority))) {
      const { updatedAirmen } = reorderAirmanSeniority(this.db.airmen, newAirman.id, Number(data.seniority));
      this.db.airmen = updatedAirmen;
    } else {
      this.db.airmen = normalizeAirmenSeniority(this.db.airmen);
    }
    this.logSystemAction(newAirman.id, `${newAirman.rank} ${newAirman.name}`, 'Added new airman to Nominal Roll');
    this.saveToStorage();

    // Auto add to Canteen Member DB (Firebase & Local Queue)
    try {
      const pureBd = cleanBd || String(newAirman.bdNo || '').replace(/\D/g, '');
      const canteenMemberPayload = {
        airman_id: newAirman.id,
        'BD No': pureBd,
        Rank: newAirman.rank,
        Surname: newAirman.name,
        Contact: newAirman.mobileNo || 'N/A',
        Due: 0,
        updatedAt: new Date().toISOString(),
      };
      if (isFirebaseConfigured && !isFirestoreQuotaExceeded()) {
        pushCanteenMembersToFirebase([canteenMemberPayload]).catch(() => {
          recordPendingDeltas({ canteenMemberIds: [newAirman.id] });
        });
      } else {
        recordPendingDeltas({ canteenMemberIds: [newAirman.id] });
      }
    } catch (cErr) {
      console.warn('Auto-sync airman to Canteen caught error:', cErr);
    }

    return this.db.airmen.find(a => a.id === id) || newAirman;
  }

  public bulkAddAirmen(airmenList: Partial<Airman>[]): { count: number; airmen: Airman[] } {
    let currentSerNo = this.db.airmen.length > 0 ? Math.max(...this.db.airmen.map((a) => a.serNo)) : 0;
    const createdAirmen: Airman[] = [];

    for (const item of airmenList) {
      currentSerNo++;
      const id = `airman-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanBd = item.bdNo ? (item.bdNo.toUpperCase().startsWith('BD') ? item.bdNo : `BD/${item.bdNo}`) : `BD/${Date.now().toString().slice(-6)}`;
      const newAirman: Airman = {
        id,
        serNo: currentSerNo,
        seniority: item.seniority !== undefined ? Number(item.seniority) : undefined,
        code: item.code || `${item.rank || 'LAC'}-${(item.name || 'AIR').slice(0, 3).toUpperCase()}`,
        bdNo: cleanBd,
        rank: item.rank || 'LAC',
        fullName: item.fullName || item.name || 'Airman',
        name: item.name || item.fullName || 'Airman',
        trade: item.trade || 'General Tech',
        addressBlock: item.addressBlock || '',
        permanentAddress: item.permanentAddress || '',
        bloodGroup: item.bloodGroup || '',
        mobileNo: item.mobileNo || '01700000000',
        flightName: (item.flightName as FlightName) || 'Admin',
        dateJoined: item.dateJoined || '',
        remarks: item.remarks || 'Bulk Imported',
        active: true,
      };

      createdAirmen.push(newAirman);
      this.db.airmen.push(newAirman);
    }

    this.db.airmen = normalizeAirmenSeniority(this.db.airmen);
    this.saveToStorage();

    // Auto add imported airmen to Canteen Member DB (Firebase & Local Queue)
    try {
      if (createdAirmen.length > 0) {
        const nowIso = new Date().toISOString();
        const canteenBatch = createdAirmen.map((a) => ({
          airman_id: a.id,
          'BD No': String(a.bdNo || '').replace(/\D/g, ''),
          Rank: a.rank,
          Surname: a.name,
          Contact: a.mobileNo || 'N/A',
          Due: 0,
          updatedAt: nowIso,
        }));
        if (isFirebaseConfigured && !isFirestoreQuotaExceeded()) {
          pushCanteenMembersToFirebase(canteenBatch).catch(() => {
            recordPendingDeltas({ canteenMemberIds: canteenBatch.map((c) => c.airman_id) });
          });
        } else {
          recordPendingDeltas({ canteenMemberIds: canteenBatch.map((c) => c.airman_id) });
        }
      }
    } catch (cErr) {
      console.warn('Bulk auto-sync airmen to Canteen caught error:', cErr);
    }

    // Log in activity history
    this.recordActivity({
      actionType: 'BULK_IMPORT_AIRMEN' as any,
      airmanId: 'BULK_AIRMEN',
      airmanName: `${createdAirmen.length} Airmen Imported`,
      dutyCode: 'GD',
      fromDate: '',
      toDate: '',
      notes: `Bulk imported ${createdAirmen.length} airmen to Nominal Roll`,
    });

    return { count: createdAirmen.length, airmen: createdAirmen };
  }

  public async updateAirman(id: string, data: Partial<Airman>): Promise<Airman | null> {
    const cleanIdBd = id.replace(/\D/g, '');
    const cleanDataBd = data.bdNo ? String(data.bdNo).replace(/\D/g, '') : '';
    const idx = this.db.airmen.findIndex((a) => {
      if (a.id === id) return true;
      const aBd = a.bdNo ? String(a.bdNo).replace(/\D/g, '') : '';
      if (cleanIdBd && aBd && aBd === cleanIdBd) return true;
      if (cleanDataBd && aBd && aBd === cleanDataBd) return true;
      return false;
    });
    if (idx === -1) return null;
    const previous = this.db.airmen[idx];

    // Check if seniority order needs shifting
    if (data.seniority !== undefined && data.seniority !== null && !isNaN(Number(data.seniority))) {
      const targetSen = Number(data.seniority);
      const currentSen = previous.seniority ?? (idx + 1);
      if (targetSen !== currentSen) {
        const { updatedAirmen } = reorderAirmanSeniority(this.db.airmen, previous.id, targetSen);
        this.db.airmen = updatedAirmen;
      }
    }

    // If rank changed, re-normalize to ensure military hierarchy
    if (data.rank && data.rank !== previous.rank) {
      this.db.airmen = normalizeAirmenSeniority(this.db.airmen);
    }

    const cleanBd = String(data.bdNo || previous.bdNo || '').replace(/\D/g, '');
    const canonicalId = previous.id?.startsWith('BD/') ? previous.id : (cleanBd ? `BD/${cleanBd}` : previous.id);

    const newIdx = this.db.airmen.findIndex((a) => a.id === previous.id || (cleanBd && a.bdNo?.replace(/\D/g, '') === cleanBd));
    if (newIdx !== -1) {
      this.db.airmen[newIdx] = {
        ...this.db.airmen[newIdx],
        ...data,
        id: canonicalId,
        seniority: this.db.airmen[newIdx].seniority,
      };
    }

    if (previous.active && !data.active) {
      this.logSystemAction(canonicalId, `${previous.rank} ${previous.name}`, 'Posted out / Marked inactive from Nominal Roll');
    } else if (!previous.active && data.active) {
      this.logSystemAction(canonicalId, `${previous.rank} ${previous.name}`, 'Reactivated in Nominal Roll');
    }

    this.saveToStorage(this.db, true, false);

    // Save to Cloud Supabase safely and exclusively via saveToFirebase
    await this.saveToFirebase(this.db, true);

    return this.db.airmen[newIdx !== -1 ? newIdx : idx];
  }

  public deleteAirman(id: string): boolean {
    const initialCount = this.db.airmen.length;
    const target = this.db.airmen.find((a) => a.id === id);
    if (target) {
        this.logSystemAction(id, `${target.rank} ${target.name}`, 'Permanently deleted from Nominal Roll');
    }
    this.db.airmen = normalizeAirmenSeniority(this.db.airmen.filter((a) => a.id !== id));

    // Clean assignments
    if (this.db.assignments) {
      Object.keys(this.db.assignments).forEach((monthKey) => {
        if (Array.isArray(this.db.assignments[monthKey])) {
          this.db.assignments[monthKey] = this.db.assignments[monthKey].filter((ass) => ass.airmanId !== id);
        }
      });
    }
    
    // Clean detailedUsers
    if (this.db.detailedUsers) {
      this.db.detailedUsers = this.db.detailedUsers.filter((u: any) => u.airmanId !== id && u.bdNo !== target?.bdNo);
    }

    this.saveToStorage();
    


    return true;
  }

  // --- ROSTER & ASSIGNMENTS ---
  public getRoster(monthKey?: string): { monthKey: string; assignments: DutyAssignment[] } {
    const today = new Date();
    const defaultMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const targetMonth = monthKey || defaultMonthKey;
    const rawAssignments = this.db.assignments[targetMonth] || [];

    return { monthKey: targetMonth, assignments: [...rawAssignments] };
  }

  public getRosterYear(year?: number): { year: number; assignments: DutyAssignment[] } {
    const targetYear = year || new Date().getFullYear();
    const prefix = `${targetYear}-`;
    const assignments: DutyAssignment[] = [];
    Object.keys(this.db.assignments).forEach((mKey) => {
      if (mKey.startsWith(prefix)) {
        assignments.push(...(this.db.assignments[mKey] || []));
      }
    });
    return { year: targetYear, assignments };
  }

  private isSameAirmanId(idA?: string, idB?: string): boolean {
    if (!idA || !idB) return false;
    if (idA === idB) return true;
    if (idA.replace(/\//g, '_') === idB.replace(/\//g, '_')) return true;
    const dA = String(idA).replace(/\D/g, '');
    const dB = String(idB).replace(/\D/g, '');
    return Boolean(dA && dB && dA === dB);
  }

  public assignDuty(monthKey: string, assignment: DutyAssignment): DutyAssignment {
    if (!this.db.assignments[monthKey]) {
      this.db.assignments[monthKey] = [];
    }
    const list = this.db.assignments[monthKey];
    let index = -1;

    const isDep = (code: any) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
    if (assignment.dutyCode === 'IDAC' || assignment.dutyCode === 'IDA') {
      index = list.findIndex(
        (a) => this.isSameAirmanId(a.airmanId, assignment.airmanId) && a.date === assignment.date && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA')
      );
    } else {
      index = list.findIndex(
        (a) => this.isSameAirmanId(a.airmanId, assignment.airmanId) && a.date === assignment.date && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(assignment.dutyCode)
      );
    }

    let sanitizedCode: any = assignment.dutyCode;
    if (sanitizedCode === 'DUTY' || sanitizedCode === 'DUTY_ON') {
      const n = (assignment.notes || '').toUpperCase();
      if (n.includes('BTF')) sanitizedCode = 'BTF';
      else if (n.includes('NTF')) sanitizedCode = 'NTF';
      else if (n.includes('HALISHAHAR')) sanitizedCode = 'HALISHAHAR';
      else if (n.includes('AIR')) sanitizedCode = 'AIRPORT';
      else if (n.includes('IDAC')) sanitizedCode = 'IDAC';
      else if (n.includes('CANTEEN')) sanitizedCode = 'CANTEEN';
      else sanitizedCode = 'GD';
    }

    const prevAssignment = index >= 0 ? { ...list[index] } : null;
    const newAss: DutyAssignment = {
      ...assignment,
      dutyCode: sanitizedCode,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      list[index] = newAss;
    } else {
      list.push(newAss);
    }

    const air = this.db.airmen.find((a) => a.id === assignment.airmanId);
    this.recordActivity({
      actionType: assignment.dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_DUTY',
      airmanId: assignment.airmanId,
      airmanName: air ? `${air.rank} ${air.name}` : assignment.airmanId,
      dutyCode: assignment.dutyCode,
      idaShift: assignment.idaShift,
      fromDate: assignment.date,
      toDate: assignment.date,
      notes: assignment.notes,
      previousAssignments: [
        {
          airmanId: assignment.airmanId,
          date: assignment.date,
          dutyCode: prevAssignment?.dutyCode,
          idaShift: prevAssignment?.idaShift,
          notes: prevAssignment?.notes,
        },
      ],
    });

    this.saveToStorage();
    return newAss;
  }

  public assignRange(params: {
    airmanId: string;
    dutyCode: DutyCategoryCode;
    idaShift?: IDAShift;
    fromDate: string;
    toDate: string;
    notes?: string;
    proxyForFlight?: FlightName;
    replaceAirmanId?: string;
    disposalScope?: 'ALL' | 'PARADE' | 'PT' | 'NIGHT_COUNT';
    replaceHistoryId?: string;
  }): { count: number; assignedDates: string[] } {
    const { airmanId, dutyCode, idaShift, fromDate, toDate, notes, proxyForFlight, replaceAirmanId, disposalScope, replaceHistoryId } = params;

    // If an existing history entry is being replaced/edited, remove it first so no ghost entry remains
    if (replaceHistoryId && this.db.activityHistory) {
      const oldHistIdx = this.db.activityHistory.findIndex((h) => h.id === replaceHistoryId);
      if (oldHistIdx !== -1) {
        this.db.activityHistory.splice(oldHistIdx, 1);
      }
    }

    const assignedDates = getDatesInRange(fromDate, toDate);
    const prevStates: Array<{ airmanId: string; date: string; dutyCode?: any; idaShift?: any; notes?: string }> = [];

    for (const dateStr of assignedDates) {
      const monthKey = dateStr.slice(0, 7);
      if (!this.db.assignments[monthKey]) {
        this.db.assignments[monthKey] = [];
      }

      if (replaceAirmanId && !this.isSameAirmanId(replaceAirmanId, airmanId)) {
        const oldIndex = this.db.assignments[monthKey].findIndex((a) => this.isSameAirmanId(a.airmanId, replaceAirmanId) && a.date === dateStr);
        if (oldIndex >= 0) {
          const oldItem = this.db.assignments[monthKey][oldIndex];
          prevStates.push({
            airmanId: replaceAirmanId,
            date: dateStr,
            dutyCode: oldItem.dutyCode,
            idaShift: oldItem.idaShift,
            notes: oldItem.notes,
          });
          this.db.assignments[monthKey].splice(oldIndex, 1);
        }
      }

      const list = this.db.assignments[monthKey];
      let index = -1;
      const isDep = (code: any) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
      const scope = disposalScope || 'ALL';
      if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(dutyCode)) {
        if (idaShift === 'Night') {
          index = list.findIndex((a) => this.isSameAirmanId(a.airmanId, airmanId) && a.date === dateStr && (
            ((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') ||
            a.dutyCode === 'ON_PARADE'
          ) && (a.disposalScope || 'ALL') === scope);
        } else {
          index = list.findIndex((a) => this.isSameAirmanId(a.airmanId, airmanId) && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(dutyCode) && (a.disposalScope || 'ALL') === scope);
        }
      } else {
        index = list.findIndex((a) => this.isSameAirmanId(a.airmanId, airmanId) && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && isDep(a.dutyCode) === isDep(dutyCode) && (a.disposalScope || 'ALL') === scope);
      }



      if (index >= 0) {
        prevStates.push({ airmanId, date: dateStr, dutyCode: list[index].dutyCode, idaShift: list[index].idaShift, notes: list[index].notes });
      } else {
        prevStates.push({ airmanId, date: dateStr, dutyCode: undefined });
      }

      let sanitizedCode: any = dutyCode;
      if (sanitizedCode === 'DUTY' || sanitizedCode === 'DUTY_ON') {
        const n = (notes || '').toUpperCase();
        if (n.includes('BTF')) sanitizedCode = 'BTF';
        else if (n.includes('NTF')) sanitizedCode = 'NTF';
        else if (n.includes('HALISHAHAR')) sanitizedCode = 'HALISHAHAR';
        else if (n.includes('AIR')) sanitizedCode = 'AIRPORT';
        else if (n.includes('IDAC')) sanitizedCode = 'IDAC';
        else if (n.includes('CANTEEN')) sanitizedCode = 'CANTEEN';
        else sanitizedCode = 'GD';
      }

      const assignment: DutyAssignment = {
        airmanId,
        date: dateStr,
        dutyCode: sanitizedCode,
        dutyName: (String(sanitizedCode).startsWith('CUST_') || String(sanitizedCode).includes('1794394'))
          ? (getCustomDutyName(sanitizedCode) || 'Escort Duty')
          : undefined,
        idaShift,
        proxyForFlight,
        disposalScope: disposalScope || 'ALL',
        notes: notes || '',
        updatedAt: new Date().toISOString(),
      };

      if (index >= 0) {
        list[index] = assignment;
      } else {
        list.push(assignment);
      }
    }

    const air = this.db.airmen.find((a) => a.id === airmanId);
    this.recordActivity({
      actionType: dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_RANGE',
      airmanId,
      airmanName: air ? `${air.rank} ${air.name}` : airmanId,
      dutyCode,
      idaShift,
      fromDate,
      toDate,
      notes,
      previousAssignments: prevStates,
    });

    this.saveToStorage();
    return { count: assignedDates.length, assignedDates };
  }

  public batchAssign(params: {
    fromDate: string;
    toDate: string;
    assignments: Array<{
      airmanId: string;
      dutyCode: DutyCategoryCode;
      idaShift?: IDAShift;
      proxyForFlight?: FlightName;
      notes?: string;
      disposalScope?: 'ALL' | 'PARADE' | 'PT' | 'NIGHT_COUNT';
    }>;
    removedAirmanIds?: string[];
  }): { count: number; assignedDates: string[] } {
    const { fromDate, toDate, assignments, removedAirmanIds } = params;
    const assignedDates = getDatesInRange(fromDate, toDate);
    const prevStates: Array<{ airmanId: string; date: string; dutyCode?: any; idaShift?: any; notes?: string }> = [];

    // Remove unassigned
    if (Array.isArray(removedAirmanIds) && removedAirmanIds.length > 0) {
      for (const dateStr of assignedDates) {
        const monthKey = dateStr.slice(0, 7);
        if (this.db.assignments[monthKey]) {
          for (const remId of removedAirmanIds) {
            const found = this.db.assignments[monthKey].find((a) => this.isSameAirmanId(a.airmanId, remId) && a.date === dateStr);
            if (found) {
              prevStates.push({ airmanId: remId, date: dateStr, dutyCode: found.dutyCode, idaShift: found.idaShift, notes: found.notes });
            }
            this.db.assignments[monthKey] = this.db.assignments[monthKey].filter(
              (a) => !(this.isSameAirmanId(a.airmanId, remId) && a.date === dateStr)
            );
          }
        }
      }
    }

    // Apply assignments
    for (const item of assignments) {
      const { airmanId, dutyCode, idaShift, proxyForFlight, notes, disposalScope } = item;
      if (!airmanId || !dutyCode) continue;

      for (const dateStr of assignedDates) {
        const monthKey = dateStr.slice(0, 7);
        if (!this.db.assignments[monthKey]) {
          this.db.assignments[monthKey] = [];
        }

        const list = this.db.assignments[monthKey];
        let index = -1;
        const isDep = (code: any) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
        if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(dutyCode)) {
          index = list.findIndex((a) => this.isSameAirmanId(a.airmanId, airmanId) && a.date === dateStr && (
            a.dutyCode === 'IDAC' || a.dutyCode === 'IDA' ||
            ['ON_PARADE', 'DUTY', 'DUTY_ON', 'IDAC CENTER', 'IDA CENTER'].includes(a.dutyCode as any)
          ));
        } else {
          const scope = disposalScope || 'ALL';
          index = list.findIndex((a) => this.isSameAirmanId(a.airmanId, airmanId) && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night') && (a.disposalScope || 'ALL') === scope && isDep(a.dutyCode) === isDep(dutyCode));
        }

        const assignment: DutyAssignment = {
          airmanId,
          date: dateStr,
          dutyCode,
          idaShift,
          proxyForFlight,
          disposalScope: disposalScope || 'ALL',
          notes: notes || '',
          updatedAt: new Date().toISOString(),
        };

        if (index >= 0) {
          list[index] = assignment;
        } else {
          list.push(assignment);
        }
      }
    }

    this.saveToStorage();
    return { count: assignments.length * assignedDates.length, assignedDates };
  }

  public deleteAssignment(airmanId: string, date: string, dutyCode?: DutyCategoryCode, idaShift?: any, disposalScope?: 'ALL' | 'PARADE' | 'PT' | 'NIGHT_COUNT'): boolean {
    const monthKey = date.slice(0, 7);
    if (!this.db.assignments[monthKey]) return false;

    const list = this.db.assignments[monthKey];
    let removed = false;

    if (dutyCode) {
      const initialLen = list.length;
      this.db.assignments[monthKey] = list.filter((a) => {
        if (!this.isSameAirmanId(a.airmanId, airmanId) || a.date !== date) return true; // keep others
        if (disposalScope && (a.disposalScope || 'ALL') !== disposalScope) return true; // keep if scope doesn't match
        const isDep = (code: any) => code && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
        if (isDep(dutyCode)) {
          return !isDep(a.dutyCode); // remove if matches
        }
        if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(dutyCode)) {
          if (idaShift) {
            return !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === idaShift);
          }
          return !(a.dutyCode === 'IDAC' || a.dutyCode === 'IDA');
        }
        return a.dutyCode !== dutyCode;
      });
      removed = this.db.assignments[monthKey].length < initialLen;
    } else {
      const initialLen = list.length;
      this.db.assignments[monthKey] = list.filter((a) => {
        if (!this.isSameAirmanId(a.airmanId, airmanId) || a.date !== date) return true;
        if (disposalScope && (a.disposalScope || 'ALL') !== disposalScope) return true; // keep if scope doesn't match
        return false;
      });
      removed = this.db.assignments[monthKey].length < initialLen;
    }

    if (removed) {
      this.saveToStorage();
    }

    return removed;
  }

  public deleteRange(params: {
    airmanId: string;
    fromDate: string;
    toDate: string;
    dutyCode?: DutyCategoryCode;
    idaShift?: any;
    disposalScope?: 'ALL' | 'PARADE' | 'PT' | 'NIGHT_COUNT';
  }): number {
    const { airmanId, fromDate, toDate, dutyCode, idaShift, disposalScope } = params;
    const dates = getDatesInRange(fromDate, toDate);
    let count = 0;

    for (const d of dates) {
      if (this.deleteAssignment(airmanId, d, dutyCode, idaShift, disposalScope)) {
        count++;
      }
    }

    return count;
  }

  public resetToEmptyRoster(): void {
    this.db.assignments = {};
    this.saveToStorage();
  }

  public clearMonth(monthKey: string): void {
    if (this.db.assignments[monthKey]) {
      delete this.db.assignments[monthKey];
      this.saveToStorage();
    }
  }

  public resetToOfficialData(): void {
    this.db.assignments = {
      
      
    };
    this.saveToStorage();
  }

  // --- PARADE STATE & PT STATE ---
  public getParadeState(params?: {
    date?: string;
    shift?: ParadeShift;
    flight?: FlightName | 'Overall';
    stateType?: string;
  }): ParadeStateResponse {
    const today = new Date().toISOString().split('T')[0];
    const date = params?.date || today;
    const shift = (params?.shift || 'Morning') as ParadeShift;
    const selectedFlight = params?.flight || 'Overall';
    const stateType = (params?.stateType || 'PARADE').toUpperCase();
    const isPT = stateType === 'PT';
    const isNightCount = stateType === 'NIGHT_COUNT';

    const monthKey = date.slice(0, 7);
    const monthAssignments = this.db.assignments[monthKey] || [];
    const dateAssignments = monthAssignments.filter((a) => a.date === date);

    let currentMatrix: DutyRatioTable[] = [];
    try {
      currentMatrix = getStoredDutyMatrix(date);
    } catch {
      currentMatrix = [...INITIAL_OFFICIAL_DUTY_MATRIX];
    }

    const getDutyRule = (assignment: DutyAssignment | undefined): {
      onParadeOnDutyDay: boolean;
      dutyOffNextDay: boolean;
      onPtNextDay?: boolean;
      matchedTitle?: string;
    } => {
      if (!assignment) return { onParadeOnDutyDay: false, dutyOffNextDay: false, onPtNextDay: true };
      const code = String(assignment.dutyCode || '').trim();
      const codeUpper = code.toUpperCase();
      const name = String((assignment as any)?.dutyName || '').trim();
      const notes = String(assignment.notes || '').trim();
      const s = (assignment.idaShift || '').trim().toLowerCase();

      const isEscortCodeOrText =
        codeUpper === 'ESCORT' ||
        codeUpper === 'ESC' ||
        codeUpper === 'ESCT' ||
        codeUpper.includes('1794394') ||
        name.toLowerCase().includes('escort') ||
        notes.toLowerCase().includes('escort');

      // Find in currentMatrix
      const table = currentMatrix.find(t => {
        if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(codeUpper)) {
          if (['IDAC', 'IDA'].includes(t.dutyCode)) {
            if (t.shiftLabel && s) {
              return t.shiftLabel.toLowerCase() === s;
            }
            return true;
          }
        }
        const tCodeUpper = String(t.dutyCode || '').toUpperCase().trim();
        const tIdLower = String(t.id || '').toLowerCase().trim();
        const tIdBaseLower = tIdLower.replace(/_duty$/, '');
        if (tCodeUpper && tCodeUpper === codeUpper) return true;
        if (tIdLower && (tIdLower === code.toLowerCase() || tIdBaseLower === code.toLowerCase())) return true;
        if (t.title) {
          const tTitle = t.title.toLowerCase().trim();
          if (name && tTitle === name.toLowerCase()) return true;
          if (notes && tTitle === notes.toLowerCase()) return true;
          if (code && tTitle === code.toLowerCase()) return true;
        }
        if (isEscortCodeOrText && (tCodeUpper.includes('1794394') || tIdLower.includes('1794394') || (t.title || '').toLowerCase().includes('escort'))) {
          return true;
        }
        return false;
      });

      // Also check custom duties
      let customDuty: any = undefined;
      try {
        const customs = getCustomDuties();
        const tIdLower = String(table?.id || '').toLowerCase().trim();
        const tIdBaseLower = tIdLower.replace(/_duty$/, '');
        customDuty = customs.find(cd => {
          const cdLower = String(cd.code || '').toLowerCase();
          const cdShortUpper = String(cd.shortName || '').toUpperCase();
          return (
            cdLower === code.toLowerCase() ||
            cdLower === tIdLower ||
            cdLower === tIdBaseLower ||
            (cdShortUpper && cdShortUpper === codeUpper) ||
            (isEscortCodeOrText && (cdLower.includes('1794394') || cd.name.toLowerCase().includes('escort'))) ||
            (name && cd.name.toLowerCase() === name.toLowerCase()) ||
            (notes && cd.name.toLowerCase() === notes.toLowerCase())
          );
        });
      } catch {}

      let onParadeOnDutyDay: boolean;
      let dutyOffNextDay: boolean;
      let onPtNextDay: boolean;

      if (table?.onParadeOnDutyDay !== undefined) {
        onParadeOnDutyDay = table.onParadeOnDutyDay;
      } else if (customDuty?.onParadeOnDutyDay !== undefined) {
        onParadeOnDutyDay = customDuty.onParadeOnDutyDay;
      } else {
        // Default: IDAC Night shift is on parade during day parade
        const isIdacNt = ['IDAC', 'IDA', 'IDA C', 'IDA_C'].includes(codeUpper) &&
          (s === 'night' || s === 'c' || s === 'nt' || notes.toLowerCase().includes('night'));
        onParadeOnDutyDay = isIdacNt;
      }

      if (table?.dutyOffNextDay !== undefined) {
        dutyOffNextDay = table.dutyOffNextDay;
      } else if (customDuty?.dutyOffNextDay !== undefined) {
        dutyOffNextDay = customDuty.dutyOffNextDay;
      } else {
        // Default: heavy / overnight duties get Duty Off
        const isIdacNt = ['IDAC', 'IDA', 'IDA C', 'IDA_C'].includes(codeUpper) &&
          (s === 'night' || s === 'c' || s === 'nt' || notes.toLowerCase().includes('night'));
        const isEscortDuty = codeUpper === 'ESCORT' || codeUpper === 'ESC' || codeUpper === 'ESCT' ||
          codeUpper.includes('1794394') || name.toLowerCase().includes('escort') || notes.toLowerCase().includes('escort');
        const isClassicHeavy = ['GD', 'BTF', 'NTF', 'AIRPORT', 'AIRFIELD', 'ATT', 'HALISHAHAR'].includes(codeUpper) || isIdacNt || isEscortDuty;
        dutyOffNextDay = isClassicHeavy;
      }

      if (table?.onPtNextDay !== undefined) {
        onPtNextDay = table.onPtNextDay;
      } else if (customDuty?.onPtNextDay !== undefined) {
        onPtNextDay = customDuty.onPtNextDay;
      } else {
        onPtNextDay = true;
      }

      return {
        onParadeOnDutyDay,
        dutyOffNextDay,
        onPtNextDay,
        matchedTitle: table?.title || customDuty?.name || (codeUpper.includes('1794394') || name.toLowerCase().includes('escort') ? 'Escort' : undefined)
      };
    };

    const assignmentMap = new Map<string, DutyAssignment>();

    const getAirmanKeyAliases = (rawId: string): string[] => {
      if (!rawId) return [];
      const keys = new Set<string>();
      keys.add(rawId);
      if (rawId.includes('/')) keys.add(rawId.replace(/\//g, '_'));
      if (rawId.includes('_')) keys.add(rawId.replace(/_/g, '/'));
      const digits = String(rawId).replace(/\D/g, '');
      if (digits) {
        keys.add(`BD_${digits}`);
        keys.add(`BD/${digits}`);
        keys.add(digits);
      }
      return Array.from(keys);
    };

    const findInAssignmentMap = (map: Map<string, DutyAssignment>, rawId: string): DutyAssignment | undefined => {
      if (!rawId) return undefined;
      if (map.has(rawId)) return map.get(rawId);
      const aliases = getAirmanKeyAliases(rawId);
      for (const k of aliases) {
        if (map.has(k)) return map.get(k);
      }
      return undefined;
    };

    const putIntoAssignmentMap = (map: Map<string, DutyAssignment>, a: DutyAssignment) => {
      const aliases = getAirmanKeyAliases(a.airmanId);
      aliases.forEach((k) => map.set(k, a));
    };

    // 1. Synthesize active multi-day entries (Leave, TDY) only if explicitly active Leave/TDY and not already tracked
    (this.db.activityHistory || []).forEach((h: any) => {
      const from = h.fromDate || h.from_date || h.date;
      const to = h.toDate || h.to_date || from;
      if (from && to && from <= date && to >= date) {
        const airId = h.airmanId || h.airman_id;
        if (!airId) return;
        const actType = String(h.actionType || h.type || '').toUpperCase();
        const rawCode = String(h.dutyCode || h.duty_code || '').toUpperCase();
        // Routine daily guard duties (GD, BTF, NTF, IDAC, AIRPORT, etc.) must NEVER be synthesized from history log!
        if (actType === 'GRANT_LEAVE' || rawCode === 'LEAVE' || rawCode === 'TDY') {
          const code = rawCode === 'TDY' ? 'TDY' : 'LEAVE';
          putIntoAssignmentMap(assignmentMap, {
            airmanId: airId,
            date: date,
            dutyCode: code as any,
            idaShift: h.idaShift || h.ida_shift || undefined,
            notes: h.notes || h.description || '',
            disposalScope: 'ALL',
          });
        }
      }
    });

    dateAssignments.forEach((a) => {
      const scope = a.disposalScope || 'ALL';
      const isApplicable = scope === 'ALL' || (isPT && scope === 'PT') || (isNightCount && scope === 'NIGHT_COUNT') || (!isPT && !isNightCount && scope === 'PARADE');
      if (isApplicable) {
        const existing = findInAssignmentMap(assignmentMap, a.airmanId);
        if (!existing) {
          putIntoAssignmentMap(assignmentMap, a);
        } else {
          // Priority logic:
          // 0. LEAVE is top military priority: routine duty cannot overwrite an active Leave!
          if (existing.dutyCode === 'LEAVE' && a.dutyCode !== 'LEAVE') {
            return; // Leave stays
          }
          if (a.dutyCode === 'LEAVE' && existing.dutyCode !== 'LEAVE') {
            putIntoAssignmentMap(assignmentMap, a);
            return;
          }

          // 1. Specific duty (like IDAC, GD, LEAVE, etc.) always beats baseline ON_PARADE
          const isBase = (code: string) => !code || code === 'ON_PARADE' || code === 'PT' || code === 'PT_PARADE';
          const existingIsBase = isBase(existing.dutyCode);
          const newIsBase = isBase(a.dutyCode);
          if (existingIsBase && !newIsBase) {
            putIntoAssignmentMap(assignmentMap, a);
            return;
          }
          if (!existingIsBase && newIsBase) {
            return; // Keep the specific duty
          }

          // 2. For PT or Night Count, IDAC Night is top priority duty
          const isIdacNt = (asn: DutyAssignment) =>
            (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(asn.dutyCode)) &&
            (asn.idaShift === 'Night' || (asn.notes || '').toLowerCase().includes('night') || (asn.notes || '').toLowerCase().includes('nt'));
          if ((isPT || isNightCount) && isIdacNt(a) && !isIdacNt(existing)) {
            putIntoAssignmentMap(assignmentMap, a);
            return;
          }
          if ((isPT || isNightCount) && !isIdacNt(a) && isIdacNt(existing)) {
            return;
          }

          // 3. Regular duty overwrites deployment
          const isDeployment = (code: string) => ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
          const existingIsDep = isDeployment(existing.dutyCode);
          const newIsDep = isDeployment(a.dutyCode);
          if (existingIsDep && !newIsDep) {
            putIntoAssignmentMap(assignmentMap, a);
          } else if (!existingIsDep && !newIsDep) {
            // Overwrite with higher specificity scope if applicable, else overwrite
            if ((existing.disposalScope || 'ALL') === 'ALL') {
              putIntoAssignmentMap(assignmentMap, a);
            }
          }
        }
      }
    });


    // If PT or Night Count, check if Leave starts tomorrow
    if (isPT || isNightCount) {
      const getTomorrowDateStr = (dateStr: string): string => {
        const [year, month, day] = dateStr.split('-').map(Number);
        if (!year || !month || !day) return dateStr;
        const d = new Date(Date.UTC(year, month - 1, day));
        d.setUTCDate(d.getUTCDate() + 1);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const da = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
      };
      const tmrwStr = getTomorrowDateStr(date);
      const tmrwMonthKey = tmrwStr.slice(0, 7);
      const tmrwAssignments = (this.db.assignments[tmrwMonthKey] || []).filter((a) => a.date === tmrwStr);
      
      tmrwAssignments.forEach((a) => {
        if (a.dutyCode === 'LEAVE') {
           const scope = a.disposalScope || 'ALL';
           const isApplicable = scope === 'ALL' || (isPT && scope === 'PT') || (isNightCount && scope === 'NIGHT_COUNT');
           if (isApplicable) {
              assignmentMap.set(a.airmanId, {
                 ...a,
                 date: date,
                 notes: a.notes ? `${a.notes} (Starts tomorrow)` : 'Starts tomorrow'
              });
           }
        }
      });
    }

    // Calculate yesterday's assignments for auto duty off calculation safely via UTC
    const getYesterdayDateStr = (dateStr: string): string => {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return dateStr;
      const d = new Date(Date.UTC(year, month - 1, day));
      d.setUTCDate(d.getUTCDate() - 1);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const da = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    };

    const yestStr = getYesterdayDateStr(date);
    const yestMonthKey = yestStr.slice(0, 7);
    const yestAssignments = (this.db.assignments[yestMonthKey] || []).filter((a) => a.date === yestStr);
    const isBaseOrEmptyDuty = (asn?: DutyAssignment): boolean => {
      if (!asn) return true;
      const c = String(asn.dutyCode || '').toUpperCase().trim();
      if (!c || c === 'ON_PARADE' || c === 'PT' || c === 'PT_PARADE') return true;
      if (c === 'DUTY' || c === 'DUTY_ON') {
        const n = String(asn.notes || '').trim().toUpperCase();
        const nm = String((asn as any).dutyName || '').trim().toUpperCase();
        const gen = (s: string) => !s || ['DUTY', 'DUTY_ON', 'ON DUTY', 'DUTY ON', 'ON_PARADE', 'ON PARADE', 'PT', 'PT_PARADE'].includes(s);
        return gen(n) && gen(nm);
      }
      return false;
    };
    const yestMap = new Map<string, DutyAssignment>();
    yestAssignments.forEach((a) => {
      const scope = a.disposalScope || 'ALL';
      const isApplicable = scope === 'ALL' || (isPT && scope === 'PT') || (isNightCount && scope === 'NIGHT_COUNT') || (!isPT && !isNightCount && scope === 'PARADE');
      if (isApplicable) {
        const existing = findInAssignmentMap(yestMap, a.airmanId);
        if (!existing) {
          putIntoAssignmentMap(yestMap, a);
        } else {
          // Apply same priority hierarchy as assignmentMap so baseline/ON_PARADE or deployments never overwrite real yesterday duty
          if (existing.dutyCode === 'LEAVE' && a.dutyCode !== 'LEAVE') return;
          if (a.dutyCode === 'LEAVE' && existing.dutyCode !== 'LEAVE') {
            putIntoAssignmentMap(yestMap, a);
            return;
          }
          const existingIsBase = isBaseOrEmptyDuty(existing);
          const newIsBase = isBaseOrEmptyDuty(a);
          if (existingIsBase && !newIsBase) {
            putIntoAssignmentMap(yestMap, a);
            return;
          }
          if (!existingIsBase && newIsBase) return;

          const isDeployment = (code: string) => ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(code);
          const existingIsDep = isDeployment(existing.dutyCode);
          const newIsDep = isDeployment(a.dutyCode);
          if (existingIsDep && !newIsDep) {
            putIntoAssignmentMap(yestMap, a);
            return;
          }
          if (!existingIsDep && newIsDep) return;

          // Among two specific non-deployment duties yesterday, keep/prefer one with dutyOffNextDay enabled
          const existingOff = getDutyRule(existing).dutyOffNextDay;
          const newOff = getDutyRule(a).dutyOffNextDay;
          if (!existingOff && newOff) {
            putIntoAssignmentMap(yestMap, a);
            return;
          }
          if (existingOff && !newOff) return;

          if ((existing.disposalScope || 'ALL') === 'ALL') {
            putIntoAssignmentMap(yestMap, a);
          }
        }
      }
    });

    // Target airmen filter
    const allAirmen = this.db.airmen || [];
    
    // Filter out airmen who haven't joined yet, have left before this date, or are inactive
    const dateActiveAirmen = allAirmen.filter(a => {
      if (a.active === false) return false;
      if (a.dateJoined && a.dateJoined > date) return false;
      if (a.dateLeft && a.dateLeft < date) return false;
      return true;
    });

    const filteredAirmen = sortAirmenBySeniority(selectedFlight === 'Overall' 
      ? dateActiveAirmen 
      : dateActiveAirmen.filter((a) => a.flightName === selectedFlight));

    let onParade = 0;
    let onDuty = 0;
    let onLeave = 0;
    let tdy = 0;
    let otherOff = 0;
    let bakeNBite = 0;

    const resolveEffectiveAssignment = (airmanId: string): { 
      dutyCode: string; 
      idaShift?: string; 
      proxyForFlight?: string;
      disposalScope?: 'ALL' | 'PARADE' | 'PT' | 'NIGHT_COUNT';
      notes: string; 
      dutyName: string;
      previousDutyName?: string;
      statusCategory: string;
    } => {
      const ass = findInAssignmentMap(assignmentMap, airmanId);
      const isDep = ass && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(ass.dutyCode);
      const isBaseToday = isBaseOrEmptyDuty(ass);
      if (!ass || isDep || isBaseToday) {
        const yestAss = findInAssignmentMap(yestMap, airmanId);
        if (yestAss) {
          const yestRule = getDutyRule(yestAss);

          if (yestRule.dutyOffNextDay) {
            let offShort = 'GD Off';
            if (
              (yestAss.dutyCode as any) === 'ESCORT' ||
              (yestAss.dutyCode as any) === 'ESC' ||
              (yestAss.dutyCode as any) === 'ESCT' ||
              String(yestAss.dutyCode || '').includes('1794394') ||
              (yestAss.dutyName || '').toLowerCase().includes('escort') ||
              (yestAss.notes || '').toLowerCase().includes('escort') ||
              (yestRule.matchedTitle || '').toLowerCase().includes('escort')
            ) offShort = 'Esct Off';
            else if (yestAss.dutyCode === 'GD') offShort = 'GD Off';
            else if (yestAss.dutyCode === 'BTF') offShort = 'BTF Off';
            else if (yestAss.dutyCode === 'NTF') offShort = 'NTF Off';
            else if (yestAss.dutyCode === 'AIRPORT' || (yestAss.dutyCode as any) === 'AIRFIELD') offShort = 'Airfield Off';
            else if (yestAss.dutyCode === 'HALISHAHAR') offShort = 'Halishahar Off';
            else if ((yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') && yestAss.idaShift === 'Night') offShort = 'IDAC Nt Off';
            else if (yestAss.notes?.toLowerCase().includes('idac') || yestAss.previousDutyName?.toLowerCase().includes('idac')) offShort = 'IDAC Nt Off';
            else if (yestAss.dutyCode === 'DUTY_OFF') offShort = yestAss.previousDutyName || yestAss.notes || 'GD Off';
            else if (yestAss.dutyCode === 'ON_PARADE') offShort = 'GD Off';
            else if (yestRule.matchedTitle) offShort = `${yestRule.matchedTitle} Off`;
            else offShort = `${yestAss.dutyCode} Off`;

            offShort = (offShort || "")
              .replace(/Escort Duty Off/g, 'Esct Off')
              .replace(/Escort Off/g, 'Esct Off')
              .replace(/ESC Off/g, 'Esct Off')
              .replace(/ESCT Off/g, 'Esct Off')
              .replace(/DUTY_OFF/g, 'Duty')
              .replace(/Off Off/g, 'Off')
              .replace(/Duty Off Off/g, 'Duty Off');

            if (!isPT) {
              return { 
                dutyCode: 'DUTY_OFF', 
                dutyName: offShort, 
                previousDutyName: offShort,
                proxyForFlight: yestAss.proxyForFlight,
                notes: offShort,
                statusCategory: 'OFF',
              };
            } else {
              // PT State
              if (yestRule.onPtNextDay !== false) {
                // On PT is ON -> On PT (On Parade)
                return {
                  dutyCode: 'ON_PARADE',
                  dutyName: 'On PT',
                  notes: '',
                  statusCategory: 'PARADE',
                  disposalScope: 'PT',
                };
              } else {
                // On PT is OFF -> Duty Off in PT State!
                return { 
                  dutyCode: 'DUTY_OFF', 
                  dutyName: offShort, 
                  previousDutyName: offShort,
                  proxyForFlight: yestAss.proxyForFlight,
                  notes: offShort,
                  statusCategory: 'OFF',
                  disposalScope: 'PT',
                };
              }
            }
          }
        }
      }

      
      const scope = ass?.disposalScope || 'ALL';
      const isApplicable = scope === 'ALL' || (isPT && scope === 'PT') || (isNightCount && scope === 'NIGHT_COUNT') || (!isPT && !isNightCount && scope === 'PARADE');

      if (ass && isApplicable) {
        let dutyName: string = ((ass as any)?.dutyName || '').trim() || String(ass.dutyCode);
        let statusCategory: string = 'DUTY';
        let previousDutyName: string | undefined = undefined;

        let codeStr = String(ass.dutyCode).trim();

        if (codeStr.startsWith('CUST_') || codeStr.includes('1794394') || dutyName.startsWith('CUST_') || dutyName.includes('1794394')) {
          const resolved = getCustomDutyName(codeStr) || getCustomDutyName(dutyName);
          if (resolved) {
            dutyName = resolved;
          } else if (codeStr.includes('1794394') || dutyName.includes('1794394')) {
            dutyName = 'Escort Duty';
          }
        }

        // If dutyCode is generic 'DUTY' or 'DUTY_ON', resolve to real disposal from notes, dutyName, or Master Disposals
        if (codeStr === 'DUTY' || codeStr === 'DUTY_ON') {
          const rawNote = (ass.notes || '').trim();
          const rawName = (((ass as any)?.dutyName || '') as string).trim();
          const isGeneric = (s: string) => !s || ['DUTY', 'DUTY_ON', 'ON DUTY', 'DUTY ON'].includes(s.toUpperCase());

          if (!isGeneric(rawNote)) {
            codeStr = rawNote.toUpperCase();
            dutyName = rawNote;
          } else if (!isGeneric(rawName)) {
            codeStr = rawName.toUpperCase();
            dutyName = rawName;
          } else {
            // Check if airman has a Master Disposal configured in Duty Distribution / Nominal Roll
            let masterDisp: string | undefined;
            if (typeof window !== 'undefined') {
              try {
                const masterStr = window.localStorage.getItem('baf_duty_distribution_disposals_' + date);
                if (masterStr) {
                  const parsed = JSON.parse(masterStr);
                  masterDisp = parsed[airmanId];
                }
              } catch {}
            }
            if (masterDisp && masterDisp !== '-' && masterDisp !== '') {
              dutyName = masterDisp;
              codeStr = masterDisp.toUpperCase();
            } else {
              codeStr = 'ON_PARADE';
              dutyName = isPT ? 'On PT' : 'On Parade';
              statusCategory = 'PARADE';
            }
          }
        }

        if (codeStr === 'GD') dutyName = 'Base Security Duty';
        else if (codeStr === 'BTF') dutyName = 'Base Taskforce Duty';
        else if (codeStr === 'NTF') dutyName = 'Najirpara Taskforce Duty';
        else if (codeStr === 'HALISHAHAR') dutyName = 'Halishahar Duty';
        else if (codeStr === 'AIRPORT' || codeStr === 'AIRFIELD' || codeStr === 'ATT' || codeStr === 'DETT') dutyName = 'Airfield';
        else if (codeStr.includes('ORDERLY')) {
          dutyName = 'Orderly Room';
          statusCategory = 'OTHERS';
        }
        else if (codeStr === 'UWO') {
          dutyName = 'UWO';
          statusCategory = 'OTHERS';
        }
        else if (codeStr === 'TDY_HSIA') {
          dutyName = 'TDY (HSIA)';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'ATT_SAIA') {
          dutyName = 'Att (SAIA)';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'ED') {
          dutyName = 'ED';
          statusCategory = 'SICK_REPORT';
        }
        else if (codeStr === 'EX_PPGF') {
          dutyName = 'Ex PPGF';
          statusCategory = 'SICK_REPORT';
        }
        else if (codeStr === 'BNS' || codeStr === 'BSH') {
          dutyName = codeStr;
          statusCategory = 'CMH';
        }
        else if (codeStr === 'GH') {
          dutyName = 'Guard of Honor';
          statusCategory = 'GAMES';
        }
        else if (codeStr === 'AWL') {
          dutyName = 'AWOL';
          statusCategory = 'ABSENT';
        }
        else if (codeStr === 'CAT_C') {
          dutyName = 'Drill Cat-C';
          statusCategory = 'ADMIN_ORDER';
        }
        else if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(codeStr)) {
          const s = ass.idaShift || 'Morning';
          const shiftLower = s.toLowerCase();
          const notesLower = (ass.notes || '').toLowerCase();
          const isIdacNt = shiftLower.includes('night') || shiftLower.includes('nt') || shiftLower === 'c' || notesLower.includes('night') || notesLower.includes('nt');
          dutyName = `IDAC Duty (${s})`;
          if (!isPT && !isNightCount && isIdacNt) {
            statusCategory = 'PARADE';
          } else {
            statusCategory = 'DUTY';
          }
        }
        else if (codeStr === 'BAKE_N_BITE') {
          dutyName = 'Bake & Bite';
          statusCategory = 'BAKE_N_BITE';
        }
        else if (codeStr === 'LEAVE') {
          const notesRaw = ass.notes || '';
          const notesLower = notesRaw.toLowerCase();
          const dutyNameRaw = (((ass as any)?.dutyName || '') as string);
          const combined = `${notesLower} ${dutyNameRaw.toLowerCase()}`;

          if (combined.includes('recreation') || combined.includes('(rl)') || combined.includes(' rl') || combined.includes('rec leave') || combined.includes('rec.')) {
            dutyName = 'Recreation Leave (RL)';
          } else if (combined.includes('annual') || combined.includes('(al)') || combined.includes(' al')) {
            dutyName = 'Annual Leave (AL)';
          } else if (combined.includes('sick') || combined.includes('(sl)') || combined.includes(' sl')) {
            dutyName = 'Sick Leave (SL)';
          } else if (combined.includes('casual') || combined.includes('(cl)') || combined.includes(' cl')) {
            dutyName = 'Casual Leave (CL)';
          } else if (dutyNameRaw && dutyNameRaw !== 'LEAVE') {
            dutyName = dutyNameRaw;
          } else if (notesRaw && !notesLower.includes('imported')) {
            dutyName = notesRaw;
          } else {
            dutyName = 'Casual Leave (CL)';
          }
          statusCategory = 'LEAVE';
        }
        else if (codeStr === 'TDY') {
          dutyName = 'TDY / Attachment';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'DUTY_OFF') {
          const yestAss = findInAssignmentMap(yestMap, airmanId);
          const yestRule = yestAss ? getDutyRule(yestAss) : undefined;
          let offShort = 'GD Off';

          if (yestAss) {
            const yestCodeStr = String(yestAss.dutyCode);
            if (
              yestCodeStr === 'ESCORT' ||
              yestCodeStr === 'ESC' ||
              yestCodeStr === 'ESCT' ||
              yestCodeStr.includes('1794394') ||
              (yestAss.dutyName || '').toLowerCase().includes('escort') ||
              (yestAss.notes || '').toLowerCase().includes('escort') ||
              (yestRule?.matchedTitle || '').toLowerCase().includes('escort')
            ) offShort = 'Esct Off';
            else if (yestCodeStr === 'GD') offShort = 'GD Off';
            else if (yestCodeStr === 'BTF') offShort = 'BTF Off';
            else if (yestCodeStr === 'NTF') offShort = 'NTF Off';
            else if (yestCodeStr === 'AIRPORT' || yestCodeStr === 'AIRFIELD' || yestCodeStr === 'ATT' || yestCodeStr === 'DETT') offShort = 'Airfield Off';
            else if (yestCodeStr === 'HALISHAHAR') offShort = 'Halishahar Off';
            else if ((yestCodeStr === 'IDAC' || yestCodeStr === 'IDA') && yestAss.idaShift === 'Night') offShort = 'IDAC Nt Off';
            else if (yestAss.notes?.toLowerCase().includes('idac') || yestAss.previousDutyName?.toLowerCase().includes('idac')) offShort = 'IDAC Nt Off';
            else if (yestCodeStr === 'DUTY_OFF') offShort = yestAss.previousDutyName || 'GD Off';
            else if (yestCodeStr === 'ON_PARADE') offShort = 'GD Off';
            else if (yestRule?.matchedTitle) offShort = `${yestRule.matchedTitle} Off`;
            else offShort = `${yestAss.dutyCode} Off`;
          } else if (ass.notes && !ass.notes.toLowerCase().includes('imported')) {
            if (ass.notes.toLowerCase().includes('escort') || ass.notes.toLowerCase().includes('esct')) offShort = 'Esct Off';
            else if (ass.notes.toLowerCase().includes('idac')) offShort = 'IDAC Nt Off';
            else if (ass.notes.toLowerCase().includes('gd')) offShort = 'GD Off';
            else if (ass.notes.toLowerCase().includes('btf')) offShort = 'BTF Off';
            else if (ass.notes.toLowerCase().includes('ntf')) offShort = 'NTF Off';
            else if (ass.notes.toLowerCase().includes('airport')) offShort = 'Airfield Off';
            else if (ass.notes.toLowerCase().includes('halishahar')) offShort = 'Halishahar Off';
            else offShort = ass.notes;
          }

          offShort = (offShort || "")
            .replace(/Escort Duty Off/g, 'Esct Off')
            .replace(/Escort Off/g, 'Esct Off')
            .replace(/ESC Off/g, 'Esct Off')
            .replace(/ESCT Off/g, 'Esct Off')
            .replace(/DUTY_OFF/g, 'Duty')
            .replace(/Off Off/g, 'Off')
            .replace(/Duty Off Off/g, 'Duty Off');

          if (!offShort.toLowerCase().endsWith('off')) {
            offShort = `${offShort} Off`;
          }

          if (isPT) {
            const isOnPt = yestRule ? (yestRule.onPtNextDay !== false) : true;
            if (isOnPt) {
              return {
                dutyCode: 'ON_PARADE',
                dutyName: 'On PT',
                notes: '',
                statusCategory: 'PARADE',
                disposalScope: scope,
              };
            } else {
              return {
                dutyCode: 'DUTY_OFF',
                dutyName: offShort,
                previousDutyName: offShort,
                proxyForFlight: ass.proxyForFlight,
                notes: offShort,
                statusCategory: 'OFF',
                disposalScope: scope,
              };
            }
          }

          previousDutyName = offShort;
          dutyName = offShort;
          statusCategory = 'OFF';
        }
        else if (codeStr === 'ON_PARADE') {
          dutyName = isPT ? 'On PT' : 'On Parade';
          statusCategory = 'PARADE';
        }
        else if (codeStr === 'ESSN') {
          dutyName = 'Essential Task';
          statusCategory = 'ESSN';
        }
        else if (codeStr === 'CMH') {
          dutyName = 'BNS/BSH/CMH';
          statusCategory = 'CMH';
        }
        else if (codeStr === 'SICK_REPORT') {
          dutyName = 'Sick Report';
          statusCategory = 'SICK_REPORT';
        }
        else if (codeStr === 'ADMIN_ORDER') {
          dutyName = 'Admin Order';
          statusCategory = 'ADMIN_ORDER';
        }
        else if (codeStr === 'CLASS_TRG') {
          dutyName = 'Class / Training';
          statusCategory = 'CLASS_TRG';
        }
        else if (codeStr === 'ATT') {
          dutyName = 'Attachment';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'DETT') {
          dutyName = 'Detachment';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'RECEPTION') {
          dutyName = isPT ? 'Reception Duty' : 'K/O & Reception';
          statusCategory = 'RECEPTION';
        }
        else if (codeStr === 'GAMES') {
          dutyName = 'G/H & Games';
          statusCategory = 'GAMES';
        }
        else if (codeStr === 'CANTEEN') {
          if (isPT) {
             return {
                dutyCode: 'RECEPTION',
                idaShift: (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(ass.dutyCode)) ? (ass.idaShift || 'Morning') : ass.idaShift,
                proxyForFlight: ass.proxyForFlight,
                disposalScope: scope,
                notes: ass.notes || '',
                dutyName: 'Reception Duty',
                previousDutyName,
                statusCategory: 'RECEPTION',
             };
          } else {
             dutyName = 'Canteen';
             statusCategory = 'CANTEEN';
          }
        }
        else if (codeStr === 'DEPLOYMENT') {
          let dest = ass.notes || 'Deployment';
          if (dest.includes(' - ')) {
            dest = dest.split(' - ')[0].trim();
          }
          dutyName = dest;
          statusCategory = 'OTHERS'; // Treated as dynamic disposal
          
          return {
            dutyCode: dest,
            idaShift: (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(ass.dutyCode)) ? (ass.idaShift || 'Morning') : ass.idaShift,
            proxyForFlight: ass.proxyForFlight,
            disposalScope: scope,
            notes: (ass.notes || '').toLowerCase().includes('imported') ? '' : (ass.notes || ''),
            dutyName: dest,
            previousDutyName,
            statusCategory: 'OTHERS'
          };
        }
        else if (codeStr === 'ABSENT') {
          dutyName = 'Absent';
          statusCategory = 'ABSENT';
        }
        else if (codeStr === 'OTHERS') {
          dutyName = ass.notes || 'Other Disposal';
          statusCategory = 'OTHERS';
        }

        const todayRule = getDutyRule(ass);
        if (todayRule.onParadeOnDutyDay && (statusCategory === 'DUTY' || statusCategory === 'PARADE')) {
          if (!isPT && !isNightCount) {
            statusCategory = 'PARADE';
            dutyName = 'On Parade';
          } else if (isPT) {
            statusCategory = 'DUTY';
          }
        }

        const safeNotes = (ass.notes || '').toLowerCase().includes('imported') ? '' : (ass.notes || '');

        return { 
          dutyCode: (String(ass.dutyCode) === 'DUTY' || String(ass.dutyCode) === 'DUTY_ON') ? (codeStr as any) : ass.dutyCode, 
          idaShift: (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(ass.dutyCode) || ['IDAC', 'IDA'].includes(codeStr)) ? (ass.idaShift || 'Morning') : ass.idaShift, 
          proxyForFlight: ass.proxyForFlight,
          disposalScope: scope,
          notes: safeNotes, 
          dutyName,
          previousDutyName,
          statusCategory,
        };
      }

      

      return { 
        dutyCode: 'ON_PARADE', 
        dutyName: isPT ? 'On PT' : 'On Parade', 
        notes: '',
        statusCategory: 'PARADE',
      };
    };

    const personnelStatusList = filteredAirmen.map((airman) => {
      const eff = resolveEffectiveAssignment(airman.id);
      if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(eff.dutyCode) || (eff.dutyName && eff.dutyName.includes('IDAC'))) {
         console.log("DEBUG IDAC for", airman.name, "id:", airman.id, "eff:", JSON.stringify(eff));
      }
      const dutyCode = eff.dutyCode;
      const idaShift = eff.idaShift;
      const proxyForFlight = eff.proxyForFlight;
      let notes = eff.notes;
      const dutyName = eff.dutyName;
      const previousDutyName = eff.previousDutyName;
      const statusCategory = eff.statusCategory;

      if (dutyCode === 'BAKE_N_BITE' || statusCategory === 'BAKE_N_BITE') {
        bakeNBite++;
      } else if (statusCategory === 'LEAVE' || dutyCode === 'LEAVE') {
        onLeave++;
      } else if (statusCategory === 'TDY' || ['TDY', 'ATT', 'DETT'].includes(dutyCode)) {
        tdy++;
      } else if (statusCategory === 'OFF' || dutyCode === 'DUTY_OFF') {
        otherOff++;
      } else if (statusCategory === 'DUTY') {
        onDuty++;
      } else if (statusCategory === 'PARADE' || dutyCode === 'ON_PARADE') {
        onParade++;
      } else {
        otherOff++;
      }

      if ((['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(dutyCode)) && idaShift === 'Night') {
        const shiftNote = 'IDAC Night';
        if (!notes) notes = shiftNote;
        else if (!notes.includes('IDAC')) notes = `${shiftNote} - ${notes}`;
      }

      return {
        airman,
        dutyCode,
        idaShift,
        proxyForFlight,
        statusCategory,
        notes,
        dutyName,
        previousDutyName,
      };
    });

    const flights: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];
    const flightBreakdown = {} as Record<FlightName, any>;

    flights.forEach((fl) => {
      const flAirmen = dateActiveAirmen.filter((a) => a.flightName === fl);
      let flParade = 0;
      let flDuty = 0;
      let flLeave = 0;
      let flTdy = 0;
      let flOff = 0;
      let flBakeNBite = 0;

      flAirmen.forEach((a) => {
        const eff = resolveEffectiveAssignment(a.id);
        if (eff.dutyCode === 'BAKE_N_BITE' || eff.statusCategory === 'BAKE_N_BITE') {
          flBakeNBite++;
        } else if (eff.statusCategory === 'LEAVE' || eff.dutyCode === 'LEAVE') flLeave++;
        else if (eff.statusCategory === 'TDY' || ['TDY', 'ATT', 'DETT'].includes(eff.dutyCode)) flTdy++;
        else if (eff.statusCategory === 'OFF' || eff.dutyCode === 'DUTY_OFF') flOff++;
        else if (eff.statusCategory === 'DUTY') flDuty++;
        else if (eff.statusCategory === 'PARADE' || eff.dutyCode === 'ON_PARADE') flParade++;
        else flOff++;
      });

      flightBreakdown[fl] = {
        total: flAirmen.length,
        onParade: flParade,
        onDuty: flDuty,
        onLeave: flLeave,
        tdy: flTdy,
        otherOff: flOff,
        bakeNBite: flBakeNBite,
      };
    });

    return {
      date,
      shift,
      flight: selectedFlight,
      summary: {
        totalStrength: filteredAirmen.length,
        onParade,
        onDuty,
        onLeave,
        tdy,
        otherOff,
        bakeNBite,
      },
      flightBreakdown,
      personnelStatusList,
    } as any;
  }

  // --- ANALYTICS ---
  public getAnalytics(monthKey?: string): {
    monthKey: string;
    totalPersonnel: number;
    dutyStats: AirmanDutyStats[];
    conflicts: ConflictAlert[]; assignments: any[];
  } {
    const today = new Date();
    const defaultMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const targetMonth = monthKey || defaultMonthKey;
    let assignments = this.db.assignments[targetMonth] || [];

    // Deduplicate assignments
    const uniqueMap = new Map();
    assignments.forEach(a => {
        const key = a.airmanId + '-' + a.date + '-' + a.dutyCode + '-' + (a.idaShift || '');
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, a);
        }
    });
    assignments = Array.from(uniqueMap.values());

    const [yStr, mStr] = targetMonth.split('-');
    const yNum = parseInt(yStr, 10);
    const mNum = parseInt(mStr, 10);

    const dutyStats = calculateDutyStats(this.db.airmen, assignments, yNum, mNum);
    const conflicts = detectConflicts(this.db.airmen, assignments);

    return {
      monthKey: targetMonth,
      totalPersonnel: this.db.airmen.length, assignments,
      dutyStats,
      conflicts,
    };
  }

  // --- ACTIVITY HISTORY ---
  public getHistory(): ActivityHistoryItem[] {
    this.cleanDuplicateHistory();
    return this.db.activityHistory || [];
  }

  public deleteHistoryEntry(historyId: string): boolean {
    if (!this.db.activityHistory) return false;
    const idx = this.db.activityHistory.findIndex((h) => h.id === historyId);
    if (idx === -1) return false;
    this.db.activityHistory.splice(idx, 1);
    this.saveToStorage();
    return true;
  }

  public cleanDuplicateHistory(): void {
    // Preserve all history items - user requested: "kono Duty , History , Log remove hbe na"
    // No history entries or logs are deleted
  }

  public mergeHistory(incoming: ActivityHistoryItem[]): void {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    const historyMap = new Map<string, ActivityHistoryItem>();
    (this.db.activityHistory || []).forEach((h) => {
      if (h && h.id) historyMap.set(h.id, h);
    });
    incoming.forEach((h) => {
      if (h && h.id) {
        const curr = historyMap.get(h.id);
        historyMap.set(h.id, curr ? { ...h, ...curr, fromDate: curr.fromDate || h.fromDate, dutyCode: curr.dutyCode || h.dutyCode } : h);
      }
    });
    this.db.activityHistory = Array.from(historyMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    this.cleanDuplicateHistory();
    this.saveToStorage();
  }

  public undoHistory(historyId: string): boolean {
    const idx = (this.db.activityHistory || []).findIndex((h) => h.id === historyId);
    if (idx === -1) return false;

    const item = this.db.activityHistory[idx];
    if (Array.isArray(item.previousAssignments)) {
      for (const prev of item.previousAssignments) {
        const monthKey = prev.date.slice(0, 7);
        if (!this.db.assignments[monthKey]) continue;

        const list = this.db.assignments[monthKey];
        const existingIdx = list.findIndex((a) => a.airmanId === prev.airmanId && a.date === prev.date);

        if (prev.dutyCode) {
          const restored: DutyAssignment = {
            airmanId: prev.airmanId,
            date: prev.date,
            dutyCode: prev.dutyCode,
            idaShift: prev.idaShift,
            notes: prev.notes || '',
            updatedAt: new Date().toISOString(),
          };
          if (existingIdx >= 0) list[existingIdx] = restored;
          else list.push(restored);
        } else {
          if (item.dutyCode) {
            const exactIdx = list.findIndex(a => a.airmanId === prev.airmanId && a.date === prev.date && a.dutyCode === item.dutyCode && (item.idaShift ? a.idaShift === item.idaShift : true));
            if (exactIdx >= 0) list.splice(exactIdx, 1);
            else if (existingIdx >= 0) list.splice(existingIdx, 1);
          } else {
            if (existingIdx >= 0) list.splice(existingIdx, 1);
          }
        }
      }
    }

    this.db.activityHistory.splice(idx, 1);
    this.saveToStorage();
    return true;
  }

  // --- AUTH & PASSCODE ---
  public verifyPasscode(code: string): boolean {
    const trimmed = (code || '').trim();
    const stored = (this.db.adminPasscode || DEFAULT_ADMIN_PASSCODE).trim();
    return trimmed === stored || trimmed === DEFAULT_ADMIN_PASSCODE;
  }

  public changePasscode(current: string, newCode: string): boolean {
    if (this.verifyPasscode(current) && newCode && newCode.length === 4) {
      this.db.adminPasscode = newCode;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // --- DATABASE BACKUP & RESTORE ---
  public exportDatabase(): string {
    const localSettings: Record<string, string> = {};
    const excludedKeys = new Set([
      'baf_local_storage_snapshot',
      'baf_drive_cloud_snapshot',
      'baf_backup_restore_history_v1',
      'baf_155_uasu_v2_db',
      'baf_database_v2',
    ]);
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || excludedKeys.has(k)) continue;
        const v = window.localStorage.getItem(k);
        if (v !== null && v !== undefined) localSettings[k] = v;
      }
    }
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      unit: '155 UASU, BAF BASE ZHR',
      version: '2.5',
      airmen: this.db.airmen,
      assignments: this.db.assignments,
      activityHistory: this.db.activityHistory,
      adminPasscode: this.db.adminPasscode,
      importHistory: this.db.importHistory,
      localSettings,
    }, null, 2);
  }

  public restoreDatabase(uploadedData: any): boolean {
    const airmen = uploadedData.airmen || uploadedData.database?.airmen;
    const assignments = uploadedData.assignments || uploadedData.database?.assignments;
    const detailedUsers = uploadedData.detailedUsers || uploadedData.database?.detailedUsers;
    const activityHistory = uploadedData.activityHistory || uploadedData.database?.activityHistory;

    let restoredAnything = false;
    if (airmen && Array.isArray(airmen)) {
      this.db.airmen = airmen;
      restoredAnything = true;
    }
    if (assignments && typeof assignments === 'object') {
      this.db.assignments = assignments;
      restoredAnything = true;
    }
    if (detailedUsers && Array.isArray(detailedUsers)) {
      this.db.detailedUsers = detailedUsers;
      restoredAnything = true;
    }
    if (activityHistory && Array.isArray(activityHistory)) {
      this.db.activityHistory = activityHistory;
      restoredAnything = true;
    }
    if (uploadedData.adminPasscode) {
      this.db.adminPasscode = uploadedData.adminPasscode;
      restoredAnything = true;
    }

    if (typeof window !== 'undefined' && window.localStorage && uploadedData.localSettings && typeof uploadedData.localSettings === 'object') {
      for (const [k, v] of Object.entries(uploadedData.localSettings)) {
        if (k && v !== undefined && v !== null) {
          window.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          restoredAnything = true;
        }
      }
    }
    
    if (restoredAnything) {
      this.saveToStorage(this.db, true, false, true); // Do NOT auto push to firebase on restore
      return true;
    }
    return false;
  }

  // --- DUTY RATIO PERSISTENCE (Local & D1) ---
  public saveDutyRatioMatrix(matrix: DutyRatioTable[], updatedBy = 'ADMIN'): void {
    saveDutyMatrix(matrix);

    this.recordActivity({
      actionType: 'IMPORT_DUTY_RATIO' as any,
      airmanId: 'ADMIN_ACTION',
      airmanName: `Duty Ratio Matrix Updated`,
      dutyCode: 'GD',
      fromDate: '',
      toDate: '',
      notes: `Updated Official Duty Ratio with ${matrix.length} duty definitions`,
    });
  }

  // --- FUZZY AIRMAN MATCHER (RANK FIRST) ---
  private findBestAirmanMatch(rawText: string, flightHint?: FlightName | 'Overall'): { airman: Airman | null; confidence: number } {
    return matchAirmanRankFirst(rawText, this.db.airmen, flightHint);
  }

  private extractTextFromPdfBase64(base64Str: string): string {
    try {
      const clean = (base64Str || "").replace(/^data:[^;]+;base64,/, '');
      const binary = atob(clean);
      const textParts: string[] = [];

      const tjMatches = binary.match(/\(([^()]{2,200})\)\s*(?:Tj|'|")/g) || [];
      for (const m of tjMatches) {
        const c = m.replace(/^\(|\)\s*(?:Tj|'|")$/g, '').trim();
        if (c.length > 0) textParts.push(c);
      }

      const arrayTjMatches = binary.match(/\[\s*(\([^)]*\)[^\]]*)+\]\s*TJ/gi) || [];
      for (const arr of arrayTjMatches) {
        const innerTexts = arr.match(/\(([^()]*)\)/g) || [];
        const joined = innerTexts.map((t) => t.slice(1, -1)).join('');
        if (joined.trim().length > 1) textParts.push(joined.trim());
      }

      const btMatches = binary.match(/BT[\s\S]*?ET/g) || [];
      for (const bt of btMatches) {
        const inParens = bt.match(/\(([^()]+)\)/g) || [];
        for (const p of inParens) {
          const t = p.slice(1, -1).trim();
          if (t.length > 1 && !textParts.includes(t)) textParts.push(t);
        }
      }

      return textParts.join(' ');
    } catch {
      return '';
    }
  }

  // --- ANALYZE DUTY DOCUMENT ---
  public analyzeDutyDocument(payload: any): any {
    const { fileBase64, files, textSnippet, targetYear = 2026, targetFlight = 'Overall' } = payload || {};

    const fileList: Array<{ base64: string; mime: string; name?: string }> = [];
    if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        if (f.fileBase64 || f.base64) {
          fileList.push({
            base64: f.fileBase64 || f.base64,
            mime: f.mimeType || f.mime || 'application/pdf',
            name: f.fileName || f.name || 'Document',
          });
        }
      }
    } else if (fileBase64) {
      fileList.push({
        base64: fileBase64,
        mime: payload.mimeType || 'application/pdf',
        name: 'Document',
      });
    }

    let extractedText = textSnippet || '';

    for (const f of fileList) {
      if (f.base64) {
        const isPdf = (f.mime && f.mime.includes('pdf')) || (f.name && f.name.toLowerCase().endsWith('.pdf'));
        const isText = (f.mime && (f.mime.includes('text') || f.mime.includes('csv') || f.mime.includes('json'))) ||
          (f.name && /\.(txt|csv|tsv|json)$/i.test(f.name));

        if (isText) {
          try {
            const clean = (f.base64 || "").replace(/^data:[^;]+;base64,/, '');
            const decoded = atob(clean);
            extractedText += `\n${decoded}`;
          } catch {
            // Ignore decode error
          }
        } else if (isPdf) {
          const pdfText = this.extractTextFromPdfBase64(f.base64);
          if (pdfText) extractedText += `\n${pdfText}`;
        }
      }
    }

    if (!extractedText.trim()) {
      throw new Error('No readable text could be extracted from the uploaded file(s). Please paste table text directly in the "Paste Text / OCR" tab.');
    }

    // Run heuristic parser strictly on the user's extracted content
    const parsedResult = parseRosterTextHeuristically(
      extractedText,
      targetYear,
      targetFlight,
      this.db.airmen
    );

    if (!parsedResult.dates || parsedResult.dates.length === 0 || parsedResult.totalAssignmentsCount === 0) {
      throw new Error('Could not identify any duty dates or airman assignments from the provided input. Please verify that your file or text contains dates (e.g. 01 Aug) and duty columns.');
    }

    return {
      ...parsedResult,
      totalPages: Math.max(fileList.length, 1),
      totalFiles: fileList.length,
    };
  }

  // --- LOAD OFFICIAL ROSTER ---
  public loadOfficialRoster(targetYear = 2026, monthChoice: any = 'all'): any {
    const doc = getOfficialParadeStateDocument(targetYear, monthChoice, this.db.airmen);
    let totalAssignmentsCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    const enrichedDates = (doc.dates || []).map((dateEntry: any) => {
      const enrichedAssignments = (dateEntry.assignments || []).map((asn: any) => {
        totalAssignmentsCount++;
        const airman = this.db.airmen.find((a) => a.id === asn.matchedAirmanId);
        if (airman) {
          matchedCount++;
          return {
            ...asn,
            matchedAirmanName: airman.name,
            matchedAirmanRank: airman.rank,
            matchedAirmanTrade: airman.trade,
            matchedAirmanFlight: airman.flightName,
            matchedAirmanBdNo: airman.bdNo,
            confidence: 1.0,
          };
        } else {
          unmatchedCount++;
          return asn;
        }
      });

      return {
        date: dateEntry.date,
        dayName: dateEntry.dayName,
        assignments: enrichedAssignments,
      };
    });

    return {
      ...doc,
      dates: enrichedDates,
      totalAssignmentsCount,
      matchedCount,
      unmatchedCount,
    };
  }

  // --- APPLY DUTY DATA FROM IMPORT ---
  public applyDutyData(assignments: any[], sourceDoc = 'PDF Import'): { appliedCount: number; batchId: string; affectedDates: string[] } {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new Error('No assignments to apply');
    }

    const affectedDates = new Set<string>();
    const importedAssignmentsForBatch: any[] = [];
    const prevAssignmentsForBatch: any[] = [];
    const airmenNamesSet = new Set<string>();
    let appliedCount = 0;

    for (const item of assignments) {
      if (!item.airmanId || !item.date || !item.dutyCode) continue;
      if (item.dutyCode === 'ON_PARADE' || item.dutyCode === 'DUTY_OFF') continue;

      const dateStr = item.date;
      const monthKey = dateStr.slice(0, 7);
      affectedDates.add(dateStr);

      if (!this.db.assignments[monthKey]) {
        this.db.assignments[monthKey] = [];
      }

      const list = this.db.assignments[monthKey];
      const existingIdx = list.findIndex((a) => a.airmanId === item.airmanId && a.date === dateStr);
      const prevItem = existingIdx >= 0 ? { ...list[existingIdx] } : null;

      prevAssignmentsForBatch.push({
        airmanId: item.airmanId,
        date: dateStr,
        dutyCode: prevItem?.dutyCode,
        idaShift: prevItem?.idaShift,
        notes: prevItem?.notes,
      });

      const air = this.db.airmen.find((a) => a.id === item.airmanId);
      const airName = air ? `${air.rank} ${air.name}` : item.airmanId;
      airmenNamesSet.add(airName);

      const dutyAssignment: DutyAssignment = {
        airmanId: item.airmanId,
        date: dateStr,
        dutyCode: item.dutyCode,
        idaShift: item.dutyCode === 'IDAC' ? item.idaShift || 'Morning' : undefined,
        disposalScope: item.disposalScope || 'ALL',
        notes: item.notes && !item.notes.toLowerCase().includes('imported') ? item.notes : '',
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...dutyAssignment };
      } else {
        list.push(dutyAssignment);
      }

      importedAssignmentsForBatch.push({
        airmanId: item.airmanId,
        airmanName: airName,
        airmanRank: air?.rank,
        airmanFlight: air?.flightName,
        date: dateStr,
        dutyCode: item.dutyCode,
        idaShift: dutyAssignment.idaShift,
        notes: dutyAssignment.notes,
      });

      this.recordActivity({
        actionType: item.dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_DUTY',
        airmanId: item.airmanId,
        airmanName: airName,
        dutyCode: item.dutyCode,
        idaShift: dutyAssignment.idaShift,
        fromDate: dateStr,
        toDate: dateStr,
        notes: dutyAssignment.notes,
      });

      appliedCount++;
    }

    if (!this.db.importHistory) {
      this.db.importHistory = [];
    }

    const sortedDates = Array.from(affectedDates).sort();
    const newBatch: ImportHistoryBatch = {
      id: `import-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sourceDoc,
      dutyCount: appliedCount,
      datesCount: affectedDates.size,
      dates: sortedDates,
      airmenNames: Array.from(airmenNamesSet),
      importedAssignments: importedAssignmentsForBatch,
      previousAssignments: prevAssignmentsForBatch,
    };

    this.db.importHistory.unshift(newBatch);
    if (this.db.importHistory.length > 50) {
      // this.db.importHistory = this.db.importHistory.slice(0, 50);
    }

    this.recordActivity({
      actionType: 'IMPORT_PDF_ROSTER',
      airmanId: 'BULK_IMPORT',
      airmanName: `${appliedCount} Duties Imported`,
      dutyCode: 'GD',
      fromDate: sortedDates[0] || '',
      toDate: sortedDates[sortedDates.length - 1] || '',
      notes: `Imported ${appliedCount} active duties across ${affectedDates.size} dates (${sourceDoc})`,
    });

    this.saveToStorage();

    return {
      appliedCount,
      batchId: newBatch.id,
      affectedDates: sortedDates,
    };
  }

  // --- IMPORT HISTORY ACCESS ---
  public getImportHistory(): ImportHistoryBatch[] {
    return this.db.importHistory || [];
  }

  public deleteImportHistory(batchId: string): boolean {
    const idx = (this.db.importHistory || []).findIndex((b) => b.id === batchId);
    if (idx === -1) return false;

    const batch = this.db.importHistory[idx];
    const prevMap = new Map<string, any>();
    (batch.previousAssignments || []).forEach((p) => {
      prevMap.set(`${p.airmanId}_${p.date}`, p);
    });

    for (const item of batch.importedAssignments) {
      const monthKey = item.date.slice(0, 7);
      if (!this.db.assignments[monthKey]) continue;

      const list = this.db.assignments[monthKey];
      const existingIdx = list.findIndex((a) => a.airmanId === item.airmanId && a.date === item.date);
      const prev = prevMap.get(`${item.airmanId}_${item.date}`);

      if (prev && prev.dutyCode && prev.dutyCode !== 'ON_PARADE') {
        const restored: DutyAssignment = {
          airmanId: prev.airmanId,
          date: prev.date,
          dutyCode: prev.dutyCode,
          idaShift: prev.idaShift,
          notes: prev.notes || '',
          updatedAt: new Date().toISOString(),
        };
        if (existingIdx >= 0) list[existingIdx] = restored;
        else list.push(restored);
      } else {
        if (existingIdx >= 0) list.splice(existingIdx, 1);
      }
    }

    this.db.importHistory.splice(idx, 1);
    this.saveToStorage();
    return true;
  }
}

// Global Singleton Instance
export const localDb = new LocalDatabaseEngine();
