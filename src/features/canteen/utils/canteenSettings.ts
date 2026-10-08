import { supabase } from '../../../supabase';
import { getMenuItemBanglaName } from './menuBanglaNames';

export type ItemDisplayLanguage = 'bn' | 'en' | 'both';

export interface DisplayedItemName {
  primary: string;
  secondary?: string;
  full: string;
}

export interface CanteenConfig {
  name: string;
  logoUrl: string;
  managerName: string;
  adminImage: string;
  phone: string;
  password: string;
  managerBdNo?: string;
  footer?: string;
  preOrderEnabled?: boolean;
  preOrderStartTime?: string; // HH:mm (24-hour format) e.g. "08:00"
  preOrderEndTime?: string;   // HH:mm (24-hour format) e.g. "16:00"
  dailyResetTime?: string;    // HH:mm (24-hour format) e.g. "15:00" (Default: 15:00 / 3:00 PM)
  itemDisplayLanguage?: ItemDisplayLanguage; // Master: 'bn' | 'en' | 'both'
  menuDisplayLanguage?: ItemDisplayLanguage; // Menu specific: 'bn' | 'en' | 'both'
  inventoryDisplayLanguage?: ItemDisplayLanguage; // Inventory specific: 'bn' | 'en' | 'both'
}

export const DEFAULT_CANTEEN_CONFIG: CanteenConfig = {
  name: 'CAFE UAV',
  logoUrl: 'https://i.postimg.cc/gcqqCXCL/Logo-(1).png',
  managerName: 'LAC Nishad',
  adminImage: 'https://lh3.googleusercontent.com/pw/AP1GczPXDD5Dohq-6TWemgeYREoimsS-iXc6KjQoxxRgI0hjRf2tESul2P6eQYmPbFDBUzcP7tRKaBH8HkHHoBqJb83Ng8bbo5mKFhfT4YkiEcEVrCc3Nd39=s800',
  phone: '+880 1601-676760',
  password: '1111',
  managerBdNo: '',
  footer: 'Official Canteen of UAV | Integrity and Service',
  preOrderEnabled: true,
  preOrderStartTime: '18:00',
  preOrderEndTime: '08:00',
  dailyResetTime: '16:00',
  itemDisplayLanguage: 'bn',
  menuDisplayLanguage: 'bn',
  inventoryDisplayLanguage: 'bn'
};

/**
 * Returns formatted item name based on current or provided display language setting.
 * - 'bn': Displays Bengali name primarily.
 * - 'en': Displays English name primarily.
 * - 'both': Displays primary with secondary subtitle/parentheses.
 */
export function getItemDisplayName(
  item: any,
  type: 'menu' | 'inventory' = 'menu',
  config?: CanteenConfig
): DisplayedItemName {
  if (!item) return { primary: '', full: '' };
  const cfg = config || getCanteenConfig();
  const lang: ItemDisplayLanguage = 
    (type === 'menu' ? cfg.menuDisplayLanguage : cfg.inventoryDisplayLanguage) 
    || cfg.itemDisplayLanguage 
    || 'bn';

  const enName = String(item.name || item.name_en || '').trim();
  let bnName = String(item.nameBn || item.name_bn || item['Name (BN)'] || '').trim();
  
  if (!bnName && type === 'menu') {
    bnName = getMenuItemBanglaName(item);
  }

  if (lang === 'en') {
    const primary = enName || bnName;
    return { primary, full: primary };
  } else if (lang === 'both') {
    if (bnName && enName && bnName.toLowerCase() !== enName.toLowerCase()) {
      return { 
        primary: bnName, 
        secondary: enName, 
        full: `${bnName} (${enName})` 
      };
    }
    const val = bnName || enName;
    return { primary: val, full: val };
  } else {
    // Default 'bn'
    const primary = bnName || enName;
    return { primary, full: primary };
  }
}

export const CANTEEN_DAILY_MENU_KEY = 'canteen_daily_menu';
export const CANTEEN_DAILY_MENU_TIMESTAMP_KEY = 'canteen_daily_menu_updated_at';
export const CANTEEN_PRE_ORDERS_KEY = 'canteen_pre_orders';

