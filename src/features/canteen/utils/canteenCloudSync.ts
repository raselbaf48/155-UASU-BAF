import { supabase } from '../../../supabase';
import { deduplicateRawItems } from './recipeManager';

/**
 * Canteen Cloud Sync Engine
 * Persists and synchronizes all Canteen data to Supabase Cloud ('app_settings' table)
 * ensuring full persistence across devices, browsers, and sessions.
 */

export const CANTEEN_CLOUD_KEYS = [
  'canteen_txs',
  'canteen_pre_orders',
  'canteen_expenses',
  'canteen_fund_transfers',
  'canteen_daily_menu',
  'canteen_menu_recipes_v2',
  'canteen_raw_stock_logs_v2',
  'canteen_expense_last_unit_prices',
  'canteen_recent_members',
  'canteen_raw_inventory_items_v2'
] as const;

export type CanteenCloudKey = typeof CANTEEN_CLOUD_KEYS[number];

export interface CloudSyncStatus {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncTime: string | null;
  errorMessage?: string;
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

/**
 * Merge two arrays of objects by unique identifier (id or orderId or key)
 */
function mergeArrayData(localArr: any[], cloudArr: any[], keyField = 'id'): any[] {
  if (!Array.isArray(localArr)) localArr = [];
  if (!Array.isArray(cloudArr)) cloudArr = [];

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

  return Array.from(map.values());
}

/**
 * Push a specific key directly to Supabase app_settings Cloud table
 */
export async function pushKeyToCloud(key: string, data: any): Promise<boolean> {
  try {
    const payload = {
      setting_key: key,
      setting_value: typeof data === 'string' ? data : JSON.stringify(data),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'setting_key' });

    if (error) {
      console.warn(`[CanteenCloudSync] Push error for ${key}:`, error);
      return false;
    }
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

// Debounce map for pushing to avoid flooding Supabase
const pushTimeouts = new Map<string, NodeJS.Timeout>();

export function queuePushKeyToCloud(key: string, data?: any, delay = 600) {
  if (pushTimeouts.has(key)) {
    clearTimeout(pushTimeouts.get(key)!);
  }

  const timer = setTimeout(async () => {
    pushTimeouts.delete(key);
    let valueToPush = data;
    if (valueToPush === undefined && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          valueToPush = JSON.parse(raw);
        }
      } catch {}
    }

    if (valueToPush !== undefined) {
      notifyStatus({ status: 'syncing' });
      const ok = await pushKeyToCloud(key, valueToPush);
      if (ok) {
        notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
      } else {
        notifyStatus({ status: 'error' });
      }
    }
  }, delay);

  pushTimeouts.set(key, timer);
}

/**
 * Dispatch corresponding DOM event so UI components refresh when a key updates
 */
function dispatchKeyUpdateEvent(key: string) {
  if (typeof window === 'undefined') return;

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
      window.dispatchEvent(new Event('canteen_daily_menu_updated'));
      break;
  }
  window.dispatchEvent(new Event('canteen_state_updated'));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Pull all Canteen keys from Supabase Cloud and merge with local storage
 */
export async function pullAllCanteenDataFromCloud(): Promise<void> {
  notifyStatus({ status: 'syncing' });

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
          } else {
            const keyField = key === 'canteen_pre_orders' ? 'orderId' : (key === 'canteen_expense_last_unit_prices' ? 'key' : 'id');
            finalVal = mergeArrayData(localVal, cloudVal, keyField);
          }
        } else if (typeof cloudVal === 'object' && cloudVal !== null && typeof localVal === 'object' && localVal !== null) {
          finalVal = { ...cloudVal, ...localVal };
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(finalVal));
          dispatchKeyUpdateEvent(key);
        }
      } else if (localVal !== null && localVal !== undefined) {
        // Cloud doesn't have this key yet, push local up
        queuePushKeyToCloud(key, localVal, 100);
      }
    }

    notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
  } catch (err: any) {
    console.warn('[CanteenCloudSync] Pull exception:', err);
    notifyStatus({ status: 'error', errorMessage: err?.message || 'Network error' });
  }
}

/**
 * Push all local Canteen data to Cloud (useful for initial seeding or manual backup)
 */
