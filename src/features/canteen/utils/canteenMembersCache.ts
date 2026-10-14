/**
 * Lightweight Canteen Members Cache.
 * Synchronous, zero-dependency local storage and memory cache.
 */

let inMemoryMembersCache: any[] | null = null;

export function deduplicateCanteenMembers(members: any[]): any[] {
  if (!Array.isArray(members)) return [];
  const seenBd = new Set<string>();
  const seenAirmanId = new Set<string>();
  const seenCivName = new Map<string, any>();
  const result: any[] = [];

  // Filter out any known orphaned ghost records like airman-3 when airman-10226 exists
  const has10226Akramul = members.some(m => {
    const bd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
    const sur = String(m.Surname || m.surname || m.Name || '').toLowerCase();
    return (bd === '10226' || m.airman_id === 'airman-10226') && sur.includes('akramul');
  });

  for (const m of members) {
    if (!m) continue;
    const cleanBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '').toLowerCase();
    const airmanId = String(m.airman_id || m.id || '').toLowerCase();
    const rank = String(m.Rank || m.rank || '').trim().toLowerCase();
    const surname = String(m.Surname || m.surname || m.Name || '').trim().toLowerCase();

    // If Akramul #10226 is present, drop old ghost #3
    if (has10226Akramul && surname.includes('akramul') && (cleanBd === '3' || airmanId === 'airman-3')) {
      continue;
    }

    // Check duplicate BD
    if (cleanBd && seenBd.has(cleanBd)) continue;
    if (airmanId && seenAirmanId.has(airmanId)) continue;

    // Check duplicate Civilian staff with identical name
    if (rank === 'civ' || rank === '-' || rank === 'civilian') {
      const civKey = `${rank}_${surname}`;
      if (seenCivName.has(civKey)) {
        const existing = seenCivName.get(civKey);
        const existingBd = String(existing['BD No'] || existing.bdNo || '').replace(/\D/g, '');
        // Prefer longer/full service number over short 1-digit
        if (cleanBd.length > existingBd.length) {
          const idx = result.indexOf(existing);
          if (idx !== -1) {
            result[idx] = m;
            seenCivName.set(civKey, m);
            if (cleanBd) seenBd.add(cleanBd);
            if (airmanId) seenAirmanId.add(airmanId);
          }
        }
        continue;
      }
      seenCivName.set(civKey, m);
    }

    if (cleanBd) seenBd.add(cleanBd);
    if (airmanId) seenAirmanId.add(airmanId);
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
