import { supabase, isSupabaseConfigured } from '../supabase';

export type PortalType = 'Office' | 'Nt Count' | 'Canteen';

export const PORTAL_STORAGE_KEY = 'baf_last_used_login_portal';
export const DEFAULT_PORTAL: PortalType = 'Office';

const VALID_PORTALS: readonly PortalType[] = ['Office', 'Nt Count', 'Canteen'];

/**
 * Validates if a string is a recognized PortalType
 */
export function isValidPortal(portal: any): portal is PortalType {
  return typeof portal === 'string' && VALID_PORTALS.includes(portal as PortalType);
}

/**
 * Checks if the user already has a saved portal preference in local storage.
 * If false, it means this is the first time (should default to 'Office').
 */
export function hasSavedPortalPreference(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const val = localStorage.getItem(PORTAL_STORAGE_KEY);
    return Boolean(val && isValidPortal(val));
  } catch {
    return false;
  }
}

/**
 * Retrieves the last used portal from local storage.
 * If none has been recorded (first time), defaults to 'Office'.
 */
export function getLastUsedPortal(): PortalType {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_PORTAL;
    const val = localStorage.getItem(PORTAL_STORAGE_KEY);
    if (val && isValidPortal(val)) {
      return val;
    }
  } catch (err) {
    console.warn('[portalPreference] Error reading local portal preference:', err);
  }
  return DEFAULT_PORTAL;
}

/**
 * Saves the last used portal to local storage and syncs it to Supabase Cloud ('app_settings').
 * Ensures persistence across browsers, devices, and sessions.
 */
export function setLastUsedPortal(portal: PortalType): void {
  if (!isValidPortal(portal)) {
    portal = DEFAULT_PORTAL;
  }

  // 1. Save to Local Storage immediately
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(PORTAL_STORAGE_KEY, portal);
      window.dispatchEvent(
        new CustomEvent('baf_portal_preference_changed', { detail: { portal } })
      );
    }
  } catch (err) {
    console.warn('[portalPreference] Error saving local portal preference:', err);
  }

  // 2. Non-blocking Cloud Sync to Supabase ('app_settings')
  try {
    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
          await supabase.from('app_settings').upsert(
            {
              setting_key: PORTAL_STORAGE_KEY,
              setting_value: portal,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'setting_key' }
          );
        } catch (cloudErr) {
          console.warn('[portalPreference] Cloud sync skipped or failed:', cloudErr);
        }
      })();
    }
  } catch (err) {
    console.warn('[portalPreference] Error syncing portal to cloud:', err);
  }
}

/**
 * Asynchronously fetches the last used portal preference from Supabase Cloud ('app_settings').
 * If a cloud value exists and local doesn't have one (or differs), syncs to local storage.
 */
export async function syncPortalFromCloud(): Promise<PortalType | null> {
  try {
    // If the device already has a saved portal preference locally, preserve it and do not overwrite from cloud
    if (hasSavedPortalPreference()) {
      return getLastUsedPortal();
    }

    if (!isSupabaseConfigured || !supabase) return null;

    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', PORTAL_STORAGE_KEY)
      .maybeSingle();

    if (error) {
      console.warn('[portalPreference] Failed to fetch portal preference from cloud:', error);
      return null;
    }

    if (data && isValidPortal(data.setting_value)) {
      const cloudPortal = data.setting_value as PortalType;
      if (typeof window !== 'undefined' && window.localStorage) {
        if (!hasSavedPortalPreference()) {
          localStorage.setItem(PORTAL_STORAGE_KEY, cloudPortal);
          window.dispatchEvent(
            new CustomEvent('baf_portal_preference_changed', { detail: { portal: cloudPortal } })
          );
        }
      }
      return cloudPortal;
    }
  } catch (err) {
    console.warn('[portalPreference] Error during cloud sync:', err);
  }
  return null;
}

export const CANTEEN_LAST_ID_KEY = 'baf_canteen_last_used_id';
export const OFFICE_LAST_ID_KEY = 'baf_office_last_used_id';

/**
 * Retrieves the last used member or user ID specifically for the given portal.
 */
export function getLastUsedIdForPortal(portal: PortalType): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    if (portal === 'Canteen') {
      const saved = localStorage.getItem(CANTEEN_LAST_ID_KEY);
      if (saved) return saved;
      const recents = localStorage.getItem('baf_canteen_recent_logins');
      if (recents) {
        const list = JSON.parse(recents);
        if (Array.isArray(list) && list.length > 0) return list[0];
      }
      return '';
    }
    if (portal === 'Office') {
      const saved = localStorage.getItem(OFFICE_LAST_ID_KEY) || localStorage.getItem('baf_last_used_id');
      if (saved) return saved;
      const recents = localStorage.getItem('baf_recent_logins');
      if (recents) {
        const list = JSON.parse(recents);
        if (Array.isArray(list) && list.length > 0) return list[0];
      }
      return '';
    }
  } catch (err) {
    console.warn('[portalPreference] Error reading last used id:', err);
  }
  return '';
}

/**
 * Saves the last used ID separately for Office or Canteen portal to Local and Cloud.
 */
export function saveLastUsedIdForPortal(portal: 'Office' | 'Canteen', id: string): void {
  const clean = id.replace(/^BD\/?/i, '').trim();
  if (!clean) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (portal === 'Canteen') {
        localStorage.setItem(CANTEEN_LAST_ID_KEY, clean);
      } else {
        localStorage.setItem(OFFICE_LAST_ID_KEY, clean);
        localStorage.setItem('baf_last_used_id', clean);
      }
    }
    if (isSupabaseConfigured && supabase) {
      const key = portal === 'Canteen' ? CANTEEN_LAST_ID_KEY : OFFICE_LAST_ID_KEY;
      (async () => {
        try {
          await supabase.from('app_settings').upsert(
            {
              setting_key: key,
              setting_value: clean,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'setting_key' }
          );
        } catch (cloudErr) {
          console.warn('[portalPreference] Cloud sync of ID failed:', cloudErr);
        }
      })();
    }
  } catch (err) {
    console.warn('[portalPreference] Error saving last used id:', err);
  }
}

/**
 * Fetches last used portal IDs from Cloud if not set locally.
 */
export async function syncLastUsedIdsFromCloud(): Promise<{ officeId?: string; canteenId?: string }> {
  try {
    if (!isSupabaseConfigured || !supabase) return {};
    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [CANTEEN_LAST_ID_KEY, OFFICE_LAST_ID_KEY]);

    const res: { officeId?: string; canteenId?: string } = {};
    if (data && Array.isArray(data)) {
      data.forEach((row) => {
        if (row.setting_key === CANTEEN_LAST_ID_KEY && row.setting_value) {
          res.canteenId = row.setting_value;
          if (typeof window !== 'undefined' && !localStorage.getItem(CANTEEN_LAST_ID_KEY)) {
            localStorage.setItem(CANTEEN_LAST_ID_KEY, row.setting_value);
          }
        }
        if (row.setting_key === OFFICE_LAST_ID_KEY && row.setting_value) {
          res.officeId = row.setting_value;
          if (typeof window !== 'undefined' && !localStorage.getItem(OFFICE_LAST_ID_KEY)) {
            localStorage.setItem(OFFICE_LAST_ID_KEY, row.setting_value);
          }
        }
      });
    }
    return res;
  } catch {
    return {};
  }
}

