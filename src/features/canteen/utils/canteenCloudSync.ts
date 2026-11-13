import { db, isFirebaseConfigured, isQuotaExceededError, isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, getQuotaConsoleUpgradeUrl, CLIENT_SESSION_ID } from '../../../firebase';
import {
  pushCanteenDataKeyToFirebase,
  fetchCanteenDataFromFirebase,
  fetchSingleCanteenDocFromFirebase,
  pushCanteenMembersToFirebase,
  fetchCanteenMembersFromFirebase,
  publishSyncManifest,
  subscribeToSyncManifest,
  probeFirebaseConnectionAndQuota,
  getPendingDeltaQueue,
  recordPendingDeltas,
  clearPendingDeltas,
} from '../../../services/firebaseFirestoreService';
import { isMultiUserMode } from '../../../services/presenceService';
import { deduplicateRawItems } from './recipeManager';
import { resolveImageUrl, getCanteenConfig, isTimestampPastResetThreshold, checkAndEnforceDailyMenuReset } from './canteenSettings';
import { normalizeCanteenMembersSeniority, sortCanteenMembersByOfficeSeniority } from './canteenSeniority';
import { 
  getCanteenMembersCache, 
  setCanteenMembersCache, 
  fetchCanteenMembersOnce, 
  getCanteenMenuCache, 
  fetchCanteenMenuOnce,
  updateSingleMenuItemInCache,
  setCanteenMenuCache,
  deduplicateCanteenMenuItems,
  getUserMenuOverrides,
  findUserMenuOverride,
  DEFAULT_CANTEEN_MENU_ITEMS,
  CanteenMenuItem
} from './canteenMenuData';

export { 
  getCanteenMembersCache, 
  setCanteenMembersCache, 
  fetchCanteenMembersOnce, 
  getCanteenMenuCache, 
  fetchCanteenMenuOnce,
  DEFAULT_CANTEEN_MENU_ITEMS 
};
export type { CanteenMenuItem };

/**
 * Canteen Cloud Sync Engine
 * Persists and synchronizes all Canteen data to Supabase Cloud ('app_settings' table)
 * ensuring full persistence across devices, browsers, and sessions.
 */

export const CANTEEN_CLOUD_KEYS = [
  'canteen_txs',
  'canteen_deleted_tx_ids',
  'canteen_pre_orders',
  'canteen_expenses',
  'canteen_deleted_expense_ids',
  'canteen_bazar_advances',
  'canteen_deleted_advance_ids',
  'canteen_member_bangla_names',
  'canteen_fund_transfers',
  'canteen_daily_menu',
  'canteen_daily_menu_updated_at',
  'canteen_menu_recipes_v3',
  'canteen_menu_recipes_20pax_v1',
  'canteen_menu_recipes_v2',
  'canteen_raw_stock_logs_v2',
  'canteen_expense_last_unit_prices',
  'canteen_recent_members',
  'canteen_raw_inventory_items_v2',
  'canteen_menu_items_catalog_v1',
  'canteen_bill_import_history',
  'canteen_pos_import_history',
  'canteen_member_seniority',
  'canteen_menu_bangla_names',
  'canteen_due_shops_v1',
  'canteen_purpose_presets',
  'canteen_deleted_purpose_presets',
  'baf_others_fund_categories',
  'baf_deleted_others_fund_categories',
  'canteen_user_menu_overrides',
  'canteen_raw_items_user_overrides'
] as const;

export type CanteenCloudKey = typeof CANTEEN_CLOUD_KEYS[number];

export interface CloudSyncStatus {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncTime: string | null;
  errorMessage?: string;
}

export interface CanteenSyncLog {
  id: string;
  type: 'PUSH' | 'PULL';
  status: 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
}

const CANTEEN_SYNC_LOGS_STORAGE_KEY = 'canteen_sync_logs';

let canteenSyncLogs: CanteenSyncLog[] = (() => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(CANTEEN_SYNC_LOGS_STORAGE_KEY) || window.localStorage.getItem(CANTEEN_SYNC_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
})();

export const getCanteenSyncLogs = (): CanteenSyncLog[] => canteenSyncLogs;

export const addCanteenSyncLog = (log: Omit<CanteenSyncLog, 'id'>): CanteenSyncLog => {
  const newLog: CanteenSyncLog = {
    ...log,
    id: 'canteen-sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
  };
  canteenSyncLogs = [newLog, ...canteenSyncLogs].slice(0, 30);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(CANTEEN_SYNC_LOGS_STORAGE_KEY, JSON.stringify(canteenSyncLogs));
      window.localStorage.setItem(CANTEEN_SYNC_LOGS_STORAGE_KEY, JSON.stringify(canteenSyncLogs));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent('canteen_sync_logs_updated', { detail: canteenSyncLogs }));
  }
  return newLog;
};

export const clearCanteenSyncLogs = () => {
  canteenSyncLogs = [];
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(CANTEEN_SYNC_LOGS_STORAGE_KEY);
      window.localStorage.removeItem(CANTEEN_SYNC_LOGS_STORAGE_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent('canteen_sync_logs_updated', { detail: [] }));
  }
};

/**
 * Safe parser for canteen_expenses: guarantees a valid Array is always returned.
 * If data was saved as an object map, wraps values or extracts array safely.
 */
export function getSafeCanteenExpenses(input?: any): any[] {
  try {
    let data = input;
    if (data === undefined && typeof window !== 'undefined') {
      const raw = localStorage.getItem('canteen_expenses');
      data = raw ? JSON.parse(raw) : [];
    } else if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      if (Array.isArray((data as any).expenses)) return (data as any).expenses;
      if (Array.isArray((data as any).items)) return (data as any).items;
      if (Array.isArray((data as any).data)) return (data as any).data;
      const values = Object.values(data).filter(val => val && typeof val === 'object' && !Array.isArray(val));
      if (values.length > 0) return values;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Safe parser for canteen_bazar_advances: guarantees a valid Array is always returned.
 */
export function getSafeCanteenAdvances(input?: any): any[] {
  try {
    let data = input;
    if (data === undefined && typeof window !== 'undefined') {
      const raw = localStorage.getItem('canteen_bazar_advances');
      data = raw ? JSON.parse(raw) : [];
    } else if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      if (Array.isArray((data as any).advances)) return (data as any).advances;
      if (Array.isArray((data as any).items)) return (data as any).items;
      if (Array.isArray((data as any).data)) return (data as any).data;
      const values = Object.values(data).filter(val => val && typeof val === 'object' && !Array.isArray(val));
      if (values.length > 0) return values;
    }
    return [];
  } catch {
    return [];
  }
}

let syncStatus: CloudSyncStatus = {
  status: 'idle',
  lastSyncTime: null
};

const notifyStatus = (status: Partial<CloudSyncStatus>) => {
  syncStatus = { ...syncStatus, ...status };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('canteen_cloud_sync_status', { detail: syncStatus }));
  }
};

export const getCanteenCloudSyncStatus = (): CloudSyncStatus => syncStatus;

// In-memory cache of the exact string representation last synced with the cloud
const lastSyncedCloudHashes = new Map<string, string>();

const SINGLE_USER_CANTEEN_BACKUP_MS = 30 * 60 * 1000; // 30 minutes
const MULTI_USER_CANTEEN_BACKUP_MS = 10 * 1000; // 10 seconds
const CANTEEN_LAST_PULL_KEY = 'canteen_last_firebase_pull_at';

// Dirty change tracking for adaptive automatic backup to Firebase
const dirtyCanteenKeys = new Set<string>();
const dirtyCanteenValues = new Map<string, any>();
let canteenBackupTimeout: any = null;
let scheduledCanteenMode: 'single' | 'multi' | null = null;
let isCanteenBackingUp = false;
let isInitialCanteenPullDone = false;
let isCanteenPulling = false;
let isApplyingCloudPull = false;

export const getIsInitialCanteenPullDone = (): boolean => isInitialCanteenPullDone;

/**
 * Mark a canteen key as dirty.
 * Saves immediately to localStorage + offline pending delta queue so no edit is lost under quota exhaustion.
 * Schedules Firebase backup using 30-min (single user) or 10-sec (multi-user) timer, skipping unchanged data.
 */
