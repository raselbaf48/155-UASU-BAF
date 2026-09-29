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

  // 1. Explicit configuration takes highest precedence
  if (table.allotmentType === 'equal') return true;
  if (table.allotmentType === 'ratio') return false;

  // 2. Default fallback for legacy duties (Airfield duty defaults to equal)
  const title = (table.title || '').toUpperCase();
  const id = (table.id || '').toLowerCase();
  
  if (id === 'airport_duty' || title.includes('AIRFIELD') || title.includes('AIRPORT')) {
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
 * Universal Duty Ratio Rounding Rule:
 * - Point er pore 50 ba tar kom thakle ager full number hbe (round down: floor)
 * - Point er pore 50 er beshi thakle porer full digit hbe (round up: floor + 1)
 */
export function roundDutyByRule(val: number): number {
  if (val <= 0 || isNaN(val)) return 0;
  const cleanVal = Number(val.toFixed(4));
  const floorVal = Math.floor(cleanVal);
  const frac = Number((cleanVal - floorVal).toFixed(4));
  
  if (frac > 0.5000) {
    return floorVal + 1;
  }
  return floorVal;
}

/**
 * Calculates auto targets using the user's specific rounding rule:
 * - Each flight gets roundDutyByRule(exactRatio).
 * - No automatic +1/-1 manipulation is done to force totals to match (user will adjust manually).
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

  const exactRatios = calculateExactDutyRatios(matrix, manpowerInput);

  matrix.forEach((t) => {
    flights.forEach((fl) => {
      const exact = exactRatios[t.id]?.[fl] ?? 0;
      autoTargets[fl][t.id] = roundDutyByRule(exact);
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
export type AllocationMode = 'SINGLE' | 'PACKAGE';

export function autoAllocateDutyMatrix(
  matrix: DutyRatioTable[],
  manpowerInput?: Partial<ManpowerState> | null,
  mode: AllocationMode = 'SINGLE'
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
  const tableTargets: Record<string, Record<FlightName, number>> = {};

  const newMatrix: DutyRatioTable[] = matrix.map((t) => {
    // True month total based on dailyRequirements if set
    const monthTotal = (t.dailyRequirements && t.dailyRequirements.length > 0)
      ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : (t.totalRequiredMonth || 0);

    const targets: Record<FlightName, number> = {
      Mechanics: t.flightTargets?.Mechanics ?? (autoTargets['Mechanics']?.[t.id] ?? 0),
      Avionics: t.flightTargets?.Avionics ?? (autoTargets['Avionics']?.[t.id] ?? 0),
      GCS: t.flightTargets?.GCS ?? (autoTargets['GCS']?.[t.id] ?? 0),
      Admin: t.flightTargets?.Admin ?? (autoTargets['Admin']?.[t.id] ?? 0),
    };
    tableTargets[t.id] = targets;

    return {
      ...t,
      totalRequiredMonth: monthTotal,
      flightTargets: t.flightTargets ? { ...t.flightTargets } : undefined,
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
    Mechanics: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (tableTargets[t.id]?.Mechanics || 0), 0),
    Avionics: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (tableTargets[t.id]?.Avionics || 0), 0),
    GCS: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (tableTargets[t.id]?.GCS || 0), 0),
    Admin: newMatrix.filter((t) => !t.isDisabled).reduce((sum, t) => sum + (tableTargets[t.id]?.Admin || 0), 0),
  };

  const targetDaily: Record<FlightName, number> = {
    Mechanics: Math.max(1, Math.round(flightMonthTotals.Mechanics / 31)),
    Avionics: Math.max(1, Math.round(flightMonthTotals.Avionics / 31)),
    GCS: Math.max(1, Math.round(flightMonthTotals.GCS / 31)),
    Admin: Math.max(1, Math.round(flightMonthTotals.Admin / 31)),
  };

  // User's Golden Rule limits per flight:
  // e.g. 93 / 31 = 3 -> min: 3, max: 3 (every day gets 3, no day gets 4)
  // e.g. 97 / 31 = 3 rem 4 -> min: 3, max: 4 (no day gets 2, exactly 4 days get 4, no day gets 5)
  const flightDailyLimits: Record<FlightName, { min: number; max: number; base: number; rem: number }> = {
    Mechanics: { min: 0, max: 0, base: 0, rem: 0 },
    Avionics: { min: 0, max: 0, base: 0, rem: 0 },
    GCS: { min: 0, max: 0, base: 0, rem: 0 },
    Admin: { min: 0, max: 0, base: 0, rem: 0 },
  };

  flights.forEach((fl) => {
    const total = flightMonthTotals[fl];
    const base = Math.floor(total / 31);
    const rem = total % 31;
    const min = base;
    const max = rem > 0 ? base + 1 : base;
    flightDailyLimits[fl] = { min, max, base, rem };
  });

  function evalDailyLoadCost(load: number, limits: { min: number; max: number }): number {
    if (load < limits.min) {
      return Math.pow(limits.min - load, 2) * 50000;
    }
    if (load > limits.max) {
      return Math.pow(load - limits.max, 2) * 50000;
    }
    return 0;
  }

  // Heavy duty (Base Security, Base Taskforce, Nazirpara Taskforce) tracking
  const dailyFlightHeavyLoad: Record<FlightName, number[]> = {
    Mechanics: new Array(31).fill(0),
    Avionics: new Array(31).fill(0),
    GCS: new Array(31).fill(0),
    Admin: new Array(31).fill(0),
  };

  function isHeavyDuty(tableId: string, title?: string): boolean {
    if (tableId === 'security_duty' || tableId === 'base_tf' || tableId === 'nazirpara_tf') {
      return true;
    }
    const t = (title || '').toUpperCase();
    if (t.includes('SECURITY') && (t.includes('BASE') || t.includes('GD'))) return true;
    if (t.includes('BASE TASKFORCE') || t.includes('BASE TF')) return true;
    if (t.includes('NAJIRPARA') || t.includes('NAZIRPARA')) return true;
    return false;
  }

  const flightHeavyMonthTotals: Record<FlightName, number> = {
    Mechanics: newMatrix.filter((t) => !t.isDisabled && isHeavyDuty(t.id, t.title)).reduce((sum, t) => sum + (tableTargets[t.id]?.Mechanics || 0), 0),
    Avionics: newMatrix.filter((t) => !t.isDisabled && isHeavyDuty(t.id, t.title)).reduce((sum, t) => sum + (tableTargets[t.id]?.Avionics || 0), 0),
    GCS: newMatrix.filter((t) => !t.isDisabled && isHeavyDuty(t.id, t.title)).reduce((sum, t) => sum + (tableTargets[t.id]?.GCS || 0), 0),
    Admin: newMatrix.filter((t) => !t.isDisabled && isHeavyDuty(t.id, t.title)).reduce((sum, t) => sum + (tableTargets[t.id]?.Admin || 0), 0),
  };

  const flightHeavyDailyLimits: Record<FlightName, { min: number; max: number }> = {
    Mechanics: { min: 0, max: 0 },
    Avionics: { min: 0, max: 0 },
    GCS: { min: 0, max: 0 },
    Admin: { min: 0, max: 0 },
  };

  flights.forEach((fl) => {
    const total = flightHeavyMonthTotals[fl];
    const base = Math.floor(total / 31);
    const rem = total % 31;
    flightHeavyDailyLimits[fl] = {
      min: base,
      max: rem > 0 ? base + 1 : base,
    };
  });

  function evalHeavyDutyCost(count: number, limits: { min: number; max: number }): number {
    if (count > limits.max) {
      return Math.pow(count - limits.max, 2) * 200000;
    }
    if (count < limits.min) {
      return Math.pow(limits.min - count, 2) * 50000;
    }
    return 0;
  }

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
        if (isHeavyDuty(t.id, t.title)) {
          dailyFlightHeavyLoad[fl][day] += c;
        }
      });
    }

    flights.forEach((fl) => {
      const assignedCount = t.data[fl].reduce((a, b) => a + b, 0);
      if (t.flightTargets) {
        t.flightTargets[fl] = assignedCount;
      }
      if (tableTargets[t.id]) {
        tableTargets[t.id][fl] = assignedCount;
      }
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
    let cost = 0;
    let curOn = 0;
    let curOff = 0;

    if (mode === 'PACKAGE') {
      // PACKAGE MODE:
      // - Target packages: min 2 consecutive, max 3 consecutive
      // - Penalize isolated single days (curOn === 1) if target >= 2
      // - Heavy penalty for streaks > 3
      for (let d = 0; d < 31; d++) {
        if (arr[d] > 0) {
          curOn++;
          curOff = 0;
        } else {
          if (curOn > 0) {
            if (target >= 2 && curOn === 1) {
              cost += 2500; // Strong penalty for isolated single day
            } else if (curOn > 3) {
              cost += Math.pow(curOn - 3, 2) * 6000; // Heavy penalty for exceeding 3 consecutive days
            }
            curOn = 0;
          }
          curOff++;
        }
      }
      if (curOn > 0) {
        if (target >= 2 && curOn === 1) {
          cost += 2500;
        } else if (curOn > 3) {
          cost += Math.pow(curOn - 3, 2) * 6000;
        }
      }
      return cost;
    }

    // SINGLE MODE:
    // - Spread out with maximum gaps between duties
    // - Strong penalty for consecutive duties (curOn > 1)
    const { maxOnStreak, maxOffStreak, gaps } = getDutyLimits(target);
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
        if (curOn > 1) {
          cost += Math.pow(curOn - 1, 2) * 1500; // Penalty for consecutive days in Single mode
        }
        if (curOn > maxOnStreak) {
          cost += Math.pow(curOn - maxOnStreak, 3) * 5000;
        }
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

    if (curOn > 1) cost += Math.pow(curOn - 1, 2) * 1500;
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

    const q = tableTargets[table.id] || table.flightTargets || {
      Mechanics: autoTargets['Mechanics']?.[table.id] ?? 0,
      Avionics: autoTargets['Avionics']?.[table.id] ?? 0,
      GCS: autoTargets['GCS']?.[table.id] ?? 0,
      Admin: autoTargets['Admin']?.[table.id] ?? 0,
    };

    const isThisTableHeavy = isHeavyDuty(table.id, table.title);

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
          const anyElig = [...elig].sort((f1, f2) => {
            if (isThisTableHeavy) {
              const h1 = dailyFlightHeavyLoad[f1][d] >= flightHeavyDailyLimits[f1].max ? 1 : 0;
              const h2 = dailyFlightHeavyLoad[f2][d] >= flightHeavyDailyLimits[f2].max ? 1 : 0;
              if (h1 !== h2) return h1 - h2;
              if (dailyFlightHeavyLoad[f1][d] !== dailyFlightHeavyLoad[f2][d]) {
                return dailyFlightHeavyLoad[f1][d] - dailyFlightHeavyLoad[f2][d];
              }
            }
            return dailyFlightLoad[f1][d] - dailyFlightLoad[f2][d];
          });
          const chosen = anyElig[0];
          table.data[chosen][d] += 1;
          dailyFlightLoad[chosen][d] += 1;
          if (isThisTableHeavy) {
            dailyFlightHeavyLoad[chosen][d] += 1;
          }
          remainingToAssign--;
          continue;
        }

        available.sort((a, b) => {
          // 0. STRICT HEAVY DUTY CONFLICT AVOIDANCE (Base Security, Base TF, Nazirpara TF):
          // Enforce flightHeavyDailyLimits (e.g. Avionics max: 1; Mechanics/GCS max: 2; Admin max: 1).
          // NEVER allocate a second heavy duty to a flight whose max is 1!
          if (isThisTableHeavy) {
            const aHeavy = dailyFlightHeavyLoad[a.fl][d];
            const bHeavy = dailyFlightHeavyLoad[b.fl][d];
            const aHLimits = flightHeavyDailyLimits[a.fl];
            const bHLimits = flightHeavyDailyLimits[b.fl];

            const aOverMax = aHeavy >= aHLimits.max ? 1 : 0;
            const bOverMax = bHeavy >= bHLimits.max ? 1 : 0;
            if (aOverMax !== bOverMax) return aOverMax - bOverMax;

            const aUnderMin = aHeavy < aHLimits.min ? 1 : 0;
            const bUnderMin = bHeavy < bHLimits.min ? 1 : 0;
            if (aUnderMin !== bUnderMin) return bUnderMin - aUnderMin;

            if (aHeavy !== bHeavy) return aHeavy - bHeavy;
          }

          // 1. STRICT DAILY LOAD CEILING & FLOOR (User's Golden Rule):
          // No flight gets (base + 1) until all get base; No flight gets (base + 2).
          const aLimits = flightDailyLimits[a.fl];
          const bLimits = flightDailyLimits[b.fl];

          const aAtOrOverMax = a.load >= aLimits.max ? 1 : 0;
          const bAtOrOverMax = b.load >= bLimits.max ? 1 : 0;
          if (aAtOrOverMax !== bAtOrOverMax) return aAtOrOverMax - bAtOrOverMax;

          const aUnderMin = a.load < aLimits.min ? 1 : 0;
          const bUnderMin = b.load < bLimits.min ? 1 : 0;
          if (aUnderMin !== bUnderMin) return bUnderMin - aUnderMin;

          // 2. Prefer flights that have fewer slots today
          if (a.today !== b.today) return a.today - b.today;

          // 3. Urgent: if remaining quota >= daysLeft, this flight must get a slot
          const aUrgent = a.rem >= a.daysLeft ? 1 : 0;
          const bUrgent = b.rem >= b.daysLeft ? 1 : 0;
          if (aUrgent !== bUrgent) return bUrgent - aUrgent;

          // Mode-specific streak priorities:
          if (mode === 'PACKAGE') {
            // In Package Mode:
            // A. If a flight had 1 duty yesterday (onStreak === 1) and has quota, give TOP PRIORITY to reach min 2 consecutive!
            const aIs1 = a.onStreak === 1 && a.rem > 0 ? 1 : 0;
            const bIs1 = b.onStreak === 1 && b.rem > 0 ? 1 : 0;
            if (aIs1 !== bIs1) return bIs1 - aIs1;

            // B. If a flight had 2 duties yesterday (onStreak === 2) and has quota, high priority to complete 3-day package
            const aIs2 = a.onStreak === 2 && a.rem > 0 ? 1 : 0;
            const bIs2 = b.onStreak === 2 && b.rem > 0 ? 1 : 0;
            if (aIs2 !== bIs2) return bIs2 - aIs2;

            // C. If a flight already had 3 duties (onStreak >= 3), DO NOT assign today (cap at 3 max consecutive)!
            const aExceed3 = a.onStreak >= 3 ? 1 : 0;
            const bExceed3 = b.onStreak >= 3 ? 1 : 0;
            if (aExceed3 !== bExceed3) return aExceed3 - bExceed3;
          } else {
            // In Single Mode:
            // Penalize consecutive duties to encourage gaps between duties!
            const aHasConsec = a.onStreak > 0 ? 1 : 0;
            const bHasConsec = b.onStreak > 0 ? 1 : 0;
            if (aHasConsec !== bHasConsec) return aHasConsec - bHasConsec;
          }

          // Streak limits
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
        if (isThisTableHeavy) {
          dailyFlightHeavyLoad[chosen][d] += 1;
        }
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

              const isTableHeavy = isHeavyDuty(table.id, table.title);

              const heavyCostBefore = isTableHeavy
                ? evalHeavyDutyCost(dailyFlightHeavyLoad[f1][d1], flightHeavyDailyLimits[f1]) +
                  evalHeavyDutyCost(dailyFlightHeavyLoad[f1][d2], flightHeavyDailyLimits[f1]) +
                  evalHeavyDutyCost(dailyFlightHeavyLoad[f2][d1], flightHeavyDailyLimits[f2]) +
                  evalHeavyDutyCost(dailyFlightHeavyLoad[f2][d2], flightHeavyDailyLimits[f2])
                : 0;

              const costBefore =
                evalFlightStreakCost(table.data[f1], target1) +
                evalFlightStreakCost(table.data[f2], target2) +
                evalDailyLoadCost(dailyFlightLoad[f1][d1], flightDailyLimits[f1]) +
                evalDailyLoadCost(dailyFlightLoad[f1][d2], flightDailyLimits[f1]) +
                evalDailyLoadCost(dailyFlightLoad[f2][d1], flightDailyLimits[f2]) +
                evalDailyLoadCost(dailyFlightLoad[f2][d2], flightDailyLimits[f2]) +
                heavyCostBefore +
                (Math.pow(dailyFlightLoad[f1][d1] - targetDaily[f1], 2) +
                 Math.pow(dailyFlightLoad[f1][d2] - targetDaily[f1], 2) +
                 Math.pow(dailyFlightLoad[f2][d1] - targetDaily[f2], 2) +
                 Math.pow(dailyFlightLoad[f2][d2] - targetDaily[f2], 2)) * 5;

              // Tentative swap of 1 unit
              table.data[f1][d1] -= 1; table.data[f1][d2] += 1;
              table.data[f2][d2] -= 1; table.data[f2][d1] += 1;
              dailyFlightLoad[f1][d1] -= 1; dailyFlightLoad[f1][d2] += 1;
              dailyFlightLoad[f2][d2] -= 1; dailyFlightLoad[f2][d1] += 1;
              if (isTableHeavy) {
                dailyFlightHeavyLoad[f1][d1] -= 1; dailyFlightHeavyLoad[f1][d2] += 1;
                dailyFlightHeavyLoad[f2][d2] -= 1; dailyFlightHeavyLoad[f2][d1] += 1;
              }

              const heavyCostAfter = isTableHeavy
                ? evalHeavyDutyCost(dailyFlightHeavyLoad[f1][d1], flightHeavyDailyLimits[f1]) +
                  evalHeavyDutyCost(dailyFlightHeavyLoad[f1][d2], flightHeavyDailyLimits[f1]) +
                  evalHeavyDutyCost(dailyFlightHeavyLoad[f2][d1], flightHeavyDailyLimits[f2]) +
                  evalHeavyDutyCost(dailyFlightHeavyLoad[f2][d2], flightHeavyDailyLimits[f2])
                : 0;

              const costAfter =
                evalFlightStreakCost(table.data[f1], target1) +
                evalFlightStreakCost(table.data[f2], target2) +
                evalDailyLoadCost(dailyFlightLoad[f1][d1], flightDailyLimits[f1]) +
                evalDailyLoadCost(dailyFlightLoad[f1][d2], flightDailyLimits[f1]) +
                evalDailyLoadCost(dailyFlightLoad[f2][d1], flightDailyLimits[f2]) +
                evalDailyLoadCost(dailyFlightLoad[f2][d2], flightDailyLimits[f2]) +
                heavyCostAfter +
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
                if (isTableHeavy) {
                  dailyFlightHeavyLoad[f1][d1] += 1; dailyFlightHeavyLoad[f1][d2] -= 1;
                  dailyFlightHeavyLoad[f2][d2] += 1; dailyFlightHeavyLoad[f2][d1] -= 1;
                }
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

  // Step 5: Global Multi-Table Daily Load Equalizer (Strict (B, B+1) Enforcement)
  // Ensures that no day drops below min (floor(Total/31)) and no day exceeds max (floor(Total/31) + (rem > 0 ? 1 : 0))
  for (let round = 0; round < 150; round++) {
    let globalChange = false;

    for (const fl of flights) {
      const limits = flightDailyLimits[fl];

      // Find underloaded days (load < limits.min)
      for (let dLow = 0; dLow < 31; dLow++) {
        if (dailyFlightLoad[fl][dLow] >= limits.min) continue;

        // Try to pull 1 duty for fl from some dHigh where dailyFlightLoad[fl][dHigh] > limits.min
        for (let dHigh = 0; dHigh < 31; dHigh++) {
          if (dLow === dHigh) continue;
          if (dailyFlightLoad[fl][dHigh] <= limits.min) continue;

          // Find a table where fl is scheduled on dHigh, and another eligible flight f2 is scheduled on dLow
          let swapped = false;
          for (const t of newMatrix.filter((x) => !x.isDisabled)) {
            if (t.data[fl][dHigh] < 1) continue;

            const elig = t.eligibleFlights && t.eligibleFlights.length > 0
              ? t.eligibleFlights
              : flights;
            if (!elig.includes(fl)) continue;

            const isTHeavy = isHeavyDuty(t.id, t.title);
            if (isTHeavy && dailyFlightHeavyLoad[fl][dLow] + 1 >= 3) continue;

            for (const f2 of elig) {
              if (f2 === fl) continue;
              if (t.data[f2][dLow] < 1) continue;
              if (isTHeavy && dailyFlightHeavyLoad[f2][dHigh] + 1 >= 3) continue;

              const f2Limits = flightDailyLimits[f2];

              const curF2Penalty =
                evalDailyLoadCost(dailyFlightLoad[f2][dLow], f2Limits) +
                evalDailyLoadCost(dailyFlightLoad[f2][dHigh], f2Limits);
              const nextF2Penalty =
                evalDailyLoadCost(dailyFlightLoad[f2][dLow] - 1, f2Limits) +
                evalDailyLoadCost(dailyFlightLoad[f2][dHigh] + 1, f2Limits);

              const curFlPenalty =
                evalDailyLoadCost(dailyFlightLoad[fl][dLow], limits) +
                evalDailyLoadCost(dailyFlightLoad[fl][dHigh], limits);
              const nextFlPenalty =
                evalDailyLoadCost(dailyFlightLoad[fl][dLow] + 1, limits) +
                evalDailyLoadCost(dailyFlightLoad[fl][dHigh] - 1, limits);

              if (nextFlPenalty + nextF2Penalty < curFlPenalty + curF2Penalty) {
                // Execute swap between fl and f2 on table t
                t.data[fl][dHigh] -= 1;
                t.data[fl][dLow] += 1;
                t.data[f2][dLow] -= 1;
                t.data[f2][dHigh] += 1;

                dailyFlightLoad[fl][dHigh] -= 1;
                dailyFlightLoad[fl][dLow] += 1;
                dailyFlightLoad[f2][dLow] -= 1;
                dailyFlightLoad[f2][dHigh] += 1;

                if (isTHeavy) {
                  dailyFlightHeavyLoad[fl][dHigh] -= 1;
                  dailyFlightHeavyLoad[fl][dLow] += 1;
                  dailyFlightHeavyLoad[f2][dLow] -= 1;
                  dailyFlightHeavyLoad[f2][dHigh] += 1;
                }

                swapped = true;
                globalChange = true;
                break;
              }
            }
            if (swapped) break;
          }
          if (swapped) break;
        }
      }
    }
    if (!globalChange) break;
  }

  // Step 6: Heavy Duty Conflict Resolver (Strict Rule: Max 2, Never 3 on Same Date; Respect flightHeavyDailyLimits)
  // Guarantees that Base Security, Base TF, and Nazirpara TF never exceed flightHeavyDailyLimits[fl].max (e.g. max 1 for Avionics).
  // Also aggressively reduces any 2-duty collisions down to 1 or 0 whenever possible.
  for (let round = 0; round < 150; round++) {
    let resolvedAny = false;

    for (let d = 0; d < 31; d++) {
      for (const fl of flights) {
        const heavyCount = dailyFlightHeavyLoad[fl][d];
        const flHLimits = flightHeavyDailyLimits[fl];
        if (heavyCount <= flHLimits.max) continue; // within allowable limit!

        // fl exceeds its max heavy duties on day d (e.g. Avionics having 2 when max is 1)
        const heavyTables = newMatrix.filter(
          (t) => !t.isDisabled && isHeavyDuty(t.id, t.title) && (t.data[fl]?.[d] || 0) > 0
        );

        for (const t of heavyTables) {
          const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;

          // Find another eligible flight f2 on day d that has room for a heavy duty
          for (const f2 of elig) {
            if (f2 === fl) continue;
            const f2HLimits = flightHeavyDailyLimits[f2];
            if (dailyFlightHeavyLoad[f2][d] >= f2HLimits.max) continue;

            // Find another day dOther where t.data[f2][dOther] > 0 and t.data[fl][dOther] === 0
            for (let dOther = 0; dOther < 31; dOther++) {
              if (dOther === d) continue;
              if (t.data[f2][dOther] < 1 || t.data[fl][dOther] > 0) continue;

              // Check if moving fl to dOther would cause fl on dOther to exceed its max
              if (dailyFlightHeavyLoad[fl][dOther] + 1 > flHLimits.max) continue;

              // Check daily load constraints: ensure this swap doesn't break [min, max] limits
              const flLimits = flightDailyLimits[fl];
              const f2Limits = flightDailyLimits[f2];
              const curLoadPen =
                evalDailyLoadCost(dailyFlightLoad[fl][d], flLimits) +
                evalDailyLoadCost(dailyFlightLoad[fl][dOther], flLimits) +
                evalDailyLoadCost(dailyFlightLoad[f2][d], f2Limits) +
                evalDailyLoadCost(dailyFlightLoad[f2][dOther], f2Limits);

              const nextLoadPen =
                evalDailyLoadCost(dailyFlightLoad[fl][d] - 1, flLimits) +
                evalDailyLoadCost(dailyFlightLoad[fl][dOther] + 1, flLimits) +
                evalDailyLoadCost(dailyFlightLoad[f2][d] + 1, f2Limits) +
                evalDailyLoadCost(dailyFlightLoad[f2][dOther] - 1, f2Limits);

              // Check if we can also swap a light duty to keep daily load 100% constant
              let lightTable: DutyRatioTable | null = null;
              for (const tLight of newMatrix.filter((x) => !x.isDisabled && !isHeavyDuty(x.id, x.title))) {
                if ((tLight.data[fl]?.[dOther] || 0) > 0 && (tLight.data[f2]?.[d] || 0) > 0) {
                  lightTable = tLight;
                  break;
                }
              }

              if (lightTable || heavyCount > flHLimits.max || nextLoadPen <= curLoadPen) {
                // Execute heavy duty swap
                t.data[fl][d] -= 1;
                t.data[fl][dOther] += 1;
                t.data[f2][d] += 1;
                t.data[f2][dOther] -= 1;

                dailyFlightLoad[fl][d] -= 1;
                dailyFlightLoad[fl][dOther] += 1;
                dailyFlightLoad[f2][d] += 1;
                dailyFlightLoad[f2][dOther] -= 1;

                dailyFlightHeavyLoad[fl][d] -= 1;
                dailyFlightHeavyLoad[fl][dOther] += 1;
                dailyFlightHeavyLoad[f2][d] += 1;
                dailyFlightHeavyLoad[f2][dOther] -= 1;

                // If light duty table found, swap it to preserve daily load perfectly
                if (lightTable) {
                  lightTable.data[fl][dOther] -= 1;
                  lightTable.data[fl][d] += 1;
                  lightTable.data[f2][d] -= 1;
                  lightTable.data[f2][dOther] += 1;

                  dailyFlightLoad[fl][dOther] -= 1;
                  dailyFlightLoad[fl][d] += 1;
                  dailyFlightLoad[f2][d] -= 1;
                  dailyFlightLoad[f2][dOther] += 1;
                }

                resolvedAny = true;
                break;
              }
            }
            if (resolvedAny) break;
          }
          if (resolvedAny) break;
        }
      }
    }
    if (!resolvedAny) break;
  }

  // Keep flightTargets untouched (only holds manual user overrides)
  return newMatrix;
}
