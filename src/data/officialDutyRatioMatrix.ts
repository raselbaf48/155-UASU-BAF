import { getCustomDuties } from '../utils/customDuties';
import { FlightName, DutyCategoryCode, IDAShift } from '../types';
import { FlightDutyQuota } from './dutyRatios';

export type AllotmentType = 'ratio' | 'equal';

export interface DutyRatioTable {
  id: string;
  serNo?: number;
  title: string; // e.g., 'SECURITY DUTY (88)'
  dutyCode: DutyCategoryCode;
  shiftLabel?: string; // e.g. 'Morning', 'Afternoon', 'Night'
  totalRequiredMonth: number;
  totalRequiredDaily?: number;
  dailyRequirements?: number[];
  isDisabled?: boolean;
  eligibleFlights?: import('../types').FlightName[];
  eligibleRanks?: import('../types').Rank[];
  allotmentType?: AllotmentType;
  onParadeOnDutyDay?: boolean; // When ON: Duty er din Parade State e ON Parade thakbe, bt PT State e On Duty thakbe
  dutyOffNextDay?: boolean;    // When ON: Porer din Parade State e Duty Off thakbe
  onPtNextDay?: boolean;       // When ON: Porer din PT State e On PT thakbe; When OFF: PT State e Duty Off thakbe
  flightTargets?: {
    Mechanics?: number;
    Avionics?: number;
    GCS?: number;
    Admin?: number;
  };
  data: {
    Mechanics: number[]; // Array of 31 numbers (index 0 = day 1, index 30 = day 31)
    Avionics: number[];
    GCS: number[];
    Admin: number[];
  };
}

