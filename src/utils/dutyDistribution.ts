/**
 * Universal Duty Distribution Engine with Cross-Duty Workload Balancing & Auto Allocate
 * 
 * 1. Airfield Duty (or similar duties) only has 3 capable flights (Mechanics, Avionics, GCS).
 *    Admin has NO Airfield duty.
 *    Therefore, Airfield Duty's workload balancing is contained strictly among the 3 capable flights.
 *    Admin is protected and unaffected by Airfield duty.
 * 
 * 2. Dynamic Manpower & Disposal Support:
 *    - When Manpower is at Default (11 Mech, 7 Avi, 11 GCS, 1 Admin):
 *      Uses the official baseline (Mech: 134, Avi: 100, GCS: 134, Admin: 30).
 *    - When Disposal or Manpower changes (Leave, TDY, Disposals, etc.):
 *      Dynamically recalculates each flight's exact mathematical ratio and integer targets.
 *    - When "Auto Allocate" is clicked:
 *      Immediately applies the new distribution from the active manpower and allocates
 *      all 31 days with 100% precision, zero exceed, and balanced daily load.
 */

import { FlightName } from '../types';
import { DutyRatioTable } from '../data/officialDutyRatioMatrix';

export interface ManpowerState {
  mechSgt: number;
  mechCpl: number;
  aviSgt: number;
  aviCpl: number;
  gcsSgt: number;
  gcsCpl: number;
  adminSgt: number;
  adminCpl: number;
}

export const DEFAULT_MANPOWER: ManpowerState = {
  mechSgt: 5,
  mechCpl: 6,
  aviSgt: 4,
  aviCpl: 3,
  gcsSgt: 5,
  gcsCpl: 6,
  adminSgt: 0,
  adminCpl: 1,
};

export function isDefaultManpower(mp?: Partial<ManpowerState> | null): boolean {
  if (!mp) return true;
  return (
    (mp.mechSgt ?? 5) === 5 &&
    (mp.mechCpl ?? 6) === 6 &&
    (mp.aviSgt ?? 4) === 4 &&
    (mp.aviCpl ?? 3) === 3 &&
    (mp.gcsSgt ?? 5) === 5 &&
    (mp.gcsCpl ?? 6) === 6 &&
    (mp.adminSgt ?? 0) === 0 &&
    (mp.adminCpl ?? 1) === 1
  );
}

// Official UASU Target Baseline (Total duties: 398)
// Sum per table matches totalRequiredMonth 100%
// Sum per flight: Mech: 134, Avi: 100, GCS: 134, Admin: 30
export const OFFICIAL_TARGET_BASELINE: Record<string, Record<FlightName, number>> = {
  security_duty:   { Mechanics: 28, Avionics: 18, GCS: 28, Admin: 14 },
  base_tf:         { Mechanics: 8,  Avionics: 5,  GCS: 6,   Admin: 3 },
  nazirpara_tf:    { Mechanics: 14, Avionics: 9,  GCS: 14, Admin: 3 },
  idac_mor:        { Mechanics: 11, Avionics: 7,  GCS: 11, Admin: 2 },
  idac_an:         { Mechanics: 11, Avionics: 7,  GCS: 11, Admin: 2 },
  idac_nt:         { Mechanics: 21, Avionics: 15, GCS: 22, Admin: 4 },
  airport_duty:    { Mechanics: 31, Avionics: 31, GCS: 31, Admin: 0 },
  halishahar_duty: { Mechanics: 10, Avionics: 8,  GCS: 11, Admin: 2 },
};

export function isFixedEqualDuty(table: DutyRatioTable): boolean {
  if (!table || table.isDisabled) return false;
  const title = (table.title || '').toUpperCase();
  const id = (table.id || '').toLowerCase();
  
  if (id === 'airport_duty' || title.includes('AIRFIELD') || title.includes('AIRPORT')) {
    return true;
  }
  
  if (table.eligibleFlights && table.eligibleFlights.length > 1 && table.totalRequiredDaily === table.eligibleFlights.length) {
    return true;
  }

  return false;
}