export function markCanteenDirty(key: string, data?: any) {
  if (isApplyingCloudPull) {
    return;
  }

  if (!CANTEEN_CLOUD_KEYS.includes(key as any) && key !== 'baf_canteen_settings_v1') {
    return;
  }

  let currentValStr: string | null = null;
  if (data !== undefined) {
    currentValStr = typeof data === 'string' ? data : JSON.stringify(data);
  } else if (typeof window !== 'undefined') {
    currentValStr = localStorage.getItem(key);
  }

  const lastSynced = lastSyncedCloudHashes.get(key);
  if (currentValStr !== null && lastSynced !== undefined && lastSynced === currentValStr) {
    dirtyCanteenKeys.delete(key);
    dirtyCanteenValues.delete(key);
    clearPendingDeltas({ canteenKeys: [key] });
    if (dirtyCanteenKeys.size === 0 && typeof window !== 'undefined') {
      localStorage.removeItem('canteen_pending_sync');
      if (canteenBackupTimeout) {
        clearTimeout(canteenBackupTimeout);
        canteenBackupTimeout = null;
        scheduledCanteenMode = null;
      }
    }
    return;
  }

  if (typeof window !== 'undefined' && data !== undefined) {
    try {
      if (typeof data === 'string') {
        localStorage.setItem(key, data);
      } else {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (err) {
      console.warn(`[CanteenCloudSync] LocalStorage save warning for ${key}:`, err);
    }
  }

  dirtyCanteenKeys.add(key);
  if (data !== undefined) {
    dirtyCanteenValues.set(key, data);
  }

  // Record in persistent pending delta queue so quota-exceeded edits survive reload & reconcile on reset
  recordPendingDeltas({ canteenKeys: [key] });

  if (typeof window !== 'undefined') {
    localStorage.setItem('canteen_pending_sync', 'true');
  }

  if (isFirestoreQuotaExceeded() || !isFirebaseConfigured) {
    notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
    return;
  }

  const desiredMode: 'single' | 'multi' = isMultiUserMode() ? 'multi' : 'single';
  const intervalMs = desiredMode === 'multi' ? MULTI_USER_CANTEEN_BACKUP_MS : SINGLE_USER_CANTEEN_BACKUP_MS;

  if (canteenBackupTimeout && scheduledCanteenMode === desiredMode) {
    return;
  }
  if (canteenBackupTimeout) {
    clearTimeout(canteenBackupTimeout);
    canteenBackupTimeout = null;
  }

  scheduledCanteenMode = desiredMode;
  canteenBackupTimeout = setTimeout(() => {
    canteenBackupTimeout = null;
    scheduledCanteenMode = null;
    if (dirtyCanteenKeys.size > 0 && !isFirestoreQuotaExceeded()) {
      performCanteenBackup(false);
    }
  }, intervalMs);
}

/**
 * Back up ONLY dirty/changed Canteen keys to Firebase Firestore.
 */
export async function performCanteenBackup(forceAll = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (isFirestoreQuotaExceeded()) {
    notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
    return true;
  }

  if (!forceAll && !isInitialCanteenPullDone) {
    return false;
  }

  if (isCanteenBackingUp) {
    return false;
  }

  const pendingQueue = getPendingDeltaQueue();
  const keysCandidate = new Set<string>([
    ...Array.from(dirtyCanteenKeys),
    ...Object.keys(pendingQueue.canteenData || {}),
  ]);

  if (!forceAll) {
    for (const key of Array.from(keysCandidate)) {
      const currentRaw = dirtyCanteenValues.has(key)
        ? (typeof dirtyCanteenValues.get(key) === 'string' ? dirtyCanteenValues.get(key) : JSON.stringify(dirtyCanteenValues.get(key)))
        : localStorage.getItem(key);
      const lastSynced = lastSyncedCloudHashes.get(key);
      if (currentRaw !== null && lastSynced !== undefined && lastSynced === currentRaw) {
        dirtyCanteenKeys.delete(key);
        dirtyCanteenValues.delete(key);
        keysCandidate.delete(key);
        clearPendingDeltas({ canteenKeys: [key] });
      }
    }
  }

  if (!forceAll && keysCandidate.size === 0) {
    localStorage.removeItem('canteen_pending_sync');
    if (canteenBackupTimeout) {
      clearTimeout(canteenBackupTimeout);
      canteenBackupTimeout = null;
      scheduledCanteenMode = null;
    }
    return true;
  }

  isCanteenBackingUp = true;
  if (canteenBackupTimeout) {
    clearTimeout(canteenBackupTimeout);
    canteenBackupTimeout = null;
    scheduledCanteenMode = null;
  }

  notifyStatus({ status: 'syncing' });

  try {
    const keysToBackup = forceAll
      ? Array.from(new Set([...CANTEEN_CLOUD_KEYS, ...Array.from(keysCandidate)]))
      : Array.from(keysCandidate);

    if (keysToBackup.length === 0) {
      isCanteenBackingUp = false;
      return true;
    }

    const promises: Promise<boolean>[] = [];
    const backedUpKeys: string[] = [];

    for (const key of keysToBackup) {
      let valToPush = dirtyCanteenValues.get(key);
      if (valToPush === undefined) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            valToPush = JSON.parse(raw);
          } catch {
            valToPush = raw;
          }
        }
      }

      if (valToPush !== undefined) {
        backedUpKeys.push(key);
        promises.push(pushKeyToCloud(key, valToPush));
      }
    }

    const results = await Promise.allSettled(promises);
    const successfulKeys: string[] = [];
    const failedKeys: string[] = [];

    backedUpKeys.forEach((k, idx) => {
      const res = results[idx];
      const isSuccess = res && res.status === 'fulfilled' && res.value === true;
      if (isSuccess && !isFirestoreQuotaExceeded()) {
        successfulKeys.push(k);
        dirtyCanteenKeys.delete(k);
        const valPushed = dirtyCanteenValues.get(k);
        dirtyCanteenValues.delete(k);
        const raw = valPushed !== undefined
          ? (typeof valPushed === 'string' ? valPushed : JSON.stringify(valPushed))
          : localStorage.getItem(k);
        if (raw) lastSyncedCloudHashes.set(k, raw);
      } else {
        failedKeys.push(k);
      }
    });

    if (successfulKeys.length > 0) {
      clearPendingDeltas({ canteenKeys: successfulKeys });
      await publishSyncManifest(['canteen_data'], `canteen_${successfulKeys.length}_keys`);
    }

    if (dirtyCanteenKeys.size === 0 && Object.keys(getPendingDeltaQueue().canteenData || {}).length === 0) {
      localStorage.removeItem('canteen_pending_sync');
    }

    if (failedKeys.length === 0) {
      const readableKeys = successfulKeys
        .map((k) => k.replace(/^canteen_/, '').replace(/_/g, ' '))
        .slice(0, 4)
        .join(', ');
      const moreCount = successfulKeys.length > 4 ? ` +${successfulKeys.length - 4} more` : '';
      const summaryMsg = isFirestoreQuotaExceeded()
        ? 'Firebase Quota Full — changes safely saved in Local Cloud.'
        : `Uploaded changed Canteen items (${readableKeys}${moreCount}) to Firebase.`;

      addCanteenSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PUSH',
        status: 'SUCCESS',
        message: summaryMsg,
      });

      notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
      isCanteenBackingUp = false;
      return true;
    } else {
      const readableFails = failedKeys
        .map((k) => k.replace(/^canteen_/, '').replace(/_/g, ' '))
        .slice(0, 3)
        .join(', ');
      addCanteenSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PUSH',
        status: 'ERROR',
        message: isFirestoreQuotaExceeded()
          ? 'Firebase Quota Exceeded — queued in Local Cloud.'
          : `Cloud backup retry queued for (${readableFails}).`,
      });

      notifyStatus({ status: isFirestoreQuotaExceeded() ? 'synced' : 'error', errorMessage: 'Sync retry queued' });
      isCanteenBackingUp = false;
      return false;
    }
  } catch (err: any) {
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PUSH',
      status: 'ERROR',
      message: 'Cloud backup error: ' + (err?.message || 'Network error'),
    });
    notifyStatus({ status: 'error', errorMessage: err?.message || 'Network error' });
    isCanteenBackingUp = false;
    return false;
  }
}

/**
 * Deleted Transaction Tombstones to prevent deleted records from resurrecting on cloud sync
 */
export function getDeletedTxIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('canteen_deleted_tx_ids');
    if (raw) return new Set(JSON.parse(raw).map(String));
  } catch {}
  return new Set();
}

export function recordDeletedTxId(txId: string | number) {
  if (typeof window === 'undefined' || !txId) return;
  try {
    const set = getDeletedTxIds();
    const str = String(txId);
    set.add(str);
    const num = Number(txId);
    if (!isNaN(num)) set.add(String(num));
    const arr = Array.from(set);
    localStorage.setItem('canteen_deleted_tx_ids', JSON.stringify(arr));
    // Persist tombstones to cloud immediately so deleted items NEVER return on any device/refresh
    pushKeyToCloud('canteen_deleted_tx_ids', arr).catch(() => {});
  } catch {}
}

export async function recordDeletedTxIdAsync(txId: string | number): Promise<void> {
  if (typeof window === 'undefined' || !txId) return;
  try {
    const set = getDeletedTxIds();
    const str = String(txId);
    set.add(str);
    const num = Number(txId);
    if (!isNaN(num)) set.add(String(num));
    const arr = Array.from(set);
    localStorage.setItem('canteen_deleted_tx_ids', JSON.stringify(arr));
    await pushKeyToCloud('canteen_deleted_tx_ids', arr);
  } catch {}
}

/**
 * Safely retrieves canteen transactions from localStorage.
 * Guarantees that an Array is ALWAYS returned, protecting callers against
 * non-array structures, numeric-keyed objects, corrupted JSON, or nulls.
 */
export function getSafeCanteenTransactions(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('canteen_txs');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray((parsed as any).txs)) return (parsed as any).txs;
      if (Array.isArray((parsed as any).transactions)) return (parsed as any).transactions;
      const values = Object.values(parsed);
      if (Array.isArray(values) && values.length > 0 && typeof values[0] === 'object') {
        return values;
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function clearDirtyCanteenKey(key: string) {
  dirtyCanteenKeys.delete(key);
  dirtyCanteenValues.delete(key);
}

/**
 * Deleted Expense Tombstones to prevent deleted expenses from resurrecting on cloud sync
 */
export function getDeletedExpenseIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('canteen_deleted_expense_ids');
    if (raw) return new Set(JSON.parse(raw).map(String));
  } catch {}
  return new Set();
}

export function recordDeletedExpenseId(expId: string | number) {
  if (typeof window === 'undefined' || !expId) return;
  try {
    const set = getDeletedExpenseIds();
    set.add(String(expId));
    const arr = Array.from(set);
    localStorage.setItem('canteen_deleted_expense_ids', JSON.stringify(arr));
    // Persist tombstones to cloud immediately so deleted expenses NEVER return
    pushKeyToCloud('canteen_deleted_expense_ids', arr).catch(() => {});
  } catch {}
}

