import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

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

export const DEFAULT_CURRENT_APP = {
  versionCode: 1,
  versionName: '1.0.0',
};

const SKIPPED_VERSION_STORAGE_KEY = 'baf_skipped_version_code';

export function isRunningInApk(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return true;
    if ((window as any).Capacitor?.isNative) return true;
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') return true;
    if (window.location.protocol === 'file:' && window.location.pathname.includes('android_asset')) return true;
    if (window.location.search.includes('force_apk=true') || localStorage.getItem('baf_force_apk_mode') === 'true') return true;
    return false;
  } catch {
    return false;
  }
}

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

export async function fetchLatestAppVersion(): Promise<AppVersionRecord | null> {
  try {
    const raw = localStorage.getItem('baf_latest_app_version');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export async function checkForAppUpdate(options?: { ignoreSkipped?: boolean; forceCheck?: boolean }): Promise<AppUpdateCheckResult> {
  try {
    const isApk = isRunningInApk();
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

export async function openDownloadUrl(apkUrl: string): Promise<boolean> {
  if (!apkUrl) return false;
  try {
    if (Capacitor.isPluginAvailable('Browser')) {
      await Browser.open({ url: apkUrl });
      return true;
    }
  } catch (err) {
    console.warn('[AppUpdate] Browser plugin open failed, using fallback:', err);
  }
  window.open(apkUrl, '_blank', 'noopener,noreferrer');
  return true;
}

export function skipVersionCode(versionCode: number): void {
  localStorage.setItem(SKIPPED_VERSION_STORAGE_KEY, String(versionCode));
}

export function clearSkippedVersion(): void {
  localStorage.removeItem(SKIPPED_VERSION_STORAGE_KEY);
}

export async function publishNewAppVersion(version: Omit<AppVersionRecord, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
  try {
    const record: AppVersionRecord = {
      version_code: version.version_code,
      version_name: version.version_name.trim(),
      apk_url: version.apk_url.trim(),
      release_notes: version.release_notes?.trim() || null,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('baf_latest_app_version', JSON.stringify(record));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to publish new version' };
  }
}

export async function downloadAppUpdate(apkUrl: string): Promise<boolean> {
  return await openDownloadUrl(apkUrl);
}