export const INITIAL_OFFICIAL_DUTY_MATRIX: DutyRatioTable[] = [
  // 1. BASE SECURITY DUTY
  {
    id: 'security_duty',
    serNo: 1,
    title: 'BASE SECURITY DUTY',
    dutyCode: 'GD',
    allotmentType: 'ratio',
    onParadeOnDutyDay: false,
    dutyOffNextDay: true,
    onPtNextDay: true,
    totalRequiredMonth: 88,
    totalRequiredDaily: 3,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,0],
      Avionics:  [0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,1,1,1,1,1,1,0],
      GCS:       [1,1,1,1,1,1,1,1,1,2,1,1,1,0,1,1,1,0,1,1,1,1,1,1,1,1,1,0,0,0,1],
      Admin:     [1,0,1,0,1,0,0,1,0,0,0,1,0,1,1,0,1,1,0,1,0,1,0,1,0,0,1,1,1,1,1],
    },
  },
  // 2. BASE TASKFORCE DUTY
  {
    id: 'base_tf',
    serNo: 2,
    title: 'BASE TASKFORCE DUTY',
    dutyCode: 'BTF',
    allotmentType: 'ratio',
    onParadeOnDutyDay: false,
    dutyOffNextDay: true,
    onPtNextDay: true,
    totalRequiredMonth: 22,
    totalRequiredDaily: 1,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [0,1,1,1,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
      Avionics:  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
      GCS:       [0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,1,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0],
      Admin:     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    },
  },
  // 3. NAJIRPARA TASKFORCE DUTY
  {
    id: 'nazirpara_tf',
    serNo: 3,
    title: 'NAJIRPARA TASKFORCE DUTY',
    dutyCode: 'NTF',
    allotmentType: 'ratio',
    onParadeOnDutyDay: false,
    dutyOffNextDay: true,
    onPtNextDay: true,
    totalRequiredMonth: 40,
    totalRequiredDaily: 1,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [1,0,0,0,1,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,1],
      Avionics:  [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,1,1,1,0,0,1,0,0,1,0],
      GCS:       [1,1,0,1,0,1,0,0,1,1,0,1,1,0,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,1,1],
      Admin:     [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    },
  },
  // 4. IDAC MORNING
  {
    id: 'idac_mor',
    serNo: 4,
    title: 'IDAC  MORNING',
    dutyCode: 'IDAC',
    shiftLabel: 'Morning',
    allotmentType: 'ratio',
    onParadeOnDutyDay: false,
    dutyOffNextDay: false,
    totalRequiredMonth: 31,
    totalRequiredDaily: 1,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [0,0,0,0,1,1,0,0,0,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,1,0],
      Avionics:  [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0],
      GCS:       [1,1,1,0,0,0,1,1,1,0,0,0,0,1,1,1,1,0,0,1,1,1,0,0,0,1,1,1,0,0,1],
      Admin:     [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
    },
  },
  // 5. IDAC AFTERNOON
  {
    id: 'idac_an',
    serNo: 5,
    title: 'IDAC AFTERNOON ',
    dutyCode: 'IDAC',
    shiftLabel: 'Afternoon',
    allotmentType: 'ratio',
    onParadeOnDutyDay: false,
    dutyOffNextDay: false,
    totalRequiredMonth: 31,
    totalRequiredDaily: 1,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [0,1,1,1,0,0,1,1,1,0,0,0,0,1,1,1,1,0,0,1,0,1,0,0,1,1,1,0,0,0,0],
      Avionics:  [1,0,0,0,0,1,0,0,0,1,1,0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1,0,1,1],
      GCS:       [0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
      Admin:     [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    },
  },
  // 6. IDAC NIGHT
  {
    id: 'idac_nt',
    serNo: 6,
    title: 'IDAC NIGHT',
    dutyCode: 'IDAC',
    shiftLabel: 'Night',
    allotmentType: 'ratio',
    onParadeOnDutyDay: true,
    dutyOffNextDay: true,
    onPtNextDay: true,
    totalRequiredMonth: 62,
    totalRequiredDaily: 2,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [1,1,1,1,0,1,0,1,0,1,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0,0,1,1,1,1,1],
      Avionics:  [1,0,0,0,1,0,1,1,1,0,0,1,0,1,1,1,0,0,1,1,0,0,0,1,1,1,0,0,0,0,0],
      GCS:       [0,1,1,1,1,1,0,0,1,1,1,0,1,1,0,1,1,0,0,1,1,1,1,0,1,1,1,1,1,1,1],
      Admin:     [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    },
  },
  // 7. AIRFIELD DUTY
  {
    id: 'airport_duty',
    serNo: 7,
    title: 'AIRFIELD DUTY',
    dutyCode: 'AIRPORT',
    allotmentType: 'equal',
    onParadeOnDutyDay: false,
    dutyOffNextDay: true,
    onPtNextDay: true,
    totalRequiredMonth: 93,
    totalRequiredDaily: 3,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      Avionics:  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      GCS:       [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      Admin:     [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    },
  },
  // 8. RECEIPTION DUTY
  {
    id: 'reception_duty',
    serNo: 8,
    title: 'RECEIPTION DUTY',
    dutyCode: 'RECEPTION',
    allotmentType: 'ratio',
    onParadeOnDutyDay: false,
    dutyOffNextDay: false,
    totalRequiredMonth: 31,
    totalRequiredDaily: 1,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    data: {
      Mechanics: [1,0,1,1,0,0,1,0,1,0,0,0,0,1,0,0,1,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
      Avionics:  [0,1,0,0,0,0,0,0,0,0,1,0,1,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1,1],
      GCS:       [0,0,0,0,1,1,0,1,0,0,0,1,0,0,1,0,0,1,1,0,0,0,1,1,0,0,1,0,1,0,0],
      Admin:     [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    },
  },
  // 9. HALISHAHAR TASKFORCE DUTY
  {
    id: 'halishahar_tf_duty',
    serNo: 9,
    title: 'HALISHAHAR TASKFORCE DUTY',
    dutyCode: 'HALISHAHAR' as DutyCategoryCode,
    allotmentType: 'equal',
    onParadeOnDutyDay: false,
    dutyOffNextDay: true,
    onPtNextDay: true,
    totalRequiredMonth: 7,
    totalRequiredDaily: 1,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    dailyRequirements: [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    data: {
      Mechanics: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      Avionics:  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      GCS:       [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      Admin:     [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    },
  },
];

export function parseDayNumber(dateStr: string): number {
  if (!dateStr) return 1;
  const trimmed = dateStr.trim();
  // Handle ISO or YYYY-MM-DD
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length >= 3) {
      const d = parseInt(parts[2].slice(0, 2), 10);
      if (!isNaN(d) && d >= 1 && d <= 31) return d;
    }
  }
  // Handle MM/DD/YYYY or DD/MM/YYYY
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length >= 3) {
      // In MM/DD/YYYY, parts[1] is the day
      const d1 = parseInt(parts[1], 10);
      if (!isNaN(d1) && d1 >= 1 && d1 <= 31) return d1;
      // In DD/MM/YYYY, parts[0] is the day
      const d0 = parseInt(parts[0], 10);
      if (!isNaN(d0) && d0 >= 1 && d0 <= 31) return d0;
      const d2 = parseInt(parts[2], 10);
      if (!isNaN(d2) && d2 >= 1 && d2 <= 31) return d2;
    }
  }
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) {
    return dt.getDate();
  }
  return 1;
}

export interface DutyRatioVersion {
  id: string;
  applyFromDate: string; // YYYY-MM-DD
  title: string;
  matrix: DutyRatioTable[];
  createdAt: string;
  notes?: string;
}

export const MATRIX_STORAGE_KEY = 'baf_official_duty_matrix_v4';
export const RATIO_HISTORY_STORAGE_KEY = 'baf_duty_ratio_history_v1';

export function normalizeDateToISOStr(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dMmmMatch = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[-\s/](\d{2,4})$/);
  if (dMmmMatch) {
    const day = parseInt(dMmmMatch[1], 10);
    const monthStr = dMmmMatch[2].toLowerCase();
    let year = parseInt(dMmmMatch[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIdx = months.indexOf(monthStr);
    if (monthIdx >= 0) {
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s;
}

export function sanitizeDutyMatrix(matrix: DutyRatioTable[]): DutyRatioTable[] {
  return matrix.map((m, idx) => {
    const copy = { ...m };
    copy.serNo = copy.serNo !== undefined && copy.serNo !== null ? Number(copy.serNo) : (idx + 1);
    if (copy.dailyRequirements && Array.isArray(copy.dailyRequirements) && copy.dailyRequirements.length > 0) {
      copy.totalRequiredMonth = copy.dailyRequirements.reduce((a, b) => a + (Number(b) || 0), 0);
    } else if (!copy.totalRequiredMonth && copy.totalRequiredDaily) {
      copy.totalRequiredMonth = copy.totalRequiredDaily * 31;
    }
    return copy;
  });
}

export function getStoredDutyMatrixInternal(): DutyRatioTable[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [...INITIAL_OFFICIAL_DUTY_MATRIX];
    }
    const raw = localStorage.getItem(MATRIX_STORAGE_KEY) || localStorage.getItem('baf_official_duty_matrix_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const defaultsMap = new Map(INITIAL_OFFICIAL_DUTY_MATRIX.map((t) => [t.id, t]));
        const updatedParsed = parsed.map((t: DutyRatioTable) => {
          const defT = defaultsMap.get(t.id);
          let title = t.title || defT?.title || '';
          if (defT) {
            const cleanT = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (
              cleanT === 'securityduty88' ||
              cleanT === 'basetf22' ||
              cleanT === 'nazirparatarforce40' ||
              cleanT === 'nazirparataforce40' ||
              cleanT === 'nazirparaf40' ||
              cleanT === 'nazirparattf40' ||
              cleanT === 'nazirparaf' ||
              cleanT === 'idacmor31' ||
              cleanT === 'idacan31' ||
              cleanT === 'idacnt62' ||
              cleanT === 'halishahartf'
            ) {
              title = defT.title;
            }
          }
          const eligFlights = t.eligibleFlights || defT?.eligibleFlights;
          const isSingleFlt = eligFlights && eligFlights.length === 1;
          return {
            ...t,
            title,
            dutyCode: defT?.dutyCode || t.dutyCode,
            eligibleFlights: eligFlights,
            eligibleRanks: t.eligibleRanks || defT?.eligibleRanks,
            allotmentType: isSingleFlt ? 'equal' : (t.allotmentType || defT?.allotmentType),
            flightTargets: t.flightTargets,
            onParadeOnDutyDay: t.onParadeOnDutyDay !== undefined ? t.onParadeOnDutyDay : defT?.onParadeOnDutyDay,
            dutyOffNextDay: t.dutyOffNextDay !== undefined ? t.dutyOffNextDay : defT?.dutyOffNextDay,
            onPtNextDay: t.onPtNextDay !== undefined ? t.onPtNextDay : (defT?.onPtNextDay !== undefined ? defT.onPtNextDay : (t.dutyOffNextDay ? true : undefined)),
          };
        });
        const existingIds = new Set(updatedParsed.map((t: DutyRatioTable) => t.id));
        const missing = INITIAL_OFFICIAL_DUTY_MATRIX.filter((t) => !existingIds.has(t.id));
        const customDuties = getCustomDuties();
        const validCustomIds = new Set(customDuties.map(cd => cd.code.toLowerCase() + '_duty'));
        const officialIds = new Set(INITIAL_OFFICIAL_DUTY_MATRIX.map(t => t.id));
        
        let finalMatrix: DutyRatioTable[] = updatedParsed.filter(t => officialIds.has(t.id) || validCustomIds.has(t.id));
        
        if (missing.length > 0) {
          finalMatrix = [...finalMatrix, ...missing];
        }

        if (typeof window !== 'undefined' && !localStorage.getItem('baf_cleared_auto_flight_targets_v4')) {
          finalMatrix.forEach(t => {
            delete t.flightTargets;
          });
          localStorage.setItem('baf_cleared_auto_flight_targets_v4', 'true');
        }

        try {
          const metaRaw = localStorage.getItem('baf_duty_matrix_metadata');
          if (metaRaw) {
            const parsedMeta = JSON.parse(metaRaw);
            if (Array.isArray(parsedMeta)) {
              parsedMeta.forEach((m: any) => {
                const isDis = m.isDisabled === true || String(m.isDisabled) === 'true' ||
                  m.is_disabled === true || String(m.is_disabled) === 'true' ||
                  String(m.status || '').toLowerCase() === 'disable' ||
                  String(m.status || '').toLowerCase() === 'disabled';
                if (isDis) {
                  const match = finalMatrix.find(t => t.id === m.id || t.title.toLowerCase().trim() === String(m.title || '').toLowerCase().trim());
                  if (match) match.isDisabled = true;
                }
              });
            }
          }
        } catch (e) {}

        const secTable = finalMatrix.find(t => t.id === 'security_duty');
        if (secTable && secTable.data?.Mechanics && secTable.data?.Admin) {
          const mechSum = secTable.data.Mechanics.reduce((a: number, b: number) => a + b, 0);
          const adminSum = secTable.data.Admin.reduce((a: number, b: number) => a + b, 0);
          if (mechSum === 33 && adminSum === 6) {
            const defSec = INITIAL_OFFICIAL_DUTY_MATRIX.find(t => t.id === 'security_duty');
            if (defSec) {
              secTable.data = {
                Mechanics: [...defSec.data.Mechanics],
                Avionics: [...defSec.data.Avionics],
                GCS: [...defSec.data.GCS],
                Admin: [...defSec.data.Admin],
              };
              try {
                localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(finalMatrix));
              } catch (e) {}
            }
          }
        }
        
        const existingMatrixIds = new Set(finalMatrix.map(t => t.id));
        customDuties.forEach(cd => {
           const id = cd.code.toLowerCase() + '_duty';
           if (!existingMatrixIds.has(id)) {
               finalMatrix.push({
                  id,
                  title: cd.name,
                  dutyCode: cd.code as any,
                  eligibleFlights: ["Mechanics", "Avionics", "GCS", "Admin"],
                  eligibleRanks: ["Sgt", "Cpl", "LAC", "AC-1"],
                  totalRequiredMonth: 0,
                  totalRequiredDaily: 0,
                  data: {
                    Mechanics: Array(31).fill(0),
                    Avionics: Array(31).fill(0),
                    GCS: Array(31).fill(0),
                    Admin: Array(31).fill(0),
                  }
               });
           }
        });

        finalMatrix.sort((a, b) => {
          if (a.serNo !== undefined && b.serNo !== undefined) return Number(a.serNo) - Number(b.serNo);
          if (a.serNo !== undefined) return -1;
          if (b.serNo !== undefined) return 1;
          return 0;
        });

        finalMatrix.forEach((d, idx) => {
          d.serNo = idx + 1;
        });

        return finalMatrix;
      }
    }
  } catch (e) {
    console.error('Failed to load stored duty matrix:', e);
  }
  
  const baseMatrix = [...INITIAL_OFFICIAL_DUTY_MATRIX];
  const customDuties = getCustomDuties();
  customDuties.forEach(cd => {
      const id = cd.code.toLowerCase() + '_duty';
      if (!baseMatrix.find(t => t.id === id)) {
          baseMatrix.push({
             id,
             title: cd.name,
             dutyCode: cd.code as any,
             eligibleFlights: ["Mechanics", "Avionics", "GCS", "Admin"],
             eligibleRanks: ["Sgt", "Cpl", "LAC", "AC-1"],
             totalRequiredMonth: 0,
             totalRequiredDaily: 0,
             data: {
               Mechanics: Array(31).fill(0),
               Avionics: Array(31).fill(0),
               GCS: Array(31).fill(0),
               Admin: Array(31).fill(0),
             }
          });
      }
  });

  baseMatrix.sort((a, b) => {
    if (a.serNo !== undefined && b.serNo !== undefined) return Number(a.serNo) - Number(b.serNo);
    if (a.serNo !== undefined) return -1;
    if (b.serNo !== undefined) return 1;
    return 0;
  });

  baseMatrix.forEach((d, idx) => {
    d.serNo = idx + 1;
  });

  return baseMatrix;
}

