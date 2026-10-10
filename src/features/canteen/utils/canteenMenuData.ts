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
  updated_at?: string;
}

import defaultMenuItemsData from '../data/defaultMenuItems.json';
import { getMenuItemBanglaName } from './menuBanglaNames';
import { getLocalSeniorityMap } from './memberSeniority';
import { sortCanteenMembersByOfficeSeniority, normalizeCanteenMembersSeniority, deduplicateCanteenMembers } from './canteenSeniority';
import { getMemberBanglaRank } from './memberBanglaNames';

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
 * Synchronously updates the menu cache in memory and localStorage (0ms delay),
 * and dispatches 'canteen_menu_updated' and 'canteen_state_updated' so ALL components
 * (CanteenInventory, MenuManagement, POS, RawDistribution, PersonalPortal) update in real-time.
 */
export function setCanteenMenuCache(items: CanteenMenuItem[]): void {
  inMemoryMenuCache = items;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('canteen_menu_cache', JSON.stringify(items));
      localStorage.setItem('canteen_menu_items_list', JSON.stringify(items));
    } catch (e) {
      console.warn('Error persisting canteen_menu_cache:', e);
    }
    // Instant event dispatch (0ms)
    window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: items }));
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
            inMemoryMenuCache = hydrated;
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('canteen_menu_cache', JSON.stringify(hydrated));
              } catch {}
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: hydrated }));
              }, 0);
            }
            return hydrated;
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
        inMemoryMenuCache = hydrated;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('canteen_menu_cache', JSON.stringify(hydrated));
          } catch {}
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: hydrated }));
          }, 0);
        }
        return hydrated;
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

