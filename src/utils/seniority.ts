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

export const JCO_RANKS: Rank[] = ['MWO', 'SWO', 'WO'];

export function isJcoRank(rank: Rank | string): boolean {
  return JCO_RANKS.includes(rank as Rank);
}

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
 * 1. STRICT MILITARY HIERARCHY: Rank ALWAYS comes first (MWO > SWO > WO > Sgt > Cpl > LAC > AC-1 > AC-2).
 *    A junior rank (e.g. LAC, Sgt) can NEVER be placed ahead of a superior rank (e.g. SWO, WO).
 * 2. JCOs (MWO, SWO, WO):
 *    - Can have custom seniority order (date of promotion / rank seniority basis).
 *    - If explicit 'seniority' is set, sorts by that number.
 *    - Otherwise falls back to BD Number.
 * 3. NON-JCOs (Sgt, Cpl, LAC, AC-1, AC-2):
 *    - ALWAYS sorted strictly by BD Number (lower BD No = more senior).
 *    - Manual seniority overrides are not applicable.
 */
export function sortAirmenBySeniority(airmen: Airman[]): Airman[] {
  return [...airmen].sort((a, b) => {
    // 1. Absolute Rank Hierarchy Check
    const rankA = RANK_SENIORITY[a.rank] || 99;
    const rankB = RANK_SENIORITY[b.rank] || 99;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // 2. Only JCOs (MWO, SWO, WO) can have custom manual seniority order
    if (isJcoRank(a.rank)) {
      const sA = (a.seniority !== undefined && a.seniority !== null && !isNaN(Number(a.seniority))) ? Number(a.seniority) : null;
      const sB = (b.seniority !== undefined && b.seniority !== null && !isNaN(Number(b.seniority))) ? Number(b.seniority) : null;

      if (sA !== null && sB !== null && sA !== sB) {
        return sA - sB;
      }
      if (sA !== null && sB === null) return -1;
      if (sA === null && sB !== null) return 1;
    }

    // 3. For non-JCOs (Sgt, Cpl, LAC, AC-1, AC-2) and JCOs with equal/no custom seniority:
    // Strictly by BD Number (lower BD No = more senior)
    return compareAirmenDefaultSeniority(a, b);
  });
}

/**
 * Ensures all airmen have clean, sequential 1..N seniority numbers
 * based on their current rank order and seniority / BD No order.
 */
export function normalizeAirmenSeniority(airmen: Airman[]): Airman[] {
  const sorted = sortAirmenBySeniority(airmen);
  return sorted.map((airman, index) => ({
    ...airman,
    seniority: index + 1,
  }));
}

/**
 * Calculates the valid seniority bounds (min and max) that an airman
 * of a given rank can occupy in the unit.
 */
export function getRankSeniorityRange(
  airmen: Airman[],
  rank: Rank | string
): { minSeniority: number; maxSeniority: number; totalInRank: number } {
  const normalized = normalizeAirmenSeniority(airmen);
  const matching = normalized.filter((a) => a.rank === rank);
  if (matching.length === 0) {
    const rankWeight = RANK_SENIORITY[rank as Rank] || 99;
    let insertionPos = 1;
    for (const a of normalized) {
      const aWeight = RANK_SENIORITY[a.rank as Rank] || 99;
      if (aWeight < rankWeight) {
        insertionPos = (a.seniority || 0) + 1;
      }
    }
    return { minSeniority: insertionPos, maxSeniority: insertionPos, totalInRank: 0 };
  }

  const seniorities = matching.map((a) => a.seniority || 0);
  return {
    minSeniority: Math.min(...seniorities),
    maxSeniority: Math.max(...seniorities),
    totalInRank: matching.length,
  };
}

/**
 * Resolves a requested seniority number into a valid unit seniority position
 * that never violates military rank hierarchy:
 * - If user gives 1 (or <= minSeniority), they become the seniormost of that rank.
 * - If user gives a rank-relative position (1..totalInRank) that is less than minSeniority,
 *   it maps to that position within the rank (e.g. 1st LAC -> minSeniority).
 * - Clamps strictly between minSeniority and maxSeniority of that rank.
 */
export function resolveTargetSeniority(
  airmen: Airman[],
  rank: Rank | string,
  inputSeniority: number
): {
  resolvedSeniority: number;
  relativeRankIndex: number;
  minRankSeniority: number;
  maxRankSeniority: number;
  totalInRank: number;
} {
  const range = getRankSeniorityRange(airmen, rank);
  const { minSeniority, maxSeniority, totalInRank } = range;

  if (totalInRank === 0) {
    return {
      resolvedSeniority: minSeniority,
      relativeRankIndex: 1,
      minRankSeniority: minSeniority,
      maxRankSeniority: maxSeniority,
      totalInRank: 0,
    };
  }

  let resolved = inputSeniority;

  // If user entered a rank-relative number (e.g. 1 for 1st in rank, 2 for 2nd in rank)
  if (inputSeniority >= 1 && inputSeniority <= totalInRank && inputSeniority < minSeniority) {
    resolved = minSeniority + inputSeniority - 1;
  } else {
    // Clamp to valid range for this rank (never jump higher ranks or fall below lower ranks)
    resolved = Math.max(minSeniority, Math.min(inputSeniority, maxSeniority));
  }

  const relativeIndex = resolved - minSeniority + 1;

  return {
    resolvedSeniority: resolved,
    relativeRankIndex: relativeIndex,
    minRankSeniority: minSeniority,
    maxRankSeniority: maxSeniority,
    totalInRank,
  };
}

/**
 * Reorders an airman's seniority within the allowed bounds of their rank:
 * Higher ranks (above this rank) and lower ranks (below this rank) remain undisturbed.
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
  // Only JCO ranks (MWO, SWO, WO) can have their seniority manually changed
  if (!isJcoRank(target.rank)) {
    return { updatedAirmen: baseList, changedAirmen: [] };
  }

  const oldSeniority = target.seniority || (targetIndex + 1);

  // 2. Resolve target seniority respecting rank hierarchy
  const { resolvedSeniority } = resolveTargetSeniority(baseList, target.rank, newSeniority);

  if (oldSeniority === resolvedSeniority) {
    return { updatedAirmen: baseList, changedAirmen: [] };
  }

  const changedIds = new Set<string>();

  // 3. Shift intermediate airmen strictly
  let adjustedList = baseList.map((a) => {
    if (a.id === targetAirmanId) {
      changedIds.add(a.id);
      return { ...a, seniority: resolvedSeniority };
    }
    const currentSen = a.seniority || 0;
    if (oldSeniority > resolvedSeniority) {
      // Moving up in seniority (e.g. from 20 -> 10)
      if (currentSen >= resolvedSeniority && currentSen < oldSeniority) {
        changedIds.add(a.id);
        return { ...a, seniority: currentSen + 1 };
      }
    } else {
      // Moving down in seniority (e.g. from 10 -> 20)
      if (currentSen <= resolvedSeniority && currentSen > oldSeniority) {
        changedIds.add(a.id);
        return { ...a, seniority: currentSen - 1 };
      }
    }
    return a;
  });

  // Re-sort strictly by rank and updated seniority and ensure sequential 1..N
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