export function getDutyRatioHistory(): DutyRatioVersion[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [{
        id: 'ratio_version_base',
        applyFromDate: '2026-01-01',
        title: 'All Duty Ratio',
        matrix: [...INITIAL_OFFICIAL_DUTY_MATRIX],
        createdAt: '2026-01-01T00:00:00.000Z',
      }];
    }
    const raw = localStorage.getItem(RATIO_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let hasModified = false;
        parsed.forEach((item: any) => {
          if (item && item.title && (item.title === 'Base Duty Ratio' || item.title === 'Base Duty Ratio (Default)' || item.title.startsWith('Base Duty Ratio'))) {
            item.title = 'All Duty Ratio';
            hasModified = true;
          }
        });
        if (hasModified) {
          try {
            localStorage.setItem(RATIO_HISTORY_STORAGE_KEY, JSON.stringify(parsed));
          } catch {}
        }
        return parsed.sort((a, b) => (a.applyFromDate || '').localeCompare(b.applyFromDate || ''));
      }
    }
  } catch (e) {
    console.error('Failed to load duty ratio history:', e);
  }

  // Fallback: seed with existing matrix as initial version
  const baseMatrix = getStoredDutyMatrixInternal();
  const initialVersion: DutyRatioVersion = {
    id: 'ratio_version_base',
    applyFromDate: '2026-01-01',
    title: 'All Duty Ratio',
    matrix: baseMatrix,
    createdAt: new Date().toISOString(),
    notes: 'Initial Official Duty Ratio Matrix',
  };
  try {
    localStorage.setItem(RATIO_HISTORY_STORAGE_KEY, JSON.stringify([initialVersion]));
  } catch (e) {}
  return [initialVersion];
}

