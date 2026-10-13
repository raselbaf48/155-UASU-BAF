/**
 * Lightweight Canteen Members Cache.
 * Synchronous, zero-dependency local storage and memory cache.
 */

let inMemoryMembersCache: any[] | null = null;

export function deduplicateCanteenMembers(members: any[]): any[] {
  if (!Array.isArray(members)) return [];
  const seen = new Set<string>();
  const result: any[] = [];
  for (const m of members) {
    if (!m) continue;
    const cleanBd = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '').toLowerCase();
    const key = cleanBd || String(m.airman_id || m.id || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(m);
  }
  return result;
}

/**
 * Returns cached members synchronously (0ms delay).
 * Checks memory first, then localStorage.
 */
export function getCanteenMembersCache(): any[] {
  if (inMemoryMembersCache && inMemoryMembersCache.length > 0) {
    return deduplicateCanteenMembers(inMemoryMembersCache);
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('canteen_members_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = deduplicateCanteenMembers(parsed);
        inMemoryMembersCache = clean;
        return clean;
      }
    }
  } catch {}
  return [];
}

/**
 * Updates in-memory and local storage members cache.
 */
export function setCanteenMembersCache(members: any[]): void {
  if (!Array.isArray(members)) return;
  inMemoryMembersCache = members;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('canteen_members_cache', JSON.stringify(members));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: members }));
      }, 0);
    } catch (e) {
      console.warn('[CanteenMembersCache] LocalStorage save warning:', e);
    }
  }
}
