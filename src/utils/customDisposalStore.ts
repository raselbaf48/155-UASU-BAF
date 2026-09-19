const STORAGE_KEY = 'user_custom_disposals_global';

export function getSavedCustomDisposals(): string[] {
  const result = new Set<string>();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          const s = typeof item === 'string' ? item.trim() : (item?.customTitle || item?.label || '').trim();
          if (s && s !== '✨ Custom...' && s.toLowerCase() !== 'custom') {
            result.add(s);
          }
        });
      }
    }
    // Also check legacy keys
    ['parade_historical_custom', 'nc_historical_custom'].forEach((k) => {
      const leg = localStorage.getItem(k);
      if (leg) {
        const parsed = JSON.parse(leg);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            const s = typeof item === 'string' ? item.trim() : (item?.customTitle || item?.label || '').trim();
            if (s && s !== '✨ Custom...' && s.toLowerCase() !== 'custom') {
              result.add(s);
            }
          });
        }
      }
    });
  } catch {}
  return Array.from(result);
}

export function saveCustomDisposal(title: string): string[] {
  const trimmed = title.trim();
  if (!trimmed || trimmed === '✨ Custom...' || trimmed.toLowerCase() === 'custom') {
    return getSavedCustomDisposals();
  }
  const current = getSavedCustomDisposals();
  if (!current.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
    const next = [...current, trimmed];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    return next;
  }
  return current;
}

export function removeSavedCustomDisposal(title: string): string[] {
  const current = getSavedCustomDisposals();
  const next = current.filter(t => t.toLowerCase() !== title.trim().toLowerCase());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
