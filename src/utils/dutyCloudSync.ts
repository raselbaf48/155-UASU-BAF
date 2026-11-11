import { DutyRatioTable, getStoredDutyMatrix, saveDutyMatrix, INITIAL_OFFICIAL_DUTY_MATRIX } from '../data/officialDutyRatioMatrix';
import { FlightName, Rank } from '../types';
import { isFixedEqualDuty } from './dutyDistribution';

export interface DutyCloudRow {
  id?: number | string;
  ser_no: number;
  duty_name: string;
  eligible_flt: string;
  eligible_rank: string;
  total: number;
  Status?: string;
  status?: string;
  day_1?: number;
  day_2?: number;
  day_3?: number;
  day_4?: number;
  day_5?: number;
  day_6?: number;
  day_7?: number;
  day_8?: number;
  day_9?: number;
  day_10?: number;
  day_11?: number;
  day_12?: number;
  day_13?: number;
  day_14?: number;
  day_15?: number;
  day_16?: number;
  day_17?: number;
  day_18?: number;
  day_19?: number;
  day_20?: number;
  day_21?: number;
  day_22?: number;
  day_23?: number;
  day_24?: number;
  day_25?: number;
  day_26?: number;
  day_27?: number;
  day_28?: number;
  day_29?: number;
  day_30?: number;
  day_31?: number;
  [key: string]: any;
}

export interface DutySyncResult {
  success: boolean;
  message: string;
  count?: number;
  isRlsBlocked?: boolean;
  matrix?: DutyRatioTable[];
}

export function parseEligibleFlights(fltStr?: string): FlightName[] {
  if (!fltStr) return ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  const s = fltStr.trim();
  if (s.toLowerCase() === 'all flt' || s.toLowerCase() === 'all') {
    return ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  }
  const parts = s.split(/[,/|]+/).map(p => p.trim().toLowerCase());
  const res: FlightName[] = [];
  if (parts.some(p => p.includes('mech'))) res.push('Mechanics');
  if (parts.some(p => p.includes('avi'))) res.push('Avionics');
  if (parts.some(p => p.includes('gcs'))) res.push('GCS');
  if (parts.some(p => p.includes('admin'))) res.push('Admin');
  return res.length > 0 ? res : ['Mechanics', 'Avionics', 'GCS', 'Admin'];
}

export function parseEligibleRanks(rankStr?: string): Rank[] {
  if (!rankStr) return ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
  const s = rankStr.trim();
  const lower = s.toLowerCase();
  if (lower === 'cpl & below' || lower === 'cpl and below') {
    return ['Cpl', 'LAC', 'AC-1', 'AC-2'];
  }
  if (lower === 'sgt & below' || lower === 'sgt and below') {
    return ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
  }
  const allRanks: Rank[] = ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
  const parts = s.split(/[,/|]+/).map(p => p.trim().toLowerCase());
  const matched = allRanks.filter(r => parts.includes(r.toLowerCase()));
  return matched.length > 0 ? matched : ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
}

export function getDailyRequirementsFromTable(table: DutyRatioTable): number[] {
  if (table.dailyRequirements && table.dailyRequirements.length === 31 && table.dailyRequirements.some(x => x > 0)) {
    return table.dailyRequirements;
  }

  if (table.data) {
    const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
    const reqs: number[] = [];
    for (let d = 0; d < 31; d++) {
      let daySum = 0;
      for (const fl of flights) {
        daySum += table.data[fl]?.[d] || 0;
      }
      reqs.push(daySum);
    }
    if (reqs.some(x => x > 0)) {
      return reqs;
    }
  }

  if (table.totalRequiredDaily && table.totalRequiredDaily > 0) {
    if (table.totalRequiredMonth && table.totalRequiredMonth < table.totalRequiredDaily * 31) {
      const reqs = new Array(31).fill(0);
      let count = 0;
      for (let i = 0; i < 31 && count < table.totalRequiredMonth; i++) {
        reqs[i] = table.totalRequiredDaily;
        count += table.totalRequiredDaily;
      }
      return reqs;
    }
    return new Array(31).fill(table.totalRequiredDaily);
  }

  if (table.totalRequiredMonth && table.totalRequiredMonth > 0) {
    const reqs = new Array(31).fill(0);
    const daysToFill = Math.min(31, table.totalRequiredMonth);
    for (let i = 0; i < daysToFill; i++) {
      reqs[i] = 1;
    }
    return reqs;
  }

  return new Array(31).fill(1);
}

export function formatTableToCloudRow(table: DutyRatioTable, index: number): DutyCloudRow {
  const serNo = table.serNo !== undefined ? table.serNo : index + 1;
  const dailyReqs = getDailyRequirementsFromTable(table);
  const total = dailyReqs.reduce((acc, curr) => acc + (curr || 0), 0);

  const row: DutyCloudRow = {
    ser_no: serNo,
    duty_name: table.title || `Duty ${serNo}`,
    eligible_flt: (table.eligibleFlights || []).join(', ') || 'All Flt',
    eligible_rank: (table.eligibleRanks || []).join(', ') || 'Cpl & Below',
    total,
    Status: table.isDisabled ? 'DISABLE' : 'ENABLE',
    status: table.isDisabled ? 'disable' : 'enable',
    is_disabled: !!table.isDisabled,
    isDisabled: !!table.isDisabled,
    'Allotment Type': table.allotmentType === 'equal' ? 'equal' : 'ratio',
  };

  for (let day = 1; day <= 31; day++) {
    row[`day_${day}`] = dailyReqs[day - 1] !== undefined ? dailyReqs[day - 1] : 0;
  }

  return row;
}

export async function pushDutyListToCloud(matrixInput?: DutyRatioTable[]): Promise<DutySyncResult> {
  const matrix = matrixInput && matrixInput.length > 0 ? matrixInput : getStoredDutyMatrix();
  saveDutyMatrix(matrix);
  return {
    success: true,
    count: matrix.length,
    matrix,
    message: `Successfully saved ${matrix.length} duties locally!`,
  };
}

export async function pullDutyListFromCloud(): Promise<DutySyncResult> {
  const matrix = getStoredDutyMatrix();
  return {
    success: true,
    count: matrix.length,
    matrix,
    message: `Loaded ${matrix.length} duties from local storage.`,
  };
}
