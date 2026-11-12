import { DutyTypeInfo, DutyCategoryCode, FlightName, Rank } from '../types';

export interface CustomDutyConfig extends DutyTypeInfo {
  isCustom: true;
}

const STORAGE_KEY = 'baf_custom_duties_v1';

export const DEFAULT_CUSTOM_DUTIES: CustomDutyConfig[] = [
  {
    code: 'CUST_1794394964393' as DutyCategoryCode,
    name: 'Escort Duty',
    shortName: 'ESCT',
    category: 'Special',
    color: 'bg-indigo-600 text-white',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    isCountedAsDuty: true,
    description: 'Escort Duty',
    isCustom: true,
    eligibleFlights: ['Mechanics', 'Avionics', 'GCS', 'Admin'],
    eligibleRanks: ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'],
    onParadeOnDutyDay: false,
    dutyOffNextDay: true,
    onPtNextDay: true
  }
];

export const getCustomDuties = (): CustomDutyConfig[] => {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_DUTIES;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed: CustomDutyConfig[] = saved ? JSON.parse(saved) : [];
    // Ensure default custom duties like Escort Duty are always present with updated shortName & rules
    const map = new Map<string, CustomDutyConfig>();
    DEFAULT_CUSTOM_DUTIES.forEach(d => map.set(d.code, d));
    parsed.forEach(d => {
      if ((d.code as any) === 'CUST_1794394964393' || d.name === 'Escort Duty') {
        map.set(d.code, {
          ...d,
          shortName: 'ESCT',
          dutyOffNextDay: true,
          onParadeOnDutyDay: false,
          onPtNextDay: true
        });
      } else {
        map.set(d.code, d);
      }
    });
    return Array.from(map.values());
  } catch {
    return DEFAULT_CUSTOM_DUTIES;
  }
};

export const getCustomDutyName = (code?: string | null): string | undefined => {
  if (!code) return undefined;
  const c = String(code).trim();
  if (c === 'CUST_1794394964393' || c.includes('1794394964393')) return 'Escort Duty';
  const custom = getCustomDuties().find(d => d.code === c);
  if (custom?.name) return custom.name;
  if (typeof window !== 'undefined') {
    try {
      const matrixRaw = localStorage.getItem('baf_official_duty_matrix_v4');
      if (matrixRaw) {
        const matrix = JSON.parse(matrixRaw);
        if (Array.isArray(matrix)) {
          const item = matrix.find((m: any) => m.id === c || m.dutyCode === c);
          if (item?.title) return item.title;
        }
      }
    } catch {}
  }
  return undefined;
};

export const saveCustomDuties = (duties: CustomDutyConfig[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(duties));
  try {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: STORAGE_KEY,
        value: JSON.stringify(duties)
      })
    }).catch(() => {});
  } catch {}
  window.dispatchEvent(new Event('baf_custom_duties_updated'));
  window.dispatchEvent(new Event('baf_state_updated')); // Force react components to update
};

export const addCustomDuty = (duty: CustomDutyConfig) => {
  const duties = getCustomDuties();
  saveCustomDuties([...duties.filter(d => d.code !== duty.code), duty]);
};

export const removeCustomDuty = (code: string) => {
  const duties = getCustomDuties();
  saveCustomDuties(duties.filter(d => d.code !== code));
};