/**
 * Deleted Advance Tombstones to prevent deleted advances from resurrecting on cloud sync
 */
export function getDeletedAdvanceIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('canteen_deleted_advance_ids');
    if (raw) return new Set(JSON.parse(raw).map(String));
  } catch {}
  return new Set();
}

export function recordDeletedAdvanceId(advId: string | number) {
  if (typeof window === 'undefined' || !advId) return;
  try {
    const set = getDeletedAdvanceIds();
    set.add(String(advId));
    const arr = Array.from(set);
    localStorage.setItem('canteen_deleted_advance_ids', JSON.stringify(arr));
    // Persist tombstones to cloud immediately so deleted advances NEVER return on any device/refresh
    pushKeyToCloud('canteen_deleted_advance_ids', arr).catch(() => {});
  } catch {}
}

/**
 * Automatically reconciles and updates/deletes corresponding expense from canteen_expenses (Capital Log)
 * when an OTHERS or UNIT_FUND transaction is deleted.
 */
export function reconcileExpenseOnFundTxDelete(deletedTx: any, remainingTxs?: any[]): void {
  if (!deletedTx) return;
  try {
    const rawExpenses = localStorage.getItem('canteen_expenses');
    if (!rawExpenses) return;
    const exps: any[] = JSON.parse(rawExpenses);
    if (!Array.isArray(exps) || exps.length === 0) return;

    const txIdStr = String(deletedTx.id || '').toLowerCase();
    const txItemsStr = String(deletedTx.items || '').toLowerCase();
    const isOthers = 
      deletedTx.billType === 'OTHERS' || 
      deletedTx.category === 'OTHERS' || 
      txIdStr.includes('others') || 
      txItemsStr.includes('others bill') || 
      txItemsStr.includes('other bill') ||
      txItemsStr.includes('others fund');

    const isUnitFund = 
      deletedTx.billType === 'UNIT_FUND' || 
      deletedTx.category === 'UNIT_FUND' || 
      txIdStr.includes('unit_fund') || 
      txIdStr.includes('unit-fund') || 
      txItemsStr.includes('unit fund');

    if (!isOthers && !isUnitFund && !deletedTx.batchExpenseId) return;

    // Get current remaining transactions from param or localStorage
    const allRemainingTxs = remainingTxs || getSafeCanteenTransactions();

    let expModified = false;

    // 1. Locate matching expense
    let targetExpIdx = exps.findIndex(e => deletedTx.batchExpenseId && String(e.id) === String(deletedTx.batchExpenseId));

    if (targetExpIdx === -1) {
      const txDate = deletedTx.date;
      targetExpIdx = exps.findIndex(e => {
        const eDate = e.date;
        const eDesc = String(e.desc || '').toLowerCase();
        const eCat = String(e.category || '').toLowerCase();
        const isCatMatch = isOthers
          ? (eCat.includes('others') || eDesc.includes('others'))
          : (eCat.includes('unit') || eDesc.includes('unit'));
        return isCatMatch && (eDate === txDate || Math.abs(new Date(eDate).getTime() - new Date(txDate).getTime()) < 86400000);
      });
    }

    if (targetExpIdx !== -1) {
      const targetExp = exps[targetExpIdx];
      // Find remaining active transactions belonging to this exact batch / expense
      const remainingTxsInBatch = allRemainingTxs.filter((t: any) => {
        if (!t || String(t.id) === String(deletedTx.id)) return false;
        if (deletedTx.batchExpenseId && t.batchExpenseId === deletedTx.batchExpenseId) return true;
        if (targetExp.id && t.batchExpenseId === targetExp.id) return true;
        return (
          String(t.items || '') === String(deletedTx.items || '') && 
          String(t.date || '') === String(deletedTx.date || '') && 
          (t.billType === deletedTx.billType || (isOthers && String(t.id || '').includes('others')))
        );
      });

      if (remainingTxsInBatch.length === 0) {
        // No remaining transactions in this batch! Delete the entire expense!
        recordDeletedExpenseId(String(targetExp.id));
        exps.splice(targetExpIdx, 1);
        expModified = true;
      } else {
        // Compute exact remaining amount from active transactions
        const remainingSum = remainingTxsInBatch.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        if (remainingSum <= 0) {
          recordDeletedExpenseId(String(targetExp.id));
          exps.splice(targetExpIdx, 1);
        } else {
          targetExp.amount = remainingSum;
          const memberList = remainingTxsInBatch.map((t: any) => {
            const name = String(t.memberName || t.name || '').trim() || (t.bdNo ? `BD-${t.bdNo}` : 'Member');
            const bd = t.bdNo ? ` (BD-${t.bdNo})` : '';
            const amt = Number(t.amount) || 0;
            return {
              name,
              bdNo: t.bdNo,
              amount: amt,
              label: `${name}${bd}: ৳${amt.toLocaleString('en-US')}`
            };
          });
          targetExp.memberBreakdown = memberList;
          if (memberList.length === 1) {
            targetExp.detailedPerson = memberList[0].label;
          } else {
            targetExp.detailedPerson = memberList.map(m => m.label).join(' • ');
          }
          targetExp.subdesc = `Kar Jonno: ${memberList.map(m => m.label).join(', ')} [${targetExp.paymentMethod || 'Cash'}]`;
        }
        expModified = true;
      }
    }

    if (expModified) {
      localStorage.setItem('canteen_expenses', JSON.stringify(exps));
      pushKeyToCloud('canteen_expenses', exps).catch(() => {});
      window.dispatchEvent(new Event('canteen_expenses_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (err) {
    console.warn('[reconcileExpenseOnFundTxDelete] Error:', err);
  }
}

/**
 * Robustly unwraps nested setting values (protects against double JSON encoding or { setting_key, setting_value } wrappers)
 */
export function unwrapSettingValue(val: any): any {
  if (val === undefined || val === null) return val;
  let parsed = val;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch {}
  }
  let iterations = 0;
  while (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.setting_value !== undefined && iterations < 5) {
    iterations++;
    let next = parsed.setting_value;
    if (typeof next === 'string') {
      try { next = JSON.parse(next); } catch {}
    }
    parsed = next;
  }
  return parsed;
}

/**
 * Merge two arrays of objects by unique identifier (id or orderId or key)
 * Also safely supports arrays of string IDs (such as canteen_daily_menu).
 */
function mergeArrayData(localArr: any[], cloudArr: any[], keyField = 'id', keyName = ''): any[] {
  localArr = unwrapSettingValue(localArr);
  cloudArr = unwrapSettingValue(cloudArr);
  if (!Array.isArray(localArr)) localArr = [];
  if (!Array.isArray(cloudArr)) cloudArr = [];

  // Filter out any explicitly deleted purpose presets so they NEVER resurrect
  if (keyName === 'canteen_purpose_presets') {
    const deletedPresets = new Set<string>();
    try {
      const d = JSON.parse(localStorage.getItem('canteen_deleted_purpose_presets') || '[]');
      if (Array.isArray(d)) d.forEach(x => deletedPresets.add(String(x).trim()));
    } catch {}
    localArr = localArr.filter(x => typeof x === 'string' && !deletedPresets.has(x.trim()));
    cloudArr = cloudArr.filter(x => typeof x === 'string' && !deletedPresets.has(x.trim()));
  }

  // Filter out any explicitly deleted others fund categories so they NEVER resurrect
  if (keyName === 'baf_others_fund_categories') {
    const deletedCats = new Set<string>();
    try {
      const d = JSON.parse(localStorage.getItem('baf_deleted_others_fund_categories') || '[]');
      if (Array.isArray(d)) d.forEach(x => deletedCats.add(String(x).trim()));
    } catch {}
    localArr = localArr.filter(c => c && !deletedCats.has(String(c.id).trim()) && !deletedCats.has(String(c.name).trim()));
    cloudArr = cloudArr.filter(c => c && !deletedCats.has(String(c.id).trim()) && !deletedCats.has(String(c.name).trim()));
  }

  const isLocalStrings = localArr.length > 0 && typeof localArr[0] === 'string';
  const isCloudStrings = cloudArr.length > 0 && typeof cloudArr[0] === 'string';

  if (isLocalStrings || isCloudStrings) {
    // Preserve string IDs (e.g. canteen_daily_menu selected item IDs, purpose presets)
    const set = new Set<string>();
    localArr.forEach(i => { if (typeof i === 'string' && i.trim()) set.add(i.trim()); });
    cloudArr.forEach(i => { if (typeof i === 'string' && i.trim()) set.add(i.trim()); });
    return Array.from(set);
  }

  // Filter out any explicitly deleted transactions and phantom auto-dues so they NEVER resurrect
  if (keyName === 'canteen_txs') {
    const deletedIds = getDeletedTxIds();
    const isPhantomOrDeleted = (t: any) => {
      if (!t) return true;
      const tId = String(t.id || '');
      if (deletedIds.has(tId)) return true;
      if (tId.startsWith('init-auto-due-') || tId.startsWith('init-due-')) return true;
      if (String(t.items || '').includes('বকেয়া ও প্রারম্ভিক বিল')) return true;
      return false;
    };
    localArr = localArr.filter(t => !isPhantomOrDeleted(t));
    cloudArr = cloudArr.filter(t => !isPhantomOrDeleted(t));
  }

  // Filter out any explicitly deleted expenses so they NEVER resurrect from cloud
  if (keyName === 'canteen_expenses') {
    const deletedExpIds = getDeletedExpenseIds();
    localArr = localArr.filter(e => e && !deletedExpIds.has(String(e.id)));
    cloudArr = cloudArr.filter(e => e && !deletedExpIds.has(String(e.id)));

    // Self-heal: ensure shop due records never attach a civilian staff member
    const cleanShopDue = (e: any) => {
      if (e && (e.dueShop || String(e.paymentMethod || '').toLowerCase() === 'due' || String(e.id || '').startsWith('shop-init-')) && e.detailedPerson) {
        const copy = { ...e };
        delete copy.detailedPerson;
        return copy;
      }
      return e;
    };
    localArr = localArr.map(cleanShopDue);
    cloudArr = cloudArr.map(cleanShopDue);
  }

  // Filter out any explicitly deleted advances so they NEVER resurrect from cloud
  if (keyName === 'canteen_bazar_advances') {
    const deletedAdvIds = getDeletedAdvanceIds();
    localArr = localArr.filter(a => a && !deletedAdvIds.has(String(a.id)));
    cloudArr = cloudArr.filter(a => a && !deletedAdvIds.has(String(a.id)));
  }

  const map = new Map<string, any>();

  // Add cloud items first
  for (const item of cloudArr) {
    if (item && typeof item === 'object') {
      const id = String(item[keyField] || item.orderId || item.uid || item.name || JSON.stringify(item));
      map.set(id, item);
    }
  }

  // Merge or overwrite with local items (or keep both)
  for (const item of localArr) {
    if (item && typeof item === 'object') {
      const id = String(item[keyField] || item.orderId || item.uid || item.name || JSON.stringify(item));
      // If local item has a timestamp and is newer, or keep local changes
      map.set(id, item);
    }
  }

  const mergedList = Array.from(map.values());
  if (keyName === 'canteen_txs') {
    // Sort newest first
    const sortedList = [...mergedList].sort((a, b) => {
      const timeA = new Date(a?.created_at || a?.createdAt || a?.timestamp || a?.date || 0).getTime() || 0;
      const timeB = new Date(b?.created_at || b?.createdAt || b?.timestamp || b?.date || 0).getTime() || 0;
      if (timeA !== timeB) return timeB - timeA;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });

    // Deduplicate only truly identical transaction copies (same member, month, billType, amount, and items)
    // Preserving all historical initial bills and amount change entries intact!
    const seenExactInitial = new Set<string>();
    const seenImportSale = new Set<string>();
    const deduped: any[] = [];
    for (const t of sortedList) {
      if (!t) continue;
      const isInitial = t.type === 'INITIAL_BILL' || 
        t.type === 'AMOUNT_CHANGE' ||
        String(t.items || '').includes('ক্যান্টিন বিল') || 
        String(t.items || '').includes('বকেয়া বিল') ||
        String(t.items || '').includes('Changed amount from');

      if (isInitial) {
        const cleanBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
        const month = t.monthKey || (t.date ? String(t.date).trim() : '');
        const bType = t.billType || 'CANTEEN';
        const amt = Number(t.amount || 0);
        const itemStr = String(t.items || '').trim();
        const exactKey = `${cleanBd}_${month}_${bType}_${amt}_${itemStr}`;
        if (cleanBd && month && seenExactInitial.has(exactKey)) {
          continue; // Drop only identical twin copies
        }
        if (cleanBd && month) {
          seenExactInitial.add(exactKey);
        }
      }

      // Deduplicate POS sales import transactions on the same (member, date): keep only the newest!
      if (String(t.id || '').startsWith('tx-sale-import-')) {
        const cleanBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '') || String(t.memberName || '').toLowerCase().trim();
        const tDate = String(t.date || '').trim();
        const importKey = `${cleanBd}__${tDate}`;
        if (cleanBd && tDate && seenImportSale.has(importKey)) {
          continue; // Newer import already kept, drop older import!
        }
        if (cleanBd && tDate) {
          seenImportSale.add(importKey);
        }
      }

      deduped.push(t);
    }
    return deduped;
  }

  return mergedList;
}

/**
 * Push a single key directly to Firebase Firestore canteen_data collection + local server fallback
 */
export async function pushKeyToCloud(key: string, data: any, _retryCount = 1): Promise<boolean> {
  const strVal = typeof data === 'string' ? data : JSON.stringify(data);

  // Always save to local server storage immediately for Local Cloud Storage durability
  if (typeof window !== 'undefined') {
    fetch('/api/canteen/save-setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setting_key: key, setting_value: strVal }),
    }).catch(() => {});
  }

  try {
    const prevSynced = lastSyncedCloudHashes.get(key);
    if (prevSynced && prevSynced === strVal) {
      return true; // Skip duplicate write
    }

    if (key === 'baf_155_uasu_v2_db' || key.endsWith('_db') || strVal.length > 700000) {
      lastSyncedCloudHashes.set(key, strVal);
      return true;
    }

    if (!isFirebaseConfigured || isFirestoreQuotaExceeded() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      recordPendingDeltas({ canteenKeys: [key] });
      return true;
    }

    const ok = await pushCanteenDataKeyToFirebase(key, data, new Date().toISOString());
    if (ok) {
      lastSyncedCloudHashes.set(key, strVal);
      clearPendingDeltas({ canteenKeys: [key] });
      return true;
    }

    recordPendingDeltas({ canteenKeys: [key] });
    return false;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, err?.message);
    }
    recordPendingDeltas({ canteenKeys: [key] });
    return false;
  }
}

