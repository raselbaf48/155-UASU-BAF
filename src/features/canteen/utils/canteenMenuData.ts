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

export const DEFAULT_CANTEEN_MENU_ITEMS: CanteenMenuItem[] = (defaultMenuItemsData as any[])
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
}));

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

    const normEn = normalizeCatalogKey(enName);
    const normBn = normalizeCatalogKey(bnName);

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

      const initialStock = (rawItem.stock !== undefined && rawItem.stock !== null && !isNaN(Number(rawItem.stock)))
        ? Number(rawItem.stock)
        : ((rawItem.max !== undefined && rawItem.max !== null && !isNaN(Number(rawItem.max)))
          ? Number(rawItem.max)
          : ((rawItem.Quantity !== undefined && rawItem.Quantity !== null && !isNaN(Number(rawItem.Quantity)))
            ? Number(rawItem.Quantity)
            : undefined));

      seen.set(groupKey, {
        ...rawItem,
        id: rawItem.id || `menu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: enName || bnName || 'Item',
        name_en: enName || rawItem.name_en || rawItem.name || '',
        name_bn: bnName,
        nameBn: bnName,
        'Name (BN)': bnName,
        price: Number(rawItem.price) || 0,
        stock: initialStock,
        max: initialStock,
        cost: Number(rawItem.cost ?? rawItem.Cost ?? 0),
        Cost: Number(rawItem.Cost ?? rawItem.cost ?? 0),
        DP: rawItem.DP || rawItem.img || rawItem.image || '',
        img: rawItem.DP || rawItem.img || rawItem.image || '',
        image: rawItem.DP || rawItem.img || rawItem.image || '',
        category: rawItem.category || rawItem.meal || 'SNACKS'
      });
    } else {
      const existing = seen.get(groupKey)!;
      const mergedPrice = Number(rawItem.price) > 0 ? Number(rawItem.price) : Number(existing.price || 0);
      const mergedCost = Number(rawItem.cost ?? rawItem.Cost) > 0 ? Number(rawItem.cost ?? rawItem.Cost) : Number(existing.cost ?? existing.Cost ?? 0);
      const mergedDp = (rawItem.DP || rawItem.img || rawItem.image || existing.DP || existing.img || existing.image || '');
      const mergedEn = existing.name || enName;
      const mergedBn = existing.name_bn || existing.nameBn || bnName;
      const incomingStock = (rawItem.stock !== undefined && rawItem.stock !== null && !isNaN(Number(rawItem.stock)))
        ? Number(rawItem.stock)
        : ((rawItem.max !== undefined && rawItem.max !== null && !isNaN(Number(rawItem.max)))
          ? Number(rawItem.max)
          : ((rawItem.Quantity !== undefined && rawItem.Quantity !== null && !isNaN(Number(rawItem.Quantity)))
            ? Number(rawItem.Quantity)
            : undefined));
      const mergedStock = incomingStock !== undefined 
        ? incomingStock 
        : (existing.stock !== undefined ? Number(existing.stock) : (existing.max !== undefined ? Number(existing.max) : undefined));

      seen.set(groupKey, {
        ...existing,
        ...rawItem,
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
        category: existing.category || rawItem.category || 'SNACKS'
      });
      if (cleanId) idToGroup.set(cleanId, groupKey);
      if (normEn) nameToGroup.set(normEn, groupKey);
      if (normBn) bnNameToGroup.set(normBn, groupKey);
    }
  }

  return Array.from(seen.values());
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
    } catch (e) {
      console.warn('Error persisting canteen_menu_cache:', e);
    }
    // Instant event dispatch (0ms)
    window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: cleanItems }));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
  }
}

/**
 * Updates a single menu item in the cache immediately in 0ms and notifies listeners.
 */
export function updateSingleMenuItemInCache(updatedItem: Partial<CanteenMenuItem> & { id: string }): CanteenMenuItem[] {
  const current = getCanteenMenuCache();
  const next = current.map((it) => {
    if (it.id === updatedItem.id) {
      return { ...it, ...updatedItem, updated_at: updatedItem.updated_at || new Date().toISOString() };
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
            const now = Date.now();

            const hydrated = data.map((it: any) => {
              const local = currentMap.get(it.id);
              if (local) {
                const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
                const serverTime = it.updated_at ? new Date(it.updated_at).getTime() : 0;
                // Preserve local changes if updated in last 30s and server hasn't caught up
                if (localTime > serverTime && now - localTime < 30000) {
                  return local;
                }
              }
              const bn = it.name_bn || it.nameBn || it['Name (BN)'] || getMenuItemBanglaName(it) || local?.name_bn || '';
              return {
                ...it,
                name_bn: bn,
                nameBn: bn,
                'Name (BN)': bn
              };
            });
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
        const now = Date.now();

        const hydrated = data.map((it: any) => {
          const local = currentMap.get(it.id);
          if (local) {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const serverTime = it.updated_at ? new Date(it.updated_at).getTime() : 0;
            if (localTime > serverTime && now - localTime < 30000) {
              return local;
            }
          }
          const bn = it.name_bn || it.nameBn || it['Name (BN)'] || getMenuItemBanglaName(it) || local?.name_bn || '';
          return {
            ...it,
            name_bn: bn,
            nameBn: bn,
            'Name (BN)': bn
          };
        });
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

/**
 * Returns cached members synchronously (0ms delay).
 * Checks memory first, then localStorage.
 */
export function getCanteenMembersCache(): any[] {
  if (inMemoryMembersCache && inMemoryMembersCache.length > 0) {
    return deduplicateCanteenMembers(inMemoryMembersCache);
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('canteen_members_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = deduplicateCanteenMembers(parsed);
        inMemoryMembersCache = clean;
        return clean;
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
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: members }));
      }, 0);
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
        .select('*');
      if (!error && data && data.length > 0) {
        // Filter out obsolete small temporary BD numbers if a real military BD record exists for the same member
        const cleanedData = data.filter((m: any) => {
          const bdNum = parseInt(String(m['BD No'] || '').replace(/\D/g, ''), 10);
          if (!isNaN(bdNum) && bdNum < 50) {
            const surname = String(m.Surname || '').trim().toLowerCase();
            const rank = String(m.Rank || '').trim().toLowerCase();
            if (surname && rank) {
              const hasRealBd = data.some((other: any) => {
                const otherBdNum = parseInt(String(other['BD No'] || '').replace(/\D/g, ''), 10);
                const otherSurname = String(other.Surname || '').trim().toLowerCase();
                const otherRank = String(other.Rank || '').trim().toLowerCase();
                return otherSurname === surname && otherRank === rank && otherBdNum >= 100;
              });
              if (hasRealBd) return false;
            }
          }
          return true;
        });

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
        const sorted = normalizeCanteenMembersSeniority(sortCanteenMembersByOfficeSeniority(merged));
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

