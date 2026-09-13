import { FlightName, DutyCategoryCode } from '../types';
import { getDailyQuotasFromMatrix } from './officialDutyRatioMatrix';

export interface FlightDutyQuota {
  flight: FlightName;
  dutyCode: DutyCategoryCode;
  requiredCount: number; // e.g. 1
}

// Default standard daily flight duty ratios for 155 UASU BAF
export const DEFAULT_FLIGHT_DUTY_RATIOS: FlightDutyQuota[] = [
  // Avionics Flight
  { flight: 'Avionics', dutyCode: 'GD', requiredCount: 1 },
  { flight: 'Avionics', dutyCode: 'BTF', requiredCount: 1 },
  { flight: 'Avionics', dutyCode: 'IDAC', requiredCount: 1 },

  // Mechanics Flight
  { flight: 'Mechanics', dutyCode: 'GD', requiredCount: 1 },
  { flight: 'Mechanics', dutyCode: 'NTF', requiredCount: 1 },
  { flight: 'Mechanics', dutyCode: 'HALISHAHAR', requiredCount: 1 },

  // GCS Flight
  { flight: 'GCS', dutyCode: 'GD', requiredCount: 1 },
  { flight: 'GCS', dutyCode: 'AIRPORT', requiredCount: 1 },

  // Admin Flight
  { flight: 'Admin', dutyCode: 'GD', requiredCount: 1 },
  { flight: 'Admin', dutyCode: 'BAKE_N_BITE', requiredCount: 1 },
];

const RATIO_STORAGE_KEY = 'baf_flight_duty_ratios_v1';

export function getStoredDutyRatiosForDate(dateStr: string): FlightDutyQuota[] {
  // Always derive exact live daily quotas directly from the official BAF 155 UASU Duty Matrix
  return getDailyQuotasFromMatrix(dateStr);
}

export function saveDutyRatiosForDate(dateStr: string, ratios: FlightDutyQuota[]) {
  // Retained for backward compatibility
  try {
    localStorage.setItem(`${RATIO_STORAGE_KEY}_${dateStr}`, JSON.stringify(ratios));
  } catch (e) {
    console.error('Failed to save flight duty ratios:', e);
  }
}

