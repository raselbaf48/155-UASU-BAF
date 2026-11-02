/**
 * Safe Storage & Quota Management Utility
 * Protects localStorage against QuotaExceededError and prunes redundant/transient data
 */

const warningThrottleMap = new Map<string, number>();

function shouldLogWarning(key: string): boolean {
  const now = Date.now();
  const last = warningThrottleMap.get(key) || 0;
  if (now - last > 60000) {
    warningThrottleMap.set(key, now);
    return true;
  }
  return false;
}

/**
 * Strips massive inline base64 image strings from menu items payload to save ~99% of storage space.
 * Default images are already bundled in DEFAULT_CANTEEN_MENU_ITEMS and restored dynamically on read.
 */
function sanitizePayloadForStorage(key: string, value: string): string {
  if (
    (key === 'canteen_menu_cache' ||
      key === 'canteen_menu_items_list' ||
      key === 'canteen_menu_items_catalog_v1' ||
      key === 'canteen_daily_menu') &&
    value.length > 5000 &&
    value.includes('data:')
  ) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const stripped = parsed.map((item: any) => {
          if (!item || typeof item !== 'object') return item;
          const copy = { ...item };
          if (typeof copy.DP === 'string' && (copy.DP.startsWith('data:') || copy.DP.length > 200)) delete copy.DP;
          if (typeof copy.img === 'string' && (copy.img.startsWith('data:') || copy.img.length > 200)) delete copy.img;
          if (typeof copy.image === 'string' && (copy.image.startsWith('data:') || copy.image.length > 200)) delete copy.image;
          return copy;
        });
        return JSON.stringify(stripped);
      }
    } catch {}
  }
  return value;
}

export function pruneNonEssentialStorage(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let freedCount = 0;

  try {
    // 1. Immediately remove baf_sync_logs from localStorage (it belongs in memory / sessionStorage)
    if (window.localStorage.getItem('baf_sync_logs')) {
      window.localStorage.removeItem('baf_sync_logs');
      freedCount++;
    }

    // 2. Prune duplicate individual canteen member caches, redundant menu catalog copy, and legacy temporary storage
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (key.startsWith('canteen_member_') ||
          key.startsWith('baf_preview_') ||
          key.startsWith('baf_temp_') ||
          key.startsWith('baf_airfield_') ||
          key === 'canteen_menu_items_catalog_v1') // redundant with canteen_menu_items_list & canteen_menu_cache
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

    // 3. Compact existing menu caches if they contain massive base64 images
    ['canteen_menu_cache', 'canteen_menu_items_list', 'canteen_daily_menu'].forEach((menuKey) => {
      try {
        const raw = window.localStorage.getItem(menuKey);
        if (raw && raw.length > 20000 && raw.includes('data:')) {
          const sanitized = sanitizePayloadForStorage(menuKey, raw);
          if (sanitized.length < raw.length) {
            window.localStorage.setItem(menuKey, sanitized);
            freedCount++;
          }
        }
      } catch {}
    });

    // 4. Trim baf_user_login_history to most recent 20 entries
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

    // 5. Trim canteen_bill_import_history and canteen_pos_import_history to most recent 2 entries
    try {
      const rawImportHistory = window.localStorage.getItem('canteen_bill_import_history');
      if (rawImportHistory) {
        const parsed = JSON.parse(rawImportHistory);
        if (Array.isArray(parsed) && parsed.length > 2) {
          window.localStorage.setItem('canteen_bill_import_history', JSON.stringify(parsed.slice(0, 2)));
          freedCount++;
        }
      }
      const rawPosHistory = window.localStorage.getItem('canteen_pos_import_history');
      if (rawPosHistory) {
        const parsed = JSON.parse(rawPosHistory);
        if (Array.isArray(parsed) && parsed.length > 2) {
          window.localStorage.setItem('canteen_pos_import_history', JSON.stringify(parsed.slice(0, 2)));
          freedCount++;
        }
      }
    } catch {}

    // 6. Prune baf_presence if large
    try {
      const rawPresence = window.localStorage.getItem('baf_presence');
      if (rawPresence && rawPresence.length > 30000) {
        window.localStorage.removeItem('baf_presence');
        freedCount++;
      }
    } catch {}
  } catch (err) {
    if (shouldLogWarning('prune_exception')) {
      console.warn('[SafeStorage] Prune exception:', err);
    }
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

  const sanitizedValue = sanitizePayloadForStorage(key, value);

  try {
    window.localStorage.setItem(key, sanitizedValue);
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
      if (shouldLogWarning(key)) {
        console.warn(`[SafeStorage] Quota exceeded for "${key}". Pruning non-essential cache...`);
      }
      pruneNonEssentialStorage();
      try {
        window.localStorage.setItem(key, sanitizedValue);
        return true;
      } catch (retryErr) {
        if (shouldLogWarning(key + '_failed')) {
          console.warn(`[SafeStorage] Retry failed for "${key}". Skipping write to prevent crash.`);
        }
        return false;
      }
    }

    if (shouldLogWarning(key + '_generic')) {
      console.warn(`[SafeStorage] Failed to save key "${key}":`, err);
    }
    return false;
  }
}

/**
 * Global protection hook to patch Storage.prototype.setItem
 * Guarantees no uncaught QuotaExceededError ever crashes the UI
 */
export function installSafeStorageProtection(): void {
  if (typeof window === 'undefined') return;

  // Run cleanup once on load to purge obsolete keys like baf_sync_logs and old member keys
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

    // Automatically strip bulky data-URI images from menu-related keys
    const sanitizedValue = this === window.localStorage ? sanitizePayloadForStorage(key, value) : value;

    try {
      originalStorageSetItem.call(this, key, sanitizedValue);
    } catch (err: any) {
      const isQuotaError =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014 ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

      if (isQuotaError && this === window.localStorage) {
        if (shouldLogWarning(key)) {
          console.warn(`[SafeStorage Global] Quota exceeded on setItem('${key}'). Auto-pruning...`);
        }
        pruneNonEssentialStorage();
        try {
          originalStorageSetItem.call(this, key, sanitizedValue);
          return;
        } catch (retryErr) {
          if (shouldLogWarning(key + '_suppressed')) {
            console.warn(`[SafeStorage Global] Could not save '${key}' after pruning. Suppressed.`);
          }
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
