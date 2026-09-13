import { DutyTypeInfo, DutyCategoryCode, FlightName, Rank } from '../types';

export interface CustomDutyConfig extends DutyTypeInfo {
  isCustom: true;
}

const STORAGE_KEY = 'baf_custom_duties_v1';

export const getCustomDuties = (): CustomDutyConfig[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveCustomDuties = (duties: CustomDutyConfig[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(duties));
  window.dispatchEvent(new Event('baf_custom_duties_updated'));
  window.dispatchEvent(new Event('baf_state_updated')); // Force react components to update
};

export const addCustomDuty = (duty: CustomDutyConfig) => {
  const duties = getCustomDuties();
  saveCustomDuties([...duties, duty]);
};

export const removeCustomDuty = (code: string) => {
  const duties = getCustomDuties();
  saveCustomDuties(duties.filter(d => d.code !== code));
};
