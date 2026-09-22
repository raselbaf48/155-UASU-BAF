import { Airman, Rank } from '../types';

export const RANK_SENIORITY: Record<Rank, number> = {
  MWO: 1,
  SWO: 2,
  WO: 3,
  Sgt: 4,
  Cpl: 5,
  LAC: 6,
  "AC-1": 7,
  "AC-2": 8,
};

/**
 * Compares airmen strictly according to default Bangladesh Air Force Seniority:
 * 1. Rank (MWO > SWO > WO > Sgt > Cpl > LAC > AC-1 > AC-2)
 * 2. BD Number (Lower BD No = more senior)
 * 3. Finally, by Serial Number
 */
export function compareAirmenDefaultSeniority(a: Airman, b: Airman): number {
  const rankA = RANK_SENIORITY[a.rank] || 99;
  const rankB = RANK_SENIORITY[b.rank] || 99;

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // Extract numbers from BD No (e.g. BD/468582 -> 468582)
  const numA = parseInt((a.bdNo || '').replace(/\D/g, ''), 10) || 0;
  const numB = parseInt((b.bdNo || '').replace(/\D/g, ''), 10) || 0;

  if (numA !== numB) {
    return numA - numB;
  }

  return (a.serNo || 0) - (b.serNo || 0);
}

/**
 * Sorts airmen:
 * 1. If explicit 'seniority' is set, sorts strictly by seniority number.
 * 2. Otherwise falls back to default BAF rank and BD No order.
 */
export function sortAirmenBySeniority(airmen: Airman[]): Airman[] {
  return [...airmen].sort((a, b) => {
    const sA = (a.seniority !== undefined && a.seniority !== null && !isNaN(Number(a.seniority))) ? Number(a.seniority) : null;
    const sB = (b.seniority !== undefined && b.seniority !== null && !isNaN(Number(b.seniority))) ? Number(b.seniority) : null;

    if (sA !== null && sB !== null && sA !== sB) {
      return sA - sB;
    }
    if (sA !== null && sB === null) return -1;
    if (sA === null && sB !== null) return 1;

    return compareAirmenDefaultSeniority(a, b);
  });
}

/**
 * Ensures all airmen have clean, sequential 1..N seniority numbers
 * based on their current order (or BD No seniority order).
 */
export function normalizeAirmenSeniority(airmen: Airman[]): Airman[] {
  const sorted = sortAirmenBySeniority(airmen);
  return sorted.map((airman, index) => ({
    ...airman,
    seniority: index + 1,
  }));
}

/**
 * Reorders an airman's seniority and shifts other airmen sequentially:
 * Example: Changing from 15 to 2:
 * 1 remains 1, target becomes 2, previous 2 becomes 3, ..., previous 14 becomes 15, 16+ remain unchanged.
 * Example: Changing from 2 to 5:
 * 1 remains 1, target becomes 5, previous 3 becomes 2, previous 4 becomes 3, previous 5 becomes 4, 6+ remain unchanged.
 */
export function reorderAirmanSeniority(
  airmen: Airman[],
  targetAirmanId: string,
  newSeniority: number
): { updatedAirmen: Airman[]; changedAirmen: Airman[] } {
  // 1. Ensure baseline list has normalized sequential seniorities
  const baseList = normalizeAirmenSeniority(airmen);
  const targetIndex = baseList.findIndex((a) => a.id === targetAirmanId);
  if (targetIndex === -1) {
    return { updatedAirmen: baseList, changedAirmen: [] };
  }

  const target = baseList[targetIndex];
  const oldSeniority = target.seniority || (targetIndex + 1);
  const totalCount = baseList.length;
  const clampedSeniority = Math.max(1, Math.min(newSeniority, totalCount));

  if (oldSeniority === clampedSeniority) {
    return { updatedAirmen: baseList, changedAirmen: [] };
  }

  const changedIds = new Set<string>();

  // Shift intermediate airmen
  let adjustedList = baseList.map((a) => {
    if (a.id === targetAirmanId) {
      changedIds.add(a.id);
      return { ...a, seniority: clampedSeniority };
    }
    const currentSen = a.seniority || 0;
    if (oldSeniority > clampedSeniority) {
      // Moving up in seniority (e.g. 15 -> 2)
      if (currentSen >= clampedSeniority && currentSen < oldSeniority) {
        changedIds.add(a.id);
        return { ...a, seniority: currentSen + 1 };
      }
    } else {
      // Moving down in seniority (e.g. 2 -> 5)
      if (currentSen <= clampedSeniority && currentSen > oldSeniority) {
        changedIds.add(a.id);
        return { ...a, seniority: currentSen - 1 };
      }
    }
    return a;
  });

  // Re-sort strictly by updated seniority and ensure sequential 1..N
  adjustedList = sortAirmenBySeniority(adjustedList);
  const finalAirmen = adjustedList.map((a, idx) => {
    const expected = idx + 1;
    if (a.seniority !== expected) {
      changedIds.add(a.id);
      return { ...a, seniority: expected };
    }
    return a;
  });

  const changedAirmen = finalAirmen.filter((a) => changedIds.has(a.id));
  return { updatedAirmen: finalAirmen, changedAirmen };
}
