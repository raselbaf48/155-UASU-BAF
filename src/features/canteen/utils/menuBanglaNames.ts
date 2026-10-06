import { pushKeyToCloud, pullKeyFromCloud } from './canteenCloudSync';

export const MENU_BANGLA_NAMES_KEY = 'canteen_menu_bangla_names';

/**
 * Standard pre-populated Bengali names for all canteen menu items.
 * The manager can edit or correct any of these at any time!
 */
export const DEFAULT_MENU_BANGLA_NAMES: Record<string, string> = {
  // Snacks & Fast Food
  "one time box": "ওয়ান টাইম বক্স",
  "chicken onion": "চিকেন অনিয়ন",
  "egg mumlet": "ডিম অমলেট",
  "egg omlet": "ডিম অমলেট",
  "egg omelette": "ডিম অমলেট",
  "dry cake": "ড্রাই কেক",
  "normal biscuit": "নরমাল বিস্কুট",
  "biscuit": "বিস্কুট",
  "noodles": "নুডলস",
  "egg noodles": "এগ নুডলস",
  "chicken noodles": "চিকেন নুডলস",
  "pasta": "পাস্তা",
  "chicken pasta": "চিকেন পাস্তা",
  "swarma": "শার্মা",
  "shawarma": "শার্মা",
  "chicken roll": "চিকেন রোল",
  "singara": "সিঙ্গারা",
  "samosa": "সমুচা",
  "samoosa": "সমুচা",
  "somosa": "সমুচা",
  "chotpoti": "চটপটি",
  "halim": "হালিম",
  "haleem": "হালিম",
  "burger": "বার্গার",
  "chicken burger": "চিকেন বার্গার",
  "porata": "পরোটা",
  "porata (hotel)": "পরোটা (হোটেল)",
  "porata (unit)": "পরোটা (ইউনিট)",
  "paratha": "পরোটা",
  "puri": "পুরি",
  "dal puri": "ডাল পুরি",
  "alu puri": "আলু পুরি",

  // Meals & Rice
  "chicken pulaw": "চিকেন পোলাও",
  "chicken polao": "চিকেন পোলাও",
  "chicken biriyani": "চিকেন বিরিয়ানি",
  "chicken biryani": "চিকেন বিরিয়ানি",
  "beef biriyani": "বিফ বিরিয়ানি",
  "beef biryani": "বিফ বিরিয়ানি",
  "chicken khichuri": "চিকেন খিচুড়ি",
  "egg khichuri": "ডিম খিচুড়ি",
  "khichuri": "খিচুড়ি",
  "chicken curry": "চিকেন কারি",
  "beef curry": "বিফ কারি",
  "egg fry": "ডিম ভাজি / ফ্রাই",
  "boiled egg": "সিদ্ধ ডিম",
  "dim vaji": "ডিম ভাজি",
  "dim seddho": "সিদ্ধ ডিম",

  // Drinks & Beverages
  "cold coffee": "কোল্ড কফি",
  "milk coffee": "দুধ কফি",
  "coffee": "কফি",
  "green tea": "গ্রিন টি",
  "lemon juice": "লেবুর জুস",
  "liquor tea": "রং চা (লিকার)",
  "raw tea": "রং চা",
  "red tea": "রং চা",
  "milk tea": "দুধ চা",
  "tea": "চা",
  "mineral water": "খাবার পানি",
  "water": "খাবার পানি",
  "soft drinks": "কোমল পানীয়",
  "coke": "কোকাকোলা",
  "pepsi": "পেপসি",
  "mojo": "মোজো",
  "sprite": "স্প্রাইট",
  "7up": "সেভেন আপ",
  "sandwich": "স্যান্ডউইচ",
  "chicken sandwich": "চিকেন স্যান্ডউইচ",
  "patties": "চিকেন পেটিস",
  "chicken patties": "চিকেন পেটিস",
  "cake": "কেক",
  "cup cake": "কাপ কেক",
  "sweet": "মিষ্টি",
  "mishti": "মিষ্টি",
  "lassi": "লাচ্ছি",
  "lacchi": "লাচ্ছি",
  "borhani": "বোরহানি",
  "plain rice": "সাদা ভাত",
  "rice": "ভাত",
  "bhat": "সাদা ভাত",
  "vegetable": "সবজি ভাজি",
  "shobji": "সবজি ভাজি",
  "dal": "ডাল",
  "daal": "ডাল",
  "fish curry": "মাছের তরকারি",
  "rui fish": "রুই মাছ ভুনা",
  "beef bhuna": "বিফ ভুনা",
  "mutton curry": "খাসির মাংস",
  "egg roll": "এগ রোল"
};

