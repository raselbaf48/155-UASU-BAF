import { supabase } from '../../../supabase';

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
}

export const DEFAULT_CANTEEN_CONFIG: CanteenConfig = {
  name: '🍽️ Cafe UAV 🍽️',
  logoUrl: 'https://i.postimg.cc/gcqqCXCL/Logo-(1).png',
  managerName: 'LAC Nishad',
  adminImage: 'https://lh3.googleusercontent.com/pw/AP1GczPXDD5Dohq-6TWemgeYREoimsS-iXc6KjQoxxRgI0hjRf2tESul2P6eQYmPbFDBUzcP7tRKaBH8HkHHoBqJb83Ng8bbo5mKFhfT4YkiEcEVrCc3Nd39=s800',
  phone: '+880 1601-676760',
  password: '0000',
  managerBdNo: '',
  footer: 'Official Canteen of UAV | Integrity and Service',
  preOrderEnabled: true,
  preOrderStartTime: '18:00',
  preOrderEndTime: '08:00'
};

export const CANTEEN_DAILY_MENU_KEY = 'canteen_daily_menu';
export const CANTEEN_DAILY_MENU_TIMESTAMP_KEY = 'canteen_daily_menu_updated_at';

/**
 * Checks if the daily curated menu has passed the 12:00 PM (noon) auto-reset threshold.
 * Everyday at 12:00 PM, curated menu automatically resets.
 * If current time >= 12:00 PM and the menu was set before today 12:00 PM, it is expired.
 * If current time < 12:00 PM and the menu was set before yesterday 12:00 PM, it is expired.
 */
export function isDailyMenuExpired(timestampMs?: number): boolean {
  const now = new Date();
  const threshold = new Date(now);
  if (now.getHours() < 12) {
    // If before 12:00 PM today, latest reset was yesterday 12:00 PM
    threshold.setDate(threshold.getDate() - 1);
  }
  threshold.setHours(12, 0, 0, 0);

  let targetTs = timestampMs;
  if (targetTs === undefined) {
    const raw = localStorage.getItem(CANTEEN_DAILY_MENU_TIMESTAMP_KEY);
    targetTs = raw ? new Date(raw).getTime() : 0;
  }

  // If never set or set before the threshold, it is expired
  return !targetTs || targetTs < threshold.getTime();
}

/**
 * Loads the curated menu item IDs, automatically resetting to [] if 12:00 PM threshold has passed.
 */
export function getCuratedDailyMenu(): string[] {
  try {
    const rawMenu = localStorage.getItem(CANTEEN_DAILY_MENU_KEY);
    if (!rawMenu) return [];

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(rawMenu);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Check expiration against daily 12:00 PM threshold
    if (isDailyMenuExpired()) {
      localStorage.setItem(CANTEEN_DAILY_MENU_KEY, '[]');
      localStorage.setItem(CANTEEN_DAILY_MENU_TIMESTAMP_KEY, new Date().toISOString());
      window.dispatchEvent(new Event('canteen_daily_menu_updated'));
      window.dispatchEvent(new Event('canteen_menu_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

/**
 * Saves newly curated menu item IDs with fresh timestamp so it remains active until the next 12:00 PM.
 */
export function saveCuratedDailyMenu(itemIds: string[]): void {
  try {
    localStorage.setItem(CANTEEN_DAILY_MENU_KEY, JSON.stringify(itemIds));
    localStorage.setItem(CANTEEN_DAILY_MENU_TIMESTAMP_KEY, new Date().toISOString());
    window.dispatchEvent(new Event('canteen_daily_menu_updated'));
    window.dispatchEvent(new Event('canteen_menu_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
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
  // Default to 18:00 - 08:00 (Evening 6 PM to Morning 8 AM)
  const startTime = cfg.preOrderStartTime || '18:00';
  const endTime = cfg.preOrderEndTime || '08:00';

  if (!isEnabled) {
    return {
      isOpen: false,
      isEnabled: false,
      startTime,
      endTime,
      message: 'প্রি-অর্ডার সার্ভিস বর্তমানে ম্যানেজার কর্তৃক বন্ধ রয়েছে'
    };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = (isNaN(startH) ? 18 : startH) * 60 + (isNaN(startM) ? 0 : startM);
  const endMinutes = (isNaN(endH) ? 8 : endH) * 60 + (isNaN(endM) ? 0 : endM);

  let isOpen = false;
  let timeRemainingText = '';

  if (startMinutes <= endMinutes) {
    // Normal window within same day
    isOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    if (isOpen) {
      const diff = endMinutes - currentMinutes;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      timeRemainingText = h > 0 ? `${h}h ${m}m remaining` : `${m} minutes remaining`;
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
      timeRemainingText = h > 0 ? `${h} ঘণ্টা ${m} মিনিট বাকি` : `${m} মিনিট বাকি`;
    }
  }

  let message = '';
  if (isOpen) {
    message = `Pre-Order is OPEN (${startTime} - ${endTime})`;
  } else {
    message = `Pre-Order Closed (সক্রিয় সময়: ${startTime} - ${endTime})`;
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

function getResolvedCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(RESOLVED_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...KNOWN_RESOLUTIONS, ...parsed };
  } catch {
    return { ...KNOWN_RESOLUTIONS };
  }
}

function setResolvedCache(url: string, resolvedUrl: string) {
  try {
    const cache = getResolvedCache();
    cache[url] = resolvedUrl;
    localStorage.setItem(RESOLVED_CACHE_KEY, JSON.stringify(cache));
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
        window.dispatchEvent(new CustomEvent('canteen_settings_updated', { detail: getCanteenConfig() }));
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
      window.dispatchEvent(new CustomEvent('canteen_settings_updated', { detail: updated }));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('canteen_settings_updated', { detail: updated }));

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

