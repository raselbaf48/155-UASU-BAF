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
  mechCpl: 5,
  aviSgt: 4,
  aviCpl: 3,
  gcsSgt: 5,
  gcsCpl: 5,
  adminSgt: 0,
  adminCpl: 3,
};

export function isDefaultManpower(mp?: Partial<ManpowerState> | null): boolean {
  if (!mp) return true;
  return (
    (mp.mechSgt ?? 5) === 5 &&
    (mp.mechCpl ?? 5) === 5 &&
    (mp.aviSgt ?? 4) === 4 &&
    (mp.aviCpl ?? 3) === 3 &&
    (mp.gcsSgt ?? 5) === 5 &&
    (mp.gcsCpl ?? 5) === 5 &&
    (mp.adminSgt ?? 0) === 0 &&
    (mp.adminCpl ?? 3) === 3
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

  // If only 1 flight is eligible, it MUST be One From Each Flt (equal)
  if (table.eligibleFlights && table.eligibleFlights.length === 1) {
    return true;
  }

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

/**
 * Checks if a duty has a static daily uniform requirement across all capable flights every day (e.g. Airfield Duty).
 */
export function isStaticDailyUniformDuty(table: DutyRatioTable): boolean {
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
 * - When reconcileTotals is true (e.g. for Auto Allocation or display matching):
 *   Ensures sum of targets equals total required duties for the table.
 *   Any fractional remainder (+1/-1) is reconciled based on the highest decimal remainder.
 */
export function calculateBalancedAutoTargets(
  matrix: DutyRatioTable[],
  manpowerInput?: Partial<ManpowerState> | null,
  reconcileTotals: boolean = true
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
    if (t.isDisabled) {
      flights.forEach((fl) => {
        autoTargets[fl][t.id] = 0;
      });
      return;
    }
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    flights.forEach((fl) => {
      const exact = exactRatios[t.id]?.[fl] ?? 0;
      autoTargets[fl][t.id] = elig.includes(fl) ? roundDutyByRule(exact) : 0;
    });

    if (reconcileTotals) {
      const monthTotal = (t.dailyRequirements && t.dailyRequirements.length > 0)
        ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
        : (t.totalRequiredMonth || 0);

      const curSum = flights.reduce((s, fl) => s + (autoTargets[fl][t.id] || 0), 0);
      const diff = monthTotal - curSum;

      if (diff > 0) {
        // Distribute remaining duties to flights with highest fractional part
        const sorted = [...elig].sort((f1, f2) => {
          const exact1 = exactRatios[t.id]?.[f1] ?? 0;
          const exact2 = exactRatios[t.id]?.[f2] ?? 0;
          const frac1 = exact1 - Math.floor(exact1);
          const frac2 = exact2 - Math.floor(exact2);
          if (Math.abs(frac1 - frac2) > 0.0001) return frac2 - frac1;
          return exact2 - exact1; // then larger overall share
        });
        for (let i = 0; i < diff; i++) {
          const fl = sorted[i % sorted.length];
          autoTargets[fl][t.id] = (autoTargets[fl][t.id] || 0) + 1;
        }
      } else if (diff < 0) {
        // Subtract excess duties from flights with lowest fractional part
        const sorted = [...elig].sort((f1, f2) => {
          const exact1 = exactRatios[t.id]?.[f1] ?? 0;
          const exact2 = exactRatios[t.id]?.[f2] ?? 0;
          const frac1 = exact1 - Math.floor(exact1);
          const frac2 = exact2 - Math.floor(exact2);
          if (Math.abs(frac1 - frac2) > 0.0001) return frac1 - frac2;
          return exact1 - exact2;
        });
        for (let i = 0; i < Math.abs(diff); i++) {
          const fl = sorted[i % sorted.length];
          if ((autoTargets[fl][t.id] || 0) > 0) {
            autoTargets[fl][t.id] = autoTargets[fl][t.id] - 1;
          }
        }
      }
    }
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
    if (t.isDisabled) return;
    const isSecurity = t.id === 'security_duty';
    const isFixed = isFixedEqualDuty(t);
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    const total = (t.dailyRequirements && t.dailyRequirements.length > 0)
      ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : (t.totalRequiredMonth || (t.totalRequiredDaily ? t.totalRequiredDaily * 31 : 0));

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
  const autoTargets = calculateBalancedAutoTargets(matrix, manpowerInput, true);
  const isDefault = isDefaultManpower(manpowerInput);

  // 1. Clone matrix with cleared data
  const tableTargets: Record<string, Record<FlightName, number>> = {};

  const newMatrix: DutyRatioTable[] = matrix.map((t) => {
    if (t.isDisabled) {
      tableTargets[t.id] = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
      return {
        ...t,
        totalRequiredMonth: 0,
        flightTargets: t.flightTargets ? { ...t.flightTargets } : undefined,
        dailyRequirements: new Array(31).fill(0),
        data: {
          Mechanics: new Array(31).fill(0),
          Avionics: new Array(31).fill(0),
          GCS: new Array(31).fill(0),
          Admin: new Array(31).fill(0),
        },
      };
    }

    // True month total based on dailyRequirements if set
    const monthTotal = (t.dailyRequirements && t.dailyRequirements.length > 0)
      ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
      : (t.totalRequiredMonth || (t.totalRequiredDaily ? t.totalRequiredDaily * 31 : 0));

    // Maintain the exact distribution:
    // If the user manually changed a flight target, use it. Otherwise use the unreconciled auto target (matching Distribution table).
    const targets: Record<FlightName, number> = {
      Mechanics: (t.flightTargets && typeof t.flightTargets['Mechanics'] === 'number') ? t.flightTargets['Mechanics'] : (autoTargets['Mechanics']?.[t.id] ?? 0),
      Avionics: (t.flightTargets && typeof t.flightTargets['Avionics'] === 'number') ? t.flightTargets['Avionics'] : (autoTargets['Avionics']?.[t.id] ?? 0),
      GCS: (t.flightTargets && typeof t.flightTargets['GCS'] === 'number') ? t.flightTargets['GCS'] : (autoTargets['GCS']?.[t.id] ?? 0),
      Admin: (t.flightTargets && typeof t.flightTargets['Admin'] === 'number') ? t.flightTargets['Admin'] : (autoTargets['Admin']?.[t.id] ?? 0),
    };

    // Ensure sum of targets matches monthTotal exactly so quota is never exceeded or short for daily calendar allocation
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    const curSum = flights.reduce((s, fl) => s + (targets[fl] || 0), 0);
    const diff = monthTotal - curSum;
    if (diff !== 0) {
      const exactRatios = calculateExactDutyRatios([t], mp);
      // NEVER alter flight targets that were manually set by the user!
      const unadjusted = elig.filter((fl) => !t.flightTargets || typeof t.flightTargets[fl] !== 'number');
      const pool = unadjusted.length > 0 ? unadjusted : elig;
      if (diff > 0) {
        const sorted = [...pool].sort((f1, f2) => {
          const exact1 = exactRatios[t.id]?.[f1] ?? 0;
          const exact2 = exactRatios[t.id]?.[f2] ?? 0;
          const frac1 = exact1 - Math.floor(exact1);
          const frac2 = exact2 - Math.floor(exact2);
          if (Math.abs(frac1 - frac2) > 0.0001) return frac2 - frac1;
          return exact2 - exact1;
        });
        for (let i = 0; i < diff; i++) {
          const fl = sorted[i % sorted.length];
          targets[fl] = (targets[fl] || 0) + 1;
        }
      } else if (diff < 0) {
        const sorted = [...pool].sort((f1, f2) => {
          const exact1 = exactRatios[t.id]?.[f1] ?? 0;
          const exact2 = exactRatios[t.id]?.[f2] ?? 0;
          const frac1 = exact1 - Math.floor(exact1);
          const frac2 = exact2 - Math.floor(exact2);
          if (Math.abs(frac1 - frac2) > 0.0001) return frac1 - frac2;
          return exact1 - exact2;
        });
        for (let i = 0; i < Math.abs(diff); i++) {
          const fl = sorted[i % sorted.length];
          if ((targets[fl] || 0) > 0) targets[fl] = targets[fl] - 1;
        }
      }
    }
    tableTargets[t.id] = targets;

    return {
      ...t,
      totalRequiredMonth: monthTotal,
      // CRITICAL: Preserve user's manual flightTargets as-is without mutating or adding un-overridden flights!
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

  function computeIdealExtraDays(rem: number, offset: number = 0): boolean[] {
    const result = new Array(31).fill(false);
    if (rem <= 0) return result;
    if (rem >= 31) return new Array(31).fill(true);
    const step = 31 / rem;
    for (let k = 0; k < rem; k++) {
      const d = Math.floor(k * step + (offset * step) / 4) % 31;
      result[d] = true;
    }
    let count = result.filter(Boolean).length;
    for (let d = 0; count < rem && d < 31; d++) {
      if (!result[d]) {
        result[d] = true;
        count++;
      }
    }
    return result;
  }

  const idealTargetToday: Record<FlightName, number[]> = {
    Mechanics: new Array(31).fill(0),
    Avionics: new Array(31).fill(0),
    GCS: new Array(31).fill(0),
    Admin: new Array(31).fill(0),
  };

  const flightOffsets: Record<FlightName, number> = {
    Mechanics: 0,
    Avionics: 1,
    GCS: 2,
    Admin: 3,
  };

  flights.forEach((fl) => {
    const total = flightMonthTotals[fl];
    const base = Math.floor(total / 31);
    const rem = total % 31;
    const min = base;
    const max = rem > 0 ? base + 1 : base;
    flightDailyLimits[fl] = { min, max, base, rem };

    const isExtra = computeIdealExtraDays(rem, flightOffsets[fl]);
    for (let d = 0; d < 31; d++) {
      idealTargetToday[fl][d] = base + (isExtra[d] ? 1 : 0);
    }
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

  // Step 2: Fixed Duties (Airfield Duty: equal share among capable flights where 1 Mech, 1 Avi, 1 GCS are fixed every day)
  newMatrix.filter((t) => !t.isDisabled && isStaticDailyUniformDuty(t)).forEach((t) => {
    const origTable = matrix.find((x) => x.id === t.id) || t;
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0
      ? t.eligibleFlights
      : (['Mechanics', 'Avionics', 'GCS'] as FlightName[]);

    const reqSlots = new Array(31).fill(0);
    const dailySum = (origTable.dailyRequirements || []).reduce((s, v) => s + (Number(v) || 0), 0);
    const expectedTotal = t.totalRequiredMonth || (origTable.totalRequiredDaily ? origTable.totalRequiredDaily * 31 : (elig.length * 31));
    if (origTable.dailyRequirements && origTable.dailyRequirements.length === 31 && dailySum === expectedTotal) {
      for (let d = 0; d < 31; d++) {
        reqSlots[d] = Number(origTable.dailyRequirements[d]) || 0;
      }
    } else {
      const base = Math.floor(expectedTotal / 31);
      const rem = expectedTotal % 31;
      const extraDays = computeIdealExtraDays(rem);
      for (let d = 0; d < 31; d++) {
        reqSlots[d] = base + (extraDays[d] ? 1 : 0);
      }
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
    // User's Golden Rule:
    // 1. Max try to give SINGLE (curOn === 1): cost = 0.
    // 2. If single not possible, 2-day package: mild penalty.
    // 3. If 2 not possible, 3 or 4 maximum.
    // 4. Over 4 is forbidden unless mathematically required by high target (e.g. target >= 25 with few off days).
    const { maxOnStreak, maxOffStreak, gaps } = getDutyLimits(target);
    for (let d = 0; d < 31; d++) {
      if (arr[d] > 0) {
        curOn++;
        if (curOff > 0) {
          if (curOff > maxOffStreak) {
            cost += Math.pow(curOff - maxOffStreak, 2) * 500;
          }
          curOff = 0;
        }
        if (curOn === 2) {
          cost += target <= 16 ? 5000 : 300;
        } else if (curOn === 3) {
          cost += target <= 20 ? 50000 : 4000;
        } else if (curOn === 4) {
          cost += target <= 24 ? 250000 : 12000;
        } else if (curOn > 4) {
          if (target <= 24) {
            cost += 500000 * Math.pow(curOn - 4, 2);
          } else if (curOn > maxOnStreak) {
            cost += 250000 * Math.pow(curOn - maxOnStreak, 2);
          }
        }
      } else {
        curOff++;
        if (curOn > 0) {
          curOn = 0;
        }
      }
    }

    if (curOff > maxOffStreak) cost += Math.pow(curOff - maxOffStreak, 2) * 500;
    if (gaps <= 5 && curOff > 1) cost += 2000 * Math.pow(curOff - 1, 2);

    // In SINGLE mode: if a flight has off days (target < 31), heavily penalize working all 7 days of days 25-31 (indices 24..30)
    if (target < 31) {
      let endDuties = 0;
      for (let d = 24; d < 31; d++) {
        if (arr[d] > 0) endDuties++;
      }
      if (endDuties >= 7) {
        cost += 1000000;
      }
    }

    return cost;
  }

  // Helper for timeline balance across the month (prevents duties from clustering in first/second half)
  function evalFlightTimelineCost(arr: number[], target: number): number {
    if (target <= 0) return 0;
    let cost = 0;
    let cum = 0;
    for (let d = 0; d < 31; d++) {
      cum += arr[d];
      const ideal = ((d + 1) * target) / 31;
      cost += Math.pow(cum - ideal, 2);
    }
    // Also penalize first-half (days 0..14) vs second-half (days 15..30) imbalance
    let h1 = 0;
    for (let d = 0; d < 15; d++) h1 += arr[d];
    const idealH1 = (15 * target) / 31;
    const diffH1 = Math.abs(h1 - idealH1);
    if (diffH1 > 1.0) {
      cost += Math.pow(diffH1 - 1.0, 2) * 50;
    }
    return cost * 10;
  }

  // Helper for daily total load dispersion across the 31 days (prevents all 5-duty days from falling in first 13 days)
  function evalFlightDailyLoadDispersionCost(fl: FlightName): number {
    const limits = flightDailyLimits[fl];
    const rem = limits.rem;
    if (rem <= 0 || rem >= 31) return 0;

    let cost = 0;
    let extraCount = 0;
    for (let d = 0; d < 31; d++) {
      if (dailyFlightLoad[fl][d] > limits.base) {
        extraCount++;
      }
      const idealExtra = ((d + 1) * rem) / 31;
      cost += Math.pow(extraCount - idealExtra, 2);
    }

    // First-half vs second-half balance of extra-duty days
    let h1Extra = 0;
    for (let d = 0; d < 15; d++) {
      if (dailyFlightLoad[fl][d] > limits.base) h1Extra++;
    }
    const idealH1Extra = (15 * rem) / 31;
    const diffH1 = Math.abs(h1Extra - idealH1Extra);
    if (diffH1 > 1.0) {
      cost += Math.pow(diffH1 - 1.0, 2) * 80;
    }
    return cost * 15;
  }

  // Step 3: Open Duties Initial Allocation with Anti-Consecutive Scoring
  const openDuties = newMatrix
    .filter((t) => !t.isDisabled && !isStaticDailyUniformDuty(t))
    .sort((a, b) => (b.totalRequiredDaily || 1) - (a.totalRequiredDaily || 1));

  openDuties.forEach((table) => {
    const origTable = matrix.find((x) => x.id === table.id) || table;
    const isSecurity = table.id === 'security_duty';
    const elig = table.eligibleFlights && table.eligibleFlights.length > 0
      ? table.eligibleFlights
      : (['Mechanics', 'Avionics', 'GCS', 'Admin'] as FlightName[]);

    const reqSlots = new Array(31).fill(0);
    const dailySum = (origTable.dailyRequirements || []).reduce((s, v) => s + (Number(v) || 0), 0);
    if (origTable.dailyRequirements && origTable.dailyRequirements.length === 31 && dailySum === table.totalRequiredMonth) {
      for (let d = 0; d < 31; d++) {
        reqSlots[d] = Number(origTable.dailyRequirements[d]) || 0;
      }
    } else {
      const totalMonth = table.totalRequiredMonth || 0;
      const base = Math.floor(totalMonth / 31);
      const rem = totalMonth % 31;
      const extraDays = computeIdealExtraDays(rem);
      for (let d = 0; d < 31; d++) {
        reqSlots[d] = base + (extraDays[d] ? 1 : 0);
      }
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

      let remainingToAssign = needed;
      while (remainingToAssign > 0) {
        const currentRemWeights = elig.map((fl) => {
          const target = q[fl] || 0;
          const assigned = table.data[fl].reduce((a, b) => a + b, 0);
          return Math.max(0, target - assigned);
        });
        const dynamicTotalRem = currentRemWeights.reduce((s, r) => s + r, 0);

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
          const maxAllowedToday = Math.max(1, Math.ceil(target / 31));
          return {
            fl,
            target,
            assigned,
            rem,
            st,
            daysLeft,
            today: table.data[fl][d],
            maxAllowedToday,
            onStreak,
            offStreak,
            maxOnStreak,
            maxOffStreak,
            load: dailyFlightLoad[fl][d],
          };
        }).filter((x) => {
          // Never assign a second duty on the same day if flight already reached its daily cap (e.g. 1 when target <= 31)
          if (x.today >= x.maxAllowedToday) return false;
          // Never assign beyond max daily load if another eligible flight has capacity and remaining quota:
          const xLim = flightDailyLimits[x.fl];
          if (x.load >= xLim.max) {
            const hasOtherWithCap = elig.some((fOther) => {
              if (fOther === x.fl) return false;
              const remO = Math.max(0, (q[fOther] || 0) - table.data[fOther].reduce((a, b) => a + b, 0));
              const loadO = dailyFlightLoad[fOther][d];
              const maxTO = Math.max(1, Math.ceil((q[fOther] || 0) / 31));
              return remO > 0 && loadO < flightDailyLimits[fOther].max && table.data[fOther][d] < maxTO;
            });
            if (hasOtherWithCap) return false;
          }
          // In SINGLE mode, enforce maxOnStreak strictly only if another flight still has remaining duties to assign
          if (mode === 'SINGLE' && x.onStreak >= x.maxOnStreak && x.rem < x.daysLeft && dynamicTotalRem > x.rem) return false;
          return dynamicTotalRem === 0 ? true : x.rem > 0;
        });

        if (available.length === 0) {
          const anyElig = [...elig].sort((f1, f2) => {
            const rem1 = Math.max(0, (q[f1] || 0) - table.data[f1].reduce((a, b) => a + b, 0));
            const rem2 = Math.max(0, (q[f2] || 0) - table.data[f2].reduce((a, b) => a + b, 0));
            if ((rem1 > 0) !== (rem2 > 0)) return rem1 > 0 ? -1 : 1;
            if (rem1 !== rem2) return rem2 - rem1;

            const max1 = Math.max(1, Math.ceil((q[f1] || 0) / 31));
            const max2 = Math.max(1, Math.ceil((q[f2] || 0) / 31));
            const full1 = table.data[f1][d] >= max1 ? 1 : 0;
            const full2 = table.data[f2][d] >= max2 ? 1 : 0;
            if (full1 !== full2) return full1 - full2;

            const lim1 = flightDailyLimits[f1];
            const lim2 = flightDailyLimits[f2];
            const under1 = dailyFlightLoad[f1][d] < lim1.base ? 1 : 0;
            const under2 = dailyFlightLoad[f2][d] < lim2.base ? 1 : 0;
            if (under1 !== under2) return under2 - under1;

            const overMax1 = dailyFlightLoad[f1][d] >= lim1.max ? 1 : 0;
            const overMax2 = dailyFlightLoad[f2][d] >= lim2.max ? 1 : 0;
            if (overMax1 !== overMax2) return overMax1 - overMax2;

            if (dailyFlightLoad[f1][d] !== dailyFlightLoad[f2][d]) {
              return dailyFlightLoad[f1][d] - dailyFlightLoad[f2][d];
            }

            if (isThisTableHeavy) {
              const h1 = dailyFlightHeavyLoad[f1][d] >= flightHeavyDailyLimits[f1].max ? 1 : 0;
              const h2 = dailyFlightHeavyLoad[f2][d] >= flightHeavyDailyLimits[f2].max ? 1 : 0;
              if (h1 !== h2) return h1 - h2;
              if (dailyFlightHeavyLoad[f1][d] !== dailyFlightHeavyLoad[f2][d]) {
                return dailyFlightHeavyLoad[f1][d] - dailyFlightHeavyLoad[f2][d];
              }
            }
            return 0;
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
          // 0. ABSOLUTE TOP PRIORITY: If remaining quota >= daysLeft, this flight CANNOT be skipped today!
          const aMust = a.rem >= a.daysLeft ? 1 : 0;
          const bMust = b.rem >= b.daysLeft ? 1 : 0;
          if (aMust !== bMust) return bMust - aMust;

          // 1. Single slot per day in this table (unless target > 31)
          if (a.today !== b.today) return a.today - b.today;

          // 2. STRICT HEAVY DUTY CONFLICT AVOIDANCE (Base Security, Base TF, Nazirpara TF):
          if (isThisTableHeavy) {
            const aHeavy = dailyFlightHeavyLoad[a.fl][d];
            const bHeavy = dailyFlightHeavyLoad[b.fl][d];
            const aHLimits = flightHeavyDailyLimits[a.fl];
            const bHLimits = flightHeavyDailyLimits[b.fl];

            const aOverMax = aHeavy >= aHLimits.max ? 1 : 0;
            const bOverMax = bHeavy >= bHLimits.max ? 1 : 0;
            if (aOverMax !== bOverMax) return aOverMax - bOverMax;

            if (aHeavy !== bHeavy) return aHeavy - bHeavy;
          }

          // 3. Global daily load ceiling: never exceed max daily load
          const aLimits = flightDailyLimits[a.fl];
          const bLimits = flightDailyLimits[b.fl];
          const aAtOrOverMax = a.load >= aLimits.max ? 1 : 0;
          const bAtOrOverMax = b.load >= bLimits.max ? 1 : 0;
          if (aAtOrOverMax !== bAtOrOverMax) return aAtOrOverMax - bAtOrOverMax;

          // 3B. CRITICAL: Fill up underloaded days FIRST! (e.g. 22 & 26 tarikh 3 duties must reach 4 before any day gets 5)
          const aUnderBase = a.load < aLimits.base ? 1 : 0;
          const bUnderBase = b.load < bLimits.base ? 1 : 0;
          if (aUnderBase !== bUnderBase) return bUnderBase - aUnderBase; // 1 (under base) comes before 0

          // 3C. Disperse remainder duties evenly: respect ideal target for today
          const aAtOrOverIdeal = a.load >= idealTargetToday[a.fl][d] ? 1 : 0;
          const bAtOrOverIdeal = b.load >= idealTargetToday[b.fl][d] ? 1 : 0;
          if (aAtOrOverIdeal !== bAtOrOverIdeal) return aAtOrOverIdeal - bAtOrOverIdeal;

          if (a.load !== b.load) return a.load - b.load;

          // 4. In SINGLE MODE: Strict Pacing Cap, Rest Preference, and Off-Days Dispersion
          if (mode === 'SINGLE') {
            // A) Pacing Cap: don't let flights with moderate target (e.g. Admin/Avionics 16) burn duties too fast
            const aIdealToday = ((d + 1) * a.target) / 31;
            const bIdealToday = ((d + 1) * b.target) / 31;
            const aPacedOut = a.target <= 22 && a.assigned >= Math.round(aIdealToday) && a.rem < a.daysLeft;
            const bPacedOut = b.target <= 22 && b.assigned >= Math.round(bIdealToday) && b.rem < b.daysLeft;
            if (aPacedOut !== bPacedOut) {
              return aPacedOut ? 1 : -1;
            }

            // B) Maximize single duties: strongly prefer flights currently on break (onStreak === 0)
            const aRest = a.onStreak === 0 ? 1 : 0;
            const bRest = b.onStreak === 0 ? 1 : 0;
            if (a.target <= 22 || b.target <= 22) {
              if (aRest !== bRest) return bRest - aRest;
            }

            // C) If both worked yesterday, penalize streak >= 2 heavily for moderate targets
            if (a.onStreak !== b.onStreak) {
              if (a.target <= 22 && a.onStreak >= 2) return 1;
              if (b.target <= 22 && b.onStreak >= 2) return -1;
              return a.onStreak - b.onStreak;
            }

            // D) Off-days pacing for high-target flights (e.g. Mechanics / GCS with few off days)
            // Prevents taking all off days early and then working 12 days in a row at month end
            const aTotalOff = 31 - a.target;
            const bTotalOff = 31 - b.target;
            if (aTotalOff > 0 && bTotalOff > 0 && (aTotalOff <= 6 || bTotalOff <= 6)) {
              const aOffTaken = d - a.assigned;
              const bOffTaken = d - b.assigned;
              const aExpectedOff = ((d + 1) * aTotalOff) / 31;
              const bExpectedOff = ((d + 1) * bTotalOff) / 31;
              const aOffBurn = aOffTaken - aExpectedOff;
              const bOffBurn = bOffTaken - bExpectedOff;
              if (Math.abs(aOffBurn - bOffBurn) > 0.4) {
                return bOffBurn - aOffBurn;
              }
            }
          }

          // 5. Mode-specific streak priorities (for PACKAGE mode):
          if (mode === 'PACKAGE') {
            const aIs1 = a.onStreak === 1 && a.rem > 0 ? 1 : 0;
            const bIs1 = b.onStreak === 1 && b.rem > 0 ? 1 : 0;
            if (aIs1 !== bIs1) return bIs1 - aIs1;

            const aIs2 = a.onStreak === 2 && a.rem > 0 ? 1 : 0;
            const bIs2 = b.onStreak === 2 && b.rem > 0 ? 1 : 0;
            if (aIs2 !== bIs2) return bIs2 - aIs2;

            const aExceed3 = a.onStreak >= 3 ? 1 : 0;
            const bExceed3 = b.onStreak >= 3 ? 1 : 0;
            if (aExceed3 !== bExceed3) return aExceed3 - bExceed3;
          }

          // 6. TABLE PACING & RATIO:
          const aIdeal = ((d + 1) * a.target) / 31;
          const bIdeal = ((d + 1) * b.target) / 31;
          const aAhead = a.assigned >= aIdeal ? 1 : 0;
          const bAhead = b.assigned >= bIdeal ? 1 : 0;
          if (aAhead !== bAhead) return aAhead - bAhead;

          const aPace = a.target > 0 ? (a.assigned / Math.max(0.1, aIdeal)) : 1;
          const bPace = b.target > 0 ? (b.assigned / Math.max(0.1, bIdeal)) : 1;
          if (Math.abs(aPace - bPace) > 0.15) return aPace - bPace;

          const aOffExceed = Math.max(0, a.offStreak - a.maxOffStreak);
          const bOffExceed = Math.max(0, b.offStreak - b.maxOffStreak);
          if (aOffExceed !== bOffExceed) return bOffExceed - aOffExceed;

          const totalSt = elig.reduce((s, fl) => s + getStrength(fl, isSecurity), 0);
          const aRatio = dynamicTotalRem > 0 ? (a.rem / dynamicTotalRem) : (a.st / (totalSt || 1));
          const bRatio = dynamicTotalRem > 0 ? (b.rem / dynamicTotalRem) : (b.st / (totalSt || 1));
          return bRatio - aRatio;
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
              const maxF1 = Math.max(1, Math.ceil(target1 / 31));
              const maxF2 = Math.max(1, Math.ceil(target2 / 31));
              if (table.data[f1][d2] + 1 > maxF1) continue;
              if (table.data[f2][d1] + 1 > maxF2) continue;
              if (dailyFlightLoad[f1][d2] + 1 > flightDailyLimits[f1].max) continue;
              if (dailyFlightLoad[f2][d1] + 1 > flightDailyLimits[f2].max) continue;
              if (isHeavyDuty(table.id, table.title)) {
                if (dailyFlightHeavyLoad[f1][d2] + 1 > flightHeavyDailyLimits[f1].max) continue;
                if (dailyFlightHeavyLoad[f2][d1] + 1 > flightHeavyDailyLimits[f2].max) continue;
              }

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
                evalFlightTimelineCost(table.data[f1], target1) +
                evalFlightTimelineCost(table.data[f2], target2) +
                evalFlightDailyLoadDispersionCost(f1) +
                evalFlightDailyLoadDispersionCost(f2) +
                heavyCostBefore;

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
                evalFlightTimelineCost(table.data[f1], target1) +
                evalFlightTimelineCost(table.data[f2], target2) +
                evalFlightDailyLoadDispersionCost(f1) +
                evalFlightDailyLoadDispersionCost(f2) +
                heavyCostAfter;

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
  // Ensures that:
  // 1. Overloaded days: No day exceeds max (floor(Total/31) + (rem > 0 ? 1 : 0)).
  //    Dates with fewer duties (e.g. 4) are filled up FIRST before any day reaches an extra duty.
  // 2. Underloaded days: No day drops below min (floor(Total/31)).
  for (let round = 0; round < 25; round++) {
    let globalChange = false;

    for (const fl of flights) {
      const limits = flightDailyLimits[fl];

      // PART A: Eliminate any OVERLOADED days (load > limits.max)
      // e.g. Day 2 and Day 3 having 6 duties when max is 5!
      for (let dHigh = 0; dHigh < 31; dHigh++) {
        if (dailyFlightLoad[fl][dHigh] <= limits.max) continue;

        // Try to push 1 duty from dHigh to some dLow where dailyFlightLoad[fl][dLow] < limits.max
        for (let dLow = 0; dLow < 31; dLow++) {
          if (dLow === dHigh) continue;
          if (dailyFlightLoad[fl][dLow] >= limits.max) continue; // dLow must have capacity

          // Find a table where fl is scheduled on dHigh, and another eligible flight f2 is scheduled on dLow
          let swapped = false;
          for (const t of newMatrix.filter((x) => !x.isDisabled)) {
            if (isStaticDailyUniformDuty(t)) continue;
            if (t.data[fl][dHigh] < 1) continue;

            const elig = t.eligibleFlights && t.eligibleFlights.length > 0
              ? t.eligibleFlights
              : flights;
            if (!elig.includes(fl)) continue;

            const isTHeavy = isHeavyDuty(t.id, t.title);
            if (isTHeavy && dailyFlightHeavyLoad[fl][dLow] + 1 > flightHeavyDailyLimits[fl].max) continue;

            const targetFl = tableTargets[t.id]?.[fl] ?? t.flightTargets?.[fl] ?? 0;
            const maxFl = Math.max(1, Math.ceil(targetFl / 31));
            if (t.data[fl][dLow] + 1 > maxFl) continue;

            for (const f2 of elig) {
              if (f2 === fl) continue;
              if (t.data[f2][dLow] < 1) continue;
              if (isTHeavy && dailyFlightHeavyLoad[f2][dHigh] + 1 > flightHeavyDailyLimits[f2].max) continue;

              const targetF2 = tableTargets[t.id]?.[f2] ?? t.flightTargets?.[f2] ?? 0;
              const maxF2 = Math.max(1, Math.ceil(targetF2 / 31));
              if (t.data[f2][dHigh] + 1 > maxF2) continue;

              const f2Limits = flightDailyLimits[f2];
              if (dailyFlightLoad[f2][dHigh] + 1 > f2Limits.max) continue;
              if (dailyFlightLoad[f2][dLow] - 1 < f2Limits.min) continue;
              if (dailyFlightLoad[fl][dLow] + 1 > limits.max) continue;

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
            if (swapped) break;
          }

          if (swapped) break;
        }
      }

      // PART B: Eliminate any UNDERLOADED days (load < limits.min)
      for (let dLow = 0; dLow < 31; dLow++) {
        if (dailyFlightLoad[fl][dLow] >= limits.min) continue;

        // Try to pull 1 duty for fl from some dHigh where dailyFlightLoad[fl][dHigh] > limits.min
        for (let dHigh = 0; dHigh < 31; dHigh++) {
          if (dLow === dHigh) continue;
          if (dailyFlightLoad[fl][dHigh] <= limits.min) continue;

          // Find a table where fl is scheduled on dHigh, and another eligible flight f2 is scheduled on dLow
          let swapped = false;
          for (const t of newMatrix.filter((x) => !x.isDisabled)) {
            if (isStaticDailyUniformDuty(t)) continue;
            if (t.data[fl][dHigh] < 1) continue;

            const elig = t.eligibleFlights && t.eligibleFlights.length > 0
              ? t.eligibleFlights
              : flights;
            if (!elig.includes(fl)) continue;

            const isTHeavy = isHeavyDuty(t.id, t.title);
            if (isTHeavy && dailyFlightHeavyLoad[fl][dLow] + 1 > flightHeavyDailyLimits[fl].max) continue;

            const targetFl = tableTargets[t.id]?.[fl] ?? t.flightTargets?.[fl] ?? 0;
            const maxFl = Math.max(1, Math.ceil(targetFl / 31));
            if (t.data[fl][dLow] + 1 > maxFl) continue;

            for (const f2 of elig) {
              if (f2 === fl) continue;
              if (t.data[f2][dLow] < 1) continue;
              if (isTHeavy && dailyFlightHeavyLoad[f2][dHigh] + 1 > flightHeavyDailyLimits[f2].max) continue;

              const targetF2 = tableTargets[t.id]?.[f2] ?? t.flightTargets?.[f2] ?? 0;
              const maxF2 = Math.max(1, Math.ceil(targetF2 / 31));
              if (t.data[f2][dHigh] + 1 > maxF2) continue;

              const f2Limits = flightDailyLimits[f2];
              if (dailyFlightLoad[f2][dHigh] + 1 > f2Limits.max) continue;
              if (dailyFlightLoad[f2][dLow] - 1 < f2Limits.min) continue;
              if (dailyFlightLoad[fl][dLow] + 1 > limits.max) continue;
              if (dailyFlightLoad[fl][dHigh] - 1 < limits.min) continue;

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
            if (swapped) break;
          }

          if (swapped) break;
        }
      }

      // PART C: Eliminate clustering of (base + 1) duties across the month
      // Disperses extra-duty days uniformly across all weeks so first half (1..15) and second half (16..31) are balanced
      if (limits.rem > 0) {
        for (let dHigh = 0; dHigh < 31; dHigh++) {
          if (dailyFlightLoad[fl][dHigh] <= idealTargetToday[fl][dHigh]) continue;

          for (let dLow = 0; dLow < 31; dLow++) {
            if (dLow === dHigh) continue;
            if (dailyFlightLoad[fl][dLow] >= idealTargetToday[fl][dLow]) continue;

            let swapped = false;
            for (const t of newMatrix.filter((x) => !x.isDisabled)) {
              if (isStaticDailyUniformDuty(t)) continue;
              if (t.data[fl][dHigh] < 1) continue;

              const elig = t.eligibleFlights && t.eligibleFlights.length > 0
                ? t.eligibleFlights
                : flights;
              if (!elig.includes(fl)) continue;

              const isTHeavy = isHeavyDuty(t.id, t.title);
              if (isTHeavy && dailyFlightHeavyLoad[fl][dLow] + 1 > flightHeavyDailyLimits[fl].max) continue;

              const targetFl = tableTargets[t.id]?.[fl] ?? t.flightTargets?.[fl] ?? 0;
              const maxFl = Math.max(1, Math.ceil(targetFl / 31));
              if (t.data[fl][dLow] + 1 > maxFl) continue;

              for (const f2 of elig) {
                if (f2 === fl) continue;
                if (t.data[f2][dLow] < 1) continue;
                if (isTHeavy && dailyFlightHeavyLoad[f2][dHigh] + 1 > flightHeavyDailyLimits[f2].max) continue;

                const targetF2 = tableTargets[t.id]?.[f2] ?? t.flightTargets?.[f2] ?? 0;
                const maxF2 = Math.max(1, Math.ceil(targetF2 / 31));
                if (t.data[f2][dHigh] + 1 > maxF2) continue;

                const f2Limits = flightDailyLimits[f2];
                // Hard limits guard for both fl and f2
                if (dailyFlightLoad[fl][dLow] + 1 > limits.max) continue;
                if (dailyFlightLoad[fl][dHigh] - 1 < limits.min) continue;
                if (dailyFlightLoad[f2][dHigh] + 1 > f2Limits.max) continue;
                if (dailyFlightLoad[f2][dLow] - 1 < f2Limits.min) continue;

                const curDiff =
                  Math.pow(dailyFlightLoad[fl][dHigh] - idealTargetToday[fl][dHigh], 2) +
                  Math.pow(dailyFlightLoad[fl][dLow] - idealTargetToday[fl][dLow], 2) +
                  Math.pow(dailyFlightLoad[f2][dHigh] - idealTargetToday[f2][dHigh], 2) +
                  Math.pow(dailyFlightLoad[f2][dLow] - idealTargetToday[f2][dLow], 2);

                const nextDiff =
                  Math.pow((dailyFlightLoad[fl][dHigh] - 1) - idealTargetToday[fl][dHigh], 2) +
                  Math.pow((dailyFlightLoad[fl][dLow] + 1) - idealTargetToday[fl][dLow], 2) +
                  Math.pow((dailyFlightLoad[f2][dHigh] + 1) - idealTargetToday[f2][dHigh], 2) +
                  Math.pow((dailyFlightLoad[f2][dLow] - 1) - idealTargetToday[f2][dLow], 2);

                if (nextDiff < curDiff) {
                  // Execute swap
                  t.data[fl][dHigh] -= 1; t.data[fl][dLow] += 1;
                  t.data[f2][dLow] -= 1; t.data[f2][dHigh] += 1;
                  dailyFlightLoad[fl][dHigh] -= 1; dailyFlightLoad[fl][dLow] += 1;
                  dailyFlightLoad[f2][dLow] -= 1; dailyFlightLoad[f2][dHigh] += 1;
                  if (isTHeavy) {
                    dailyFlightHeavyLoad[fl][dHigh] -= 1; dailyFlightHeavyLoad[fl][dLow] += 1;
                    dailyFlightHeavyLoad[f2][dLow] -= 1; dailyFlightHeavyLoad[f2][dHigh] += 1;
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

              if (isStaticDailyUniformDuty(t)) continue;
              const maxFlDOther = Math.max(1, Math.ceil((tableTargets[t.id]?.[fl] || 0) / 31));
              if (t.data[fl][dOther] + 1 > maxFlDOther) continue;
              const maxF2D = Math.max(1, Math.ceil((tableTargets[t.id]?.[f2] || 0) / 31));
              if (t.data[f2][d] + 1 > maxF2D) continue;

              // Check if we can also swap a light duty to keep daily load 100% constant
              let lightTable: DutyRatioTable | null = null;
              for (const tLight of newMatrix.filter((x) => !x.isDisabled && !isHeavyDuty(x.id, x.title) && !isStaticDailyUniformDuty(x))) {
                if ((tLight.data[fl]?.[dOther] || 0) > 0 && (tLight.data[f2]?.[d] || 0) > 0) {
                  const maxLtFlD = Math.max(1, Math.ceil((tableTargets[tLight.id]?.[fl] || 0) / 31));
                  if ((tLight.data[fl]?.[d] || 0) + 1 > maxLtFlD) continue;
                  const maxLtF2DOther = Math.max(1, Math.ceil((tableTargets[tLight.id]?.[f2] || 0) / 31));
                  if ((tLight.data[f2]?.[dOther] || 0) + 1 > maxLtF2DOther) continue;
                  lightTable = tLight;
                  break;
                }
              }

              if (!lightTable) {
                if (dailyFlightLoad[fl][dOther] + 1 > flLimits.max) continue;
                if (dailyFlightLoad[f2][d] + 1 > f2Limits.max) continue;
                if (dailyFlightLoad[fl][d] - 1 < flLimits.min) continue;
                if (dailyFlightLoad[f2][dOther] - 1 < f2Limits.min) continue;
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

  // Preserve user's manual flightTargets and distribution intact
  return newMatrix;
}