export function getDutyRatioVersionForDate(dateStr?: string): DutyRatioVersion {
  const history = getDutyRatioHistory();
  if (history.length === 0) {
    return {
      id: 'ratio_version_base',
      applyFromDate: '2026-01-01',
      title: 'All Duty Ratio',
      matrix: getStoredDutyMatrixInternal(),
      createdAt: new Date().toISOString(),
    };
  }

  let targetISO = '';
  if (dateStr) {
    targetISO = normalizeDateToISOStr(dateStr);
  }
  if (!targetISO) {
    const now = new Date();
    targetISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Filter versions whose applyFromDate is <= targetISO
  const applicable = history.filter(v => (v.applyFromDate || '') <= targetISO);
  if (applicable.length > 0) {
    // Return latest applicable version
    return applicable[applicable.length - 1];
  }

  // If target date is earlier than all versions, return the earliest version
  return history[0];
}

export function getStoredDutyMatrix(dateStr?: string): DutyRatioTable[] {
  if (dateStr) {
    const version = getDutyRatioVersionForDate(dateStr);
    if (version && version.matrix && version.matrix.length > 0) {
      return version.matrix;
    }
  }
  return getStoredDutyMatrixInternal();
}

export function saveDutyMatrix(matrix: DutyRatioTable[]) {
  try {
    const sanitizedMatrix = sanitizeDutyMatrix(matrix);

    localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(sanitizedMatrix));
    
    const metadata = sanitizedMatrix.map(m => ({
        id: m.id,
        serNo: m.serNo,
        title: m.title,
        dutyCode: m.dutyCode,
        shiftLabel: m.shiftLabel,
        eligibleFlights: m.eligibleFlights,
        eligibleRanks: m.eligibleRanks,
        allotmentType: m.allotmentType,
        flightTargets: m.flightTargets,
        isDisabled: m.isDisabled,
        totalRequiredDaily: m.totalRequiredDaily,
        totalRequiredMonth: m.totalRequiredMonth,
        dailyRequirements: m.dailyRequirements,
        onParadeOnDutyDay: m.onParadeOnDutyDay,
        dutyOffNextDay: m.dutyOffNextDay,
        onPtNextDay: m.onPtNextDay
    }));
    localStorage.setItem('baf_duty_matrix_metadata', JSON.stringify(metadata));
    localStorage.setItem('baf_duty_matrix_full', JSON.stringify(sanitizedMatrix));
    localStorage.setItem('baf_pending_sync', 'true');
    localStorage.setItem('baf_matrix_last_modified', String(Date.now()));

    // Synchronize all versions in history so getDutyRatioVersionForDate does not revert to old matrix!
    try {
      const history = getDutyRatioHistory();
      if (history.length > 0) {
        const updatedHistory = history.map(v => ({
          ...v,
          matrix: sanitizedMatrix
        }));
        localStorage.setItem(RATIO_HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      }
    } catch (hErr) {
      console.warn('Could not sync history versions:', hErr);
    }

    // Persist to server app_settings directly so pullAllSettingsFromServer does not overwrite with stale settings
    if (typeof fetch !== 'undefined') {
      fetch('/api/supabase/rest/v1/app_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            setting_key: 'baf_official_duty_matrix_v4',
            setting_value: JSON.stringify(sanitizedMatrix),
            updated_at: new Date().toISOString()
          },
          {
            setting_key: 'baf_duty_matrix_metadata',
            setting_value: JSON.stringify(metadata),
            updated_at: new Date().toISOString()
          },
          {
            setting_key: 'baf_duty_matrix_full',
            setting_value: JSON.stringify(sanitizedMatrix),
            updated_at: new Date().toISOString()
          }
        ])
      }).catch(err => console.warn('Could not persist matrix to server app_settings:', err));
    }

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix: sanitizedMatrix } }));
        window.dispatchEvent(new CustomEvent('baf_sync_duty_matrix_cloud', { detail: { matrix: sanitizedMatrix } }));
      }, 0);
    }
  } catch (e) {
    console.error('Failed to save duty matrix:', e);
  }
}