/**
 * Pull a specific key from Firebase Firestore with local server fallback
 */
export async function pullKeyFromCloud(key: string): Promise<any | null> {
  if (isFirebaseConfigured && !isFirestoreQuotaExceeded()) {
    try {
      const fbVal = await fetchSingleCanteenDocFromFirebase(key);
      if (fbVal !== null && fbVal !== undefined) {
        return unwrapSettingValue(fbVal);
      }
    } catch {}
  }

  // Fallback to local server backup
  try {
    const localRes = await fetch('/api/canteen/all-settings');
    if (localRes.ok) {
      const list = await localRes.json();
      if (Array.isArray(list)) {
        const found = list.find((it: any) => it && it.setting_key === key);
        if (found && found.setting_value) {
          return unwrapSettingValue(found.setting_value);
        }
      }
    }
  } catch {}

  return null;
}

export function queuePushKeyToCloud(key: string, data?: any, delay = -1) {
  markCanteenDirty(key, data);
  if (delay === 0) {
    performCanteenBackup(false);
  }
}

/**
 * Dispatch corresponding DOM event so UI components refresh when a key updates
 */
function dispatchKeyUpdateEvent(key: string) {
  if (typeof window === 'undefined') return;

  setTimeout(() => {
    const cloudEvent = (eventName: string) =>
      new CustomEvent(eventName, { detail: { source: 'cloud_sync' } });

    switch (key) {
      case 'canteen_txs':
        window.dispatchEvent(cloudEvent('canteen_txs_updated'));
        break;
      case 'canteen_pre_orders':
        window.dispatchEvent(cloudEvent('canteen_pre_orders_updated'));
        break;
      case 'canteen_expenses':
        window.dispatchEvent(cloudEvent('canteen_expenses_updated'));
        break;
      case 'canteen_bazar_advances':
        window.dispatchEvent(cloudEvent('canteen_bazar_advances_updated'));
        break;
      case 'canteen_member_bangla_names':
        window.dispatchEvent(cloudEvent('canteen_member_bangla_names_updated'));
        break;
      case 'canteen_menu_bangla_names':
        window.dispatchEvent(cloudEvent('canteen_menu_bangla_names_updated'));
        break;
      case 'canteen_fund_transfers':
        window.dispatchEvent(cloudEvent('canteen_transfers_updated'));
        break;
      case 'canteen_menu_recipes_v3':
      case 'canteen_menu_recipes_v2':
        window.dispatchEvent(cloudEvent('canteen_menu_recipes_updated'));
        break;
      case 'canteen_menu_recipes_20pax_v1':
        window.dispatchEvent(cloudEvent('canteen_recipes_20pax_updated'));
        break;
      case 'canteen_raw_stock_logs_v2':
        window.dispatchEvent(cloudEvent('canteen_raw_stock_logs_updated'));
        break;
      case 'canteen_raw_inventory_items_v2':
        window.dispatchEvent(cloudEvent('canteen_raw_inventory_updated'));
        break;
      case 'canteen_menu_items_catalog_v1':
        window.dispatchEvent(cloudEvent('canteen_menu_updated'));
        break;
      case 'canteen_daily_menu':
      case 'canteen_daily_menu_updated_at':
        window.dispatchEvent(cloudEvent('canteen_daily_menu_updated'));
        break;
      case 'canteen_bill_import_history':
        window.dispatchEvent(cloudEvent('canteen_bill_import_history_updated'));
        break;
      case 'canteen_pos_import_history':
        window.dispatchEvent(cloudEvent('canteen_pos_import_history_updated'));
        break;
      case 'canteen_purpose_presets':
      case 'canteen_deleted_purpose_presets':
        window.dispatchEvent(cloudEvent('canteen_purpose_presets_updated'));
        break;
      case 'baf_others_fund_categories':
      case 'baf_deleted_others_fund_categories':
        window.dispatchEvent(cloudEvent('others_fund_updated'));
        break;
    }
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
  }, 0);
}

/**
 * Pull all Canteen keys from Firebase Firestore (or Local Cloud Storage on quota exceeded) and reconcile deltas
 */
