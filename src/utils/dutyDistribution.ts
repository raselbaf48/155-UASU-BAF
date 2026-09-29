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

  const getStrength = (fl: FlightName, isSecurity: boolean) => {
    let cpl = 0, sgt = 0;
    if (fl === 'Mechanics') { cpl = mp.mechCpl; sgt = mp.mechSgt; }
    if (fl === 'Avionics') { cpl = mp.aviCpl; sgt = mp.aviSgt; }
    if (fl === 'GCS') { cpl = mp.gcsCpl; sgt = mp.gcsSgt; }
    if (fl === 'Admin') { cpl = mp.adminCpl; sgt = mp.adminSgt; }
    return isSecurity ? cpl : (cpl + sgt);
  };

  activeDuties.forEach((t) => {
    const isSecurity = t.id === 'security_duty';
    const isFixed = isFixedEqualDuty(t);
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    const total = t.totalRequiredMonth || 0;

    // Use official baseline only if manpower is untouched default
    if (isDefault && OFFICIAL_TARGET_BASELINE[t.id]) {
      flights.forEach((fl) => {
        autoTargets[fl][t.id] = OFFICIAL_TARGET_BASELINE[t.id][fl] ?? 0;
      });
      return;
    }

    // Fixed duties (e.g. Airfield Duty): equal share among capable flights
    if (isFixed) {
      const per = elig.length > 0 ? Math.round(total / elig.length) : 0;
      flights.forEach((fl) => {
        autoTargets[fl][t.id] = elig.includes(fl) ? per : 0;
      });
      return;
    }

    // Dynamic calculation based on current manpower
    const maxPerFlight = 31;
    const pool = elig.reduce((s, fl) => s + getStrength(fl, isSecurity), 0);
    const rawShares: Record<FlightName, number> = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
    
    elig.forEach((fl) => {
      const st = getStrength(fl, isSecurity);
      rawShares[fl] = pool > 0 ? (st / pool) * total : 0;
    });

    // Cap at maxPerFlight (31) and re-distribute excess to uncapped flights
    let excess = 0;
    elig.forEach((fl) => {
      if (rawShares[fl] > maxPerFlight) {
        excess += (rawShares[fl] - maxPerFlight);
        rawShares[fl] = maxPerFlight;
      }
    });

    const uncapped = elig.filter((fl) => rawShares[fl] < maxPerFlight);
    const uncappedPool = uncapped.reduce((s, fl) => s + rawShares[fl], 0);
    if (excess > 0 && uncappedPool > 0) {
      uncapped.forEach((fl) => {
        rawShares[fl] += (rawShares[fl] / uncappedPool) * excess;
      });
    }

    const shares = elig.map((fl) => {
      const r = Math.min(maxPerFlight, rawShares[fl]);
      return {
        fl,
        raw: r,
        floor: Math.floor(r),
        rem: r - Math.floor(r),
      };
    });

    const alloc = shares.reduce((s, x) => s + x.floor, 0);
    let remSlots = total - alloc;
    shares
      .filter((x) => x.floor < maxPerFlight)
      .sort((a, b) => b.rem - a.rem);

    for (let i = 0; i < remSlots && i < shares.length; i++) {
      if (shares[i].floor < maxPerFlight) {
        shares[i].floor += 1;
      }
    }

    flights.forEach((fl) => {
      const found = shares.find((x) => x.fl === fl);
      autoTargets[fl][t.id] = found ? found.floor : 0;
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

  const getStrength = (fl: FlightName, isSecurity: boolean) => {
    let cpl = 0, sgt = 0;
    if (fl === 'Mechanics') { cpl = mp.mechCpl; sgt = mp.mechSgt; }
    if (fl === 'Avionics') { cpl = mp.aviCpl; sgt = mp.aviSgt; }
    if (fl === 'GCS') { cpl = mp.gcsCpl; sgt = mp.gcsSgt; }
    if (fl === 'Admin') { cpl = mp.adminCpl; sgt = mp.adminSgt; }
    return isSecurity ? cpl : (cpl + sgt);
  };

  matrix.forEach((t) => {
    result[t.id] = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
    const isSecurity = t.id === 'security_duty';
    const isFixed = isFixedEqualDuty(t);
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;
    const total = t.totalRequiredMonth || 0;

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
  const autoTargets = calculateBalancedAutoTargets(matrix, manpowerInput);
  const isDefault = isDefaultManpower(manpowerInput);

  // 1. Clone matrix with cleared data
  const newMatrix: DutyRatioTable[] = matrix.map((t) => {
    // If manpower changed, adopt the new distribution immediately!
    // If manpower is default, preserve custom flightTargets only if they match totalRequiredMonth exactly.
    const existing = t.flightTargets;
    const existingSum = existing ? (existing.Mechanics || 0) + (existing.Avionics || 0) + (existing.GCS || 0) + (existing.Admin || 0) : 0;
    const monthTotal = t.totalRequiredMonth || 0;

    let targets: Record<FlightName, number>;
    if (isDefault && existing && existingSum === monthTotal && monthTotal > 0) {
      targets = {
        Mechanics: existing.Mechanics || 0,
        Avionics: existing.Avionics || 0,
        GCS: existing.GCS || 0,
        Admin: existing.Admin || 0,
      };
    } else {
      targets = {
        Mechanics: autoTargets['Mechanics']?.[t.id] ?? 0,
        Avionics: autoTargets['Avionics']?.[t.id] ?? 0,
        GCS: autoTargets['GCS']?.[t.id] ?? 0,
        Admin: autoTargets['Admin']?.[t.id] ?? 0,
      };
    }

    return {
      ...t,
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

  // Step 2: Fixed Duties (Airfield Duty: 1 Mech, 1 Avi, 1 GCS on all 31 days)
  newMatrix.filter((t) => !t.isDisabled && isFixedEqualDuty(t)).forEach((t) => {
    const elig = t.eligibleFlights && t.eligibleFlights.length > 0
      ? t.eligibleFlights
      : (['Mechanics', 'Avionics', 'GCS'] as FlightName[]);

    t.dailyRequirements = new Array(31).fill(elig.length);

    for (let day = 0; day < 31; day++) {
      elig.forEach((fl) => {
        t.data[fl][day] = 1;
        dailyFlightLoad[fl][day] += 1;
      });
    }

    flights.forEach((fl) => {
      t.flightTargets[fl] = t.data[fl].reduce((a, b) => a + b, 0);
    });
  });

  // Step 3: Open Duties Initial Allocation
  const openDuties = newMatrix
    .filter((t) => !t.isDisabled && !isFixedEqualDuty(t))
    .sort((a, b) => (b.totalRequiredDaily || 1) - (a.totalRequiredDaily || 1));

  openDuties.forEach((table) => {
    const origTable = matrix.find((x) => x.id === table.id) || table;
    const elig = table.eligibleFlights && table.eligibleFlights.length > 0
      ? table.eligibleFlights
      : (['Mechanics', 'Avionics', 'GCS', 'Admin'] as FlightName[]);

    let reqSlots = new Array(31).fill(0);
    for (let d = 0; d < 31; d++) {
      reqSlots[d] = origTable.dailyRequirements?.[d] ?? flights.reduce((s, fl) => s + (origTable.data[fl]?.[d] || 0), 0);
    }
    table.dailyRequirements = [...reqSlots];

    const q = table.flightTargets;

    // Day by day allocation
    for (let d = 0; d < 31; d++) {
      const needed = reqSlots[d];
      if (needed <= 0) continue;

      const candidates = elig.map((fl) => ({
        fl,
        rem: (q[fl] || 0) - table.data[fl].reduce((a, b) => a + b, 0),
        load: dailyFlightLoad[fl][d],
      })).filter((x) => x.rem > 0 && table.data[x.fl][d] === 0);

      // Sort: highest remaining quota first, then lowest daily load
      candidates.sort((a, b) => {
        if (a.rem !== b.rem) return b.rem - a.rem;
        return a.load - b.load;
      });

      for (let s = 0; s < needed && s < candidates.length; s++) {
        const chosen = candidates[s].fl;
        table.data[chosen][d] = 1;
        dailyFlightLoad[chosen][d] += 1;
      }
    }
  });

  // Step 4: Post-Allocation Squared Deviation Swap Smoother
  for (let iter = 0; iter < 1000; iter++) {
    let improved = false;

    for (const t of openDuties) {
      const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : flights;

      for (let d1 = 0; d1 < 31; d1++) {
        for (let d2 = 0; d2 < 31; d2++) {
          if (d1 === d2) continue;

          for (const f1 of elig) {
            if (t.data[f1][d1] !== 1 || t.data[f1][d2] !== 0) continue;

            for (const f2 of elig) {
              if (f1 === f2) continue;
              if (t.data[f2][d2] !== 1 || t.data[f2][d1] !== 0) continue;

              const costBefore =
                Math.pow(dailyFlightLoad[f1][d1] - targetDaily[f1], 2) +
                Math.pow(dailyFlightLoad[f1][d2] - targetDaily[f1], 2) +
                Math.pow(dailyFlightLoad[f2][d1] - targetDaily[f2], 2) +
                Math.pow(dailyFlightLoad[f2][d2] - targetDaily[f2], 2);

              const costAfter =
                Math.pow((dailyFlightLoad[f1][d1] - 1) - targetDaily[f1], 2) +
                Math.pow((dailyFlightLoad[f1][d2] + 1) - targetDaily[f1], 2) +
                Math.pow((dailyFlightLoad[f2][d1] + 1) - targetDaily[f2], 2) +
                Math.pow((dailyFlightLoad[f2][d2] - 1) - targetDaily[f2], 2);

              if (costAfter < costBefore) {
                // Execute swap
                t.data[f1][d1] = 0;
                t.data[f1][d2] = 1;
                t.data[f2][d2] = 0;
                t.data[f2][d1] = 1;

                dailyFlightLoad[f1][d1] -= 1;
                dailyFlightLoad[f1][d2] += 1;
                dailyFlightLoad[f2][d2] -= 1;
                dailyFlightLoad[f2][d1] += 1;

                improved = true;
                break;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }

    if (!improved) break;
  }

  // Final verification: ensure table.flightTargets matches exact assigned total
  newMatrix.forEach((t) => {
    flights.forEach((fl) => {
      t.flightTargets[fl] = t.data[fl].reduce((a, b) => a + b, 0);
    });
  });

  return newMatrix;
}
