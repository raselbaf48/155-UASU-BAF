export function getCleanBdNo(val: any): string {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
}

/**
 * Official BAF Rank Seniority Weighting:
 * 1. Commissioned Officers:
 *    ACM > AM > AVM > Air Cdre > Gp Capt > Wg Cdr > Sqn Ldr > Flt Lt > Flg Offr > Plt Offr
 * 2. JCOs (Junior Commissioned Officers):
 *    MWO > SWO > WO
 * 3. Airmen NCOs & ORs:
 *    Sgt > Cpl > LAC > AC-1 > AC-2 > AC
 * 4. NC(E)
 * 5. Civilians
 */
export const getRankWeight = (rankStr?: string): number => {
  if (!rankStr) return 999;
  const upper = rankStr.toUpperCase().trim();

  // 1. Commissioned Officers (Officers come FIRST)
  if (upper.includes('AIR CHIEF') || upper === 'ACM') return 1;
  if (upper.includes('AIR MSHL') || upper === 'AM') return 2;
  if (upper.includes('AVM') || upper.includes('AIR VICE')) return 3;
  if (upper.includes('AIR CDRE') || upper.includes('COMMODORE')) return 4;
  if (upper.includes('GP CAPT') || upper.includes('GROUP CAPTAIN')) return 5;
  if (upper.includes('WG CDR') || upper.includes('WING COMMANDER')) return 6;
  if (upper.includes('SQN LDR') || upper.includes('SQUADRON LEADER')) return 7;
  
  // Flight Lieutenant (Flt Lt)
  if (
    upper.includes('FLT LT') || 
    upper.includes('FLIGHT LIEUTENANT') || 
    upper.includes('FLT. LT') || 
    upper.includes('FLT-LT') ||
    upper === 'FLTLT'
  ) return 8;

  // Flying Officer (Flg Offr / Fg Offr) comes after Flt Lt
  if (
    upper.includes('FG OFFR') || 
    upper.includes('FLG OFFR') || 
    upper.includes('FLYING OFFICER') || 
    upper.includes('FLG. OFFR') || 
    upper.includes('FG. OFFR') || 
    upper.includes('FLG-OFFR') ||
    upper.includes('FG-OFFR') ||
    upper === 'FLGOFFR' ||
    upper === 'FGOFFR'
  ) return 9;

  // Pilot Officer (Plt Offr)
  if (
    upper.includes('PLT OFFR') || 
    upper.includes('PILOT OFFICER') || 
    upper.includes('PLT. OFFR') ||
    upper.includes('PLT-OFFR') ||
    upper === 'PLTOFFR'
  ) return 10;

  if (upper.includes('OFFR') || upper.includes('OFFICER')) return 11;

  // 2. JCOs (Junior Commissioned Officers come after Officers)
  if (upper === 'MWO' || upper.includes('MASTER WARRANT') || upper.includes('মাঃওঃঅঃ')) return 20;
  if (upper === 'SWO' || upper.includes('SENIOR WARRANT') || upper.includes('সিঃওঃঅঃ') || upper.includes('সিঃ ওঃ অঃ')) return 21;
  if (upper === 'WO' || upper.includes('WARRANT') || upper.includes('ওঃঅঃ')) return 22;

  // 3. Airmen NCOs & ORs (come after JCOs)
  if (upper === 'SGT' || upper.includes('SERGEANT') || upper.includes('সার্জেন্ট') || upper.includes('সার্জেণ্ট')) return 30;
  if (upper === 'CPL' || upper.includes('CORPORAL') || upper.includes('কর্পোরাল')) return 31;
  if (upper === 'LAC' || upper.includes('LEADING') || upper.includes('এলএসি')) return 32;
  if (upper === 'AC-1' || upper === 'AC1' || upper.includes('এসি-১')) return 33;
  if (upper === 'AC-2' || upper === 'AC2' || upper.includes('এসি-২')) return 34;
  if (upper === 'AC' || upper.includes('AIRCRAFTMAN') || upper.includes('এসি')) return 35;

  // 4. NC(E)
  if (upper.includes('NC(E)') || upper.includes('NCE')) return 40;

  // 5. Civilians
  if (upper.includes('CIV') || upper.includes('CIVILIAN') || upper.includes('বেসামরিক')) return 50;

  return 100;
};

export const getAirmanOfficeRankWeight = getRankWeight;

/**
 * Standard Canteen Seniority:
 * Strictly maintains Settings Member DB seniority order:
 * 1. Rank Seniority:
 *    Commissioned Officers (Flt Lt > Flg Offr > Plt Offr)
 *    > JCOs (MWO > SWO > WO)
 *    > Airmen (Sgt > Cpl > LAC > AC-1 > AC-2 > AC)
 *    > NC(E) > Civilians
 * 2. Within the same rank:
 *    Lower BD Number = more senior (bdA - bdB)
 */