export async function pullAllCanteenDataFromCloud(options?: { isLoginSync?: boolean; isQuotaRecovery?: boolean }): Promise<void> {
  notifyStatus({ status: 'syncing' });
  isCanteenPulling = true;
  isApplyingCloudPull = true;

  try {
    let data: Array<{ setting_key: string; setting_value: any; updated_at?: string }> | null = null;
    let fetchError: any = null;
    let usedLocalFallback = false;

    if (isFirebaseConfigured) {
      if (options?.isLoginSync || options?.isQuotaRecovery || isFirestoreQuotaExceeded()) {
        const probe = await probeFirebaseConnectionAndQuota(Boolean(options?.isLoginSync || options?.isQuotaRecovery));
        if (probe.quotaExceeded || isFirestoreQuotaExceeded()) {
          usedLocalFallback = true;
          if (options?.isLoginSync && typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('baf_login_quota_exceeded_popup', {
                detail: {
                  source: 'login',
                  message: probe.errorMsg || 'Firebase daily quota exceeded. Switching to Local Cloud Storage.',
                  upgradeUrl: getQuotaConsoleUpgradeUrl(),
                },
              })
            );
          }
        }
      }

      if (!usedLocalFallback && !isFirestoreQuotaExceeded()) {
        try {
          const fbDocs = await fetchCanteenDataFromFirebase();
          if (fbDocs && fbDocs.length > 0) {
            data = fbDocs.map((d) => ({
              setting_key: d.docKey,
              setting_value: d.value,
              updated_at: d.updatedAt,
            }));
          }
        } catch (err: any) {
          fetchError = err;
          if (isQuotaExceededError(err)) {
            setFirestoreQuotaExceeded(true, err?.message);
            usedLocalFallback = true;
            if (options?.isLoginSync && typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('baf_login_quota_exceeded_popup', {
                  detail: {
                    source: 'login',
                    message: err?.message || 'Firebase daily quota exceeded.',
                    upgradeUrl: getQuotaConsoleUpgradeUrl(),
                  },
                })
              );
            }
          }
        }
      }
    }

    // Fallback to Local Cloud Storage (/api/canteen/all-settings) when quota exceeded or Firebase empty
    if (usedLocalFallback || fetchError || !data || data.length === 0) {
      try {
        const rawFetcher = (typeof window !== 'undefined' && (window as any).__baf_raw_fetch) || fetch;
        const localRes = await rawFetcher('/api/canteen/all-settings');
        if (localRes.ok) {
          const localSettings = await localRes.json();
          if (Array.isArray(localSettings) && localSettings.length > 0) {
            data = localSettings.filter((s: any) => s && s.setting_key && (s.setting_key.startsWith('canteen_') || s.setting_key.startsWith('baf_')));
            fetchError = null;
          }
        }
      } catch (lErr) {
        console.warn('[CanteenCloudSync] Local server fallback notice:', lErr);
      }
    }

    if (fetchError && (!data || data.length === 0)) {
      const hasLocalKeys = typeof window !== 'undefined' && Boolean(
        localStorage.getItem('canteen_daily_menu') ||
        localStorage.getItem('canteen_txs') ||
        localStorage.getItem('canteen_menu_cache') ||
        localStorage.getItem('canteen_members_cache') ||
        localStorage.getItem('canteen_settings')
      );
      if (hasLocalKeys) {
        notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
        return;
      }
      notifyStatus({ status: 'error', errorMessage: fetchError?.message || 'Sync error' });
      return;
    }

    if (!data || data.length === 0) {
      notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
      return;
    }

    const cloudKeyMap = new Map<string, any>();
    const cloudUpdatedMap = new Map<string, string>();
    for (const row of data) {
      if (!row.setting_key) continue;
      const unwrapped = unwrapSettingValue(row.setting_value);
      cloudKeyMap.set(row.setting_key, unwrapped);
      if (row.updated_at) cloudUpdatedMap.set(row.setting_key, row.updated_at);
      if (typeof window !== 'undefined') {
        const rawStr = typeof row.setting_value === 'string' ? row.setting_value : JSON.stringify(row.setting_value);
        if (row.setting_key.startsWith('canteen_member_')) {
          localStorage.setItem(row.setting_key, rawStr);
        }
        if (row.setting_key === 'canteen_members') {
          localStorage.setItem('canteen_members_cache', rawStr);
        }
        if (row.setting_key === 'baf_official_duty_matrix_v4' || row.setting_key === 'baf_detailed_user_logins' || row.setting_key === 'baf_custom_duties_v1') {
          localStorage.setItem(row.setting_key, rawStr);
        }
      }
    }


    // Merge deleted transaction IDs first so any incoming txs are filtered accurately
    const cloudDeleted = cloudKeyMap.get('canteen_deleted_tx_ids');
    if (Array.isArray(cloudDeleted) && cloudDeleted.length > 0) {
      const localDeleted = getDeletedTxIds();
      cloudDeleted.forEach(id => localDeleted.add(String(id)));
      if (typeof window !== 'undefined') {
        localStorage.setItem('canteen_deleted_tx_ids', JSON.stringify(Array.from(localDeleted)));
      }
    }

    // Merge deleted expense IDs so any deleted expenses never resurrect
    const cloudDeletedExp = cloudKeyMap.get('canteen_deleted_expense_ids');
    if (Array.isArray(cloudDeletedExp) && cloudDeletedExp.length > 0) {
      const localDeletedExp = getDeletedExpenseIds();
      cloudDeletedExp.forEach(id => localDeletedExp.add(String(id)));
      if (typeof window !== 'undefined') {
        localStorage.setItem('canteen_deleted_expense_ids', JSON.stringify(Array.from(localDeletedExp)));
      }
    }

    // Merge deleted advance IDs so any deleted advances never resurrect
    const cloudDeletedAdv = cloudKeyMap.get('canteen_deleted_advance_ids');
    if (Array.isArray(cloudDeletedAdv) && cloudDeletedAdv.length > 0) {
      const localDeletedAdv = getDeletedAdvanceIds();
      cloudDeletedAdv.forEach(id => localDeletedAdv.add(String(id)));
      if (typeof window !== 'undefined') {
        localStorage.setItem('canteen_deleted_advance_ids', JSON.stringify(Array.from(localDeletedAdv)));
      }
    }

    const ARRAY_KEYS = new Set([
      'canteen_txs',
      'canteen_expenses',
      'canteen_bazar_advances',
      'canteen_pre_orders',
      'canteen_daily_menu',
      'canteen_menu_recipes_v3',
      'canteen_menu_recipes_20pax_v1',
      'canteen_menu_recipes_v2',
      'canteen_raw_stock_logs_v2',
      'canteen_raw_inventory_items_v2',
      'canteen_menu_items_catalog_v1',
      'canteen_bill_import_history',
      'canteen_pos_import_history',
      'canteen_member_seniority',
      'canteen_due_shops_v1',
      'canteen_purpose_presets',
      'baf_others_fund_categories',
      'canteen_fund_transfers'
    ]);

    // Iterate over all canteen cloud keys
    for (const key of CANTEEN_CLOUD_KEYS) {
      let cloudVal = cloudKeyMap.get(key);
      const localRaw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      let localVal: any = null;
      if (localRaw) {
        try { localVal = JSON.parse(localRaw); } catch { localVal = localRaw; }
      }

      if (key === 'canteen_expenses') {
        localVal = getSafeCanteenExpenses(localVal);
        if (cloudVal !== undefined) cloudVal = getSafeCanteenExpenses(cloudVal);
      } else if (key === 'canteen_bazar_advances') {
        localVal = getSafeCanteenAdvances(localVal);
        if (cloudVal !== undefined) cloudVal = getSafeCanteenAdvances(cloudVal);
      } else if (ARRAY_KEYS.has(key)) {
        if (localVal && !Array.isArray(localVal)) {
          localVal = typeof localVal === 'object' ? Object.values(localVal).filter(v => v && typeof v === 'object') : [];
        }
        if (cloudVal !== undefined && !Array.isArray(cloudVal)) {
          cloudVal = typeof cloudVal === 'object' && cloudVal !== null ? Object.values(cloudVal).filter(v => v && typeof v === 'object') : [];
        }
      }

      if (cloudVal !== undefined) {
        let finalVal = cloudVal;

        // If both exist and are arrays (e.g. transactions, orders, expenses, stock logs) -> smart merge
        if (Array.isArray(cloudVal) && Array.isArray(localVal)) {
          if (key === 'canteen_raw_inventory_items_v2') {
            const { deduplicated } = deduplicateRawItems([...localVal, ...cloudVal]);
            finalVal = deduplicated;
          } else if (key === 'canteen_menu_items_catalog_v1') {
            const currentCache = getCanteenMenuCache();
            const effectiveLocal = (Array.isArray(localVal) && localVal.length > 0) ? localVal : currentCache;
            const overrides = getUserMenuOverrides();

            // Local modifications and overrides take absolute precedence over stale cloudVal
            const mergedList: any[] = [];
            const processedIds = new Set<string>();

            for (const lItem of effectiveLocal) {
              const lId = String(lItem.id || '').toLowerCase();
              processedIds.add(lId);
              const ov = findUserMenuOverride(overrides, lItem);
              mergedList.push(ov ? { ...lItem, ...ov } : lItem);
            }

            if (Array.isArray(cloudVal)) {
              for (const cItem of cloudVal) {
                const cId = String(cItem.id || '').toLowerCase();
                if (!processedIds.has(cId)) {
                  processedIds.add(cId);
                  const ov = findUserMenuOverride(overrides, cItem);
                  mergedList.push(ov ? { ...cItem, ...ov } : cItem);
                }
              }
            }

            const finalizedMenu = deduplicateCanteenMenuItems(mergedList);
            finalVal = finalizedMenu;
            setCanteenMenuCache(finalizedMenu);
          } else if (key === 'canteen_daily_menu') {
            const localUpdated = typeof window !== 'undefined' ? localStorage.getItem('canteen_daily_menu_updated_at') : null;
            const cloudUpdated = cloudKeyMap.get('canteen_daily_menu_updated_at');
            const localTime = new Date(localUpdated || 0).getTime();
            const cloudTime = new Date(cloudUpdated || 0).getTime();

            const isCloudExpired = isTimestampPastResetThreshold(cloudUpdated);
            const isLocalExpired = isTimestampPastResetThreshold(localUpdated);

            // If expired past schedule reset threshold, reset to empty
            if (isCloudExpired || isLocalExpired) {
              finalVal = [];
            } else if (!isLocalExpired && localTime >= cloudTime && Array.isArray(localVal) && localVal.length > 0) {
              finalVal = localVal;
            } else if (!isCloudExpired && Array.isArray(cloudVal) && cloudVal.length > 0) {
              finalVal = cloudVal;
            } else {
              finalVal = [];
            }
          } else if (key === 'canteen_pre_orders') {
            const validCloud = Array.isArray(cloudVal)
              ? cloudVal.filter((o: any) => o?.timestamp && !isTimestampPastResetThreshold(o.timestamp))
              : [];
            const validLocal = Array.isArray(localVal)
              ? localVal.filter((o: any) => o?.timestamp && !isTimestampPastResetThreshold(o.timestamp))
              : [];
            finalVal = mergeArrayData(validLocal, validCloud, 'orderId', key);
          } else {
            const keyField = key === 'canteen_expense_last_unit_prices' ? 'key' : 'id';
            finalVal = mergeArrayData(localVal, cloudVal, keyField, key);
            if (key === 'canteen_txs') {
              const deletedIds = getDeletedTxIds();
              finalVal = finalVal.filter((t: any) => !deletedIds.has(String(t?.id)));
            }
            if (key === 'canteen_expenses') {
              const deletedExpIds = getDeletedExpenseIds();
              finalVal = finalVal.filter((e: any) => !deletedExpIds.has(String(e?.id)));
            }
            if (key === 'canteen_bazar_advances') {
              const deletedAdvIds = getDeletedAdvanceIds();
              finalVal = finalVal.filter((a: any) => !deletedAdvIds.has(String(a?.id)));
            }
          }
        } else if (key === 'canteen_daily_menu' && Array.isArray(localVal) && localVal.length > 0 && (!Array.isArray(cloudVal) || cloudVal.length === 0)) {
          const localUpdated = typeof window !== 'undefined' ? localStorage.getItem('canteen_daily_menu_updated_at') : null;
          if (isTimestampPastResetThreshold(localUpdated)) {
            finalVal = [];
          } else {
            finalVal = localVal;
          }
        } else if (typeof cloudVal === 'object' && cloudVal !== null && typeof localVal === 'object' && localVal !== null) {
          if (ARRAY_KEYS.has(key)) {
            finalVal = [];
          } else {
            finalVal = { ...cloudVal, ...localVal };
          }
        }

        if (ARRAY_KEYS.has(key) && !Array.isArray(finalVal)) {
          finalVal = [];
        }

        if (Array.isArray(finalVal)) {
          if (key === 'canteen_txs') {
            const deletedIds = getDeletedTxIds();
            finalVal = finalVal.filter((t: any) => !deletedIds.has(String(t?.id)));
          }
          if (key === 'canteen_expenses') {
            const deletedExpIds = getDeletedExpenseIds();
            finalVal = finalVal.filter((e: any) => !deletedExpIds.has(String(e?.id)));
          }
          if (key === 'canteen_bazar_advances') {
            const deletedAdvIds = getDeletedAdvanceIds();
            finalVal = finalVal.filter((a: any) => !deletedAdvIds.has(String(a?.id)));
          }
        }

        if (typeof window !== 'undefined') {
          if (key === 'canteen_daily_menu_updated_at') {
            const localUpdated = localStorage.getItem('canteen_daily_menu_updated_at');
            const localTime = new Date(localUpdated || 0).getTime();
            const incomingTime = new Date(finalVal || 0).getTime();
            if (localTime > incomingTime && localUpdated) {
              finalVal = localUpdated;
            }
            const cleanStr = typeof finalVal === 'string' ? finalVal.replace(/^"|"$/g, '') : String(finalVal);
            localStorage.setItem(key, cleanStr);
            lastSyncedCloudHashes.set(key, cleanStr);
          } else {
            const jsonStr = JSON.stringify(finalVal);
            localStorage.setItem(key, jsonStr);
            if (key === 'canteen_menu_items_catalog_v1') {
              localStorage.setItem('canteen_menu_items_list', jsonStr);
              localStorage.setItem('canteen_menu_cache', jsonStr);
            }
            lastSyncedCloudHashes.set(key, jsonStr);
          }
          dispatchKeyUpdateEvent(key);
        }
      } else if (localVal !== null && localVal !== undefined) {
        // Record existing local key into cache so it does not trigger false dirty pushes
        const rawLocal = typeof localVal === 'string' ? localVal : JSON.stringify(localVal);
        lastSyncedCloudHashes.set(key, rawLocal);
      }
    }

    const pendingQueue = getPendingDeltaQueue();
    const pendingCanteenKeys = pendingQueue.canteenData || {};
    const keysToPushBack: Array<{ key: string; value: any }> = [];

    for (const key of CANTEEN_CLOUD_KEYS) {
      const pendingIso = pendingCanteenKeys[key];
      const cloudIso = cloudUpdatedMap.get(key);
      const localMs = pendingIso ? Date.parse(pendingIso) || 0 : 0;
      const cloudMs = cloudIso ? Date.parse(cloudIso) || 0 : 0;
      const storedValRaw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      let storedValParsed: any = undefined;
      if (storedValRaw !== null) {
        try {
          storedValParsed = JSON.parse(storedValRaw);
        } catch {
          storedValParsed = storedValRaw;
        }
      }

      if (pendingIso && storedValParsed !== undefined && (!cloudIso || localMs >= cloudMs)) {
        const cloudRaw = cloudKeyMap.get(key);
        const mergedIsDifferent = JSON.stringify(storedValParsed) !== JSON.stringify(cloudRaw);
        if (mergedIsDifferent && !usedLocalFallback && isFirebaseConfigured && !isFirestoreQuotaExceeded()) {
          keysToPushBack.push({ key, value: storedValParsed });
        }
      }
    }

    if (keysToPushBack.length > 0 && !usedLocalFallback && isFirebaseConfigured && !isFirestoreQuotaExceeded()) {
      for (const item of keysToPushBack) {
        await pushKeyToCloud(item.key, item.value);
      }
      await publishSyncManifest(['canteen_data'], options?.isQuotaRecovery ? 'canteen_quota_recovery_merge' : 'canteen_delta_merge');
    }

    if (!usedLocalFallback && !isFirestoreQuotaExceeded()) {
      dirtyCanteenKeys.clear();
      dirtyCanteenValues.clear();
      clearPendingDeltas({ canteenKeys: CANTEEN_CLOUD_KEYS as unknown as string[] });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('canteen_pending_sync');
        localStorage.setItem(CANTEEN_LAST_PULL_KEY, new Date().toISOString());
      }
      if (canteenBackupTimeout) {
        clearTimeout(canteenBackupTimeout);
        canteenBackupTimeout = null;
        scheduledCanteenMode = null;
      }
    }

    notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PULL',
      status: 'SUCCESS',
      message: usedLocalFallback
        ? `Firebase Quota Full — loaded ${cloudKeyMap.size} Canteen records from Local Cloud Storage.`
        : `Downloaded latest Canteen data (${cloudKeyMap.size} records) from Firebase Firestore.`,
    });

    try {
      const { syncImportHistoryToTransactions } = await import('./importHistoryTxs');
      await syncImportHistoryToTransactions();
    } catch (recErr) {
      console.warn('[CanteenCloudSync] syncImportHistoryToTransactions notice:', recErr);
    }
  } catch (err: any) {
    console.warn('[CanteenCloudSync] Pull exception:', err);
    notifyStatus({ status: 'error', errorMessage: err?.message || 'Network error' });
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PULL',
      status: 'ERROR',
      message: 'Failed to download updates: ' + (err?.message || 'Network error'),
    });
  } finally {
    isApplyingCloudPull = false;
    isCanteenPulling = false;
    isInitialCanteenPullDone = true;
  }
}

