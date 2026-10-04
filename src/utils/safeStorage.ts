/**
 * Safe Storage & Quota Management Utility
 * Protects localStorage against QuotaExceededError and prunes redundant/transient data
 */

export function pruneNonEssentialStorage(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let freedCount = 0;

  try {
    // 1. Immediately remove baf_sync_logs from localStorage (it belongs in memory / sessionStorage)
    if (window.localStorage.getItem('baf_sync_logs')) {
      window.localStorage.removeItem('baf_sync_logs');
      freedCount++;
    }

    // 2. Prune duplicate individual canteen member caches and legacy airfield SAIA storage
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (key.startsWith('canteen_member_') ||
          key.startsWith('baf_preview_') ||
          key.startsWith('baf_temp_') ||
          key.startsWith('baf_airfield_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
        freedCount++;
      } catch {}
    });

    // 3. Trim baf_user_login_history to most recent 20 entries
    try {
      const rawLogins = window.localStorage.getItem('baf_user_login_history');
      if (rawLogins) {
        const parsed = JSON.parse(rawLogins);
        if (Array.isArray(parsed) && parsed.length > 20) {
          window.localStorage.setItem('baf_user_login_history', JSON.stringify(parsed.slice(0, 20)));
          freedCount++;
        }
      }
    } catch {}

    // 4. Trim canteen_bill_import_history to most recent 3 entries
    try {
      const rawImportHistory = window.localStorage.getItem('canteen_bill_import_history');
      if (rawImportHistory) {
        const parsed = JSON.parse(rawImportHistory);
        if (Array.isArray(parsed) && parsed.length > 3) {
          window.localStorage.setItem('canteen_bill_import_history', JSON.stringify(parsed.slice(0, 3)));
          freedCount++;
        }
      }
    } catch {}

    // 5. Prune baf_presence if large
    try {
      const rawPresence = window.localStorage.getItem('baf_presence');
      if (rawPresence && rawPresence.length > 50000) {
        window.localStorage.removeItem('baf_presence');
        freedCount++;
      }
    } catch {}
  } catch (err) {
    console.warn('[SafeStorage] Prune exception:', err);
  }

  return freedCount;
}

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  // Never write sync logs to localStorage
  if (key === 'baf_sync_logs') {
    try {
      window.sessionStorage.setItem('baf_sync_logs', value);
    } catch {}
    return true;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    // Check for QuotaExceededError
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`[SafeStorage] Quota exceeded for "${key}". Pruning non-essential cache...`);
      pruneNonEssentialStorage();
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn(`[SafeStorage] Retry failed for "${key}". Skipping write to prevent crash.`);
        return false;
      }
    }

    console.warn(`[SafeStorage] Failed to save key "${key}":`, err);
    return false;
  }
}

/**
 * Global protection hook to patch Storage.prototype.setItem
 * Guarantees no uncaught QuotaExceededError ever crashes the UI
 */
export function installSafeStorageProtection(): void {
  if (typeof window === 'undefined') return;

  // Run cleanup once on load to purge obsolete keys like baf_sync_logs
  pruneNonEssentialStorage();

  const originalStorageSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    // Special handling for baf_sync_logs: redirect localStorage writes to sessionStorage
    if (this === window.localStorage && key === 'baf_sync_logs') {
      try {
        window.sessionStorage.setItem('baf_sync_logs', value);
      } catch {}
      try {
        originalStorageSetItem.call(this, 'baf_sync_logs', '[]');
      } catch {}
      return;
    }

    try {
      originalStorageSetItem.call(this, key, value);
    } catch (err: any) {
      const isQuotaError =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014 ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

      if (isQuotaError && this === window.localStorage) {
        console.warn(`[SafeStorage Global] Quota exceeded on setItem('${key}'). Auto-pruning...`);
        pruneNonEssentialStorage();
        try {
          originalStorageSetItem.call(this, key, value);
          return;
        } catch (retryErr) {
          console.warn(`[SafeStorage Global] Could not save '${key}' after pruning. Suppressed.`);
          return;
        }
      }

      // Re-throw non-quota or non-localStorage errors if not quota
      if (!isQuotaError) {
        throw err;
      }
    }
  };
}
