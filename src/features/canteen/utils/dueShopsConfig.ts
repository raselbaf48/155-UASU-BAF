import { pushKeyToCloud } from './canteenCloudSync';

export interface DueShopConfig {
  id: string;
  name: string;
  banglaName?: string;
  emoji?: string;
  color?: string; // e.g. 'emerald' | 'amber' | 'purple' | 'blue' | 'rose' | 'teal' | 'indigo' | 'cyan'
  location?: string;
  contactNo?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
}

export const DUE_SHOPS_STORAGE_KEY = 'canteen_due_shops_v1';

export const DEFAULT_DUE_SHOPS: DueShopConfig[] = [
  {
    id: 'grocessary-shop',
    name: 'Grocessary Shop',
    banglaName: 'গ্রোসারি শপ',
    emoji: '🛒',
    color: 'emerald',
    location: 'ক্যান্টিন মেইন মার্কেট',
    contactNo: '০১৭০০-০০০০০১'
  },
  {
    id: 'poultry-shop',
    name: 'Poultry Shop',
    banglaName: 'পোল্ট্রি শপ',
    emoji: '🍗',
    color: 'amber',
    location: 'পোল্ট্রি শেড মার্কেট',
    contactNo: '০১৭০০-০০০০০২'
  },
  {
    id: 'bake-and-bite',
    name: 'Bake & Bite',
    banglaName: 'বেক অ্যান্ড বাইট',
    emoji: '☕',
    color: 'purple',
    location: 'বেকারি কর্নার',
    contactNo: '০১৭০০-০০০০০৩'
  }
];

/**
 * Read current Due Shops list from localStorage or fallback to defaults
 */
export const getDueShops = (): DueShopConfig[] => {
  if (typeof window === 'undefined') return DEFAULT_DUE_SHOPS;
  try {
    const raw = localStorage.getItem(DUE_SHOPS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DUE_SHOPS_STORAGE_KEY, JSON.stringify(DEFAULT_DUE_SHOPS));
      return DEFAULT_DUE_SHOPS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_DUE_SHOPS;
  } catch {
    return DEFAULT_DUE_SHOPS;
  }
};

/**
 * Save Due Shops list to localStorage, dispatch update event, and push to cloud
 */
export const saveDueShops = (shops: DueShopConfig[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DUE_SHOPS_STORAGE_KEY, JSON.stringify(shops));
    pushKeyToCloud(DUE_SHOPS_STORAGE_KEY, shops).catch(() => {});
    window.dispatchEvent(new CustomEvent('canteen_due_shops_updated', { detail: shops }));
  } catch (err) {
    console.warn('Error saving due shops:', err);
  }
};

/**
 * Add a new shop to the list
 */
export const addDueShop = (shop: Omit<DueShopConfig, 'id'>): DueShopConfig => {
  const current = getDueShops();
  const slug = shop.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const id = `shop-${slug || Date.now()}-${Date.now().toString().slice(-4)}`;
  const newShop: DueShopConfig = {
    ...shop,
    id,
    name: shop.name.trim(),
    banglaName: shop.banglaName?.trim() || shop.name.trim(),
    emoji: shop.emoji?.trim() || '🏪',
    color: shop.color || 'blue'
  };
  const updated = [...current, newShop];
  saveDueShops(updated);
  return newShop;
};

/**
 * Update an existing shop in the list.
 * If the shop name changed, optionally updates records in canteen_expenses.
 */
export const updateDueShop = (
  id: string, 
  data: Partial<DueShopConfig>,
  oldName?: string
): DueShopConfig[] => {
  const current = getDueShops();
  const updated = current.map((s) => {
    if (s.id === id) {
      return {
        ...s,
        ...data,
        name: data.name !== undefined ? data.name.trim() : s.name,
        banglaName: data.banglaName !== undefined ? data.banglaName.trim() : s.banglaName,
        emoji: data.emoji !== undefined ? data.emoji.trim() : s.emoji
      };
    }
    return s;
  });

  saveDueShops(updated);

  // If name changed, rename in expenses if oldName provided
  if (oldName && data.name && oldName !== data.name) {
    try {
      const rawExp = localStorage.getItem('canteen_expenses');
      if (rawExp) {
        const exps: any[] = JSON.parse(rawExp);
        let hasChanges = false;
        const renamed = exps.map((e) => {
          if (e.dueShop === oldName) {
            hasChanges = true;
            return { ...e, dueShop: data.name };
          }
          return e;
        });
        if (hasChanges) {
          localStorage.setItem('canteen_expenses', JSON.stringify(renamed));
          pushKeyToCloud('canteen_expenses', renamed).catch(() => {});
          window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: renamed }));
        }
      }
    } catch {}
  }

  return updated;
};

export const DUE_SHOPS_ARCHIVE_KEY = 'canteen_due_shops_archive_v1';

