export interface IdacEmergencyContact {
  id: string;
  name: string;
  remark?: string; // e.g., 'Supervisor', 'Flight Safety', 'In-Charge'
  rankDesignation?: string;
  phone: string;
  whatsappPhone: string;
  airmanId?: string;
  rank?: string;
  flightName?: string;
  serNo?: number;
}

export interface IdacResponsibility {
  id: string;
  text: string;
}

export interface IdacShiftTimeConfig {
  shift: 'Morning' | 'Afternoon' | 'Night';
  startTime: string; // e.g. '07:30'
  endTime: string;   // e.g. '14:30'
  label?: string;
}

export const DEFAULT_SHIFT_TIMES: IdacShiftTimeConfig[] = [
  { shift: 'Morning', startTime: '07:30', endTime: '14:30', label: '07:30 - 14:30 hrs' },
  { shift: 'Afternoon', startTime: '14:30', endTime: '21:00', label: '14:30 - 21:00 hrs' },
  { shift: 'Night', startTime: '21:00', endTime: '07:30', label: '21:00 - 07:30 hrs' },
];

const DEFAULT_RESPONSIBILITIES: IdacResponsibility[] = [
  { id: '1', text: 'If electricity off has a look whether Gen is automatically On or not.' },
  { id: '2', text: 'Any Fire occurrence.' },
  { id: '3', text: 'Any other abnormality.' },
  { id: '4', text: 'Pour out the water from dehumidifier every morning.' },
];

const DEFAULT_CONTACTS: IdacEmergencyContact[] = [
  {
    id: 'airman-5',
    airmanId: 'airman-5',
    name: 'WO A. Baten',
    remark: 'Supervisor',
    rankDesignation: 'Warrant Officer (Avionics Flt)',
    phone: '01711465669',
    whatsappPhone: '01711465669',
    rank: 'WO',
    flightName: 'Avionics',
    serNo: 5,
  },
  {
    id: 'airman-7',
    airmanId: 'airman-7',
    name: 'WO Lutfar',
    rankDesignation: 'Warrant Officer (Avionics Flt)',
    phone: '01711465917',
    whatsappPhone: '01711465917',
    rank: 'WO',
    flightName: 'Avionics',
    serNo: 7,
  },
  {
    id: 'airman-9',
    airmanId: 'airman-9',
    name: 'Sgt Uzzal',
    rankDesignation: 'Sergeant (Avionics Flt)',
    phone: '01918523473',
    whatsappPhone: '01918523473',
    rank: 'Sgt',
    flightName: 'Avionics',
    serNo: 9,
  },
];

const RESPONSIBILITIES_KEY = 'baf_idac_responsibilities';
const CONTACTS_KEY = 'baf_idac_emergency_contacts_v5';
const SHIFT_TIMES_KEY = 'baf_idac_shift_times_v2';

export const getRankSeniorityWeight = (rankStr?: string): number => {
  if (!rankStr) return 99;
  const upper = rankStr.toUpperCase();
  if (upper.includes('MWO')) return 1;
  if (upper.includes('SWO')) return 2;
  if (upper.includes('WO') || upper.includes('WARRANT')) return 3;
  if (upper.includes('SGT') || upper.includes('SERGEANT')) return 4;
  if (upper.includes('CPL') || upper.includes('CORPORAL')) return 5;
  if (upper.includes('LAC')) return 6;
  if (upper.includes('AC-1') || upper.includes('AC1')) return 7;
  if (upper.includes('AC')) return 8;
  return 50;
};

export const normalizeContactKey = (c: IdacEmergencyContact): string => {
  if (c.airmanId) return `airman-${c.airmanId}`;
  if (c.phone) {
    const cleanP = c.phone.replace(/\D/g, '');
    if (cleanP.length >= 8) return `phone-${cleanP.slice(-10)}`;
  }
  const cleanName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `name-${cleanName}`;
};

export const sortContactsBySeniority = (list: IdacEmergencyContact[]): IdacEmergencyContact[] => {
  // Deduplicate first
  const seen = new Set<string>();
  const deduped: IdacEmergencyContact[] = [];

  list.forEach((item) => {
    // Clean normalized key
    const k1 = item.airmanId ? `aid-${item.airmanId}` : '';
    const cleanP = (item.phone || '').replace(/\D/g, '');
    const k2 = cleanP.length >= 8 ? `p-${cleanP.slice(-10)}` : '';
    const cleanN = (item.name || '').toLowerCase().replace(/[^a-z]/g, '');
    const isBaten = cleanN.includes('baten');
    const k3 = isBaten ? 'baten' : `n-${cleanN}`;

    if (k1 && seen.has(k1)) return;
    if (k2 && seen.has(k2)) return;
    if (seen.has(k3)) return;

    if (k1) seen.add(k1);
    if (k2) seen.add(k2);
    seen.add(k3);
    deduped.push(item);
  });

  return deduped.sort((a, b) => {
    const rA = getRankSeniorityWeight(a.rank || a.rankDesignation || a.name);
    const rB = getRankSeniorityWeight(b.rank || b.rankDesignation || b.name);
    if (rA !== rB) return rA - rB;
    const sA = typeof a.serNo === 'number' && a.serNo > 0 ? a.serNo : 999;
    const sB = typeof b.serNo === 'number' && b.serNo > 0 ? b.serNo : 999;
    return sA - sB;
  });
};

export const getIdacResponsibilities = (): IdacResponsibility[] => {
  try {
    const raw = localStorage.getItem(RESPONSIBILITIES_KEY);
    if (!raw) return DEFAULT_RESPONSIBILITIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RESPONSIBILITIES;
  } catch {
    return DEFAULT_RESPONSIBILITIES;
  }
};

export const saveIdacResponsibilities = (list: IdacResponsibility[]): void => {
  try {
    localStorage.setItem(RESPONSIBILITIES_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('baf_idac_settings_updated'));
  } catch (e) {
    console.error('Failed to save responsibilities:', e);
  }
};

export const getIdacEmergencyContacts = (): IdacEmergencyContact[] => {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY) || localStorage.getItem('baf_idac_emergency_contacts');
    if (!raw) return sortContactsBySeniority(DEFAULT_CONTACTS);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return sortContactsBySeniority(parsed);
    }
    return sortContactsBySeniority(DEFAULT_CONTACTS);
  } catch {
    return sortContactsBySeniority(DEFAULT_CONTACTS);
  }
};

export const saveIdacEmergencyContacts = (list: IdacEmergencyContact[]): void => {
  try {
    const sorted = sortContactsBySeniority(list);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent('baf_idac_settings_updated'));
  } catch (e) {
    console.error('Failed to save emergency contacts:', e);
  }
};

export const getIdacShiftTimes = (): IdacShiftTimeConfig[] => {
  try {
    const raw = localStorage.getItem(SHIFT_TIMES_KEY);
    if (!raw) return DEFAULT_SHIFT_TIMES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed;
    }
    return DEFAULT_SHIFT_TIMES;
  } catch {
    return DEFAULT_SHIFT_TIMES;
  }
};

export const saveIdacShiftTimes = (times: IdacShiftTimeConfig[]): void => {
  try {
    localStorage.setItem(SHIFT_TIMES_KEY, JSON.stringify(times));
    window.dispatchEvent(new CustomEvent('baf_idac_settings_updated'));
    window.dispatchEvent(new CustomEvent('baf_state_updated'));
  } catch (e) {
    console.error('Failed to save shift times:', e);
  }
};