export function saveDutyRatioVersion(params: {
  id?: string;
  applyFromDate: string;
  title?: string;
  matrix: DutyRatioTable[];
  notes?: string;
}): DutyRatioVersion {
  const sanitized = sanitizeDutyMatrix(params.matrix);
  const history = getDutyRatioHistory();
  const applyDate = normalizeDateToISOStr(params.applyFromDate) || params.applyFromDate;
  
  let targetVersion: DutyRatioVersion;
  const existingIdx = history.findIndex(v => (params.id && v.id === params.id) || v.applyFromDate === applyDate);
  
  if (existingIdx >= 0) {
    targetVersion = {
      ...history[existingIdx],
      applyFromDate: applyDate,
      title: params.title || history[existingIdx].title || `All Duties Ratio (${applyDate})`,
      matrix: sanitized,
      notes: params.notes ?? history[existingIdx].notes,
    };
    history[existingIdx] = targetVersion;
  } else {
    targetVersion = {
      id: params.id || `ratio_v_${Date.now()}`,
      applyFromDate: applyDate,
      title: params.title || `All Duties Ratio (${applyDate})`,
      matrix: sanitized,
      createdAt: new Date().toISOString(),
      notes: params.notes || '',
    };
    history.push(targetVersion);
  }

  history.sort((a, b) => (a.applyFromDate || '').localeCompare(b.applyFromDate || ''));
  
  try {
    localStorage.setItem(RATIO_HISTORY_STORAGE_KEY, JSON.stringify(history));
    localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('Failed to save duty ratio history:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('baf_duty_ratio_history_updated', { detail: { history } }));
    window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix: sanitized } }));
  }

  return targetVersion;
}

