/**
 * Rank and Airman Name Formatting Utility for 155 UASU BAF
 * 
 * Strict BAF Rule:
 * - Only 'Sgt' and 'Cpl' are displayed in running letters (Title Case: First letter capital, rest lowercase).
 * - All other ranks MUST be displayed in BLOCK CAPITAL LETTERS:
 *   MWO, SWO, WO, LAC, AC-1, AC-2, AC, FLT LT, SQN LDR, etc.
 */

export const formatRank = (rank?: string): string => {
  if (!rank) return '';
  const clean = rank.trim();
  const upper = clean.toUpperCase();

  // 1. Running letter ranks (ONLY Sgt and Cpl)
  if (upper === 'SGT' || upper === 'SERGEANT') return 'Sgt';
  if (upper === 'CPL' || upper === 'CORPORAL') return 'Cpl';

  // 2. AC-1 and AC-2 normalization to block capital with hyphen
  if (
    upper === 'AC-1' ||
    upper === 'AC1' ||
    upper === 'AC 1' ||
    upper === 'AC-I' ||
    upper === 'AC_1' ||
    upper.startsWith('AC-1')
  ) {
    return 'AC-1';
  }
  if (
    upper === 'AC-2' ||
    upper === 'AC2' ||
    upper === 'AC 2' ||
    upper === 'AC-II' ||
    upper === 'AC_2' ||
    upper.startsWith('AC-2')
  ) {
    return 'AC-2';
  }

  // 3. All other ranks MUST be in ALL CAPITAL LETTERS (MWO, SWO, WO, LAC, AC, FLT LT, etc.)
  return upper;
};

export const formatAirmanName = (name?: string): string => {
  if (!name) return '';
  const clean = name.trim();
  const upper = clean.toUpperCase();

  // If a rank is passed to formatAirmanName, format it as rank
  if (upper === 'SGT' || upper === 'SERGEANT') return 'Sgt';
  if (upper === 'CPL' || upper === 'CORPORAL') return 'Cpl';
  if (
    ['MWO', 'SWO', 'WO', 'LAC', 'AC', 'MW', 'FLT LT', 'SQN LDR', 'WG CDR', 'GP CAPT', 'AIR CDRE'].includes(upper) ||
    upper.startsWith('AC-') ||
    upper.startsWith('AC ') ||
    upper.startsWith('AC_') ||
    upper === 'AC1' ||
    upper === 'AC2'
  ) {
    return formatRank(upper);
  }

  // Standard person name (Title Case / Running Letter)
  return clean
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
};

export const formatAirmanWithRank = (airman?: { rank?: string; name: string }): string => {
  if (!airman) return '';
  const rank = formatRank(airman.rank);
  const name = formatAirmanName(airman.name);
  return `${rank} ${name}`.trim();
};