/**
 * Determines the effective daily reset time from settings.
 * Strictly follows dailyResetTime (e.g. 16:00 / 03:00) so Menu & Live Pre-Orders
 * reset according to the Daily Auto-Reset setting, independently of Pre-Order Active Window.
 */
export function getEffectiveResetTime(config?: CanteenConfig): string {
  const cfg = config || getCanteenConfig();
  return cfg.dailyResetTime || '16:00';
}

/**
 * Computes the epoch timestamp of the most recent reset boundary in Asia/Dhaka time.
 */
export function getLastResetTimeDhaka(resetStr?: string, config?: CanteenConfig): number {
  let effectiveTime = resetStr;
  if (!effectiveTime && typeof window !== 'undefined') {
    try {
      effectiveTime = getEffectiveResetTime(config);
    } catch {}
  }
  if (!effectiveTime) effectiveTime = '16:00';

  const parts = effectiveTime.split(':').map(v => parseInt(v, 10));
  const rHour = isNaN(parts[0]) ? 16 : parts[0];
  const rMin = isNaN(parts[1]) ? 0 : parts[1];

  const now = new Date();
  
  // Format current date in Asia/Dhaka (BST, UTC+6)
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hour = now.getHours();
  let minute = now.getMinutes();

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23'
    });
    const partsObj: Record<string, string> = {};
    formatter.formatToParts(now).forEach(p => { partsObj[p.type] = p.value; });

    year = parseInt(partsObj.year, 10);
    month = parseInt(partsObj.month, 10) - 1;
    day = parseInt(partsObj.day, 10);
    hour = parseInt(partsObj.hour, 10);
    minute = parseInt(partsObj.minute, 10);
  } catch {}

  // In Dhaka time, is current time past or equal to rHour:rMin?
  const isPastResetToday = (hour > rHour) || (hour === rHour && minute >= rMin);

  let resetDay = day;
  let resetMonth = month;
  let resetYear = year;

  if (!isPastResetToday) {
    const prevDay = new Date(Date.UTC(year, month, day - 1));
    resetYear = prevDay.getUTCFullYear();
    resetMonth = prevDay.getUTCMonth();
    resetDay = prevDay.getUTCDate();
  }

  // Dhaka is UTC+6 -> exact UTC epoch timestamp
  const d = new Date(Date.UTC(resetYear, resetMonth, resetDay, rHour, rMin, 0, 0));
  return d.getTime() - (6 * 60 * 60 * 1000);
}

/**
 * Checks if a given timestamp has passed the daily auto-reset threshold.
 * Uses the configured preOrderEndTime / dailyResetTime from Canteen Settings.
 * Everyday at that cutoff time, Curated Daily Menu and Pre-Orders automatically reset.
 */
export function isTimestampPastResetThreshold(timestamp?: any, customResetTime?: string, config?: CanteenConfig): boolean {
  try {
    if (!timestamp) return true;
    let raw = timestamp;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed) raw = parsed;
      } catch {}
    }

    const setTime = typeof raw === 'number' ? raw : new Date(raw).getTime();
    if (isNaN(setTime) || setTime <= 0) return true;

    const now = Date.now();
    // Safety guard: if set within the last 10 seconds (just saved by user), do not expire immediately
    if (now - setTime < 10 * 1000) return false;

    // Get the configured reset time from canteen settings (follows Pre-Order schedule end time)
    let resetStr = customResetTime;
    if (!resetStr && typeof window !== 'undefined') {
      try {
        resetStr = getEffectiveResetTime(config);
      } catch {}
    }
    if (!resetStr) resetStr = '16:00';

    const lastReset = getLastResetTimeDhaka(resetStr, config);
    return setTime <= lastReset + 1000;
  } catch {
    return true;
  }
}

/**
 * Checks if the daily curated menu has passed the auto-reset threshold.
 */
