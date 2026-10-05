import { supabase } from '../../../supabase';
import { deduplicateRawItems } from './recipeManager';
import { resolveImageUrl, getCanteenConfig } from './canteenSettings';

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
  'canteen_bazar_advances',
  'canteen_member_bangla_names',
  'canteen_fund_transfers',
  'canteen_daily_menu',
  'canteen_menu_recipes_v2',
  'canteen_raw_stock_logs_v2',
  'canteen_expense_last_unit_prices',
  'canteen_recent_members',
  'canteen_raw_inventory_items_v2',
  'canteen_bill_import_history'
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
    const seenInitial = new Set<string>();
    const deduped: any[] = [];
    for (const t of mergedList) {
      if (!t) continue;
      const isInitial = t.type === 'INITIAL_BILL' || 
        String(t.items || '').includes('ক্যান্টিন বিল') || 
        String(t.items || '').includes('বকেয়া বিল');
      if (isInitial) {
        const cleanBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
        const month = t.monthKey || (t.date ? String(t.date).trim() : '');
        const bType = t.billType || 'CANTEEN';
        const k = `${cleanBd}_${month}_${bType}`;
        if (cleanBd && month && seenInitial.has(k)) {
          continue; // Drop duplicate
        }
        if (cleanBd && month) {
          seenInitial.add(k);
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
      window.dispatchEvent(new Event('canteen_daily_menu_updated'));
      break;
    case 'canteen_bill_import_history':
      window.dispatchEvent(new Event('canteen_bill_import_history_updated'));
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

    // Merge deleted transaction IDs first so any incoming txs are filtered accurately
    const cloudDeleted = cloudKeyMap.get('canteen_deleted_tx_ids');
    if (Array.isArray(cloudDeleted) && cloudDeleted.length > 0) {
      const localDeleted = getDeletedTxIds();
      cloudDeleted.forEach(id => localDeleted.add(String(id)));
      if (typeof window !== 'undefined') {
        localStorage.setItem('canteen_deleted_tx_ids', JSON.stringify(Array.from(localDeleted)));
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
            if (localVal.length > 0 && cloudVal.length === 0) {
              finalVal = localVal;
              queuePushKeyToCloud('canteen_daily_menu', localVal, 100);
            } else if (cloudVal.length > 0 && localVal.length === 0) {
              finalVal = cloudVal;
            } else {
              finalVal = mergeArrayData(localVal, cloudVal, 'id');
            }
          } else {
            const keyField = key === 'canteen_pre_orders' ? 'orderId' : (key === 'canteen_expense_last_unit_prices' ? 'key' : 'id');
            finalVal = mergeArrayData(localVal, cloudVal, keyField, key);
            if (key === 'canteen_txs') {
              const deletedIds = getDeletedTxIds();
              finalVal = finalVal.filter((t: any) => !deletedIds.has(String(t?.id)));
            }
          }
        } else if (key === 'canteen_daily_menu' && Array.isArray(localVal) && localVal.length > 0 && (!Array.isArray(cloudVal) || cloudVal.length === 0)) {
          finalVal = localVal;
          queuePushKeyToCloud('canteen_daily_menu', localVal, 100);
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

  // 2. Member DPs from local member cache
  try {
    const cached = localStorage.getItem('canteen_members_cache');
    if (cached) {
      const members = JSON.parse(cached);
      if (Array.isArray(members)) {
        members.forEach((m: any) => {
          if (m?.DP) preloadImage(m.DP);
        });
      }
    }
  } catch {}

  // 3. Menu items
  try {
    const menuRaw = localStorage.getItem('canteen_daily_menu');
    if (menuRaw) {
      const items = JSON.parse(menuRaw);
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item?.DP || item?.img || item?.image) preloadImage(item.DP || item.img || item.image);
        });
      }
    }
  } catch {}
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
      const { data, error } = await supabase.from('Canteen_Member').select('*');
      if (error || !data) return;

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
        if (m.DP) preloadImage(m.DP);
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

        const isChanged = (
          Math.abs(cloudDue - localDue) > 0.01 ||
          cloudDp !== localDp ||
          cloudRole !== localRole ||
          cloudRank !== localRank ||
          cloudSurname !== localSurname
        );

        if (isChanged) {
          hasDelta = true;
          const updated = { ...localM, ...cloudM };
          mergedList.push(updated);
          if (cleanBd) {
            localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
              dp: updated.DP || '',
              due: Number(updated.Due) || 0,
              rank: updated.Rank || '',
              surname: updated.Surname || '',
              contact: updated.Contact || '',
              bdNo: cleanBd
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
      localStorage.setItem('canteen_members_cache', JSON.stringify(mergedList));
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: mergedList }));
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

  // 1. Initial Pull from Cloud: Settings + Members + Preload all DPs and media
  pullAllCanteenDataFromCloud();
  syncCanteenMembersFromCloud();
  preloadAllCanteenMedia();

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
                if (currentLocal.length > 0 && parsed.length === 0) {
                  mergedVal = currentLocal;
                } else {
                  mergedVal = mergeArrayData(currentLocal, parsed, 'id');
                }
              } else {
                const keyField = key === 'canteen_pre_orders' ? 'orderId' : 'id';
                mergedVal = mergeArrayData(currentLocal, parsed, keyField, key);
                if (key === 'canteen_txs') {
                  const deletedIds = getDeletedTxIds();
                  mergedVal = mergedVal.filter((t: any) => !deletedIds.has(String(t?.id)));
                }
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

  // 4. Listen to local DOM events to auto-queue pushes to cloud
  const handleLocalTxs = () => queuePushKeyToCloud('canteen_txs');
  const handleLocalOrders = () => queuePushKeyToCloud('canteen_pre_orders');
  const handleLocalExpenses = () => queuePushKeyToCloud('canteen_expenses');
  const handleLocalAdvances = () => queuePushKeyToCloud('canteen_bazar_advances');
  const handleLocalBanglaNames = () => queuePushKeyToCloud('canteen_member_bangla_names');
  const handleLocalTransfers = () => queuePushKeyToCloud('canteen_fund_transfers');
  const handleLocalRecipes = () => queuePushKeyToCloud('canteen_menu_recipes_v2');
  const handleLocalStockLogs = () => queuePushKeyToCloud('canteen_raw_stock_logs_v2');
  const handleLocalRawInventory = () => queuePushKeyToCloud('canteen_raw_inventory_items_v2');
  const handleLocalDailyMenu = () => queuePushKeyToCloud('canteen_daily_menu');

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

  const handleStateUpdated = () => {
    queuePushKeyToCloud('canteen_txs');
    queuePushKeyToCloud('canteen_pre_orders');
    queuePushKeyToCloud('canteen_expenses');
    queuePushKeyToCloud('canteen_bazar_advances');
    queuePushKeyToCloud('canteen_member_bangla_names');
    queuePushKeyToCloud('canteen_fund_transfers');
    queuePushKeyToCloud('canteen_daily_menu');
    queuePushKeyToCloud('canteen_raw_inventory_items_v2');
    queuePushKeyToCloud('canteen_raw_stock_logs_v2');
    queuePushKeyToCloud('canteen_menu_recipes_v2');
  };
  window.addEventListener('canteen_state_updated', handleStateUpdated);

  return () => {
    supabase.removeChannel(channel);
    supabase.removeChannel(memberChannel);
    window.removeEventListener('canteen_txs_updated', handleLocalTxs);
    window.removeEventListener('canteen_pre_orders_updated', handleLocalOrders);
    window.removeEventListener('canteen_expenses_updated', handleLocalExpenses);
    window.removeEventListener('canteen_bazar_advances_updated', handleLocalAdvances);
    window.removeEventListener('canteen_transfers_updated', handleLocalTransfers);
    window.removeEventListener('canteen_menu_recipes_updated', handleLocalRecipes);
    window.removeEventListener('canteen_raw_stock_logs_updated', handleLocalStockLogs);
    window.removeEventListener('canteen_raw_inventory_updated', handleLocalRawInventory);
    window.removeEventListener('canteen_daily_menu_updated', handleLocalDailyMenu);
    window.removeEventListener('canteen_state_updated', handleStateUpdated);
    isInitialized = false;
  };
}
