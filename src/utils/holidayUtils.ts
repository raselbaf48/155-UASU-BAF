export const parseLocalDate = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
};

export const getWeekdayShort = (dateStr: string): string => {
  const dt = parseLocalDate(dateStr);
  if (!dt) return '';
  return dt.toLocaleDateString('en-US', { weekday: 'short' });
};

export const getWeekdayFull = (dateStr: string): string => {
  const dt = parseLocalDate(dateStr);
  if (!dt) return '';
  return dt.toLocaleDateString('en-US', { weekday: 'long' });
};

const readHolidayList = (key: string): string[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const isHolidayDate = (dateStr: string): boolean => {
  const dt = parseLocalDate(dateStr);
  if (!dt) return false;
  const cleanDate = dateStr.split('T')[0];
  const removed = readHolidayList('baf_removed_holidays');
  if (removed.includes(cleanDate)) return false;

  const custom = readHolidayList('baf_custom_holidays');
  if (custom.includes(cleanDate)) return true;

  const day = dt.getDay();
  return day === 5 || day === 6; // Friday or Saturday (Weekend / Off Day)
};
