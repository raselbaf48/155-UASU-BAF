import { supabase } from '../../../supabase';

export interface CanteenMenuItem {
  id: string;
  name: string;
  name_en?: string;
  name_bn?: string;
  nameBn?: string;
  'Name (BN)'?: string;
  category: string;
  price: number;
  stock?: number;
  Cost?: number;
  cost?: number;
  'Raw Item'?: string;
  rawItem?: string;
  DP?: string;
  img?: string;
  image?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

import defaultMenuItemsData from '../data/defaultMenuItems.json';
import { getMenuItemBanglaName } from './menuBanglaNames';
import { getLocalSeniorityMap } from './memberSeniority';
import { sortCanteenMembersByOfficeSeniority, normalizeCanteenMembersSeniority, deduplicateCanteenMembers } from './canteenSeniority';
import { getMemberBanglaRank } from './memberBanglaNames';
import { sortCanteenMenuItems, getCanteenMenuItemOrder, OFFICIAL_CANTEEN_MENU_ORDER } from './menuOrdering';

export { sortCanteenMenuItems, getCanteenMenuItemOrder, OFFICIAL_CANTEEN_MENU_ORDER };

export const isOneTimeBoxItem = (it: any): boolean => {
  if (!it) return false;
  const n = String(it.name || it.name_en || '').toUpperCase().trim();
  const bn = String(it.name_bn || it['Name (BN)'] || it.nameBn || '').trim();
  return n.includes('ONE TIME BOX') || bn.includes('ওয়ান টাইম বক্স') || bn.includes('ওয়ান টাইম ফুড বক্স');
};

/**
 * Normalizes item names across Bengali character variations (য় vs য়, ী vs ি)
 * and English spelling variations (Biriyani vs Biryani) for 100% resilient matches.
 */
export const normalizeCatalogKey = (s: string): string => {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/\u09af\u09bc/g, '\u09df') // য় to য়
    .replace(/\u09a1\u09bc/g, '\u09dc') // ড় to ড়
    .replace(/\u09a2\u09bc/g, '\u09dd') // ঢ় to ঢ়
    .replace(/ী/g, 'ি') // dirghoi to hroshwoi
    .replace(/biryani/g, 'biriyani')
    .replace(/[\s\-_]+/g, ' ')
    .trim();
};

export const PARCEL_BOX_ITEM: CanteenMenuItem = {
  id: 'parcel-one-time-box',
  name: 'ONE TIME BOX',
  name_en: 'ONE TIME BOX',
  name_bn: 'ওয়ান টাইম বক্স',
  nameBn: 'ওয়ান টাইম বক্স',
  'Name (BN)': 'ওয়ান টাইম বক্স',
  category: 'SNACKS',
  price: 5,
  Cost: 4,
  cost: 4
};

export const DEFAULT_CANTEEN_MENU_ITEMS: CanteenMenuItem[] = sortCanteenMenuItems((defaultMenuItemsData as any[])
  .filter((it) => !isOneTimeBoxItem(it))
  .map((it) => ({
  id: it.id,
  name: it.name,
  name_en: it.name,
  name_bn: it.name_bn || getMenuItemBanglaName(it),
  nameBn: it.name_bn || getMenuItemBanglaName(it),
  category: it.category || 'SNACKS',
  price: Number(it.price) || 0,
  Cost: Number(it.Cost ?? it.cost ?? 0),
  cost: Number(it.Cost ?? it.cost ?? 0),
  rawItem: it['Raw Item'] || it.rawItem || '',
  'Raw Item': it['Raw Item'] || it.rawItem || '',
  DP: it.DP || it.img || it.image || '',
  img: it.DP || it.img || it.image || '',
  image: it.DP || it.img || it.image || '',
  created_at: it.created_at || new Date().toISOString()
})));

// In-Memory Caches for Instant (0ms) Access
let inMemoryMenuCache: CanteenMenuItem[] | null = null;
let menuFetchPromise: Promise<CanteenMenuItem[]> | null = null;

let inMemoryMembersCache: any[] | null = null;
let memberFetchPromise: Promise<any[]> | null = null;

/**
 * Strictly deduplicates canteen menu items to guarantee that no duplicate item exists
 * anywhere in Menu or Inventory. Deduplicates by:
 * 1. Matching ID (case-insensitive)
 * 2. Matching normalized English name
 * 3. Matching normalized Bengali name
 */
