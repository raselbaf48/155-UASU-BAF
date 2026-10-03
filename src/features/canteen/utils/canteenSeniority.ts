import { localDb } from '../../../services/localDatabase';
import { RANK_SENIORITY } from '../../../utils/seniority';

export function getCleanBdNo(val: any): string {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
}

export function getAirmanOfficeRankWeight(rankStr?: string): number {
  if (!rankStr) return 99;
  const clean = rankStr.trim();
  const direct = RANK_SENIORITY[clean as any];
  if (direct !== undefined) return direct;

  const upper = clean.toUpperCase();
  if (upper.includes('MWO') || upper.includes('MASTER WARRANT')) return 1;
  if (upper.includes('SWO') || upper.includes('SENIOR WARRANT')) return 2;
  if (upper.includes('WO') || upper.includes('WARRANT')) return 3;
  if (upper.includes('SGT') || upper.includes('SERGEANT')) return 4;
  if (upper.includes('CPL') || upper.includes('CORPORAL')) return 5;
  if (upper.includes('LAC')) return 6;
  if (upper.includes('AC-1') || upper.includes('AC1')) return 7;
  if (upper.includes('AC-2') || upper.includes('AC2')) return 8;
  if (upper.includes('AC')) return 9;
  if (upper.includes('NCE') || upper.includes('NC(E)')) return 10;
  if (upper.includes('CIV')) return 11;
  return 20;
}

/**
 * Sorts Canteen members strictly according to the Office Nominal Roll's Seniority:
 * 1. Checks if the member exists in the Office airmen database (localDb.getAirmen()).
 *    If matched, uses their official Nominal Roll seniority position (1..N).
 * 2. If not found in Office database (e.g. Civilians), sorts by:
 *    - Strict BAF Rank hierarchy (MWO > SWO > WO > Sgt > Cpl > LAC > AC-1 > AC-2 > Civ)
 *    - Lower BD Number = more senior
 */
export function sortCanteenMembersByOfficeSeniority(members: any[]): any[] {
  if (!Array.isArray(members) || members.length <= 1) return members || [];

  let officeAirmen: any[] = [];
  try {
    officeAirmen = localDb.getAirmen();
  } catch (e) {
    try {
      const stored = localStorage.getItem('baf_db');
      if (stored) {
        officeAirmen = JSON.parse(stored)?.airmen || [];
      }
    } catch {}
  }

  // Pre-build a map of BD Number -> Office Seniority index (0-based)
  const officeSeniorityMap = new Map<string, number>();
  officeAirmen.forEach((airman, index) => {
    const bdClean = getCleanBdNo(airman.bdNo);
    if (bdClean && !officeSeniorityMap.has(bdClean)) {
      const sen = (airman.seniority !== undefined && airman.seniority !== null && !isNaN(Number(airman.seniority)))
        ? Number(airman.seniority)
        : index + 1;
      officeSeniorityMap.set(bdClean, sen);
    }
    const idClean = airman.id;
    if (idClean && !officeSeniorityMap.has(idClean)) {
      const sen = (airman.seniority !== undefined && airman.seniority !== null && !isNaN(Number(airman.seniority)))
        ? Number(airman.seniority)
        : index + 1;
      officeSeniorityMap.set(idClean, sen);
    }
  });

  return [...members].sort((a, b) => {
    const bdA = getCleanBdNo(a['BD No'] || a.bdNo || a.airman_id);
    const bdB = getCleanBdNo(b['BD No'] || b.bdNo || b.airman_id);
    const idA = String(a.airman_id || a.id || '');
    const idB = String(b.airman_id || b.id || '');

    const senA = officeSeniorityMap.get(bdA) ?? (idA ? officeSeniorityMap.get(idA) : undefined);
    const senB = officeSeniorityMap.get(bdB) ?? (idB ? officeSeniorityMap.get(idB) : undefined);

    // If both exist in Office Nominal Roll, sort by their exact Nominal Roll seniority!
    if (senA !== undefined && senB !== undefined) {
      if (senA !== senB) return senA - senB;
    }
    // If one is in Office Nominal Roll and other is not:
    if (senA !== undefined && senB === undefined) {
      const rankB = String(b.Rank || b.rank || '').toUpperCase();
      if (rankB.includes('CIV')) return -1;
    }
    if (senA === undefined && senB !== undefined) {
      const rankA = String(a.Rank || a.rank || '').toUpperCase();
      if (rankA.includes('CIV')) return 1;
    }

    // Default BAF Military Rank hierarchy (Office standard)
    const rankWeightA = getAirmanOfficeRankWeight(a.Rank || a.rank);
    const rankWeightB = getAirmanOfficeRankWeight(b.Rank || b.rank);
    if (rankWeightA !== rankWeightB) {
      return rankWeightA - rankWeightB;
    }

    // Secondary: lower BD No = more senior
    const numA = parseInt(bdA, 10) || 9999999;
    const numB = parseInt(bdB, 10) || 9999999;
    return numA - numB;
  });
}
