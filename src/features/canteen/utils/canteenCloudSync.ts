import { supabase } from '../../../supabase';
import { deduplicateRawItems } from './recipeManager';
import { resolveImageUrl, getCanteenConfig, isTimestampPastResetThreshold, checkAndEnforceDailyMenuReset } from './canteenSettings';
import { normalizeCanteenMembersSeniority, sortCanteenMembersByOfficeSeniority } from './canteenSeniority';
import { 
  getCanteenMembersCache, 
  setCanteenMembersCache, 
  fetchCanteenMembersOnce, 
  getCanteenMenuCache, 
  fetchCanteenMenuOnce,
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
  'canteen_member_bangla_names',
  'canteen_fund_transfers',
  'canteen_daily_menu',
  'canteen_daily_menu_updated_at',
  'canteen_menu_recipes_v2',
  'canteen_raw_stock_logs_v2',
  'canteen_expense_last_unit_prices',
  'canteen_recent_members',
  'canteen_raw_inventory_items_v2',
  'canteen_bill_import_history',
  'canteen_member_seniority',
  'canteen_menu_bangla_names',
  'canteen_due_shops_v1'
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

// Dirty change tracking for 10-second automatic backup to Supabase
const dirtyCanteenKeys = new Set<string>();
const dirtyCanteenValues = new Map<string, any>();
let canteenBackupTimeout: any = null;
let isCanteenBackingUp = false;
let isInitialCanteenPullDone = false;
let isCanteenPulling = false;
let isApplyingCloudPull = false;

export const getIsInitialCanteenPullDone = (): boolean => isInitialCanteenPullDone;

/**
 * Mark a canteen key as dirty.
 * If data is provided, it is immediately saved to localStorage so local cloud is instant!
 * Schedules a backup to Supabase after 10 seconds of actual changes.
 * If data is identical to the cloud state, NO backup is triggered!
 */
export function markCanteenDirty(key: string, data?: any) {
  // If data is being loaded from Cloud download, do not treat as local dirty edit
  if (isApplyingCloudPull) {
    return;
  }

  // Only track actual persistent cloud keys! Never mark internal UI/cache keys dirty!
  if (!CANTEEN_CLOUD_KEYS.includes(key as any) && key !== 'baf_canteen_settings_v1') {
    return;
  }

  // Get current string representation
  let currentValStr: string | null = null;
  if (data !== undefined) {
    currentValStr = typeof data === 'string' ? data : JSON.stringify(data);
  } else if (typeof window !== 'undefined') {
    currentValStr = localStorage.getItem(key);
  }

  // Compare with last synced cloud value: IF IDENTICAL, DO NOT MARK DIRTY!
  const lastSynced = lastSyncedCloudHashes.get(key);
  if (currentValStr !== null && lastSynced !== undefined && lastSynced === currentValStr) {
    dirtyCanteenKeys.delete(key);
    dirtyCanteenValues.delete(key);
    if (dirtyCanteenKeys.size === 0 && typeof window !== 'undefined') {
      localStorage.removeItem('canteen_pending_sync');
      if (canteenBackupTimeout) {
        clearTimeout(canteenBackupTimeout);
        canteenBackupTimeout = null;
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

  if (typeof window !== 'undefined') {
    localStorage.setItem('canteen_pending_sync', 'true');
  }

  // Schedule / debounce backup after 10 seconds
  if (canteenBackupTimeout) {
    clearTimeout(canteenBackupTimeout);
  }
  canteenBackupTimeout = setTimeout(() => {
    if (isInitialCanteenPullDone && dirtyCanteenKeys.size > 0) {
      performCanteenBackup(false);
    }
  }, 10000);
}

/**
 * Back up pending/dirty Canteen changes to Supabase.
 * ONLY runs if there are actual changes (dirtyCanteenKeys > 0 or forced).
 * If no changes occurred, does nothing!
 */
export async function performCanteenBackup(forceAll = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Never upload before initial cloud download completes (unless forced by manual button)
  if (!forceAll && !isInitialCanteenPullDone) {
    console.warn('[CanteenCloudSync] Cloud upload blocked: waiting for initial cloud download to finish first.');
    return false;
  }

  if (isCanteenBackingUp) {
    return false;
  }

  // Double check: remove any keys that haven't actually changed from lastSyncedCloudHashes
  if (!forceAll) {
    for (const key of Array.from(dirtyCanteenKeys)) {
      const currentRaw = dirtyCanteenValues.has(key)
        ? (typeof dirtyCanteenValues.get(key) === 'string' ? dirtyCanteenValues.get(key) : JSON.stringify(dirtyCanteenValues.get(key)))
        : localStorage.getItem(key);
      const lastSynced = lastSyncedCloudHashes.get(key);
      if (currentRaw !== null && lastSynced !== undefined && lastSynced === currentRaw) {
        dirtyCanteenKeys.delete(key);
        dirtyCanteenValues.delete(key);
      }
    }
  }

  // If nothing changed and not forced, DO NOT make any unnecessary backup!
  if (!forceAll && dirtyCanteenKeys.size === 0) {
    if (typeof window !== 'undefined') localStorage.removeItem('canteen_pending_sync');
    if (canteenBackupTimeout) {
      clearTimeout(canteenBackupTimeout);
      canteenBackupTimeout = null;
    }
    return true;
  }

  isCanteenBackingUp = true;
  if (canteenBackupTimeout) {
    clearTimeout(canteenBackupTimeout);
    canteenBackupTimeout = null;
  }

  notifyStatus({ status: 'syncing' });

  try {
    const keysToBackup = forceAll 
      ? Array.from(new Set([...CANTEEN_CLOUD_KEYS, ...Array.from(dirtyCanteenKeys)])) 
      : Array.from(dirtyCanteenKeys);

    if (keysToBackup.length === 0) {
      isCanteenBackingUp = false;
      return true;
    }

    const promises: Promise<any>[] = [];
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
    const hasFailures = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false));

    if (!hasFailures) {
      // Clear backed up dirty keys and record their synced values
      backedUpKeys.forEach(k => {
        dirtyCanteenKeys.delete(k);
        const valPushed = dirtyCanteenValues.get(k);
        dirtyCanteenValues.delete(k);
        const raw = valPushed !== undefined
          ? (typeof valPushed === 'string' ? valPushed : JSON.stringify(valPushed))
          : localStorage.getItem(k);
        if (raw) lastSyncedCloudHashes.set(k, raw);
      });

      if (dirtyCanteenKeys.size === 0) {
        localStorage.removeItem('canteen_pending_sync');
      }

      const readableKeys = backedUpKeys
        .map(k => k.replace(/^canteen_/, '').replace(/_/g, ' '))
        .slice(0, 4)
        .join(', ');
      const moreCount = backedUpKeys.length > 4 ? ` +${backedUpKeys.length - 4} more` : '';
      const summaryMsg = `Uploaded changes (${readableKeys}${moreCount}) to Cloud database.`;

      addCanteenSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PUSH',
        status: 'SUCCESS',
        message: summaryMsg
      });

      notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
      isCanteenBackingUp = false;
      return true;
    } else {
      addCanteenSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PUSH',
        status: 'ERROR',
        message: 'Cloud backup partially failed. Will retry automatically.'
      });

      notifyStatus({ status: 'error', errorMessage: 'Sync failed' });
      isCanteenBackingUp = false;
      return false;
    }
  } catch (err: any) {
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PUSH',
      status: 'ERROR',
      message: 'Cloud backup error: ' + (err?.message || 'Network error')
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
    set.add(String(txId));
    const arr = Array.from(set);
    localStorage.setItem('canteen_deleted_tx_ids', JSON.stringify(arr));
    // Persist tombstones to cloud immediately so deleted items NEVER return on any device/refresh
    pushKeyToCloud('canteen_deleted_tx_ids', arr).catch(() => {});
  } catch {}
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
    const allRemainingTxs = remainingTxs || (() => {
      try {
        return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      } catch {
        return [];
      }
    })();

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
 * Merge two arrays of objects by unique identifier (id or orderId or key)
 * Also safely supports arrays of string IDs (such as canteen_daily_menu).
 */
