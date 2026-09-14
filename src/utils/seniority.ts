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
 * Sorts airmen strictly according to Bangladesh Air Force Seniority:
 * 1. Rank (MWO > SWO > WO > Sgt > Cpl > LAC > AC-1 > AC-2)
 * 2. BD Number (Lower BD No = more senior)
 * 3. Serial Number
 */
export function sortAirmenBySeniority(airmen: Airman[]): Airman[] {
  return [...airmen].sort((a, b) => {
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
  });
}