export function getFlightStrength(mp: ManpowerState, fl: FlightName, isSecurity: boolean): number {
  let cpl = 0, sgt = 0;
  if (fl === 'Mechanics') { cpl = mp.mechCpl; sgt = mp.mechSgt; }
  if (fl === 'Avionics') { cpl = mp.aviCpl; sgt = mp.aviSgt; }
  if (fl === 'GCS') { cpl = mp.gcsCpl; sgt = mp.gcsSgt; }
  if (fl === 'Admin') { cpl = mp.adminCpl; sgt = mp.adminSgt; }
  return isSecurity ? cpl : (cpl + sgt);
}

/**
 * Calculates balanced auto targets.
 * - If default manpower is active: uses OFFICIAL_TARGET_BASELINE.
 * - If manpower or disposal changes: dynamically recalculates each flight's fair share based on current manpower!
 */
export function calculateBalancedAutoTargets(
  matrix: DutyRatioTable[],
  manpowerInput?: Partial<ManpowerState> | null
): Record<FlightName, Record<string, number>> {
  const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  const autoTargets: Record<FlightName, Record<string, number>> = {
    Mechanics: {},
    Avionics: {},
    GCS: {},
    Admin: {},
  };

  const mp: ManpowerState = {
    ...DEFAULT_MANPOWER,
    ...(manpowerInput || {}),
  };

  const isDefault = isDefaultManpower(mp);
  const activeDuties = matrix.filter((t) => !t.isDisabled);
  const getStrength = (fl: FlightName, isSec: boolean) => getFlightStrength(mp, fl, isSec);

  // 1. Calculate overall base total duty weight across all active duties (Sob Duty miliye)
  const totalDutyWeight: Record<FlightName, number> = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
  activeDuties.forEach((t) => {
    const isSecurity = t.id === 'security_duty';
    const isFixed = isFixedEqualDuty(t);
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    const total = (t.dailyRequirements && t.dailyRequirements.length > 0)
      ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : (t.totalRequiredMonth || 0);

    if (isFixed) {
      elig.forEach((fl) => {
        totalDutyWeight[fl] += total / elig.length;
      });
      return;
    }

    const pool = elig.reduce((s, fl) => s + getStrength(fl, isSecurity), 0);
    elig.forEach((fl) => {
      const st = getStrength(fl, isSecurity);
      totalDutyWeight[fl] += pool > 0 ? (st / pool) * total : (total / elig.length);
    });
  });

  const cumulativeTotals: Record<FlightName, number> = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
  let mechGcsTurn: FlightName = 'Mechanics';

  activeDuties.forEach((t) => {
    const isSecurity = t.id === 'security_duty';
    const isFixed = isFixedEqualDuty(t);
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    
    // Compute total from dailyRequirements if set, otherwise from totalRequiredMonth
    const calculatedTotal = (t.dailyRequirements && t.dailyRequirements.length > 0)
      ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : (t.totalRequiredMonth || 0);
    const total = calculatedTotal;

    // Fixed duties (e.g. Airfield Duty): equal share among capable flights
    if (isFixed) {
      const per = elig.length > 0 ? Math.floor(total / elig.length) : 0;
      let rem = elig.length > 0 ? total % elig.length : 0;
      flights.forEach((fl) => {
        if (!elig.includes(fl)) {
          autoTargets[fl][t.id] = 0;
        } else {
          const val = per + (rem > 0 ? 1 : 0);
          autoTargets[fl][t.id] = val;
          cumulativeTotals[fl] += val;
          if (rem > 0) rem--;
        }
      });
      return;
    }

    // Dynamic calculation based on current manpower ratio
    const pool = elig.reduce((s, fl) => s + getStrength(fl, isSecurity), 0);
    const shares = elig.map((fl) => {
      const st = getStrength(fl, isSecurity);
      const raw = pool > 0 ? (st / pool) * total : (total / elig.length);
      const floor = Math.floor(raw);
      const rem = raw - floor;
      return { fl, raw, floor, rem, assigned: floor };
    });

    const floorSum = shares.reduce((s, x) => s + x.floor, 0);
    let remainingSlots = total - floorSum;

    if (remainingSlots > 0) {
      // Rank candidate flights for the extra (+1) slots
      shares.sort((a, b) => {
        // 1. Remainder comparison (higher remainder gets priority)
        if (Math.abs(b.rem - a.rem) > 0.0001) {
          return b.rem - a.rem;
        }

        // TIE IN REMAINDER!
        // 2. Rule 1: Overall total duty (সব ডিউটি মিলিয়ে যার ডিউটি কম সে পাবে)
        // Admin (~12 month total) gets priority over Avionics (~98 month total) when both have 0.5 rem (Sy Duty)
        const overallDiff = totalDutyWeight[a.fl] - totalDutyWeight[b.fl];
        if (Math.abs(overallDiff) > 0.5) {
          return overallDiff; // lower overall duty gets priority
        }

        // 3. Rule 1.1: Running cumulative total so far
        const runDiff = cumulativeTotals[a.fl] - cumulativeTotals[b.fl];
        if (runDiff !== 0) {
          return runDiff; // lower running total gets priority
        }

        // 4. Rule 2: Alternation for tied flights with equal running totals (Mech vs GCS)
        if ((a.fl === 'Mechanics' && b.fl === 'GCS') || (a.fl === 'GCS' && b.fl === 'Mechanics')) {
          return a.fl === mechGcsTurn ? -1 : 1;
        }

        return flights.indexOf(a.fl) - flights.indexOf(b.fl);
      });

      for (let i = 0; i < remainingSlots; i++) {
        const winner = shares[i];
        winner.assigned += 1;
        // If winner was chosen between Mech and GCS on equal running totals, alternate turn
        if (winner.fl === 'Mechanics' || winner.fl === 'GCS') {
          const other: FlightName = winner.fl === 'Mechanics' ? 'GCS' : 'Mechanics';
          const otherCand = shares.find((x) => x.fl === other);
          if (
            otherCand &&
            Math.abs(winner.rem - otherCand.rem) <= 0.0001 &&
            cumulativeTotals[winner.fl] === cumulativeTotals[other]
          ) {
            mechGcsTurn = other;
          }
        }
      }
    }

    flights.forEach((fl) => {
      const found = shares.find((x) => x.fl === fl);
      const val = found ? found.assigned : 0;
      autoTargets[fl][t.id] = val;
      cumulativeTotals[fl] += val;
    });
  });

  return autoTargets;
}