export function deleteDutyRatioVersion(id: string): boolean {
  try {
    const raw = localStorage.getItem(RATIO_HISTORY_STORAGE_KEY);
    const history: DutyRatioVersion[] = raw ? JSON.parse(raw) : getDutyRatioHistory();
    const filtered = history.filter(v => v.id !== id);

    if (filtered.length === history.length) {
      console.warn('Version not found to delete:', id);
      return false;
    }

    if (filtered.length === 0) {
      const resetVersion: DutyRatioVersion = {
        id: 'ratio_version_base',
        applyFromDate: '2026-01-01',
        title: 'All Duty Ratio',
        matrix: [...INITIAL_OFFICIAL_DUTY_MATRIX],
        createdAt: new Date().toISOString(),
        notes: 'Reset to Official Unit Default Scale',
      };
      localStorage.setItem(RATIO_HISTORY_STORAGE_KEY, JSON.stringify([resetVersion]));
      localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(INITIAL_OFFICIAL_DUTY_MATRIX));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_history_updated', { detail: { history: [resetVersion] } }));
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix: INITIAL_OFFICIAL_DUTY_MATRIX } }));
      }
      return true;
    }

    localStorage.setItem(RATIO_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
    const latest = filtered[filtered.length - 1];
    if (latest && latest.matrix) {
      localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(latest.matrix));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_duty_ratio_history_updated', { detail: { history: filtered } }));
      if (latest && latest.matrix) {
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix: latest.matrix } }));
      }
    }
    return true;
  } catch (e) {
    console.error('Failed to delete duty ratio version:', e);
    return false;
  }
}

