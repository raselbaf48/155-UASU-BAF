import { supabase } from '../../../supabase';

export interface CanteenMenuItem {
  id: string;
  name: string;
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

export const DEFAULT_CANTEEN_MENU_ITEMS: CanteenMenuItem[] = [
  {
    id: "28d0782c-1bdf-42f6-a616-683a9d5038f1",
    name: "EGG MUMLET",
    category: "SNACKS",
    price: 15,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "bcb8b137-36b8-4fd0-9e11-0e9502859618",
    name: "EGG NOODLES",
    category: "SNACKS",
    price: 50,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "da73d5ab-f0e9-4df1-b3bd-89ed86a1da4f",
    name: "GREEN TEA",
    category: "SNACKS",
    price: 8,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "c6ca22ca-0a4a-4a2b-8b48-0d839d240e7b",
    name: "HALIM",
    category: "SNACKS",
    price: 50,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "3d86a07a-2c53-416a-abb6-52b0b448ca63",
    name: "LEMON JUICE",
    category: "DRINK",
    price: 10,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "0e5511c2-9014-4aeb-8e57-624d6994986a",
    name: "LIQUOR TEA",
    category: "DRINK",
    price: 5,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "02d2b676-3b4b-4e7d-9b58-477c53ede8ae",
    name: "MILK COFFEE",
    category: "DRINK",
    price: 25,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "136e714f-1272-4723-a0a5-2048cb81e94f",
    name: "MILK TEA",
    category: "DRINK",
    price: 12,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "5db26171-f6dc-4268-8d64-a5b53140e368",
    name: "NOODLES",
    category: "SNACKS",
    price: 30,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "0a1f36fc-aad0-4d45-a0d8-9222ca1ca07e",
    name: "NORMAL BISCUIT",
    category: "SNACKS",
    price: 5,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "38bc5293-57ed-4e5a-b817-cbdcb37bfebd",
    name: "ONE TIME BOX",
    category: "SNACKS",
    price: 5,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "3dde1a4e-9b62-49a9-8b24-d758c2afc24a",
    name: "PASTA",
    category: "SNACKS",
    price: 35,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "98b60d30-301c-49ea-9e99-7661e30fca39",
    name: "PORATA",
    category: "SNACKS",
    price: 15,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "cebd3bcc-1802-4f63-90f3-0bb2fa27e121",
    name: "PORATA (HOTEL)",
    category: "SNACKS",
    price: 10,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "04bcbfd0-dfc9-4abf-9270-b193563969ef",
    name: "RED TEA",
    category: "DRINK",
    price: 8,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "96f0ba1b-b4a1-4322-a7d5-d227b233c7f3",
    name: "ROLL",
    category: "SNACKS",
    price: 20,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "d83a1529-e099-4d6f-9988-5182ec35f5ee",
    name: "SAMOSA",
    category: "SNACKS",
    price: 10,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "70d10b7b-2092-491b-8534-11883aa36952",
    name: "SINGARA",
    category: "SNACKS",
    price: 10,
    stock: 99998,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "273a3c89-ceba-4202-a169-be5a1be82cf0",
    name: "TOAST BISCUIT",
    category: "SNACKS",
    price: 5,
    stock: 99999,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "089a215f-20f3-47b2-983b-5a0a94cba18e",
    name: "CHICKEN BIRIYANI",
    category: "SNACKS",
    price: 65,
    stock: 10,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "5cc854fa-cdf0-43e9-a4cf-339f8a1dcbd3",
    name: "CHICKEN CURRY",
    category: "SNACKS",
    price: 50,
    stock: 99998,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "c149451c-7fe4-4531-9984-0addc2742fdb",
    name: "CHICKEN KHICHURI",
    category: "SNACKS",
    price: 65,
    stock: 99998,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "c5d4c577-81ab-43cf-88ca-d0e431661a2f",
    name: "CHICKEN ONION",
    category: "SNACKS",
    price: 45,
    stock: 99998,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "2a22e09c-cc55-4528-8a73-225de8456c1c",
    name: "CHICKEN PASTA",
    category: "SNACKS",
    price: 55,
    stock: 99998,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "b3785b27-f250-4000-85bf-3fbaf804cc63",
    name: "CHICKEN PULAW",
    category: "SNACKS",
    price: 65,
    stock: 99997,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "e37bb8e1-db3f-464a-8968-74bec924ac87",
    name: "CHOTPOTI",
    category: "SNACKS",
    price: 30,
    stock: 99998,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "c06d9508-2367-404d-b7ca-b5c9670a4b6c",
    name: "COLD COFFEE",
    category: "DRINK",
    price: 40,
    stock: 99997,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "7bb1b308-130a-4ee5-b2c4-bff0a5e25c49",
    name: "DRY CAKE",
    category: "SNACKS",
    price: 12,
    stock: 99998,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "2cb63ae0-6f65-48c7-92f5-77add415f5ea",
    name: "EGG FRY",
    category: "SNACKS",
    price: 18,
    stock: 0,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  },
  {
    id: "51d5db48-1160-468c-a55a-ef21b7e4b81d",
    name: "EGG KHICURI",
    category: "SNACKS",
    price: 45,
    stock: 99997,
    created_at: "2026-09-16T11:21:03.555622+00:00"
  }
];

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
        inMemoryMenuCache = parsed;
        return parsed;
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
 */
export async function fetchCanteenMenuOnce(forceRefresh = false): Promise<CanteenMenuItem[]> {
  if (!forceRefresh && inMemoryMenuCache && inMemoryMenuCache.length > 0) {
    return inMemoryMenuCache;
  }
  if (menuFetchPromise) {
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