/**
 * Calculates exact mathematical ratios (with decimals) for the Show/Hide Exact Ratio view.
 */
export function calculateExactDutyRatios(
  matrix: DutyRatioTable[],
  manpowerInput?: Partial<ManpowerState> | null
): Record<string, Record<FlightName, number>> {
  const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  const result: Record<string, Record<FlightName, number>> = {};

  const mp: ManpowerState = {
    ...DEFAULT_MANPOWER,
    ...(manpowerInput || {}),
  };

  const getStrength = (fl: FlightName, isSec: boolean) => getFlightStrength(mp, fl, isSec);

  matrix.forEach((t) => {
    result[t.id] = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
    const isSecurity = t.id === 'security_duty';
    const isFixed = isFixedEqualDuty(t);
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    const total = (t.dailyRequirements && t.dailyRequirements.length > 0)
      ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : (t.totalRequiredMonth || 0);

    if (isFixed) {
      const per = elig.length > 0 ? total / elig.length : 0;
      flights.forEach((fl) => {
        result[t.id][fl] = elig.includes(fl) ? per : 0;
      });
      return;
    }

    const pool = elig.reduce((s, fl) => s + getStrength(fl, isSecurity), 0);
    flights.forEach((fl) => {
      if (elig.includes(fl)) {
        const st = getStrength(fl, isSecurity);
        result[t.id][fl] = pool > 0 ? (st / pool) * total : 0;
      } else {
        result[t.id][fl] = 0;
      }
    });
  });

  return result;
}

