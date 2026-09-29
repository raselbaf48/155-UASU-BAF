const STORAGE_KEY = 'user_custom_disposals_global';
const DELETED_KEY = 'user_deleted_custom_disposals_global';

function getDeletedDisposals(): Set<string> {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: string) => {
          if (typeof item === 'string' && item.trim()) {
            set.add(item.trim().toLowerCase());
          }
        });
      }
    }
  } catch {}
  return set;
}

export function getSavedCustomDisposals(): string[] {
  const result = new Set<string>();
  const deleted = getDeletedDisposals();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          const s = typeof item === 'string' ? item.trim() : (item?.customTitle || item?.label || '').trim();
          if (s && s !== '✨ Custom...' && s.toLowerCase() !== 'custom' && !deleted.has(s.toLowerCase())) {
            result.add(s);
          }
        });
      }
    }
    // Check legacy keys only if not explicitly deleted
    const legacyKeys = [
      'parade_historical_custom',
      'nc_historical_custom',
      'flg_wg_historical_custom',
      'flg_wg_saved_disposals_v4',
    ];
    legacyKeys.forEach((k) => {
      const leg = localStorage.getItem(k);
      if (leg) {
        const parsed = JSON.parse(leg);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            const s = typeof item === 'string' ? item.trim() : (item?.customTitle || item?.label || '').trim();
            if (s && s !== '✨ Custom...' && s.toLowerCase() !== 'custom' && !deleted.has(s.toLowerCase())) {
              result.add(s);
            }
          });
        }
      }
    });
  } catch {}
  return Array.from(result);
}

export function saveCustomDisposal(title: string, forceRecreate = false): string[] {
  const trimmed = title.trim();
  if (!trimmed || trimmed === '✨ Custom...' || trimmed.toLowerCase() === 'custom') {
    return getSavedCustomDisposals();
  }

  const deleted = getDeletedDisposals();
  if (deleted.has(trimmed.toLowerCase())) {
    if (!forceRecreate) {
      // Do not resurrect automatically from background/cache calls
      return getSavedCustomDisposals();
    }
    // Explicit user action: un-blacklist
    try {
      deleted.delete(trimmed.toLowerCase());
      localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deleted)));
    } catch {}
  }

  const current = getSavedCustomDisposals();
  if (!current.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
    const next = [...current, trimmed];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new CustomEvent('baf_custom_disposals_updated'));
    return next;
  }
  return current;
}

export function removeSavedCustomDisposal(title: string): string[] {
  const trimmed = title.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) return getSavedCustomDisposals();

  // 1. Add to deleted blacklist permanently
  try {
    const deleted = getDeletedDisposals();
    deleted.add(lower);
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deleted)));
  } catch {}

  // 2. Remove from STORAGE_KEY
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const next = parsed.filter((item: any) => {
          const s = typeof item === 'string' ? item.trim() : (item?.customTitle || item?.label || '').trim();
          return s.toLowerCase() !== lower;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    }
  } catch {}

  // 3. Clean legacy keys so they don't hold the deleted item
  const legacyKeys = [
    'parade_historical_custom',
    'nc_historical_custom',
    'flg_wg_historical_custom',
    'flg_wg_saved_disposals_v4',
    'savedDisposalKeys_Parade',
    'savedDisposalKeys_NC',
  ];
  legacyKeys.forEach((k) => {
    try {
      const leg = localStorage.getItem(k);
      if (leg) {
        const parsed = JSON.parse(leg);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((item: any) => {
            const s = typeof item === 'string' ? item.trim() : (item?.customTitle || item?.label || '').trim();
            return s.toLowerCase() !== lower;
          });
          localStorage.setItem(k, JSON.stringify(cleaned));
        }
      }
    } catch {}
  });

  // 4. Clean all 'baf_duty_distribution_disposals_' keys in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('baf_duty_distribution_disposals_')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            let changed = false;
            Object.keys(parsed).forEach(airmanId => {
              if (parsed[airmanId] && typeof parsed[airmanId] === 'string' && parsed[airmanId].trim().toLowerCase() === lower) {
                parsed[airmanId] = '-';
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          }
        }
      }
    }
  } catch {}

  // Dispatch global event so all components react immediately
  window.dispatchEvent(new CustomEvent('baf_custom_disposals_updated'));

  return getSavedCustomDisposals();
}