export function sortCanteenMembersByOfficeSeniority(members: any[]): any[] {
  if (!Array.isArray(members) || members.length <= 1) return members || [];

  return [...members].sort((a, b) => {
    const rankA = a.Rank || a.rank || '';
    const rankB = b.Rank || b.rank || '';
    const weightA = getRankWeight(rankA);
    const weightB = getRankWeight(rankB);

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    // 2. Custom manual seniority within the rank (identical to Biodata Register)
    const sA = (a.Seniority !== undefined && a.Seniority !== null && a.Seniority !== '' && !isNaN(Number(a.Seniority)))
      ? Number(a.Seniority)
      : ((a.seniority !== undefined && a.seniority !== null && a.seniority !== '' && !isNaN(Number(a.seniority))) ? Number(a.seniority) : null);

    const sB = (b.Seniority !== undefined && b.Seniority !== null && b.Seniority !== '' && !isNaN(Number(b.Seniority)))
      ? Number(b.Seniority)
      : ((b.seniority !== undefined && b.seniority !== null && b.seniority !== '' && !isNaN(Number(b.seniority))) ? Number(b.seniority) : null);

    if (sA !== null && sB !== null && sA !== sB) {
      return sA - sB;
    }
    if (sA !== null && sB === null) return -1;
    if (sA === null && sB !== null) return 1;

    // 3. Fallback within the same rank: strictly by BD Number (lower BD No = more senior)
    const bdAStr = String(a['BD No'] || a.bdNo || a.airman_id || '').replace(/\D/g, '');
    const bdBStr = String(b['BD No'] || b.bdNo || b.airman_id || '').replace(/\D/g, '');
    const numA = parseInt(bdAStr, 10) || 9999999;
    const numB = parseInt(bdBStr, 10) || 9999999;
    return numA - numB;
  });
}

/**
 * Ensures all members have sequential 1..N seniority numbers
 * based on their current rank order and seniority / BD No order.
 */
export function normalizeCanteenMembersSeniority(members: any[]): any[] {
  const sorted = sortCanteenMembersByOfficeSeniority(members);
  return sorted.map((member, index) => ({
    ...member,
    seniority: index + 1,
    Seniority: index + 1
  }));
}

/**
 * Calculates the valid seniority bounds (min and max) that a member
 * of a given rank can occupy in the unit.
 */
export function getCanteenRankSeniorityRange(
  members: any[],
  rank: string
): { minSeniority: number; maxSeniority: number; totalInRank: number } {
  const normalized = normalizeCanteenMembersSeniority(members);
  const matching = normalized.filter((m) => String(m.Rank || m.rank || '').trim() === String(rank || '').trim());
  if (matching.length === 0) {
    const rankWeight = getRankWeight(rank);
    let insertionPos = 1;
    for (const m of normalized) {
      const mWeight = getRankWeight(m.Rank || m.rank);
      if (mWeight < rankWeight) {
        insertionPos = (m.seniority || 0) + 1;
      }
    }
    return { minSeniority: insertionPos, maxSeniority: insertionPos, totalInRank: 0 };
  }

  const seniorities = matching.map((m) => m.seniority || 0);
  return {
    minSeniority: Math.min(...seniorities),
    maxSeniority: Math.max(...seniorities),
    totalInRank: matching.length,
  };
}

/**
 * Resolves a requested seniority number into a valid unit seniority position
 * that never violates military rank hierarchy, exactly as in office app's Biodata Register:
 * - If user gives 1 (or <= minSeniority), they become the seniormost of that rank.
 * - If user gives a rank-relative position (1..totalInRank) that is less than minSeniority,
 *   it maps to that position within the rank (e.g. 1st of rank -> minSeniority).
 * - Clamps strictly between minSeniority and maxSeniority of that rank.
 */