/**
 * Push all local Canteen data to Cloud (useful for initial seeding or manual backup)
 */
export async function pushAllLocalDataToCloud(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isFirestoreQuotaExceeded()) {
    notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
    return true;
  }
  notifyStatus({ status: 'syncing' });

  const promises: Promise<any>[] = [];

  for (const key of CANTEEN_CLOUD_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        promises.push(pushKeyToCloud(key, parsed));
      } catch {
        promises.push(pushKeyToCloud(key, raw));
      }
    }
  }

  try {
    const cfg = localStorage.getItem('baf_canteen_settings_v1') || localStorage.getItem('canteen_config');
    if (cfg) promises.push(pushKeyToCloud('baf_canteen_settings_v1', JSON.parse(cfg)));
  } catch {}

  const results = await Promise.allSettled(promises);
  const ok = !results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false));

  if (ok) {
    dirtyCanteenKeys.clear();
    dirtyCanteenValues.clear();
    localStorage.removeItem('canteen_pending_sync');
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PUSH',
      status: 'SUCCESS',
      message: 'Manual backup of all Canteen tables & settings to Supabase completed.'
    });
    notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
    return true;
  } else {
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PUSH',
      status: 'ERROR',
      message: 'Manual backup to Supabase failed for some records.'
    });
    notifyStatus({ status: 'error', errorMessage: 'Upload failed' });
    return false;
  }
}