function mergeArrayData(localArr: any[], cloudArr: any[], keyField = 'id', keyName = ''): any[] {
  if (!Array.isArray(localArr)) localArr = [];
  if (!Array.isArray(cloudArr)) cloudArr = [];

  const isLocalStrings = localArr.length > 0 && typeof localArr[0] === 'string';
  const isCloudStrings = cloudArr.length > 0 && typeof cloudArr[0] === 'string';

  if (isLocalStrings || isCloudStrings) {
    // Preserve string IDs (e.g. canteen_daily_menu selected item IDs)
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
      deduped.push(t);
    }
    return deduped;
  }

  return mergedList;
}

/**
 * Push a specific key directly to Supabase app_settings Cloud table
 */
export async function pushKeyToCloud(key: string, data: any): Promise<boolean> {
  try {
    const strVal = typeof data === 'string' ? data : JSON.stringify(data);
    const payload = {
      setting_key: key,
      setting_value: strVal,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'setting_key' });

    if (error) {
      console.warn(`[CanteenCloudSync] Push error for ${key}:`, error);
      return false;
    }
    lastSyncedCloudHashes.set(key, strVal);
    return true;
  } catch (err) {
    console.warn(`[CanteenCloudSync] Network error pushing ${key}:`, err);
    return false;
  }
}