export function resetDutyMatrixToDefault(): DutyRatioTable[] {
  try {
    localStorage.removeItem(MATRIX_STORAGE_KEY);
    localStorage.removeItem(RATIO_HISTORY_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix: INITIAL_OFFICIAL_DUTY_MATRIX } }));
        window.dispatchEvent(new CustomEvent('baf_duty_ratio_history_updated', { detail: { history: [] } }));
      }, 0);
    }
  } catch (e) {
    console.error('Failed to reset matrix:', e);
  }
  return INITIAL_OFFICIAL_DUTY_MATRIX;
}

/**
 * Calculates exact FlightDutyQuota[] for any given date string (e.g., '2026-08-12')
 * by extracting the day number (1..31) and summing quotas across all duty tables.
 */
export function getDailyQuotasFromMatrix(dateStr: string): FlightDutyQuota[] {
  const matrix = getStoredDutyMatrix(dateStr);
  const dayNum = parseDayNumber(dateStr);
  const dayIndex = Math.max(0, Math.min(30, dayNum - 1));

  const flightQuotaMap: Record<FlightName, Partial<Record<DutyCategoryCode, number>>> = {
    Avionics: {},
    Mechanics: {},
    GCS: {},
    Admin: {},
  };

  const flights: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];

  matrix.forEach((table) => {
    flights.forEach((fl) => {
      const val = table.data[fl]?.[dayIndex] || 0;
      flightQuotaMap[fl][table.dutyCode] = (flightQuotaMap[fl][table.dutyCode] || 0) + val;
    });
  });

  const result: FlightDutyQuota[] = [];
  flights.forEach((fl) => {
    Object.entries(flightQuotaMap[fl]).forEach(([dCode, count]) => {
      if (count && count > 0) {
        result.push({
          flight: fl,
          dutyCode: dCode as DutyCategoryCode,
          requiredCount: count,
        });
      }
    });
  });

  return result;
}

/**
 * Returns available IDAC shifts ('Morning', 'Afternoon', 'Night') for a given date and flight,
 * strictly based on whether IDAC quota > 0 for that specific shift in the Official Duty Ratio Matrix.
 */
