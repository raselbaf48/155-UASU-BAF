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
 * Saves the last used portal strictly to local storage of this device.
 */
export function setLastUsedPortal(portal: PortalType): void {
  if (!isValidPortal(portal)) {
    portal = DEFAULT_PORTAL;
  }

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
}

/**
 * Returns local portal preference (never syncs across devices).
 */
export async function syncPortalFromCloud(): Promise<PortalType | null> {
  return getLastUsedPortal();
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
 * Saves the last used ID separately for Office or Canteen portal strictly to Local Storage.
 * Never synced across devices.
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
  } catch (err) {
    console.warn('[portalPreference] Error saving last used id:', err);
  }
}

/**
 * Returns local last used portal IDs (strictly device-specific, never synced to/from cloud).
 */
export async function syncLastUsedIdsFromCloud(): Promise<{ officeId?: string; canteenId?: string }> {
  try {
    const res: { officeId?: string; canteenId?: string } = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      res.officeId = localStorage.getItem(OFFICE_LAST_ID_KEY) || localStorage.getItem('baf_last_used_id') || undefined;
      res.canteenId = localStorage.getItem(CANTEEN_LAST_ID_KEY) || undefined;
    }
    return res;
  } catch {
    return {};
  }
}