/**
 * Pull a specific key from Supabase app_settings
 */
export async function pullKeyFromCloud(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();

    if (error || !data?.setting_value) return null;
    try {
      return JSON.parse(data.setting_value);
    } catch {
      return data.setting_value;
    }
  } catch (err) {
    console.warn(`[CanteenCloudSync] Error pulling ${key}:`, err);
    return null;
  }
}

export function queuePushKeyToCloud(key: string, data?: any, delay = 10000) {
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
    switch (key) {
      case 'canteen_txs':
        window.dispatchEvent(new Event('canteen_txs_updated'));
        break;
      case 'canteen_pre_orders':
        window.dispatchEvent(new Event('canteen_pre_orders_updated'));
        break;
      case 'canteen_expenses':
        window.dispatchEvent(new Event('canteen_expenses_updated'));
        break;
      case 'canteen_bazar_advances':
        window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
        break;
      case 'canteen_member_bangla_names':
        window.dispatchEvent(new Event('canteen_member_bangla_names_updated'));
        break;
      case 'canteen_fund_transfers':
        window.dispatchEvent(new Event('canteen_transfers_updated'));
        break;
      case 'canteen_menu_recipes_v2':
        window.dispatchEvent(new Event('canteen_menu_recipes_updated'));
        break;
      case 'canteen_raw_stock_logs_v2':
        window.dispatchEvent(new Event('canteen_raw_stock_logs_updated'));
        break;
      case 'canteen_raw_inventory_items_v2':
        window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
        break;
      case 'canteen_daily_menu':
      case 'canteen_daily_menu_updated_at':
        window.dispatchEvent(new Event('canteen_daily_menu_updated'));
        break;
      case 'canteen_bill_import_history':
        window.dispatchEvent(new Event('canteen_bill_import_history_updated'));
        break;
    }
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
  }, 0);
}

/**
 * Pull all Canteen keys from Supabase Cloud and merge with local storage
 */