export function getIdacShiftsForDateAndFlight(dateStr: string, flight?: FlightName): IDAShift[] {
  if (!dateStr) return ['Morning', 'Afternoon', 'Night'];

  const dayNum = parseDayNumber(dateStr);
  const dayIndex = Math.max(0, Math.min(30, dayNum - 1));

  const matrix = getStoredDutyMatrix(dateStr);

  const morTable = matrix.find((t) => t.id === 'idac_mor' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Morning'));
  const anTable = matrix.find((t) => t.id === 'idac_an' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Afternoon'));
  const ntTable = matrix.find((t) => t.id === 'idac_nt' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Night'));

  const isSpecificFlight = flight && flight !== ('All' as any);
  const flightsToCheck: FlightName[] = isSpecificFlight
    ? [flight]
    : ['Mechanics', 'Avionics', 'GCS', 'Admin'];

  let morQuota = 0;
  let anQuota = 0;
  let ntQuota = 0;

  flightsToCheck.forEach((f) => {
    if (morTable?.data[f]) morQuota += morTable.data[f][dayIndex] || 0;
    if (anTable?.data[f]) anQuota += anTable.data[f][dayIndex] || 0;
    if (ntTable?.data[f]) ntQuota += ntTable.data[f][dayIndex] || 0;
  });

  const availableShifts: IDAShift[] = [];
  if (morQuota > 0) availableShifts.push('Morning');
  if (anQuota > 0) availableShifts.push('Afternoon');
  if (ntQuota > 0) availableShifts.push('Night');

  if (!isSpecificFlight && availableShifts.length === 0) {
    return ['Morning', 'Afternoon', 'Night'];
  }

  return availableShifts;
}

/**
 * Returns the exact scheduled quota for a given date, flight, duty code, and optional shift.
 */
export function getFlightDutyQuotaForDate(
  dateStr: string,
  flight: FlightName,
  dutyCode: DutyCategoryCode,
  shiftLabel?: string
): number {
  if (!dateStr || !flight) return 0;
  const dayNum = parseDayNumber(dateStr);
  const dayIndex = Math.max(0, Math.min(30, dayNum - 1));

  const matrix = getStoredDutyMatrix(dateStr);

  let table: DutyRatioTable | undefined;
  if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
    if (shiftLabel === 'Morning') {
      table = matrix.find((t) => t.id === 'idac_mor' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Morning'));
    } else if (shiftLabel === 'Afternoon') {
      table = matrix.find((t) => t.id === 'idac_an' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Afternoon'));
    } else if (shiftLabel === 'Night') {
      table = matrix.find((t) => t.id === 'idac_nt' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Night'));
    } else {
      return 0;
    }
  } else if (dutyCode === 'GD') {
    table = matrix.find((t) => t.id === 'security_duty' || t.dutyCode === 'GD');
  } else if (dutyCode === 'NTF') {
    table = matrix.find((t) => t.id === 'nazirpara_tf' || t.dutyCode === 'NTF');
  } else if (dutyCode === 'BTF') {
    table = matrix.find((t) => t.id === 'base_tf' || t.dutyCode === 'BTF');
  } else if (dutyCode === 'HALISHAHAR') {
    table = matrix.find((t) => t.id === 'halishahar_duty' || t.dutyCode === 'HALISHAHAR');
  } else if (dutyCode === 'AIRPORT') {
    table = matrix.find((t) => t.id === 'airport_duty' || t.dutyCode === 'AIRPORT');
  } else {
    table = matrix.find((t) => t.dutyCode === dutyCode);
  }

  if (!table || table.isDisabled) return 0;
  
  if (table.flightTargets && typeof table.flightTargets[flight] === 'number' && table.flightTargets[flight] === 0) {
    return 0;
  }

  return table.data[flight]?.[dayIndex] || 0;
}

export function getFlightsForIdacShift(dateStr: string, shift: string): import('../types').FlightName[] {
  if (!dateStr || !shift) return [];
  const dayNum = parseDayNumber(dateStr);
  const dayIndex = Math.max(0, Math.min(30, dayNum - 1));
  const matrix = getStoredDutyMatrix(dateStr);
  
  let table;
  if (shift === 'Morning') {
    table = matrix.find((t) => t.id === 'idac_mor' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Morning'));
  } else if (shift === 'Afternoon') {
    table = matrix.find((t) => t.id === 'idac_an' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Afternoon'));
  } else if (shift === 'Night') {
    table = matrix.find((t) => t.id === 'idac_nt' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Night'));
  }
  
  if (!table || table.isDisabled) return [];
  
  const validFlights: import('../types').FlightName[] = [];
  const flights: import('../types').FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];
  flights.forEach(f => {
    if (table?.data[f] && table.data[f][dayIndex] > 0) {
      validFlights.push(f);
    }
  });
  
  return validFlights;
}