export const getArchivedDueShops = (): DueShopConfig[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DUE_SHOPS_ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const archiveDueShop = (shop: DueShopConfig): void => {
  if (typeof window === 'undefined') return;
  try {
    const archived = getArchivedDueShops();
    if (!archived.some(s => s.id === shop.id || s.name.toLowerCase() === shop.name.toLowerCase())) {
      const updated = [...archived, shop];
      localStorage.setItem(DUE_SHOPS_ARCHIVE_KEY, JSON.stringify(updated));
      pushKeyToCloud(DUE_SHOPS_ARCHIVE_KEY, updated).catch(() => {});
    }
  } catch {}
};

/**
 * Calculate current unpaid due for a shop from canteen_expenses
 */
export const getShopDueAmount = (shopName: string): number => {
  if (typeof window === 'undefined' || !shopName) return 0;
  try {
    const raw = localStorage.getItem('canteen_expenses');
    if (!raw) return 0;
    const expenses: any[] = JSON.parse(raw);
    if (!Array.isArray(expenses)) return 0;
    const sNameLower = shopName.trim().toLowerCase();
    return expenses
      .filter((e) => {
        const isDue = String(e.paymentMethod || '').trim().toLowerCase() === 'due';
        if (!isDue) return false;
        const dueShop = String(e.dueShop || '').trim().toLowerCase();
        if (dueShop) {
          return dueShop === sNameLower;
        }
        const desc = String(e.desc || '').toLowerCase();
        return desc.includes(sNameLower);
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  } catch {
    return 0;
  }
};

/**
 * Check if a shop can be deleted (No due allowed)
 */
export const canDeleteDueShop = (shopName: string): { allowed: boolean; dueAmount: number; reason?: string } => {
  const dueAmount = getShopDueAmount(shopName);
  if (dueAmount > 0) {
    return {
      allowed: false,
      dueAmount,
      reason: `এই দোকানে এখনো ৳${dueAmount.toLocaleString()} বকেয়া রয়েছে। বকেয়া পরিশোধ না করা পর্যন্ত দোকান মুছে ফেলা যাবে না।`
    };
  }
  return { allowed: true, dueAmount: 0 };
};

/**
 * Delete a shop from the list (Only permitted when due is 0)
 * Safely archives the shop so previous history and logs retain the shop name and details!
 */
export const deleteDueShop = (id: string): DueShopConfig[] => {
  const current = getDueShops();
  const shopToDelete = current.find(s => s.id === id);
  if (shopToDelete) {
    const check = canDeleteDueShop(shopToDelete.name);
    if (!check.allowed) {
      throw new Error(check.reason || 'বকেয়া থাকায় দোকানটি মুছে ফেলা সম্ভব নয়!');
    }
    // Archive so historical statements & logs keep the shop name intact
    archiveDueShop(shopToDelete);
  }
  const updated = current.filter((s) => s.id !== id);
  saveDueShops(updated);
  return updated;
};

/**
 * Resolve display name in Bengali for any shop name (Checks active + archived shops)
 */
export const getShopDisplayNameBn = (shopName: string, shopsList?: DueShopConfig[]): string => {
  const shops = shopsList || getDueShops();
  const match = shops.find(s => s.name.toLowerCase() === shopName.toLowerCase() || s.id === shopName);
  if (match && match.banglaName) {
    return match.banglaName;
  }
  // Check archived shops so past history always displays properly
  const archived = getArchivedDueShops();
  const archivedMatch = archived.find(s => s.name.toLowerCase() === shopName.toLowerCase() || s.id === shopName);
  if (archivedMatch && archivedMatch.banglaName) {
    return archivedMatch.banglaName;
  }

  if (shopName === 'Grocessary Shop' || shopName.toLowerCase().includes('grocessary') || shopName.toLowerCase().includes('grocery')) {
    return 'গ্রোসারি শপ';
  }
  if (shopName === 'Poultry Shop' || shopName.toLowerCase().includes('poultry')) {
    return 'পোল্ট্রি শপ';
  }
  if (shopName === 'Bake & Bite' || shopName.toLowerCase().includes('bake') || shopName.toLowerCase().includes('bite')) {
    return 'বেক অ্যান্ড বাইট';
  }
  return shopName;
};

/**
 * Resolve emoji for any shop name (Checks active + archived shops)
 */
export const getShopEmoji = (shopName: string, shopsList?: DueShopConfig[]): string => {
  const shops = shopsList || getDueShops();
  const match = shops.find(s => s.name.toLowerCase() === shopName.toLowerCase() || s.id === shopName);
  if (match && match.emoji) {
    return match.emoji;
  }
  const archived = getArchivedDueShops();
  const archivedMatch = archived.find(s => s.name.toLowerCase() === shopName.toLowerCase() || s.id === shopName);
  if (archivedMatch && archivedMatch.emoji) {
    return archivedMatch.emoji;
  }

  if (shopName.toLowerCase().includes('poultry') || shopName.toLowerCase().includes('chicken') || shopName.toLowerCase().includes('meat')) return '🍗';
  if (shopName.toLowerCase().includes('bake') || shopName.toLowerCase().includes('bite') || shopName.toLowerCase().includes('tea') || shopName.toLowerCase().includes('coffee')) return '☕';
  if (shopName.toLowerCase().includes('grocessary') || shopName.toLowerCase().includes('grocery') || shopName.toLowerCase().includes('rice')) return '🛒';
  return '🏪';
};

/**
 * Resolve shop color
 */
export const getShopColor = (shopName: string, shopsList?: DueShopConfig[]): string => {
  const shops = shopsList || getDueShops();
  const match = shops.find(s => s.name.toLowerCase() === shopName.toLowerCase() || s.id === shopName);
  if (match?.color) return match.color;
  const archived = getArchivedDueShops();
  const archivedMatch = archived.find(s => s.name.toLowerCase() === shopName.toLowerCase() || s.id === shopName);
  return archivedMatch?.color || 'indigo';
};