export async function pushAllLocalDataToCloud(): Promise<void> {
  if (typeof window === 'undefined') return;
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

  await Promise.allSettled(promises);
  notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
}

let isInitialized = false;

/**
 * Initialize automated Canteen Cloud Synchronization:
 * 1. Pulls initial cloud data and merges with local storage.
 * 2. Sets up Realtime listener on Supabase 'app_settings'.
 * 3. Listens to local canteen update events to push changes to cloud automatically.
 */
export function initCanteenCloudSync(): () => void {
  if (isInitialized || typeof window === 'undefined') {
    return () => {};
  }
  isInitialized = true;

  // 1. Initial Pull from Cloud
  pullAllCanteenDataFromCloud();

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
              } else {
                const keyField = key === 'canteen_pre_orders' ? 'orderId' : 'id';
                mergedVal = mergeArrayData(currentLocal, parsed, keyField);
              }
            }

            localStorage.setItem(key, JSON.stringify(mergedVal));
            dispatchKeyUpdateEvent(key);
            notifyStatus({ status: 'synced', lastSyncTime: new Date().toLocaleTimeString() });
          } catch (e) {
            console.warn(`[CanteenCloudSync] Realtime parse error for ${key}:`, e);
          }
        }
      }
    )
    .subscribe();

  // 3. Listen to local DOM events to auto-queue pushes to cloud
  const handleLocalTxs = () => queuePushKeyToCloud('canteen_txs');
  const handleLocalOrders = () => queuePushKeyToCloud('canteen_pre_orders');
  const handleLocalExpenses = () => queuePushKeyToCloud('canteen_expenses');
  const handleLocalTransfers = () => queuePushKeyToCloud('canteen_fund_transfers');
  const handleLocalRecipes = () => queuePushKeyToCloud('canteen_menu_recipes_v2');
  const handleLocalStockLogs = () => queuePushKeyToCloud('canteen_raw_stock_logs_v2');
  const handleLocalRawInventory = () => queuePushKeyToCloud('canteen_raw_inventory_items_v2');
  const handleLocalDailyMenu = () => queuePushKeyToCloud('canteen_daily_menu');

  window.addEventListener('canteen_txs_updated', handleLocalTxs);
  window.addEventListener('canteen_pre_orders_updated', handleLocalOrders);
  window.addEventListener('canteen_expenses_updated', handleLocalExpenses);
  window.addEventListener('canteen_transfers_updated', handleLocalTransfers);
  window.addEventListener('canteen_menu_recipes_updated', handleLocalRecipes);
  window.addEventListener('canteen_raw_stock_logs_updated', handleLocalStockLogs);
  window.addEventListener('canteen_raw_inventory_updated', handleLocalRawInventory);
  window.addEventListener('canteen_daily_menu_updated', handleLocalDailyMenu);

  const handleStateUpdated = () => {
    queuePushKeyToCloud('canteen_txs');
    queuePushKeyToCloud('canteen_pre_orders');
    queuePushKeyToCloud('canteen_expenses');
    queuePushKeyToCloud('canteen_fund_transfers');
    queuePushKeyToCloud('canteen_daily_menu');
    queuePushKeyToCloud('canteen_raw_inventory_items_v2');
    queuePushKeyToCloud('canteen_raw_stock_logs_v2');
    queuePushKeyToCloud('canteen_menu_recipes_v2');
  };
  window.addEventListener('canteen_state_updated', handleStateUpdated);

  return () => {
    supabase.removeChannel(channel);
    window.removeEventListener('canteen_txs_updated', handleLocalTxs);
    window.removeEventListener('canteen_pre_orders_updated', handleLocalOrders);
    window.removeEventListener('canteen_expenses_updated', handleLocalExpenses);
    window.removeEventListener('canteen_transfers_updated', handleLocalTransfers);
    window.removeEventListener('canteen_menu_recipes_updated', handleLocalRecipes);
    window.removeEventListener('canteen_raw_stock_logs_updated', handleLocalStockLogs);
    window.removeEventListener('canteen_raw_inventory_updated', handleLocalRawInventory);
    window.removeEventListener('canteen_daily_menu_updated', handleLocalDailyMenu);
    window.removeEventListener('canteen_state_updated', handleStateUpdated);
    isInitialized = false;
  };
}