const preloadedImageUrls = new Set<string>();

export function preloadImage(url: string | undefined | null) {
  if (!url || typeof window === 'undefined') return;
  const resolved = resolveImageUrl(url);
  if (!resolved || resolved.startsWith('data:') || preloadedImageUrls.has(resolved)) return;
  preloadedImageUrls.add(resolved);
  try {
    const img = new Image();
    img.src = resolved;
  } catch {}
}

/**
 * Pre-cache all canteen member DPs, manager image, logo, and menu item photos into browser image cache
 */
export function preloadAllCanteenMedia() {
  if (typeof window === 'undefined') return;
  
  // 1. Manager Image & Logo
  try {
    const cfg = getCanteenConfig();
    if (cfg.adminImage) preloadImage(cfg.adminImage);
    if (cfg.logoUrl) preloadImage(cfg.logoUrl);
  } catch {}

  // 2. Stagger preloading for only the top 10 most recent/active members and menu items
  // avoiding CPU/network flood when entering the canteen app
  setTimeout(() => {
    try {
      const cached = getCanteenMembersCache();
      if (Array.isArray(cached) && cached.length > 0) {
        cached.slice(0, 10).forEach((m: any) => {
          if (m?.DP && !m.DP.startsWith('data:')) preloadImage(m.DP);
        });
      }
    } catch {}

    try {
      const menu = getCanteenMenuCache();
      if (Array.isArray(menu) && menu.length > 0) {
        menu.forEach((item: any) => {
          const imgUrl = item?.DP || item?.img || item?.image;
          if (imgUrl) preloadImage(imgUrl);
        });
      }
    } catch {}

    try {
      const rawStored = localStorage.getItem('canteen_raw_inventory_items_v2');
      if (rawStored) {
        const rawItems = JSON.parse(rawStored);
        if (Array.isArray(rawItems)) {
          rawItems.forEach((r: any) => {
            const imgUrl = r?.DP || r?.dp || r?.image;
            if (imgUrl) preloadImage(imgUrl);
          });
        }
      }
    } catch {}
  }, 800);
}

/**
 * Intelligent Canteen Member Cloud Sync:
 * - On first entry / empty cache: Downloads ALL members, saves to local storage, and preloads all DPs.
 * - On subsequent visits: Performs smart delta check with Cloud, ONLY downloading and updating the exact records that changed.
 */
let lastMemberSyncTime = 0;

export async function syncCanteenMembersFromCloud(forceFull = false): Promise<void> {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  // Throttle delta checks to once every 15 seconds unless forced
  if (!forceFull && now - lastMemberSyncTime < 15000) {
    return;
  }
  lastMemberSyncTime = now;

  try {
    const localCacheRaw = localStorage.getItem('canteen_members_cache');
    const hasLocalCache = Boolean(localCacheRaw && localCacheRaw.length > 50);

    // If no local cache yet: download everything and warm up cache
    if (!hasLocalCache || forceFull) {
      const data = await fetchCanteenMembersOnce(forceFull);
      if (!data || data.length === 0) return;

      localStorage.setItem('canteen_members_cache', JSON.stringify(data));
      data.forEach((m: any) => {
        const cleanBd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '').toLowerCase();
        if (cleanBd) {
          localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
            dp: m.DP || '',
            due: Number(m.Due) || 0,
            rank: m.Rank || '',
            surname: m.Surname || '',
            contact: m.Contact || m['Mobile No'] || '',
            bdNo: cleanBd
          }));
        }
      });

      preloadAllCanteenMedia();
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: data }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      return;
    }

    // Smart Delta-Sync via Firebase Firestore canteen_members
    let cloudData: any[] = [];
    if (isFirebaseConfigured && !isFirestoreQuotaExceeded()) {
      try {
        cloudData = await fetchCanteenMembersFromFirebase();
      } catch (fbErr) {
        console.warn('[CanteenCloudSync] Firestore member pull notice:', fbErr);
      }
    }
    if (!cloudData || cloudData.length === 0) return;

    let localMembers: any[] = [];
    try {
      localMembers = JSON.parse(localCacheRaw!);
    } catch {
      localMembers = [];
    }

    const localMap = new Map<string, any>();
    localMembers.forEach((m: any) => {
      const key = String(m.airman_id || m['BD No'] || '').trim();
      if (key) localMap.set(key, m);
    });

    let hasDelta = false;
    const mergedList: any[] = [];

    for (const cloudM of cloudData) {
      const key = String(cloudM.airman_id || cloudM['BD No'] || '').trim();
      if (!key) continue;
      const cleanBd = String(cloudM['BD No'] || cloudM.airman_id || '').replace(/\D/g, '').toLowerCase();

      const localM = localMap.get(key);

      if (!localM) {
        // Brand new member from cloud
        hasDelta = true;
        mergedList.push(cloudM);
        if (cleanBd) {
          localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
            dp: cloudM.DP || '',
            due: Number(cloudM.Due) || 0,
            rank: cloudM.Rank || '',
            surname: cloudM.Surname || '',
            contact: cloudM.Contact || '',
            bdNo: cleanBd
          }));
        }
        if (cloudM.DP) preloadImage(cloudM.DP);
      } else {
        // Compare values
        const cloudDue = Number(cloudM.Due || 0);
        const localDue = Number(localM.Due || 0);
        const cloudDp = String(cloudM.DP || '').trim();
        const localDp = String(localM.DP || '').trim();
        const cloudRole = String(cloudM.Role || '').trim();
        const localRole = String(localM.Role || '').trim();
        const cloudRank = String(cloudM.Rank || '').trim();
        const localRank = String(localM.Rank || '').trim();
        const cloudSurname = String(cloudM.Surname || '').trim();
        const localSurname = String(localM.Surname || '').trim();
        const cloudContact = String(cloudM.Contact || cloudM['Mobile No'] || '').trim();
        const localContact = String(localM.Contact || localM['Mobile No'] || '').trim();
        const cloudSeniority = (cloudM as any).Seniority !== undefined && (cloudM as any).Seniority !== null ? Number((cloudM as any).Seniority) : undefined;
        const localSeniority = (localM as any).Seniority !== undefined && (localM as any).Seniority !== null ? Number((localM as any).Seniority) : undefined;
        const cloudRankBn = String((cloudM as any).Rank_BN || (cloudM as any).rank_bn || '').trim();
        const localRankBn = String((localM as any).Rank_BN || (localM as any).rank_bn || '').trim();
        const cloudNameBn = String((cloudM as any).Name_BN || (cloudM as any).name_bn || '').trim();
        const localNameBn = String((localM as any).Name_BN || (localM as any).name_bn || '').trim();

        const isChanged = (
          Math.abs(cloudDue - localDue) > 0.01 ||
          cloudDp !== localDp ||
          cloudRole !== localRole ||
          cloudRank !== localRank ||
          cloudSurname !== localSurname ||
          (cloudContact && cloudContact !== localContact) ||
          cloudSeniority !== localSeniority ||
          cloudRankBn !== localRankBn ||
          cloudNameBn !== localNameBn
        );

        if (isChanged) {
          hasDelta = true;
          const mergedContact = cloudContact || localContact || '';
          const updated = { 
            ...localM, 
            ...cloudM,
            Contact: mergedContact,
            Seniority: cloudSeniority !== undefined ? cloudSeniority : localSeniority,
            seniority: cloudSeniority !== undefined ? cloudSeniority : localSeniority,
            Rank_BN: cloudRankBn || localRankBn,
            rank_bn: cloudRankBn || localRankBn,
            rankBn: cloudRankBn || localRankBn,
            Name_BN: cloudNameBn || localNameBn,
            name_bn: cloudNameBn || localNameBn
          };
          mergedList.push(updated);
          if (cleanBd) {
            localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
              dp: updated.DP || '',
              due: Number(updated.Due) || 0,
              rank: updated.Rank || '',
              surname: updated.Surname || '',
              contact: mergedContact,
              bdNo: cleanBd,
              seniority: updated.Seniority,
              rankBn: updated.Rank_BN
            }));
          }
          if (cloudDp && cloudDp !== localDp) {
            preloadImage(cloudDp);
          }
        } else {
          mergedList.push(localM);
        }
      }
    }

    // Also preserve any newly added local members that haven't reached cloudData yet
    for (const [key, localM] of localMap.entries()) {
      const alreadyInMerged = mergedList.some((m) => {
        const mKey = String(m.airman_id || m['BD No'] || '').trim();
        return mKey && (mKey === key || mKey.toLowerCase() === key.toLowerCase());
      });
      if (!alreadyInMerged) {
        hasDelta = true;
        mergedList.push(localM);
      }
    }

    if (hasDelta) {
      const finalSorted = normalizeCanteenMembersSeniority(sortCanteenMembersByOfficeSeniority(mergedList));
      localStorage.setItem('canteen_members_cache', JSON.stringify(finalSorted));
      setCanteenMembersCache(finalSorted);
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: finalSorted }));
      window.dispatchEvent(new Event('canteen_state_updated'));
    }
  } catch (err) {
    console.warn('[CanteenCloudSync] Member sync exception:', err);
  }
}

let isInitialized = false;

/**
 * Initialize automated Canteen Cloud Synchronization with Firebase Firestore & Local Cloud fallback
 */