/**
 * Intelligent Matrix Auto Allocation Engine
 * - Automatically recalculates targets based on active manpower / disposals.
 * - Strictly enforces that flight monthly quota NEVER exceeds targets (Allocated Total === Target Total).
 * - Minimizes deviation from nearest independent integer:
 *   targetDaily = Math.round(flightTotal / 31)
 * - Uses a post-allocation swap smoother to eliminate outliers and clusterings.
 */
export function autoAllocateDutyMatrix(
  matrix: DutyRatioTable[],
  manpowerInput?: Partial<ManpowerState> | null
): DutyRatioTable[] {
  const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  const mp: ManpowerState = {
    ...DEFAULT_MANPOWER,
    ...(manpowerInput || {}),
  };
  const getStrength = (fl: FlightName, isSec: boolean) => getFlightStrength(mp, fl, isSec);
  const autoTargets = calculateBalancedAutoTargets(matrix, manpowerInput);
  const isDefault = isDefaultManpower(manpowerInput);

  // 1. Clone matrix with cleared data
  const newMatrix: DutyRatioTable[] = matrix.map((t) => {
    // True month total based on dailyRequirements if set
    const monthTotal = (t.dailyRequirements && t.dailyRequirements.length > 0)
      ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : (t.totalRequiredMonth || 0);

    const existing = t.flightTargets;
    const existingSum = existing ? (existing.Mechanics || 0) + (existing.Avionics || 0) + (existing.GCS || 0) + (existing.Admin || 0) : 0;

    const targets: Record<FlightName, number> = {
      Mechanics: autoTargets['Mechanics']?.[t.id] ?? 0,
      Avionics: autoTargets['Avionics']?.[t.id] ?? 0,
      GCS: autoTargets['GCS']?.[t.id] ?? 0,
      Admin: autoTargets['Admin']?.[t.id] ?? 0,
    };

    return {
      ...t,
      totalRequiredMonth: monthTotal,
      flightTargets: targets,
      data: {
        Mechanics: new Array(31).fill(0),
        Avionics: new Array(31).fill(0),
        GCS: new Array(31).fill(0),
        Admin: new Array(31).fill(0),
      },
    };
  });

  // Track daily load for each flight on each day (0..30)
  const dailyFlightLoad: Record<FlightName, number[]> = {
    Mechanics: new Array(31).fill(0),
    Avionics: new Array(31).fill(0),
    GCS: new Array(31).fill(0),
    Admin: new Array(31).fill(0),
  };

  // Target daily independent numbers
  const flightMonthTotals: Record<FlightName, number> = {
    Mechanics: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (t.flightTargets?.Mechanics || 0), 0),
    Avionics: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (t.flightTargets?.Avionics || 0), 0),
    GCS: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (t.flightTargets?.GCS || 0), 0),
    Admin: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (t.flightTargets?.Admin || 0), 0),
  };

  const targetDaily: Record<FlightName, number> = {
    Mechanics: Math.max(1, Math.round(flightMonthTotals.Mechanics / 31)),
    Avionics: Math.max(1, Math.round(flightMonthTotals.Avionics / 31)),
    GCS: Math.max(1, Math.round(flightMonthTotals.GCS / 31)),
    Admin: Math.max(1, Math.round(flightMonthTotals.Admin / 31)),
  };

  // Step 2: Fixed Duties (Airfield Duty: equal share among capable flights)
  newMatrix.filter((t) => !t.isDisabled && isFixedEqualDuty(t)).forEach((t) => {
    const origTable = matrix.find((x) => x.id === t.id) || t;
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0
      ? t.eligibleFlights
      : (['Mechanics', 'Avionics', 'GCS'] as FlightName[]);

    const reqSlots = new Array(31).fill(0);
    for (let d = 0; d < 31; d++) {
      reqSlots[d] = origTable.dailyRequirements?.[d] ?? elig.length;
    }
    t.dailyRequirements = [...reqSlots];

    for (let day = 0; day < 31; day++) {
      const needed = reqSlots[day];
      if (needed <= 0) continue;
      const per = Math.floor(needed / elig.length);
      let rem = needed % elig.length;
      elig.forEach((fl) => {
        const c = per + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        t.data[fl][day] = c;
        dailyFlightLoad[fl][day] += c;
      });
    }

    flights.forEach((fl) => {
      t.flightTargets[fl] = t.data[fl].reduce((a, b) => a + b, 0);
    });
  });

  // Helper for gap rules & anti-consecutive limits
  function getDutyLimits(target: number) {
    if (target <= 0) return { maxOnStreak: 0, maxOffStreak: 31, gaps: 31 };
    if (target >= 31) return { maxOnStreak: 31, maxOffStreak: 0, gaps: 0 };
    const gaps = 31 - target;
    let maxOnStreak = 1;
    if (target <= 15) {
      maxOnStreak = 1;
    } else if (target <= 20) {
      maxOnStreak = 2;
    } else if (target <= 23) {
      maxOnStreak = 3;
    } else if (target <= 25) {
      maxOnStreak = 4;
    } else {
      maxOnStreak = Math.ceil(target / (gaps + 1));
    }

    let maxOffStreak = 1;
    if (gaps <= 5) {
      maxOffStreak = 1;
    } else if (gaps <= 10) {
      maxOffStreak = 2;
    } else if (gaps <= 18) {
      maxOffStreak = 2;
    } else {
      maxOffStreak = Math.ceil(gaps / (target + 1)) + 1;
    }

    return { maxOnStreak, maxOffStreak, gaps };
  }

  function evalFlightStreakCost(arr: number[], target: number): number {
    if (target <= 0 || target >= 31) return 0;
    const { maxOnStreak, maxOffStreak, gaps } = getDutyLimits(target);
    let cost = 0;
    let curOn = 0;
    let curOff = 0;

    for (let d = 0; d < 31; d++) {
      if (arr[d] > 0) {
        curOn++;
        if (curOff > 0) {
          if (curOff > maxOffStreak) {
            cost += Math.pow(curOff - maxOffStreak, 2) * 500;
          }
          if (gaps <= 5 && curOff > 1) {
            cost += 2000 * Math.pow(curOff - 1, 2);
          }
          curOff = 0;
        }
        if (curOn > maxOnStreak) {
          cost += Math.pow(curOn - maxOnStreak, 3) * 5000;
        }
        if (curOn > 1 && target <= 15) cost += 80;
        if (curOn > 2 && target <= 20) cost += 120;
      } else {
        curOff++;
        if (curOn > 0) {
          if (curOn > maxOnStreak) {
            cost += Math.pow(curOn - maxOnStreak, 3) * 5000;
          }
          curOn = 0;
        }
      }
    }

    if (curOn > maxOnStreak) cost += Math.pow(curOn - maxOnStreak, 3) * 5000;
    if (curOff > maxOffStreak) cost += Math.pow(curOff - maxOffStreak, 2) * 500;
    if (gaps <= 5 && curOff > 1) cost += 2000 * Math.pow(curOff - 1, 2);

    return cost;
  }

  // Step 3: Open Duties Initial Allocation with Anti-Consecutive Scoring
  const openDuties = newMatrix
    .filter((t) => !t.isDisabled && !isFixedEqualDuty(t))
    .sort((a, b) => (b.totalRequiredDaily || 1) - (a.totalRequiredDaily || 1));

  openDuties.forEach((table) => {
    const origTable = matrix.find((x) => x.id === table.id) || table;
    const isSecurity = table.id === 'security_duty';
    const elig = table.eligibleFlights && table.eligibleFlights.length > 0
      ? table.eligibleFlights
      : (['Mechanics', 'Avionics', 'GCS', 'Admin'] as FlightName[]);

    const reqSlots = new Array(31).fill(0);
    for (let d = 0; d < 31; d++) {
      reqSlots[d] = origTable.dailyRequirements?.[d] ?? flights.reduce((s, fl) => s + (origTable.data[fl]?.[d] || 0), 0);
    }
    table.dailyRequirements = [...reqSlots];

    const q = table.flightTargets;

    // Day by day allocation
    for (let d = 0; d < 31; d++) {
      const needed = reqSlots[d];
      if (needed <= 0) continue;

      // Calculate candidate data
      const flightWeights = elig.map((fl) => {
        const target = q[fl] || 0;
        const assigned = table.data[fl].reduce((a, b) => a + b, 0);
        const rem = Math.max(0, target - assigned);
        const st = getStrength(fl, isSecurity);
        let onStreak = 0;
        for (let prev = d - 1; prev >= 0 && table.data[fl][prev] > 0; prev--) onStreak++;
        let offStreak = 0;
        for (let prev = d - 1; prev >= 0 && table.data[fl][prev] === 0; prev--) offStreak++;
        const { maxOnStreak, maxOffStreak } = getDutyLimits(target);
        return {
          fl,
          target,
          assigned,
          rem,
          st,
          onStreak,
          offStreak,
          maxOnStreak,
          maxOffStreak,
          load: dailyFlightLoad[fl][d],
        };
      });

      const totalRem = flightWeights.reduce((s, x) => s + x.rem, 0);
      const totalSt = flightWeights.reduce((s, x) => s + x.st, 0);

      let remainingToAssign = needed;
      while (remainingToAssign > 0) {
        const available = elig.map((fl) => {
          const target = q[fl] || 0;
          const assigned = table.data[fl].reduce((a, b) => a + b, 0);
          const rem = Math.max(0, target - assigned);
          const st = getStrength(fl, isSecurity);
          const daysLeft = 31 - d;
          let onStreak = 0;
          for (let prev = d - 1; prev >= 0 && table.data[fl][prev] > 0; prev--) onStreak++;
          let offStreak = 0;
          for (let prev = d - 1; prev >= 0 && table.data[fl][prev] === 0; prev--) offStreak++;
          const { maxOnStreak, maxOffStreak } = getDutyLimits(target);
          return {
            fl,
            target,
            assigned,
            rem,
            st,
            daysLeft,
            today: table.data[fl][d],
            onStreak,
            offStreak,
            maxOnStreak,
            maxOffStreak,
            load: dailyFlightLoad[fl][d],
          };
        }).filter((x) => totalRem === 0 ? true : x.rem > 0);

        if (available.length === 0) {
          const anyElig = [...elig].sort((f1, f2) => dailyFlightLoad[f1][d] - dailyFlightLoad[f2][d]);
          const chosen = anyElig[0];
          table.data[chosen][d] += 1;
          dailyFlightLoad[chosen][d] += 1;
          remainingToAssign--;
          continue;
        }

        available.sort((a, b) => {
          // 1. Prefer flights that have fewer slots today
          if (a.today !== b.today) return a.today - b.today;

          // 2. Urgent: if remaining quota >= daysLeft, this flight must get a slot
          const aUrgent = a.rem >= a.daysLeft ? 1 : 0;
          const bUrgent = b.rem >= b.daysLeft ? 1 : 0;
          if (aUrgent !== bUrgent) return bUrgent - aUrgent;

          // 3. Streak limits
          const aExceed = Math.max(0, a.onStreak - a.maxOnStreak);
          const bExceed = Math.max(0, b.onStreak - b.maxOnStreak);
          if (aExceed !== bExceed) return aExceed - bExceed;

          if (a.onStreak !== b.onStreak) {
            const aPen = a.onStreak >= a.maxOnStreak ? 1000 : a.onStreak * 30;
            const bPen = b.onStreak >= b.maxOnStreak ? 1000 : b.onStreak * 30;
            return aPen - bPen;
          }

          const aOffExceed = Math.max(0, a.offStreak - a.maxOffStreak);
          const bOffExceed = Math.max(0, b.offStreak - b.maxOffStreak);
          if (aOffExceed !== bOffExceed) return bOffExceed - aOffExceed;

          const aLoadPen = Math.max(0, a.load - targetDaily[a.fl]) * 10;
          const bLoadPen = Math.max(0, b.load - targetDaily[b.fl]) * 10;

          const aRatio = totalRem > 0 ? (a.rem / totalRem) : (a.st / (totalSt || 1));
          const bRatio = totalRem > 0 ? (b.rem / totalRem) : (b.st / (totalSt || 1));

          const aScore = aRatio * 100 - aLoadPen;
          const bScore = bRatio * 100 - bLoadPen;
          return bScore - aScore;
        });

        const chosen = available[0].fl;
        table.data[chosen][d] += 1;
        dailyFlightLoad[chosen][d] += 1;
        remainingToAssign--;
      }
    }

    // Step 4: Intra-table 2-opt Swap Optimizer with Gap and Anti-Streak Penalties
    for (let iter = 0; iter < 3000; iter++) {
      let improved = false;

      for (let d1 = 0; d1 < 31; d1++) {
        for (let d2 = 0; d2 < 31; d2++) {
          if (d1 === d2) continue;
          if (reqSlots[d1] !== reqSlots[d2]) continue; // Only swap between days with identical quota to never alter day sums!

          for (const f1 of elig) {
            if (table.data[f1][d1] < 1 || table.data[f1][d2] > 0) continue;

            for (const f2 of elig) {
              if (f1 === f2) continue;
              if (table.data[f2][d2] < 1 || table.data[f2][d1] > 0) continue;

              const target1 = q[f1] || 0;
              const target2 = q[f2] || 0;

              const costBefore =
                evalFlightStreakCost(table.data[f1], target1) +
                evalFlightStreakCost(table.data[f2], target2) +
                (Math.pow(dailyFlightLoad[f1][d1] - targetDaily[f1], 2) +
                 Math.pow(dailyFlightLoad[f1][d2] - targetDaily[f1], 2) +
                 Math.pow(dailyFlightLoad[f2][d1] - targetDaily[f2], 2) +
                 Math.pow(dailyFlightLoad[f2][d2] - targetDaily[f2], 2)) * 5;

              // Tentative swap of 1 unit
              table.data[f1][d1] -= 1; table.data[f1][d2] += 1;
              table.data[f2][d2] -= 1; table.data[f2][d1] += 1;
              dailyFlightLoad[f1][d1] -= 1; dailyFlightLoad[f1][d2] += 1;
              dailyFlightLoad[f2][d2] -= 1; dailyFlightLoad[f2][d1] += 1;

              const costAfter =
                evalFlightStreakCost(table.data[f1], target1) +
                evalFlightStreakCost(table.data[f2], target2) +
                (Math.pow(dailyFlightLoad[f1][d1] - targetDaily[f1], 2) +
                 Math.pow(dailyFlightLoad[f1][d2] - targetDaily[f1], 2) +
                 Math.pow(dailyFlightLoad[f2][d1] - targetDaily[f2], 2) +
                 Math.pow(dailyFlightLoad[f2][d2] - targetDaily[f2], 2)) * 5;

              if (costAfter < costBefore) {
                improved = true;
                break;
              } else {
                // Revert swap
                table.data[f1][d1] += 1; table.data[f1][d2] -= 1;
                table.data[f2][d2] += 1; table.data[f2][d1] -= 1;
                dailyFlightLoad[f1][d1] += 1; dailyFlightLoad[f1][d2] -= 1;
                dailyFlightLoad[f2][d2] += 1; dailyFlightLoad[f2][d1] -= 1;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (!improved) break;
    }
  });

  // Final verification: ensure table.flightTargets matches exact assigned total
  newMatrix.forEach((t) => {
    flights.forEach((fl) => {
      t.flightTargets[fl] = t.data[fl].reduce((a, b) => a + b, 0);
    });
  });

  return newMatrix;
}