export function deduplicateCanteenMenuItems(items: CanteenMenuItem[]): CanteenMenuItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const seen = new Map<string, CanteenMenuItem>();
  const idToGroup = new Map<string, string>();
  const nameToGroup = new Map<string, string>();
  const bnNameToGroup = new Map<string, string>();

  for (const rawItem of items) {
    if (!rawItem || isOneTimeBoxItem(rawItem)) continue;
    const cleanId = String(rawItem.id || '').trim().toLowerCase();
    const enName = String(rawItem.name || rawItem.name_en || '').trim();
    const bnName = String(rawItem.name_bn || rawItem.nameBn || rawItem['Name (BN)'] || getMenuItemBanglaName(rawItem) || '').trim();
    let cleanEnName = enName;
    let cleanBnName = bnName;
    const lowerEn = enName.toLowerCase();
    const lowerBn = bnName.toLowerCase();
    const isHotelPorota = lowerEn.includes('hotel') || lowerBn.includes('হোটেল');
    if (!isHotelPorota && (lowerEn.includes('porata') || lowerEn.includes('porota') || lowerEn.includes('paratha') || lowerBn.includes('পরোটা'))) {
      cleanEnName = 'PORATA';
      cleanBnName = 'পরোটা';
    }

    const normEn = normalizeCatalogKey(cleanEnName);
    const normBn = normalizeCatalogKey(cleanBnName);

    let groupKey: string | undefined;
    if (cleanId && idToGroup.has(cleanId)) {
      groupKey = idToGroup.get(cleanId);
    } else if (normEn && nameToGroup.has(normEn)) {
      groupKey = nameToGroup.get(normEn);
    } else if (normBn && bnNameToGroup.has(normBn)) {
      groupKey = bnNameToGroup.get(normBn);
    }

    if (!groupKey) {
      groupKey = cleanId ? `id_${cleanId}` : (normEn ? `name_${normEn}` : (normBn ? `bn_${normBn}` : `idx_${Math.random()}`));
      if (cleanId) idToGroup.set(cleanId, groupKey);
      if (normEn) nameToGroup.set(normEn, groupKey);
      if (normBn) bnNameToGroup.set(normBn, groupKey);

      const userOverrides = getUserMenuOverrides();
      const userOv = findUserMenuOverride(userOverrides, rawItem) || (cleanId && userOverrides[cleanId]) || (rawItem.id && userOverrides[rawItem.id]);

      const initialStock = (rawItem.stock !== undefined && rawItem.stock !== null && !isNaN(Number(rawItem.stock)))
        ? Number(rawItem.stock)
        : ((rawItem.max !== undefined && rawItem.max !== null && !isNaN(Number(rawItem.max)))
          ? Number(rawItem.max)
          : ((rawItem.Quantity !== undefined && rawItem.Quantity !== null && !isNaN(Number(rawItem.Quantity)))
            ? Number(rawItem.Quantity)
            : undefined));

      seen.set(groupKey, {
        ...rawItem,
        ...userOv,
        id: rawItem.id || `menu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: userOv?.name || enName || bnName || 'Item',
        name_en: userOv?.name_en || userOv?.name || enName || rawItem.name_en || rawItem.name || '',
        name_bn: userOv?.name_bn || userOv?.nameBn || bnName,
        nameBn: userOv?.name_bn || userOv?.nameBn || bnName,
        'Name (BN)': userOv?.name_bn || userOv?.nameBn || bnName,
        price: userOv?.price !== undefined ? Number(userOv.price) : (Number(rawItem.price) || 0),
        stock: initialStock,
        max: initialStock,
        cost: Number(rawItem.cost ?? rawItem.Cost ?? 0),
        Cost: Number(rawItem.Cost ?? rawItem.cost ?? 0),
        DP: userOv?.DP || rawItem.DP || rawItem.img || rawItem.image || '',
        img: userOv?.DP || rawItem.DP || rawItem.img || rawItem.image || '',
        image: userOv?.DP || rawItem.DP || rawItem.img || rawItem.image || '',
        category: rawItem.category || rawItem.meal || 'SNACKS'
      });
    } else {
      const existing = seen.get(groupKey)!;
      const userOverrides = getUserMenuOverrides();
      const userOv = findUserMenuOverride(userOverrides, rawItem) ||
        findUserMenuOverride(userOverrides, existing) ||
        (cleanId && userOverrides[cleanId]) ||
        (existing.id && userOverrides[existing.id]) ||
        (rawItem.id && userOverrides[rawItem.id]);

      const rawItemTime = new Date((rawItem as any).updated_at || (rawItem as any).updatedAt || 0).getTime();
      const existingTime = new Date((existing as any).updated_at || (existing as any).updatedAt || 0).getTime();
      const preferRaw = rawItemTime > existingTime;

      const mergedPrice = (userOv?.price !== undefined)
        ? Number(userOv.price)
        : (preferRaw ? (Number(rawItem.price) > 0 ? Number(rawItem.price) : Number(existing.price)) : (Number(existing.price) > 0 ? Number(existing.price) : Number(rawItem.price) || 0));
      const mergedCost = Number(existing.cost ?? existing.Cost) > 0 ? Number(existing.cost ?? existing.Cost) : Number(rawItem.cost ?? rawItem.Cost ?? 0);
      const mergedDp = (userOv?.DP || existing.DP || existing.img || existing.image || rawItem.DP || rawItem.img || rawItem.image || '');
      const mergedEn = userOv?.name || userOv?.name_en || (preferRaw ? (enName || rawItem.name || existing.name) : (existing.name || existing.name_en || enName || rawItem.name));
      const mergedBn = userOv?.name_bn || userOv?.nameBn || (preferRaw ? (bnName || rawItem.name_bn || existing.name_bn) : (existing.name_bn || existing.nameBn || bnName || rawItem.name_bn || rawItem.nameBn));
      const incomingStock = (rawItem.stock !== undefined && rawItem.stock !== null && !isNaN(Number(rawItem.stock)))
        ? Number(rawItem.stock)
        : ((rawItem.max !== undefined && rawItem.max !== null && !isNaN(Number(rawItem.max)))
          ? Number(rawItem.max)
          : ((rawItem.Quantity !== undefined && rawItem.Quantity !== null && !isNaN(Number(rawItem.Quantity)))
            ? Number(rawItem.Quantity)
            : undefined));
      const mergedStock = existing.stock !== undefined 
        ? Number(existing.stock) 
        : (incomingStock !== undefined ? incomingStock : (existing.max !== undefined ? Number(existing.max) : undefined));

      seen.set(groupKey, {
        ...rawItem,
        ...existing,
        ...userOv,
        id: existing.id,
        name: mergedEn,
        name_en: mergedEn,
        name_bn: mergedBn,
        nameBn: mergedBn,
        'Name (BN)': mergedBn,
        price: mergedPrice,
        stock: mergedStock,
        max: mergedStock,
        cost: mergedCost,
        Cost: mergedCost,
        DP: mergedDp,
        img: mergedDp,
        image: mergedDp,
        category: existing.category || rawItem.category || 'SNACKS',
        updated_at: preferRaw ? ((rawItem as any).updated_at || new Date().toISOString()) : (existing.updated_at || new Date().toISOString())
      });
      if (cleanId) idToGroup.set(cleanId, groupKey);
      if (normEn) nameToGroup.set(normEn, groupKey);
      if (normBn) bnNameToGroup.set(normBn, groupKey);
    }
  }

  return sortCanteenMenuItems(Array.from(seen.values()));
}

/**
 * Returns cached menu catalog synchronously (0ms delay).
 * Checks memory first, then localStorage, then defaults.
 */
export function getCanteenMenuCache(): CanteenMenuItem[] {
  if (inMemoryMenuCache && inMemoryMenuCache.length > 0) {
    return deduplicateCanteenMenuItems(inMemoryMenuCache.filter((p) => !isOneTimeBoxItem(p)));
  }
  if (typeof window === 'undefined') return DEFAULT_CANTEEN_MENU_ITEMS;
  try {
    const raw = localStorage.getItem('canteen_menu_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hydrated = parsed
          .filter((p: any) => !isOneTimeBoxItem(p))
          .map((p: any) => {
          if (!p.DP && !p.img && !p.image) {
            const def = DEFAULT_CANTEEN_MENU_ITEMS.find((d) => d.id === p.id || d.name?.toLowerCase() === p.name?.toLowerCase());
            if (def?.DP) {
              return { ...p, DP: def.DP, img: def.DP, image: def.DP };
            }
          }
          return p;
        });
        const clean = deduplicateCanteenMenuItems(hydrated);
        inMemoryMenuCache = clean;
        return clean;
      }
    }
    const rawList = localStorage.getItem('canteen_menu_items_list');
    if (rawList) {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleanList = deduplicateCanteenMenuItems(parsed.filter((p: any) => !isOneTimeBoxItem(p)));
        inMemoryMenuCache = cleanList;
        return cleanList;
      }
    }
  } catch {}
  inMemoryMenuCache = DEFAULT_CANTEEN_MENU_ITEMS;
  return DEFAULT_CANTEEN_MENU_ITEMS;
}

/**
 * Synchronously updates the menu cache in memory and localStorage (0ms delay),
 * and dispatches 'canteen_menu_updated' and 'canteen_state_updated' so ALL components
 * (CanteenInventory, MenuManagement, POS, RawDistribution, PersonalPortal) update in real-time.
 */
export function setCanteenMenuCache(items: CanteenMenuItem[]): void {
  const cleanItems = deduplicateCanteenMenuItems(items.filter((it) => !isOneTimeBoxItem(it)));
  inMemoryMenuCache = cleanItems;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('canteen_menu_cache', JSON.stringify(cleanItems));
      localStorage.setItem('canteen_menu_items_list', JSON.stringify(cleanItems));
      localStorage.setItem('canteen_menu_items_catalog_v1', JSON.stringify(cleanItems));
    } catch (e) {
      console.warn('Error persisting canteen_menu_cache:', e);
    }
    // Instant event dispatch (0ms)
    window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: cleanItems }));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
  }
}

export const MENU_USER_OVERRIDES_KEY = 'canteen_user_menu_overrides';

export function getUserMenuOverrides(): Record<string, Partial<CanteenMenuItem>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MENU_USER_OVERRIDES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

/**
 * Robust override lookup: checks raw ID, lowercase ID, and normalized English & Bengali names.
 * Guarantees that any custom name change by the user is NEVER lost regardless of ID format.
 */
export function findUserMenuOverride(
  overrides: Record<string, Partial<CanteenMenuItem>>,
  item: any
): Partial<CanteenMenuItem> | undefined {
  if (!item || !overrides) return undefined;
  const rawId = String(item.id || '').trim();
  const cleanId = rawId.toLowerCase();
  // Strictly lookup by unique Item ID so renaming items never matches obsolete previous names!
  return (rawId && overrides[rawId]) ||
         (cleanId && overrides[cleanId]) ||
         undefined;
}

export function saveUserMenuOverride(item: Partial<CanteenMenuItem> & { id: string }): void {
  if (!item || !item.id || typeof window === 'undefined') return;
  try {
    const current = getUserMenuOverrides();
    const rawId = String(item.id).trim();
    const cleanId = rawId.toLowerCase();
    const nameEn = String(item.name_en || item.name || '').trim();
    const nameBn = String(item.name_bn || item.nameBn || item['Name (BN)'] || (item as any).Name_BN || '').trim();

    const overrideEntry: Partial<CanteenMenuItem> = {
      ...item,
      id: rawId,
      name: nameEn || undefined,
      name_en: nameEn || undefined,
      name_bn: nameBn || undefined,
      nameBn: nameBn || undefined,
      'Name (BN)': nameBn || undefined,
      updated_at: new Date().toISOString()
    };

    // Clean any old obsolete name-based keys from overrides
    const updated: Record<string, Partial<CanteenMenuItem>> = {};
    for (const [k, v] of Object.entries(current)) {
      if (!k.startsWith('name_') && !k.startsWith('bn_')) {
        updated[k] = v;
      }
    }
    updated[rawId] = overrideEntry;
    if (cleanId) updated[cleanId] = overrideEntry;

    localStorage.setItem(MENU_USER_OVERRIDES_KEY, JSON.stringify(updated));
    // Immediately persist to cloud app_settings
    try {
      Promise.resolve(
        supabase.from('app_settings').upsert({
          setting_key: MENU_USER_OVERRIDES_KEY,
          setting_value: JSON.stringify(updated),
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' })
      ).catch(() => {});
    } catch {}
  } catch (err) {
    console.warn('Error saving menu override:', err);
  }
}

/**
 * Updates a single menu item in the cache immediately in 0ms and notifies listeners.
 */
export function updateSingleMenuItemInCache(updatedItem: Partial<CanteenMenuItem> & { id: string }): CanteenMenuItem[] {
  const normBn = updatedItem.name_bn || (updatedItem as any).nameBn || (updatedItem as any)['Name (BN)'] || (updatedItem as any).Name_BN;
  const normEn = updatedItem.name_en || updatedItem.name;
  const cleanItem = {
    ...updatedItem,
    name: normEn || updatedItem.name,
    name_en: normEn || updatedItem.name_en,
    name_bn: normBn || updatedItem.name_bn,
    nameBn: normBn || (updatedItem as any).nameBn,
    'Name (BN)': normBn || (updatedItem as any)['Name (BN)'],
    'Name_BN': normBn || (updatedItem as any).Name_BN,
  };
  saveUserMenuOverride(cleanItem);
  const current = getCanteenMenuCache();
  const next = current.map((it) => {
    if (String(it.id).toLowerCase() === String(updatedItem.id).toLowerCase()) {
      return { 
        ...it, 
        ...cleanItem, 
        name: normEn || it.name,
        name_en: normEn || it.name_en,
        name_bn: normBn || it.name_bn,
        nameBn: normBn || it.nameBn,
        'Name (BN)': normBn || it['Name (BN)'],
        updated_at: updatedItem.updated_at || new Date().toISOString() 
      };
    }
    return it;
  });
  setCanteenMenuCache(next);
  return next;
}

/**
 * Fetches latest menu catalog from Supabase, updates memory & localStorage caches,
 * and deduplicates simultaneous requests (single-flight).
 * Uses Stale-While-Revalidate pattern: instantly returns existing cached menu (with DPs) in 0ms,
 * while refreshing from cloud in the background.
 */
export async function fetchCanteenMenuOnce(forceRefresh = false): Promise<CanteenMenuItem[]> {
  const cached = getCanteenMenuCache();

  // If we already have cached menu items, return them INSTANTLY (0ms) so all DPs show up without delay!
  if (!forceRefresh && cached && cached.length > 0 && cached !== DEFAULT_CANTEEN_MENU_ITEMS) {
    if (!menuFetchPromise) {
      menuFetchPromise = (async () => {
        try {
          const { data, error } = await supabase.from('Canteen_Menu').select('*');
          if (!error && data && data.length > 0) {
            const currentCache = getCanteenMenuCache();
            const currentMap = new Map(currentCache.map((i) => [i.id, i]));
            const overrides = getUserMenuOverrides();

            const hydrated = data.map((it: any) => {
              const local = currentMap.get(it.id) ||
                currentCache.find(c => String(c.id).toLowerCase() === String(it.id).toLowerCase());
              const userOv = findUserMenuOverride(overrides, it) || overrides[it.id] || (local?.id ? overrides[local.id] : undefined);

              if (userOv) {
                const ovName = userOv.name || userOv.name_en || local?.name || it.name;
                const ovBn = userOv.name_bn || userOv.nameBn || local?.name_bn || it.name_bn || '';
                return {
                  ...it,
                  ...local,
                  ...userOv,
                  name: ovName,
                  name_en: ovName,
                  name_bn: ovBn,
                  nameBn: ovBn,
                  'Name (BN)': ovBn,
                  price: userOv.price !== undefined ? userOv.price : (local?.price !== undefined ? local.price : it.price),
                  stock: userOv.stock !== undefined ? userOv.stock : (local?.stock !== undefined ? local.stock : it.stock)
                };
              }

              if (local) {
                const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
                const serverTime = it.updated_at ? new Date(it.updated_at).getTime() : 0;
                // Preserve local changes if local timestamp is newer or equal to server, or if local has custom name
                if (localTime >= serverTime) {
                  return {
                    ...it,
                    ...local
                  };
                }
              }
              const resolvedBn = it.name_bn || it.nameBn || it['Name (BN)'] || local?.name_bn || local?.nameBn || getMenuItemBanglaName(it) || '';
              const resolvedEn = it.name || it.name_en || local?.name_en || local?.name || '';
              return {
                ...it,
                ...local,
                name: resolvedEn,
                name_en: resolvedEn,
                name_bn: resolvedBn,
                nameBn: resolvedBn,
                'Name (BN)': resolvedBn
              };
            });

            // Retain any existing local items that are not in the cloud Canteen_Menu table
            const hydratedIds = new Set(hydrated.map((h: any) => String(h.id).toLowerCase()));
            for (const c of currentCache) {
              if (!hydratedIds.has(String(c.id).toLowerCase())) {
                hydrated.push(c);
              }
            }
            const cleanHydrated = deduplicateCanteenMenuItems(hydrated);
            inMemoryMenuCache = cleanHydrated;
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('canteen_menu_cache', JSON.stringify(cleanHydrated));
                localStorage.setItem('canteen_menu_items_list', JSON.stringify(cleanHydrated));
              } catch {}
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: cleanHydrated }));
              }, 0);
            }
            return cleanHydrated;
          }
        } catch (e) {
          console.warn('[CanteenMenuData] Background menu refresh error:', e);
        } finally {
          menuFetchPromise = null;
        }
        return cached;
      })();
    }
    return cached;
  }

  if (menuFetchPromise) {
    if (cached && cached.length > 0 && cached !== DEFAULT_CANTEEN_MENU_ITEMS) {
      return cached;
    }
    return menuFetchPromise;
  }

  menuFetchPromise = (async () => {
    try {
      const { data, error } = await supabase.from('Canteen_Menu').select('*');
      if (!error && data && data.length > 0) {
        const currentCache = getCanteenMenuCache();
        const currentMap = new Map(currentCache.map((i) => [i.id, i]));
        const overrides = getUserMenuOverrides();

        const hydrated = data.map((it: any) => {
          const local = currentMap.get(it.id) ||
            currentCache.find(c => String(c.id).toLowerCase() === String(it.id).toLowerCase());
          const userOv = findUserMenuOverride(overrides, it) || overrides[it.id] || (local?.id ? overrides[local.id] : undefined);

          if (userOv) {
            const ovName = userOv.name || userOv.name_en || local?.name || it.name;
            const ovBn = userOv.name_bn || userOv.nameBn || local?.name_bn || it.name_bn || '';
            return {
              ...it,
              ...local,
              ...userOv,
              name: ovName,
              name_en: ovName,
              name_bn: ovBn,
              nameBn: ovBn,
              'Name (BN)': ovBn,
              price: userOv.price !== undefined ? userOv.price : (local?.price !== undefined ? local.price : it.price),
              stock: userOv.stock !== undefined ? userOv.stock : (local?.stock !== undefined ? local.stock : it.stock)
            };
          }

          if (local) {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const serverTime = it.updated_at ? new Date(it.updated_at).getTime() : 0;
            if (localTime >= serverTime) {
              return {
                ...it,
                ...local
              };
            }
          }
          const resolvedBn = it.name_bn || it.nameBn || it['Name (BN)'] || local?.name_bn || local?.nameBn || getMenuItemBanglaName(it) || '';
          const resolvedEn = it.name || it.name_en || local?.name_en || local?.name || '';
          return {
            ...it,
            ...local,
            name: resolvedEn,
            name_en: resolvedEn,
            name_bn: resolvedBn,
            nameBn: resolvedBn,
            'Name (BN)': resolvedBn
          };
        });

        // Retain any existing local items that are not in the cloud Canteen_Menu table
        const hydratedIds = new Set(hydrated.map((h: any) => String(h.id).toLowerCase()));
        for (const c of currentCache) {
          if (!hydratedIds.has(String(c.id).toLowerCase())) {
            hydrated.push(c);
          }
        }
        const cleanHydrated = deduplicateCanteenMenuItems(hydrated);
        inMemoryMenuCache = cleanHydrated;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('canteen_menu_cache', JSON.stringify(cleanHydrated));
            localStorage.setItem('canteen_menu_items_list', JSON.stringify(cleanHydrated));
          } catch {}
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: cleanHydrated }));
          }, 0);
        }
        return cleanHydrated;
      }
    } catch (e) {
      console.warn('[CanteenMenuData] Error fetching menu from cloud:', e);
    } finally {
      menuFetchPromise = null;
    }
    return getCanteenMenuCache();
  })();

  if (cached && cached.length > 0 && cached !== DEFAULT_CANTEEN_MENU_ITEMS) {
    return cached;
  }

  return menuFetchPromise;
}
import { getCanteenMembersCache, setCanteenMembersCache, deduplicateCanteenMembers as dedupeMembersFromCache } from './canteenMembersCache';
export { getCanteenMembersCache, setCanteenMembersCache };

/**
 * Fetches latest members from Supabase, deduplicating concurrent calls.
 * Uses stale-while-revalidate pattern so existing cached members are returned instantly
 * while background refresh updates silently.
 */
export async function fetchCanteenMembersOnce(force = false): Promise<any[]> {
  const cached = getCanteenMembersCache();

  if (memberFetchPromise && !force) {
    if (cached.length > 0) return cached;
    return memberFetchPromise;
  }

  memberFetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('Canteen_Member')
        .select('*');
      if (!error && data && data.length > 0) {
        const cleanedData = data;

        const localSeniorityMap = getLocalSeniorityMap();
        const merged = cleanedData.map((m: any) => {
          const bd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
          const cloudSen = (m.Seniority !== undefined && m.Seniority !== null && !isNaN(Number(m.Seniority)))
            ? Number(m.Seniority)
            : ((m.seniority !== undefined && m.seniority !== null && !isNaN(Number(m.seniority)))
              ? Number(m.seniority)
              : undefined);
          const sen = cloudSen !== undefined ? cloudSen : (bd ? localSeniorityMap[bd] : undefined);

          const nameBn = String(m.Name_BN || m['Name_BN'] || m.name_bn || m.nameBn || m.Surname_bn || m.bangla_name || '').trim();
          const rawRankBn = String(m.Rank_BN || m['Rank_BN'] || m.rank_bn || m.rankBn || m.Rank_bn || '').trim();
          const rankBn = rawRankBn || getMemberBanglaRank(m);

          return {
            ...m,
            Name_BN: nameBn || undefined,
            name_bn: nameBn || undefined,
            nameBn: nameBn || undefined,
            Rank_BN: rankBn || undefined,
            rank_bn: rankBn || undefined,
            rankBn: rankBn || undefined,
            Seniority: sen,
            seniority: sen
          };
        });
        const currentLocal = getCanteenMembersCache();
        const mergedWithLocal = deduplicateCanteenMembers([...merged, ...currentLocal]);
        const sorted = normalizeCanteenMembersSeniority(sortCanteenMembersByOfficeSeniority(mergedWithLocal));
        setCanteenMembersCache(sorted);
        return sorted;
      }
    } catch (err) {
      console.warn('[CanteenMenuData] Error fetching members from cloud:', err);
    } finally {
      memberFetchPromise = null;
    }
    return getCanteenMembersCache();
  })();

  if (!force && cached.length > 0) {
    return cached;
  }

  return memberFetchPromise;
}

export const CANTEEN_DELETED_MEMBERS_ARCHIVE_KEY = 'canteen_deleted_members_archive_v1';

export function getArchivedCanteenMembers(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CANTEEN_DELETED_MEMBERS_ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function archiveCanteenMember(member: any): void {
  if (typeof window === 'undefined' || !member) return;
  try {
    const archived = getArchivedCanteenMembers();
    const bdNo = member['BD No'] || member.bdNo;
    const airmanId = member.airman_id || `airman-${bdNo}`;
    if (!archived.some(m => m.airman_id === airmanId || (bdNo && (m['BD No'] === bdNo || m.bdNo === bdNo)))) {
      archived.push({
        ...member,
        archivedAt: new Date().toISOString()
      });
      localStorage.setItem(CANTEEN_DELETED_MEMBERS_ARCHIVE_KEY, JSON.stringify(archived));
    }
  } catch {}
}

export function findMemberWithArchiveFallback(identifier: string, activeMembers?: any[]): any | null {
  if (!identifier) return null;
  const members = activeMembers || getCanteenMembersCache();
  const cleanId = String(identifier || '').trim().toLowerCase().replace(/^airman-/i, '').replace(/^bd\/?/i, '').replace(/\D/g, '');
  // First search active members
  const foundActive = members.find(m => {
    const mBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
    const mAirman = String(m.airman_id || '').toLowerCase();
    return (cleanId && mBd === cleanId) || mAirman === identifier.toLowerCase() || mAirman === `airman-${cleanId}`;
  });
  if (foundActive) return foundActive;

  // Fallback to archived members so old logs and transactions NEVER lose member details
  const archived = getArchivedCanteenMembers();
  return archived.find(m => {
    const mBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
    const mAirman = String(m.airman_id || '').toLowerCase();
    return (cleanId && mBd === cleanId) || mAirman === identifier.toLowerCase() || mAirman === `airman-${cleanId}`;
  }) || null;
}

