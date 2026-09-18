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
}

export const DEFAULT_CANTEEN_CONFIG: CanteenConfig = {
  name: '🍽️ Cafe UAV 🍽️',
  logoUrl: 'https://i.postimg.cc/gcqqCXCL/Logo-(1).png',
  managerName: 'LAC Nishad',
  adminImage: 'https://lh3.googleusercontent.com/pw/AP1GczPXDD5Dohq-6TWemgeYREoimsS-iXc6KjQoxxRgI0hjRf2tESul2P6eQYmPbFDBUzcP7tRKaBH8HkHHoBqJb83Ng8bbo5mKFhfT4YkiEcEVrCc3Nd39=s800',
  phone: '+880 1601-676760',
  password: '0000',
  managerBdNo: '',
  footer: 'Official Canteen of UAV | Integrity and Service'
};

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