export function isDailyMenuExpired(timestamp?: any, config?: CanteenConfig): boolean {
  try {
    let raw = timestamp;
    if (raw === undefined && typeof window !== 'undefined') {
      raw = localStorage.getItem(CANTEEN_DAILY_MENU_TIMESTAMP_KEY);
    }
    if (!raw) {
      if (typeof window !== 'undefined') {
        const currentMenu = localStorage.getItem(CANTEEN_DAILY_MENU_KEY);
        if (currentMenu && currentMenu !== '[]') return true;
      }
      return false;
    }
    return isTimestampPastResetThreshold(raw, undefined, config);
  } catch {
    return false;
  }
}

/**
 * Actively checks if the curated menu has expired past the Pre-Order schedule cutoff,
 * and if so, resets it to [] and notifies all components and cloud immediately.
 * If force=true, resets immediately regardless of time.
 */
export function checkAndEnforceDailyMenuReset(force = false, config?: CanteenConfig): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawMenu = localStorage.getItem(CANTEEN_DAILY_MENU_KEY);
    const hasItems = Boolean(rawMenu && rawMenu !== '[]' && rawMenu !== 'null');

    if (force || isDailyMenuExpired(undefined, config)) {
      if (hasItems || force) {
        localStorage.setItem(CANTEEN_DAILY_MENU_KEY, '[]');
        const resetTimestamp = new Date().toISOString();
        localStorage.setItem(CANTEEN_DAILY_MENU_TIMESTAMP_KEY, resetTimestamp);

        // Also clean up any active pre-orders from previous cycle
        if (force) {
          localStorage.setItem(CANTEEN_PRE_ORDERS_KEY, '[]');
          supabase.from('app_settings').upsert([
            {
              setting_key: CANTEEN_PRE_ORDERS_KEY,
              setting_value: '[]',
              updated_at: resetTimestamp
            }
          ], { onConflict: 'setting_key' }).then(() => {}, () => {});
        } else {
          getCleanActivePreOrders();
        }

        supabase.from('app_settings').upsert([
          {
            setting_key: CANTEEN_DAILY_MENU_KEY,
            setting_value: '[]',
            updated_at: resetTimestamp
          },
          {
            setting_key: CANTEEN_DAILY_MENU_TIMESTAMP_KEY,
            setting_value: resetTimestamp,
            updated_at: resetTimestamp
          }
        ], { onConflict: 'setting_key' }).then(() => {}, () => {});

        setTimeout(() => {
          window.dispatchEvent(new Event('canteen_daily_menu_updated'));
          window.dispatchEvent(new Event('canteen_menu_updated'));
          window.dispatchEvent(new Event('canteen_pre_orders_updated'));
          window.dispatchEvent(new Event('canteen_state_updated'));
        }, 0);
        return true;
      }
    }
  } catch {}
  return false;
}

/**
 * Loads the curated menu item IDs, automatically resetting to [] if pre-order schedule cutoff has passed.
 */