export function initCanteenCloudSync(): () => void {
  if (isInitialized || typeof window === 'undefined') {
    return () => {};
  }
  isInitialized = true;

  // 1. Initial Pull from Firebase (or Local Cloud if quota full)
  pullAllCanteenDataFromCloud({ isLoginSync: false });
  syncCanteenMembersFromCloud();
  fetchCanteenMenuOnce();
  preloadAllCanteenMedia();

  checkAndEnforceDailyMenuReset();
  const autoResetTimer = setInterval(() => {
    checkAndEnforceDailyMenuReset();
  }, 5000);

  // 2. Subscribe to Firebase sync_manifest for multi-user real-time updates
  let manifestUnsub: (() => void) | null = null;
  let lastCanteenRevision = 0;

  const attachCanteenManifest = () => {
    if (!isFirebaseConfigured || isFirestoreQuotaExceeded() || manifestUnsub) return;
    manifestUnsub = subscribeToSyncManifest((manifest) => {
      if (!manifest || manifest.updatedBySessionId === CLIENT_SESSION_ID) return;
      if (manifest.revision && manifest.revision <= lastCanteenRevision) return;
      lastCanteenRevision = manifest.revision || Date.now();
      const cols = manifest.changedCollections || [];
      if (cols.includes('canteen_data')) {
        pullAllCanteenDataFromCloud({ isLoginSync: false }).catch(() => {});
      }
      if (cols.includes('canteen_members')) {
        syncCanteenMembersFromCloud(true).catch(() => {});
      }
    });
  };
  attachCanteenManifest();

  const handleQuotaStatus = (e: any) => {
    if (e?.detail?.exceeded) {
      if (manifestUnsub) {
        manifestUnsub();
        manifestUnsub = null;
      }
    } else {
      attachCanteenManifest();
    }
  };
  const handleQuotaRecovered = () => {
    pullAllCanteenDataFromCloud({ isQuotaRecovery: true }).catch(() => {});
    syncCanteenMembersFromCloud(true).catch(() => {});
  };
  window.addEventListener('baf_firebase_quota_status', handleQuotaStatus);
  window.addEventListener('baf_firebase_quota_recovered', handleQuotaRecovered);

  // 3. Listen to local canteen update events -> mark dirty & adaptive backup
  const handleLocalTxs = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_txs');
  };
  const handleLocalOrders = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_pre_orders');
  };
  const handleLocalExpenses = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_expenses');
  };
  const handleLocalAdvances = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_bazar_advances');
  };
  const handleLocalBanglaNames = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_member_bangla_names');
  };
  const handleLocalTransfers = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_fund_transfers');
  };
  const handleLocalRecipes = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_menu_recipes_v3');
    queuePushKeyToCloud('canteen_menu_recipes_20pax_v1');
    queuePushKeyToCloud('canteen_menu_recipes_v2');
  };
  const handleLocalStockLogs = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_raw_stock_logs_v2');
  };
  const handleLocalRawInventory = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_raw_inventory_items_v2');
  };
  const handleLocalBillHistory = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_bill_import_history');
  };
  const handleLocalPosImportHistory = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    queuePushKeyToCloud('canteen_pos_import_history');
  };
  const handleLocalMenuCatalog = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    try {
      const raw = localStorage.getItem('canteen_menu_items_list') || localStorage.getItem('canteen_menu_cache');
      if (raw) {
        const lastSynced = lastSyncedCloudHashes.get('canteen_menu_items_catalog_v1');
        if (lastSynced && lastSynced === raw) return;
        queuePushKeyToCloud('canteen_menu_items_catalog_v1', JSON.parse(raw));
      }
    } catch {}
  };
  const handleLocalSettings = (e: any) => {
    if (e?.detail) {
      queuePushKeyToCloud('baf_canteen_settings_v1', e.detail);
    }
  };
  const handleLocalDailyMenu = (e?: any) => {
    if ((e as any)?.detail?.source === 'cloud_sync') return;
    try {
      const rawMenu = localStorage.getItem('canteen_daily_menu');
      const parsedMenu = rawMenu ? JSON.parse(rawMenu) : [];
      queuePushKeyToCloud('canteen_daily_menu', parsedMenu);
    } catch {
      queuePushKeyToCloud('canteen_daily_menu', []);
    }
    const rawTime = localStorage.getItem('canteen_daily_menu_updated_at') || new Date().toISOString();
    queuePushKeyToCloud('canteen_daily_menu_updated_at', rawTime);
  };

  window.addEventListener('canteen_txs_updated', handleLocalTxs);
  window.addEventListener('canteen_pre_orders_updated', handleLocalOrders);
  window.addEventListener('canteen_expenses_updated', handleLocalExpenses);
  window.addEventListener('canteen_bazar_advances_updated', handleLocalAdvances);
  window.addEventListener('canteen_member_bangla_names_updated', handleLocalBanglaNames);
  window.addEventListener('canteen_transfers_updated', handleLocalTransfers);
  window.addEventListener('canteen_menu_recipes_updated', handleLocalRecipes);
  window.addEventListener('canteen_recipes_20pax_updated', handleLocalRecipes);
  window.addEventListener('canteen_raw_stock_logs_updated', handleLocalStockLogs);
  window.addEventListener('canteen_raw_inventory_updated', handleLocalRawInventory);
  window.addEventListener('canteen_daily_menu_updated', handleLocalDailyMenu);
  window.addEventListener('canteen_bill_import_history_updated', handleLocalBillHistory);
  window.addEventListener('canteen_pos_import_history_updated', handleLocalPosImportHistory);
  window.addEventListener('canteen_menu_updated', handleLocalMenuCatalog);
  window.addEventListener('canteen_settings_updated', handleLocalSettings);

  // Switch timer if active user count toggles between single (30m) and multi (10s)
  const handleActiveUsersChanged = () => {
    if (dirtyCanteenKeys.size > 0 && !isCanteenBackingUp && isInitialCanteenPullDone && !isFirestoreQuotaExceeded()) {
      const desiredMode = isMultiUserMode() ? 'multi' : 'single';
      if (scheduledCanteenMode !== desiredMode) {
        if (canteenBackupTimeout) {
          clearTimeout(canteenBackupTimeout);
          canteenBackupTimeout = null;
        }
        scheduledCanteenMode = desiredMode;
        const delayMs = desiredMode === 'multi' ? MULTI_USER_CANTEEN_BACKUP_MS : SINGLE_USER_CANTEEN_BACKUP_MS;
        canteenBackupTimeout = setTimeout(() => {
          canteenBackupTimeout = null;
          scheduledCanteenMode = null;
          if (dirtyCanteenKeys.size > 0 && !isFirestoreQuotaExceeded()) {
            performCanteenBackup(false);
          }
        }, delayMs);
      }
    }
  };
  window.addEventListener('baf_active_users_changed', handleActiveUsersChanged);

  // 10-Second Multi-User Poll: only backs up when activeUsers >= 2 AND actual changes exist!
  const multiUserPollTicker = setInterval(() => {
    if (isFirestoreQuotaExceeded() || !isMultiUserMode()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (dirtyCanteenKeys.size > 0 && !isCanteenBackingUp && isInitialCanteenPullDone) {
      performCanteenBackup(false);
    }
  }, MULTI_USER_CANTEEN_BACKUP_MS);

  const flushBeforeClose = () => {
    if (dirtyCanteenKeys.size > 0 && !isFirestoreQuotaExceeded()) {
      performCanteenBackup(false);
    }
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushBeforeClose();
  };
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', flushBeforeClose);
  window.addEventListener('beforeunload', flushBeforeClose);
  window.addEventListener('baf_before_user_logout', flushBeforeClose);

  return () => {
    if (manifestUnsub) manifestUnsub();
    window.removeEventListener('baf_firebase_quota_status', handleQuotaStatus);
    window.removeEventListener('baf_firebase_quota_recovered', handleQuotaRecovered);
    window.removeEventListener('baf_active_users_changed', handleActiveUsersChanged);
    window.removeEventListener('canteen_txs_updated', handleLocalTxs);
    window.removeEventListener('canteen_pre_orders_updated', handleLocalOrders);
    window.removeEventListener('canteen_expenses_updated', handleLocalExpenses);
    window.removeEventListener('canteen_bazar_advances_updated', handleLocalAdvances);
    window.removeEventListener('canteen_member_bangla_names_updated', handleLocalBanglaNames);
    window.removeEventListener('canteen_transfers_updated', handleLocalTransfers);
    window.removeEventListener('canteen_menu_recipes_updated', handleLocalRecipes);
    window.removeEventListener('canteen_recipes_20pax_updated', handleLocalRecipes);
    window.removeEventListener('canteen_raw_stock_logs_updated', handleLocalStockLogs);
    window.removeEventListener('canteen_raw_inventory_updated', handleLocalRawInventory);
    window.removeEventListener('canteen_bill_import_history_updated', handleLocalBillHistory);
    window.removeEventListener('canteen_pos_import_history_updated', handleLocalPosImportHistory);
    window.removeEventListener('canteen_settings_updated', handleLocalSettings);
    clearInterval(autoResetTimer);
    clearInterval(multiUserPollTicker);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', flushBeforeClose);
    window.removeEventListener('beforeunload', flushBeforeClose);
    window.removeEventListener('baf_before_user_logout', flushBeforeClose);
    window.removeEventListener('canteen_daily_menu_updated', handleLocalDailyMenu);
    window.removeEventListener('canteen_menu_updated', handleLocalMenuCatalog);
    isInitialized = false;
  };
}
