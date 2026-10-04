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
  if (upper === 'SWO' || upper.includes('SENIOR WARRANT') || upper.includes('সিঃওঃঅঃ')) return 21;
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

    const bdAStr = String(a['BD No'] || a.bdNo || a.airman_id || '').replace(/\D/g, '');
    const bdBStr = String(b['BD No'] || b.bdNo || b.airman_id || '').replace(/\D/g, '');
    const numA = parseInt(bdAStr, 10) || 9999999;
    const numB = parseInt(bdBStr, 10) || 9999999;
    return numA - numB;
  });
}