export function getCuratedDailyMenu(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const rawMenu = localStorage.getItem(CANTEEN_DAILY_MENU_KEY);
    if (!rawMenu) return [];

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(rawMenu);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Check expiration against Pre-Order schedule cutoff threshold
    if (isDailyMenuExpired()) {
      localStorage.setItem(CANTEEN_DAILY_MENU_KEY, '[]');
      localStorage.setItem(CANTEEN_DAILY_MENU_TIMESTAMP_KEY, new Date().toISOString());
      
      // Also push reset to Cloud so cloud does not hold stale items
      supabase.from('app_settings').upsert([
        {
          setting_key: CANTEEN_DAILY_MENU_KEY,
          setting_value: '[]',
          updated_at: new Date().toISOString()
        },
        {
          setting_key: CANTEEN_DAILY_MENU_TIMESTAMP_KEY,
          setting_value: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'setting_key' }).then(() => {}, () => {});

      setTimeout(() => {
        window.dispatchEvent(new Event('canteen_daily_menu_updated'));
        window.dispatchEvent(new Event('canteen_menu_updated'));
        window.dispatchEvent(new Event('canteen_state_updated'));
      }, 0);
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

/**
 * Loads active pre-orders, automatically filtering out orders that passed the daily 3:00 reset.
 */
export function getCleanActivePreOrders(): any[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(CANTEEN_PRE_ORDERS_KEY);
    if (!raw) return [];

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Filter out orders that passed the daily 3:00 reset boundary
    const active = parsed.filter(order => {
      if (!order || !order.timestamp) return false;
      return !isTimestampPastResetThreshold(order.timestamp);
    });

    if (active.length !== parsed.length) {
      localStorage.setItem(CANTEEN_PRE_ORDERS_KEY, JSON.stringify(active));
      supabase.from('app_settings').upsert({
        setting_key: CANTEEN_PRE_ORDERS_KEY,
        setting_value: JSON.stringify(active),
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' }).then(() => {}, () => {});

      setTimeout(() => {
        window.dispatchEvent(new Event('canteen_pre_orders_updated'));
        window.dispatchEvent(new Event('canteen_state_updated'));
      }, 0);
    }

    return active;
  } catch {
    return [];
  }
}

/**
 * Saves newly curated menu item IDs with fresh timestamp so it remains active until the next 3:00 reset.
 * Syncs localStorage, dispatches local events, and instantly upserts to Cloud 'app_settings'.
 */
export function saveCuratedDailyMenu(itemIds: string[]): void {
  try {
    const timestamp = new Date().toISOString();
    localStorage.setItem(CANTEEN_DAILY_MENU_KEY, JSON.stringify(itemIds));
    localStorage.setItem(CANTEEN_DAILY_MENU_TIMESTAMP_KEY, timestamp);
    setTimeout(() => {
      window.dispatchEvent(new Event('canteen_daily_menu_updated'));
      window.dispatchEvent(new Event('canteen_menu_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
    }, 0);

    // Directly push to Cloud Supabase app_settings table so it persists immediately
    supabase
      .from('app_settings')
      .upsert([
        {
          setting_key: CANTEEN_DAILY_MENU_KEY,
          setting_value: JSON.stringify(itemIds),
          updated_at: timestamp
        },
        {
          setting_key: CANTEEN_DAILY_MENU_TIMESTAMP_KEY,
          setting_value: timestamp,
          updated_at: timestamp
        }
      ], { onConflict: 'setting_key' })
      .then(
        ({ error }) => {
          if (error) console.warn('Failed to push daily menu to cloud:', error);
        },
        (err) => console.warn('Network error pushing daily menu to cloud:', err)
      );
  } catch (e) {
    console.error('Failed to save curated daily menu:', e);
  }
}

export interface PreOrderTimeStatus {
  isOpen: boolean;
  isEnabled: boolean;
  startTime: string;
  endTime: string;
  message: string;
  timeRemainingText?: string;
}

export function checkPreOrderWindow(config?: CanteenConfig): PreOrderTimeStatus {
  const cfg = config || getCanteenConfig();
  const isEnabled = cfg.preOrderEnabled !== false;
  const startTime = cfg.preOrderStartTime || '08:00';
  const endTime = cfg.preOrderEndTime || '16:00';

  if (!isEnabled) {
    return {
      isOpen: false,
      isEnabled: false,
      startTime,
      endTime,
      message: 'প্রি-অর্ডার সার্ভিস বর্তমানে বন্ধ আছে (Service Disabled)',
      timeRemainingText: ''
    };
  }

  // Get current minutes in Asia/Dhaka time zone
  let currentMinutes = 0;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    currentMinutes = h * 60 + m;
  } catch {
    const now = new Date();
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM);
  const endMinutes = (isNaN(endH) ? 16 : endH) * 60 + (isNaN(endM) ? 0 : endM);

  let isOpen = false;
  let timeRemainingText = '';

  if (startMinutes <= endMinutes) {
    // Normal daytime window (e.g. 08:00 to 16:00)
    isOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    if (isOpen) {
      const diff = endMinutes - currentMinutes;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      timeRemainingText = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
    }
  } else {
    // Overnight window (e.g. 18:00 to 08:00)
    isOpen = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    if (isOpen) {
      const diff = currentMinutes >= startMinutes 
        ? (24 * 60 - currentMinutes + endMinutes)
        : (endMinutes - currentMinutes);
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      timeRemainingText = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
    }
  }

  let message = '';
  if (isOpen) {
    message = `Pre-Order is OPEN (${startTime} - ${endTime})`;
  } else {
    message = `Pre-Order is CLOSED (${startTime} - ${endTime})`;
  }

  return {
    isOpen,
    isEnabled,
    startTime,
    endTime,
    message,
    timeRemainingText
  };
}

const STORAGE_KEY = 'canteen_settings';
const RESOLVED_CACHE_KEY = 'canteen_image_resolutions';

// Pre-seeded known Google Photos links
const KNOWN_RESOLUTIONS: Record<string, string> = {
  'https://photos.app.goo.gl/ydicbnTyNZqrN1zT9': 'https://lh3.googleusercontent.com/pw/AP1GczPXDD5Dohq-6TWemgeYREoimsS-iXc6KjQoxxRgI0hjRf2tESul2P6eQYmPbFDBUzcP7tRKaBH8HkHHoBqJb83Ng8bbo5mKFhfT4YkiEcEVrCc3Nd39=s800'
};

let memoryResolvedCache: Record<string, string> | null = null;

function getResolvedCache(): Record<string, string> {
  if (memoryResolvedCache) return memoryResolvedCache;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(RESOLVED_CACHE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    memoryResolvedCache = { ...KNOWN_RESOLUTIONS, ...parsed };
    return memoryResolvedCache;
  } catch {
    memoryResolvedCache = { ...KNOWN_RESOLUTIONS };
    return memoryResolvedCache;
  }
}

function setResolvedCache(url: string, resolvedUrl: string) {
  try {
    const cache = getResolvedCache();
    cache[url] = resolvedUrl;
    memoryResolvedCache = cache;
    if (typeof window !== 'undefined') {
      localStorage.setItem(RESOLVED_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {}
}

/**
 * Asynchronously resolves shortened or album links (such as https://photos.app.goo.gl/...)
 * into direct CDN image URLs using the server resolver.
 */
export async function fetchDirectImageUrl(url: string): Promise<string> {
  if (!url) return '';
  const cleaned = url.trim();

  // If already a direct image format or data URI:
  if (cleaned.startsWith('data:image') || cleaned.endsWith('.png') || cleaned.endsWith('.jpg') || cleaned.endsWith('.jpeg') || cleaned.endsWith('.webp')) {
    // Check if it's not a webpage URL
    if (!cleaned.includes('photos.app.goo.gl') && !cleaned.includes('photos.google.com/share')) {
      return cleaned;
    }
  }

  // Check cache first
  const cache = getResolvedCache();
  if (cache[cleaned]) {
    return cache[cleaned];
  }

  // Google Drive
  const driveMatch = cleaned.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|.*[?&]id=([a-zA-Z0-9_-]+))/);
  if (driveMatch) {
    const fileId = driveMatch[1] || driveMatch[2];
    if (fileId) {
      const direct = `https://lh3.googleusercontent.com/d/${fileId}`;
      setResolvedCache(cleaned, direct);
      return direct;
    }
  }

  // For photos.app.goo.gl or any web page URL
  try {
    const res = await fetch(`/api/resolve-image-url?url=${encodeURIComponent(cleaned)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.resolvedUrl && data.resolvedUrl !== cleaned) {
        setResolvedCache(cleaned, data.resolvedUrl);
        return data.resolvedUrl;
      }
    }
  } catch (e) {
    console.warn('Failed to resolve image URL on server:', e);
  }

  return cleaned;
}

/**
 * Resolves standard image URLs including Google Photos, Google Drive, PostImg, Imgur, etc.
 * Immediately returns cached resolution or triggers background resolution if needed.
 */
export function resolveImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  let cleaned = url.trim();

  // 1. Google Drive direct link conversion
  const driveMatch = cleaned.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|.*[?&]id=([a-zA-Z0-9_-]+))/);
  if (driveMatch) {
    const fileId = driveMatch[1] || driveMatch[2];
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // 2. Check cached resolution for Google Photos or other shareable links
  const cache = getResolvedCache();
  if (cache[cleaned]) {
    return cache[cleaned];
  }

  // 3. If it is a photos.app.goo.gl or photos.google.com/share link, trigger background resolution
  if (cleaned.includes('photos.app.goo.gl') || cleaned.includes('photos.google.com/share')) {
    fetchDirectImageUrl(cleaned).then((resolved) => {
      if (resolved && resolved !== cleaned) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('canteen_settings_updated', { detail: getCanteenConfig() }));
        }, 0);
      }
    });
  }

  return cleaned;
}

export function getCanteenConfig(): CanteenConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CANTEEN_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CANTEEN_CONFIG, ...parsed };
  } catch (e) {
    console.error('Failed to load canteen settings from storage:', e);
    return DEFAULT_CANTEEN_CONFIG;
  }
}

/**
 * Fetch settings from Cloud Supabase 'app_settings' table (setting_key: 'canteen_settings').
 * Syncs local storage and broadcasts updates in real-time.
 */
export async function fetchCanteenConfigFromCloud(): Promise<CanteenConfig> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'canteen_settings')
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      const updated: CanteenConfig = { ...DEFAULT_CANTEEN_CONFIG, ...parsed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('canteen_settings_updated', { detail: updated }));
      }, 0);
      return updated;
    }
  } catch (e) {
    console.warn('Could not pull canteen settings from cloud:', e);
  }
  return getCanteenConfig();
}

/**
 * Save settings to both localStorage and Cloud Supabase 'app_settings' table.
 */
export function saveCanteenConfig(config: Partial<CanteenConfig>): CanteenConfig {
  try {
    const current = getCanteenConfig();
    const updated: CanteenConfig = { ...current, ...config };

    // Pre-order active window and daily menu reset times are separate settings
    if (config.preOrderStartTime !== undefined) {
      updated.preOrderStartTime = config.preOrderStartTime;
    }
    if (config.preOrderEndTime !== undefined) {
      updated.preOrderEndTime = config.preOrderEndTime;
    }
    if (config.dailyResetTime !== undefined) {
      updated.dailyResetTime = config.dailyResetTime;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('canteen_settings_updated', { detail: updated }));
      window.dispatchEvent(new Event('storage'));
    }, 0);

    // Check if new schedule triggers an immediate menu reset
    checkAndEnforceDailyMenuReset(false, updated);

    // Async push to Supabase app_settings table for Cloud persistence
    supabase
      .from('app_settings')
      .upsert({
        setting_key: 'canteen_settings',
        setting_value: JSON.stringify(updated),
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' })
      .then(
        ({ error }) => {
          if (error) {
            console.warn('Failed to sync canteen_settings to Cloud app_settings:', error);
          }
        },
        (err) => {
          console.warn('Network error saving to cloud app_settings:', err);
        }
      );

    return updated;
  } catch (e) {
    console.error('Failed to save canteen settings:', e);
    return DEFAULT_CANTEEN_CONFIG;
  }
}

/**
 * Initialize real-time listener on app_settings for canteen_settings changes.
 */
export function subscribeToCanteenSettingsRealtime(onUpdate?: (cfg: CanteenConfig) => void): () => void {
  // 1. Initial pull from cloud
  fetchCanteenConfigFromCloud().then((cfg) => {
    if (onUpdate) onUpdate(cfg);
  });

  // 2. Real-time Supabase postgres_changes channel
  const channel = supabase
    .channel('canteen_settings_live_sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_settings',
        filter: 'setting_key=eq.canteen_settings'
      },
      (payload: any) => {
        if (payload?.new?.setting_value) {
          try {
            const parsed = JSON.parse(payload.new.setting_value);
            const updated: CanteenConfig = { ...DEFAULT_CANTEEN_CONFIG, ...parsed };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('canteen_settings_updated', { detail: updated }));
            if (onUpdate) onUpdate(updated);
          } catch (err) {
            console.error('Failed to parse realtime canteen settings:', err);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

