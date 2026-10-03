import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabase';

export interface AppVersionRecord {
  id?: number;
  version_code: number;
  version_name: string;
  apk_url: string;
  release_notes?: string | null;
  created_at?: string;
}

export interface AppUpdateCheckResult {
  hasUpdate: boolean;
  currentVersionCode: number;
  currentVersionName: string;
  latestVersion: AppVersionRecord | null;
  error?: string | null;
}

// Fallback version if running in pure browser / dev environment
export const DEFAULT_CURRENT_APP = {
  versionCode: 1,
  versionName: '1.0.0',
};

const SKIPPED_VERSION_STORAGE_KEY = 'baf_skipped_version_code';

/**
 * Detects whether the application is running inside an installed Android APK / Capacitor native app,
 * rather than in a web browser / website.
 */
export function isRunningInApk(): boolean {
  try {
    if (typeof window === 'undefined') return false;

    // 1. Capacitor native platform detection (Capacitor.isNativePlatform() is true ONLY inside native APK/app)
    if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
      return true;
    }

    // 2. Global window Capacitor native bridge check
    if ((window as any).Capacitor && typeof (window as any).Capacitor.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform()) {
      return true;
    }

    // 3. Native custom scheme (Capacitor Android native app loads from capacitor://localhost)
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') {
      return true;
    }

    // 4. Android file asset origin
    if (window.location.protocol === 'file:' && window.location.pathname.includes('android_asset')) {
      return true;
    }

    // 5. Manual override for developer testing / previewing APK mode only
    if (window.location.search.includes('force_apk=true') || localStorage.getItem('baf_force_apk_mode') === 'true') {
      return true;
    }

    // Otherwise, this is running in a web browser (Website)
    return false;
  } catch {
    return false;
  }
}

/**
 * Retrieves current installed app info via Capacitor App plugin,
 * or falls back to standard client version.
 */
export async function getCurrentAppVersion(): Promise<{ versionCode: number; versionName: string }> {
  try {
    if (Capacitor.isPluginAvailable('App')) {
      const info = await App.getInfo();
      const parsedBuild = parseInt(info.build, 10);
      return {
        versionCode: !isNaN(parsedBuild) && parsedBuild > 0 ? parsedBuild : DEFAULT_CURRENT_APP.versionCode,
        versionName: info.version || DEFAULT_CURRENT_APP.versionName,
      };
    }
  } catch (err) {
    console.warn('[AppUpdate] Could not retrieve app version from Capacitor App plugin:', err);
  }

  // Check if saved in localStorage (e.g. for testing)
  const savedCode = localStorage.getItem('baf_app_current_version_code');
  const savedName = localStorage.getItem('baf_app_current_version_name');
  if (savedCode) {
    const parsed = parseInt(savedCode, 10);
    if (!isNaN(parsed)) {
      return {
        versionCode: parsed,
        versionName: savedName || DEFAULT_CURRENT_APP.versionName,
      };
    }
  }

  return DEFAULT_CURRENT_APP;
}

/**
 * Fetches the latest version record from the Supabase `app_versions` table.
 */
export async function fetchLatestAppVersion(): Promise<AppVersionRecord | null> {
  try {
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('version_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[AppUpdate] Error fetching from app_versions:', error);
      return null;
    }

    return data as AppVersionRecord | null;
  } catch (err) {
    console.error('[AppUpdate] Failed to query app_versions table:', err);
    return null;
  }
}

/**
 * Compares current version with the latest version in Supabase.
 * NOTE: Returns hasUpdate: false on websites so that update popups NEVER show on web.
 */
export async function checkForAppUpdate(options?: { ignoreSkipped?: boolean; forceCheck?: boolean }): Promise<AppUpdateCheckResult> {
  try {
    const isApk = isRunningInApk();
    // Do NOT check or show update system on the Website (only on APK) unless explicitly forced
    if (!isApk && !options?.forceCheck) {
      return {
        hasUpdate: false,
        currentVersionCode: DEFAULT_CURRENT_APP.versionCode,
        currentVersionName: DEFAULT_CURRENT_APP.versionName,
        latestVersion: null,
      };
    }

    const current = await getCurrentAppVersion();
    const latest = await fetchLatestAppVersion();

    if (!latest) {
      return {
        hasUpdate: false,
        currentVersionCode: current.versionCode,
        currentVersionName: current.versionName,
        latestVersion: null,
      };
    }

    const isNewer = Number(latest.version_code) > Number(current.versionCode);

    // Check if the user previously skipped this version
    if (isNewer && !options?.ignoreSkipped) {
      const skippedCode = localStorage.getItem(SKIPPED_VERSION_STORAGE_KEY);
      if (skippedCode && parseInt(skippedCode, 10) === latest.version_code) {
        return {
          hasUpdate: false,
          currentVersionCode: current.versionCode,
          currentVersionName: current.versionName,
          latestVersion: latest,
        };
      }
    }

    return {
      hasUpdate: isNewer,
      currentVersionCode: current.versionCode,
      currentVersionName: current.versionName,
      latestVersion: latest,
    };
  } catch (err: any) {
    console.error('[AppUpdate] Error during update check:', err);
    return {
      hasUpdate: false,
      currentVersionCode: DEFAULT_CURRENT_APP.versionCode,
      currentVersionName: DEFAULT_CURRENT_APP.versionName,
      latestVersion: null,
      error: err?.message || 'Update check failed',
    };
  }
}

/**
 * Opens the APK download URL using Capacitor's Browser plugin.
 */
export async function downloadAppUpdate(apkUrl: string): Promise<boolean> {
  if (!apkUrl) {
    console.error('[AppUpdate] No apk_url provided to download');
    return false;
  }

  try {
    console.log('[AppUpdate] Opening APK URL via Capacitor Browser:', apkUrl);
    // Capacitor Browser plugin
    await Browser.open({
      url: apkUrl,
      windowName: '_blank',
      presentationStyle: 'popover',
    });
    return true;
  } catch (err) {
    console.warn('[AppUpdate] Capacitor Browser.open failed, falling back to window.open:', err);
    try {
      window.open(apkUrl, '_blank');
      return true;
    } catch (winErr) {
      console.error('[AppUpdate] Fallback window.open also failed:', winErr);
      return false;
    }
  }
}

/**
 * Remember skipped version code
 */
export function skipVersionCode(versionCode: number): void {
  localStorage.setItem(SKIPPED_VERSION_STORAGE_KEY, String(versionCode));
}

/**
 * Clear skipped version code
 */
export function clearSkippedVersion(): void {
  localStorage.removeItem(SKIPPED_VERSION_STORAGE_KEY);
}

/**
 * Helper to insert a new version into `app_versions` table (for Admin release management)
 */
export async function publishNewAppVersion(version: Omit<AppVersionRecord, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('app_versions').insert([
      {
        version_code: version.version_code,
        version_name: version.version_name.trim(),
        apk_url: version.apk_url.trim(),
        release_notes: version.release_notes?.trim() || null,
      },
    ]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to publish new version' };
  }
}