export function resolveCanteenTargetSeniority(
  members: any[],
  rank: string,
  inputSeniority: number
): {
  resolvedSeniority: number;
  relativeRankIndex: number;
  minRankSeniority: number;
  maxRankSeniority: number;
  totalInRank: number;
} {
  const range = getCanteenRankSeniorityRange(members, rank);
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
 * Reorders a canteen member's seniority within the allowed bounds of their rank:
 * Higher ranks (above this rank) and lower ranks (below this rank) remain undisturbed.
 * Intermediate members of the same rank shift smoothly up or down.
 */
export function reorderCanteenMemberSeniority(
  members: any[],
  targetBdOrId: string,
  newSeniority: number
): { updatedMembers: any[]; changedMembers: any[] } {
  const baseList = normalizeCanteenMembersSeniority(members);
  const cleanTargetBd = String(targetBdOrId || '').replace(/\D/g, '');
  const targetIndex = baseList.findIndex(
    (m) =>
      (m.airman_id && String(m.airman_id).toLowerCase() === String(targetBdOrId).toLowerCase()) ||
      (cleanTargetBd && String(m['BD No'] || m.bdNo || '').replace(/\D/g, '') === cleanTargetBd)
  );

  if (targetIndex === -1) {
    return { updatedMembers: baseList, changedMembers: [] };
  }

  const target = baseList[targetIndex];
  const oldSeniority = target.seniority || (targetIndex + 1);
  const rank = target.Rank || target.rank || '';

  const { resolvedSeniority } = resolveCanteenTargetSeniority(baseList, rank, newSeniority);

  if (oldSeniority === resolvedSeniority) {
    return { updatedMembers: baseList, changedMembers: [] };
  }

  const changedMembers: any[] = [];

  const adjustedList = baseList.map((m) => {
    const isTarget =
      (m.airman_id && String(m.airman_id).toLowerCase() === String(targetBdOrId).toLowerCase()) ||
      (cleanTargetBd && String(m['BD No'] || m.bdNo || '').replace(/\D/g, '') === cleanTargetBd);

    if (isTarget) {
      const updated = { ...m, seniority: resolvedSeniority, Seniority: resolvedSeniority };
      changedMembers.push(updated);
      return updated;
    }

    const currentSen = m.seniority || 0;
    if (oldSeniority > resolvedSeniority) {
      // Moving up in seniority (e.g. from 20 -> 10)
      if (currentSen >= resolvedSeniority && currentSen < oldSeniority) {
        const updated = { ...m, seniority: currentSen + 1, Seniority: currentSen + 1 };
        changedMembers.push(updated);
        return updated;
      }
    } else {
      // Moving down in seniority (e.g. from 10 -> 20)
      if (currentSen <= resolvedSeniority && currentSen > oldSeniority) {
        const updated = { ...m, seniority: currentSen - 1, Seniority: currentSen - 1 };
        changedMembers.push(updated);
        return updated;
      }
    }

    return m;
  });

  const finalSorted = normalizeCanteenMembersSeniority(adjustedList);
  return { updatedMembers: finalSorted, changedMembers };
}

/**
 * Identify Commissioned Officers
 */
export const isOfficerMember = (member: any): boolean => {
  const rank = String(member?.Rank || member?.rank || '').toUpperCase().trim();
  const officerRanks = [
    'AIR CHIEF MSHL', 'AIR MSHL', 'AVM', 'AIR CDRE', 'GP CAPT', 
    'WG CDR', 'SQN LDR', 'FLT LT', 'FLG OFFR', 'FG OFFR', 'PLT OFFR'
  ];
  return officerRanks.some(r => rank.includes(r)) || /officer|commander|leader|captain/i.test(rank);
};

/**
 * Identify Civilian Members (Civ, Cook, Staff, Unit Guest, Civilian)
 */
export const isCivilianMember = (member: any): boolean => {
  if (isOfficerMember(member)) return false;
  const rank = String(member?.Rank || member?.rank || '').toUpperCase().trim();
  const role = String(member?.Role || member?.role || '').toUpperCase().trim();
  const surname = String(member?.Surname || member?.name || '').toLowerCase().trim();
  return (
    rank === 'CIV' || 
    rank.includes('CIV') || 
    rank.includes('CIVILIAN') || 
    rank.includes('বেসামরিক') || 
    rank.includes('সিভিলিয়ান') || 
    rank === '-' ||
    role.includes('CIV') || 
    role === 'COOK' ||
    surname === 'unit guest' ||
    surname.includes('guest')
  );
};

/**
 * Identify Airmen (JCOs, NCOs, ORs: MWO, SWO, WO, Sgt, Cpl, LAC, AC)
 */
export const isAirmanMember = (member: any): boolean => {
  return !isOfficerMember(member) && !isCivilianMember(member);
};

/**
 * Robust matcher to ensure 100% accurate link between canteen member and transaction records
 */
export const isTxBelongingToMember = (member: any, tx: any): boolean => {
  if (!member || !tx) return false;
  const mAirman = String(member.airman_id || member.airmanId || '').trim().toLowerCase();
  const txAirman = String(tx.airman_id || tx.airmanId || '').trim().toLowerCase();
  if (mAirman && txAirman && mAirman === txAirman) return true;

  const mBdClean = String(member['BD No'] || member.bdNo || member.bd_no || member.airman_id || '').replace(/\D/g, '');
  const txBdClean = String(tx.bdNo || tx['BD No'] || tx.bd_no || tx.airman_id || '').replace(/\D/g, '');
  const mBdCleanNoZero = mBdClean.replace(/^0+/, '');
  const txBdCleanNoZero = txBdClean.replace(/^0+/, '');
  if (mBdClean && txBdClean && (mBdClean === txBdClean || (mBdCleanNoZero && mBdCleanNoZero === txBdCleanNoZero))) {
    return true;
  }

  const mSurname = String(member['Surname'] || member.surname || '').trim().toLowerCase();
  const mRank = String(member['Rank'] || member.rank || '').trim().toLowerCase();
  if (mSurname && tx.memberName) {
    const txName = String(tx.memberName).toLowerCase();
    if (txName.includes(mSurname) && (!mRank || txName.includes(mRank))) {
      return true;
    }
  }

  return false;
};
