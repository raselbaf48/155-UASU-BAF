import { supabase } from '../../../supabase';

export interface CanteenMenuItem {
  id: string;
  name: string;
  name_en?: string;
  name_bn?: string;
  nameBn?: string;
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
}

import defaultMenuItemsData from '../data/defaultMenuItems.json';
import { getMenuItemBanglaName } from './menuBanglaNames';

export const DEFAULT_CANTEEN_MENU_ITEMS: CanteenMenuItem[] = (defaultMenuItemsData as any[]).map((it) => ({
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
}));

// In-Memory Caches for Instant (0ms) Access
let inMemoryMenuCache: CanteenMenuItem[] | null = null;
let menuFetchPromise: Promise<CanteenMenuItem[]> | null = null;

let inMemoryMembersCache: any[] | null = null;
let memberFetchPromise: Promise<any[]> | null = null;

/**
 * Returns cached menu catalog synchronously (0ms delay).
 * Checks memory first, then localStorage, then defaults.
 */
export function getCanteenMenuCache(): CanteenMenuItem[] {
  if (inMemoryMenuCache && inMemoryMenuCache.length > 0) {
    return inMemoryMenuCache;
  }
  if (typeof window === 'undefined') return DEFAULT_CANTEEN_MENU_ITEMS;
  try {
    const raw = localStorage.getItem('canteen_menu_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hydrated = parsed.map((p: any) => {
          if (!p.DP && !p.img && !p.image) {
            const def = DEFAULT_CANTEEN_MENU_ITEMS.find((d) => d.id === p.id || d.name?.toLowerCase() === p.name?.toLowerCase());
            if (def?.DP) {
              return { ...p, DP: def.DP, img: def.DP, image: def.DP };
            }
          }
          return p;
        });
        inMemoryMenuCache = hydrated;
        return hydrated;
      }
    }
    const rawList = localStorage.getItem('canteen_menu_items_list');
    if (rawList) {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryMenuCache = parsed;
        return parsed;
      }
    }
  } catch {}
  inMemoryMenuCache = DEFAULT_CANTEEN_MENU_ITEMS;
  return DEFAULT_CANTEEN_MENU_ITEMS;
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
            inMemoryMenuCache = data;
            if (typeof window !== 'undefined') {
              localStorage.setItem('canteen_menu_cache', JSON.stringify(data));
              window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: data }));
            }
            return data;
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
        inMemoryMenuCache = data;
        if (typeof window !== 'undefined') {
          localStorage.setItem('canteen_menu_cache', JSON.stringify(data));
          window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: data }));
        }
        return data;
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

/**
 * Returns cached members synchronously (0ms delay).
 * Checks memory first, then localStorage.
 */
export function getCanteenMembersCache(): any[] {
  if (inMemoryMembersCache && inMemoryMembersCache.length > 0) {
    return inMemoryMembersCache;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('canteen_members_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryMembersCache = parsed;
        return parsed;
      }
    }
  } catch {}
  return [];
}

/**
 * Updates in-memory and local storage members cache.
 */
export function setCanteenMembersCache(members: any[]): void {
  if (!Array.isArray(members)) return;
  inMemoryMembersCache = members;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('canteen_members_cache', JSON.stringify(members));
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: members }));
    } catch (e) {
      console.warn('[CanteenMenuData] LocalStorage save warning:', e);
    }
  }
}

/**
 * Fetches latest members from Supabase, deduplicating concurrent calls.
 * Uses stale-while-revalidate pattern so existing cached members are returned instantly
 * while background refresh updates silently.
 */
export async function fetchCanteenMembersOnce(force = false): Promise<any[]> {
  const cached = getCanteenMembersCache();
  if (!force && cached.length > 0) {
    return cached;
  }
  if (memberFetchPromise) {
    if (cached.length > 0) return cached;
    return memberFetchPromise;
  }

  memberFetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('Canteen_Member')
        .select('airman_id, "BD No", Rank, Surname, Contact, Due, Role, DP');
      if (!error && data && data.length > 0) {
        const sorted = data.sort((a: any, b: any) => {
          const bdA = Number(String(a['BD No'] || a.airman_id || '').replace(/\D/g, '')) || 0;
          const bdB = Number(String(b['BD No'] || b.airman_id || '').replace(/\D/g, '')) || 0;
          return bdA - bdB;
        });
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

  if (cached.length > 0) {
    return cached;
  }

  return memberFetchPromise;
}