/**
 * Normalizes string keys for flexible matching
 */
function normalizeKey(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Returns the currently stored mapping merged with defaults
 */
export function getMenuBanglaNamesMap(): Record<string, string> {
  let customMap: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(MENU_BANGLA_NAMES_KEY);
    if (raw) {
      customMap = JSON.parse(raw);
    }
  } catch {}
  return { ...DEFAULT_MENU_BANGLA_NAMES, ...customMap };
}

/**
 * Retrieves the Bengali name of a menu item.
 * 1. Checks item.name_bn or item.nameBn
 * 2. Checks local/cloud storage mapping by item.id
 * 3. Checks by item.name
 * 4. Falls back to default dictionary
 */
export function getMenuItemBanglaName(itemOrName: any): string {
  if (!itemOrName) return '';

  if (typeof itemOrName === 'object') {
    if (itemOrName.name_bn && String(itemOrName.name_bn).trim()) {
      return String(itemOrName.name_bn).trim();
    }
    if (itemOrName.nameBn && String(itemOrName.nameBn).trim()) {
      return String(itemOrName.nameBn).trim();
    }
    if (itemOrName['Name (BN)'] && String(itemOrName['Name (BN)']).trim()) {
      return String(itemOrName['Name (BN)']).trim();
    }
  }

  const map = getMenuBanglaNamesMap();

  if (typeof itemOrName === 'object') {
    // Check by ID
    if (itemOrName.id && map[String(itemOrName.id)]) {
      return map[String(itemOrName.id)];
    }
    // Check by name
    const rawName = itemOrName.name || itemOrName.name_en || '';
    if (rawName) {
      const norm = normalizeKey(rawName);
      if (map[norm]) return map[norm];
    }
  } else if (typeof itemOrName === 'string') {
    const norm = normalizeKey(itemOrName);
    if (map[norm]) return map[norm];
    if (map[itemOrName]) return map[itemOrName];
  }

  return '';
}

/**
 * Saves a Bengali name for a menu item (by id and name),
 * persists to localStorage, dispatches update event, and pushes to Cloud.
 */
export async function saveMenuItemBanglaName(
  identifier: { id?: string; name: string },
  nameBn: string
): Promise<void> {
  const trimmedBn = String(nameBn || '').trim();
  let currentMap: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(MENU_BANGLA_NAMES_KEY);
    if (raw) currentMap = JSON.parse(raw);
  } catch {}

  const normName = normalizeKey(identifier.name);

  if (trimmedBn) {
    if (identifier.id) currentMap[identifier.id] = trimmedBn;
    if (normName) currentMap[normName] = trimmedBn;
  } else {
    if (identifier.id) delete currentMap[identifier.id];
    if (normName) delete currentMap[normName];
  }

  try {
    localStorage.setItem(MENU_BANGLA_NAMES_KEY, JSON.stringify(currentMap));
    window.dispatchEvent(new CustomEvent('canteen_menu_bangla_names_updated', { detail: currentMap }));
  } catch {}

  try {
    await pushKeyToCloud(MENU_BANGLA_NAMES_KEY, currentMap);
  } catch (err) {
    console.warn('Note pushing canteen_menu_bangla_names to cloud:', err);
  }
}

/**
 * Fetches menu Bengali names from Cloud KV and synchronizes locally
 */
export async function fetchMenuBanglaNamesFromCloud(): Promise<Record<string, string>> {
  try {
    const cloudKv = await pullKeyFromCloud(MENU_BANGLA_NAMES_KEY);
    if (cloudKv && typeof cloudKv === 'object') {
      let currentMap: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(MENU_BANGLA_NAMES_KEY);
        if (raw) currentMap = JSON.parse(raw);
      } catch {}
      const merged = { ...DEFAULT_MENU_BANGLA_NAMES, ...currentMap, ...cloudKv };
      localStorage.setItem(MENU_BANGLA_NAMES_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('canteen_menu_bangla_names_updated', { detail: merged }));
      return merged;
    }
  } catch (err) {
    console.warn('Note pulling canteen_menu_bangla_names from cloud:', err);
  }
  return getMenuBanglaNamesMap();
}