export async function pullAllCanteenDataFromCloud(): Promise<void> {
  notifyStatus({ status: 'syncing' });
  isCanteenPulling = true;
  isApplyingCloudPull = true;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value, updated_at')
      .like('setting_key', 'canteen_%');

    if (error) {
      console.warn('[CanteenCloudSync] Cloud pull error:', error);
      notifyStatus({ status: 'error', errorMessage: error.message });
      return;
    }

    if (!data || data.length === 0) {
      // If cloud is empty for some keys, push initial local data to cloud
      await pushAllLocalDataToCloud();
      notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
      return;
    }

    const cloudKeyMap = new Map<string, any>();
    for (const row of data) {
      if (!row.setting_key) continue;
      try {
        cloudKeyMap.set(row.setting_key, JSON.parse(row.setting_value));
      } catch {
        cloudKeyMap.set(row.setting_key, row.setting_value);
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

    // Iterate over all canteen cloud keys
    for (const key of CANTEEN_CLOUD_KEYS) {
      const cloudVal = cloudKeyMap.get(key);
      const localRaw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      let localVal: any = null;
      if (localRaw) {
        try { localVal = JSON.parse(localRaw); } catch { localVal = localRaw; }
      }

      if (cloudVal !== undefined) {
        let finalVal = cloudVal;

        // If both exist and are arrays (e.g. transactions, orders, expenses, stock logs) -> smart merge
        if (Array.isArray(cloudVal) && Array.isArray(localVal)) {
          if (key === 'canteen_raw_inventory_items_v2') {
            const { deduplicated } = deduplicateRawItems([...localVal, ...cloudVal]);
            finalVal = deduplicated;
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
          }
        } else if (key === 'canteen_daily_menu' && Array.isArray(localVal) && localVal.length > 0 && (!Array.isArray(cloudVal) || cloudVal.length === 0)) {
          const localUpdated = typeof window !== 'undefined' ? localStorage.getItem('canteen_daily_menu_updated_at') : null;
          if (isTimestampPastResetThreshold(localUpdated)) {
            finalVal = [];
          } else {
            finalVal = localVal;
          }
        } else if (typeof cloudVal === 'object' && cloudVal !== null && typeof localVal === 'object' && localVal !== null) {
          finalVal = { ...cloudVal, ...localVal };
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

    // Clean any dirty states since we just pulled the latest cloud dataset
    dirtyCanteenKeys.clear();
    dirtyCanteenValues.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('canteen_pending_sync');
    }
    if (canteenBackupTimeout) {
      clearTimeout(canteenBackupTimeout);
      canteenBackupTimeout = null;
    }

    notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PULL',
      status: 'SUCCESS',
      message: `Downloaded latest canteen dataset (${cloudKeyMap.size} records) from Supabase.`
    });
  } catch (err: any) {
    console.warn('[CanteenCloudSync] Pull exception:', err);
    notifyStatus({ status: 'error', errorMessage: err?.message || 'Network error' });
    addCanteenSyncLog({
      timestamp: new Date().toISOString(),
      type: 'PULL',
      status: 'ERROR',
      message: 'Failed to download updates from Supabase: ' + (err?.message || 'Network error')
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

    // Smart Delta-Sync: Fetch cloud members and ONLY apply the changed records
    const { data: cloudData, error } = await supabase
      .from('Canteen_Member')
      .select('airman_id, "BD No", DP, Due, Rank, Surname, Contact, Role');

    if (error || !cloudData) return;

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
 * Initialize automated Canteen Cloud Synchronization:
 * 1. Pulls initial cloud data and merges with local storage.
 * 2. Sets up Realtime listener on Supabase 'app_settings' and 'Canteen_Member'.
 * 3. Listens to local canteen update events to push changes to cloud automatically.
 */
export function initCanteenCloudSync(): () => void {
  if (isInitialized || typeof window === 'undefined') {
    return () => {};
  }
  isInitialized = true;

  // 1. Initial Pull from Cloud: Settings + Members + Menu Catalog + Preload Media
  pullAllCanteenDataFromCloud();
  syncCanteenMembersFromCloud();
  fetchCanteenMenuOnce();
  preloadAllCanteenMedia();

  // Active check & enforce Pre-Order schedule cutoff reset in real-time
  checkAndEnforceDailyMenuReset();
  const autoResetTimer = setInterval(() => {
    checkAndEnforceDailyMenuReset();
  }, 5000);

  // 2. Setup Realtime subscription on app_settings
  const channel = supabase
    .channel('canteen_all_cloud_sync_channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_settings'
      },
      (payload: any) => {
        const newRecord = payload.new;
        if (!newRecord || !newRecord.setting_key) return;

        const key = newRecord.setting_key;
        if (typeof key === 'string' && key.startsWith('canteen_')) {
          try {
            const parsed = JSON.parse(newRecord.setting_value);
            const currentLocalRaw = localStorage.getItem(key);
            let currentLocal: any = null;
            if (currentLocalRaw) {
              try { currentLocal = JSON.parse(currentLocalRaw); } catch {}
            }

            let mergedVal = parsed;
            if (Array.isArray(parsed) && Array.isArray(currentLocal)) {
              if (key === 'canteen_raw_inventory_items_v2') {
                const { deduplicated } = deduplicateRawItems([...parsed, ...currentLocal]);
                mergedVal = deduplicated;
              } else if (key === 'canteen_daily_menu') {
                const localUpdated = typeof window !== 'undefined' ? localStorage.getItem('canteen_daily_menu_updated_at') : null;
                const localTime = new Date(localUpdated || 0).getTime();
                if (isTimestampPastResetThreshold(localUpdated)) {
                  mergedVal = [];
                } else if (Array.isArray(parsed) && parsed.length === 0) {
                  mergedVal = [];
                } else {
                  if (Date.now() - localTime < 15000 && Array.isArray(currentLocal) && currentLocal.length > 0) {
                    return;
                  }
                  mergedVal = Array.isArray(parsed) ? parsed : [];
                }
              } else if (key === 'canteen_pre_orders') {
                const validIncoming = Array.isArray(parsed)
                  ? parsed.filter((o: any) => o?.timestamp && !isTimestampPastResetThreshold(o.timestamp))
                  : [];
                const validLocal = Array.isArray(currentLocal)
                  ? currentLocal.filter((o: any) => o?.timestamp && !isTimestampPastResetThreshold(o.timestamp))
                  : [];
                mergedVal = mergeArrayData(validLocal, validIncoming, 'orderId', key);
              } else {
                const keyField = key === 'canteen_expense_last_unit_prices' ? 'key' : 'id';
                mergedVal = mergeArrayData(currentLocal, parsed, keyField, key);
                if (key === 'canteen_txs') {
                  const deletedIds = getDeletedTxIds();
                  mergedVal = mergedVal.filter((t: any) => !deletedIds.has(String(t?.id)));
                }
                if (key === 'canteen_expenses') {
                  const deletedExpIds = getDeletedExpenseIds();
                  mergedVal = mergedVal.filter((e: any) => !deletedExpIds.has(String(e?.id)));
                }
              }
            }

            if (key === 'canteen_daily_menu_updated_at') {
              const localUpdated = typeof window !== 'undefined' ? localStorage.getItem('canteen_daily_menu_updated_at') : null;
              const localTime = new Date(localUpdated || 0).getTime();
              const incomingTime = new Date(mergedVal || 0).getTime();
              if (localTime > incomingTime) {
                // Incoming realtime event is older than local, ignore
                return;
              }
              const cleanStr = typeof mergedVal === 'string' ? mergedVal.replace(/^"|"$/g, '') : String(mergedVal);
              localStorage.setItem(key, cleanStr);
            } else {
              localStorage.setItem(key, JSON.stringify(mergedVal));
            }
            dispatchKeyUpdateEvent(key);
            notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
          } catch (e) {
            console.warn(`[CanteenCloudSync] Realtime parse error for ${key}:`, e);
          }
        }
      }
    )
    .subscribe();

  // 3. Setup Realtime subscription on Canteen_Member (Instant Delta Update for DPs & Member Info)
  const memberChannel = supabase
    .channel('canteen_members_realtime_sync_channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Canteen_Member'
      },
      (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const oldRecord = payload.old;
          const airmanId = oldRecord?.airman_id;
          if (airmanId) {
            try {
              const cached = localStorage.getItem('canteen_members_cache');
              if (cached) {
                const list = JSON.parse(cached);
                const filtered = list.filter((m: any) => m.airman_id !== airmanId);
                localStorage.setItem('canteen_members_cache', JSON.stringify(filtered));
                window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: filtered }));
              }
            } catch {}
          }
          return;
        }

        const newRow = payload.new;
        if (!newRow) return;

        const cleanBd = String(newRow['BD No'] || newRow.airman_id || '').replace(/\D/g, '').toLowerCase();

        // Update single member in local storage instantly
        if (cleanBd) {
          localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
            dp: newRow.DP || '',
            due: Number(newRow.Due) || 0,
            rank: newRow.Rank || '',
            surname: newRow.Surname || '',
            contact: newRow.Contact || '',
            bdNo: cleanBd
          }));
        }

        if (newRow.DP) preloadImage(newRow.DP);

        try {
          const cached = localStorage.getItem('canteen_members_cache');
          let list: any[] = cached ? JSON.parse(cached) : [];
          const idx = list.findIndex((m: any) => m.airman_id === newRow.airman_id || (cleanBd && String(m['BD No'] || '').replace(/\D/g, '') === cleanBd));
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...newRow };
          } else {
            list.push(newRow);
          }
          localStorage.setItem('canteen_members_cache', JSON.stringify(list));
          window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: list }));
          window.dispatchEvent(new Event('canteen_state_updated'));
        } catch {}
      }
    )
    .subscribe();

  // 4. Listen to local DOM events to mark dirty and auto-backup to cloud after 10s
  const handleLocalTxs = () => queuePushKeyToCloud('canteen_txs');
  const handleLocalOrders = () => queuePushKeyToCloud('canteen_pre_orders');
  const handleLocalExpenses = () => queuePushKeyToCloud('canteen_expenses');
  const handleLocalAdvances = () => queuePushKeyToCloud('canteen_bazar_advances');
  const handleLocalBanglaNames = () => queuePushKeyToCloud('canteen_member_bangla_names');
  const handleLocalTransfers = () => queuePushKeyToCloud('canteen_fund_transfers');
  const handleLocalRecipes = () => queuePushKeyToCloud('canteen_menu_recipes_v2');
  const handleLocalStockLogs = () => queuePushKeyToCloud('canteen_raw_stock_logs_v2');
  const handleLocalRawInventory = () => queuePushKeyToCloud('canteen_raw_inventory_items_v2');
  const handleLocalBillHistory = () => queuePushKeyToCloud('canteen_bill_import_history');
  const handleLocalSettings = (e: any) => {
    if (e?.detail) {
      queuePushKeyToCloud('baf_canteen_settings_v1', e.detail);
    }
  };
  const handleLocalDailyMenu = () => {
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
  window.addEventListener('canteen_raw_stock_logs_updated', handleLocalStockLogs);
  window.addEventListener('canteen_raw_inventory_updated', handleLocalRawInventory);
  window.addEventListener('canteen_daily_menu_updated', handleLocalDailyMenu);
  window.addEventListener('canteen_bill_import_history_updated', handleLocalBillHistory);
  window.addEventListener('canteen_settings_updated', handleLocalSettings);

  // 10-Second interval:
  // Backs up ONLY if something changed! If dirtyCanteenKeys is empty, does nothing!
  const tenSecBackupTicker = setInterval(() => {
    if (dirtyCanteenKeys.size > 0 && !isCanteenBackingUp && isInitialCanteenPullDone) {
      performCanteenBackup(false);
    }
  }, 10000);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && dirtyCanteenKeys.size > 0) {
      performCanteenBackup(false);
    }
  };
  const handleBeforeUnload = () => {
    if (dirtyCanteenKeys.size > 0) {
      performCanteenBackup(false);
    }
  };
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    supabase.removeChannel(channel);
    supabase.removeChannel(memberChannel);
    window.removeEventListener('canteen_txs_updated', handleLocalTxs);
    window.removeEventListener('canteen_pre_orders_updated', handleLocalOrders);
    window.removeEventListener('canteen_expenses_updated', handleLocalExpenses);
    window.removeEventListener('canteen_bazar_advances_updated', handleLocalAdvances);
    window.removeEventListener('canteen_member_bangla_names_updated', handleLocalBanglaNames);
    window.removeEventListener('canteen_transfers_updated', handleLocalTransfers);
    window.removeEventListener('canteen_menu_recipes_updated', handleLocalRecipes);
    window.removeEventListener('canteen_raw_stock_logs_updated', handleLocalStockLogs);
    window.removeEventListener('canteen_raw_inventory_updated', handleLocalRawInventory);
    window.removeEventListener('canteen_bill_import_history_updated', handleLocalBillHistory);
    window.removeEventListener('canteen_settings_updated', handleLocalSettings);
    clearInterval(autoResetTimer);
    clearInterval(tenSecBackupTicker);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('canteen_daily_menu_updated', handleLocalDailyMenu);
    isInitialized = false;
  };
}
