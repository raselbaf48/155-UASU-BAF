/**
 * Standard Canteen date formatting utility
 * Output format: "DD Mon YY" (e.g. "20 Sep 26")
 */

const MONTH_ABBRS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const formatCanteenDate = (val: any): string => {
  if (!val) return '-';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '-';
    const day = String(val.getDate()).padStart(2, '0');
    const mon = MONTH_ABBRS[val.getMonth()];
    const yr = String(val.getFullYear()).slice(-2);
    return `${day} ${mon} ${yr}`;
  }

  let str = String(val).trim();
  if (!str) return '-';

  // Replace Bengali digits with English digits
  const bnDigits: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  str = str.replace(/[০-৯]/g, ch => bnDigits[ch] || ch);

  // If already in "DD Mon YY" format, e.g. "20 Sep 26" or "20 Sep 2026"
  const existingMonMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})/);
  if (existingMonMatch) {
    const day = existingMonMatch[1].padStart(2, '0');
    const monStr = existingMonMatch[2].slice(0, 3).toLowerCase();
    const monIndex = MONTH_ABBRS.findIndex(m => m.toLowerCase() === monStr);
    const mon = monIndex >= 0 ? MONTH_ABBRS[monIndex] : existingMonMatch[2].slice(0, 3);
    const yr = existingMonMatch[3].slice(-2);
    return `${day} ${mon} ${yr}`;
  }

  // Check if numeric timestamp (10 to 13 digits)
  if (/^\d{10,13}$/.test(str)) {
    const d = new Date(Number(str));
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const mon = MONTH_ABBRS[d.getMonth()];
      const yr = String(d.getFullYear()).slice(-2);
      return `${day} ${mon} ${yr}`;
    }
  }

  // Check if DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (e.g. 20/09/2026, 20-9-2026)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      const d = String(day).padStart(2, '0');
      const mon = MONTH_ABBRS[month];
      const yr = String(year).slice(-2);
      return `${d} ${mon} ${yr}`;
    }
  }

  // Check if YYYY-MM-DD or YYYY/MM/DD (ISO standard, e.g. 2026-09-20)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      const d = String(day).padStart(2, '0');
      const mon = MONTH_ABBRS[month];
      const yr = String(year).slice(-2);
      return `${d} ${mon} ${yr}`;
    }
  }

  // Standard Date parsing fallback (for ISO strings with time, etc.)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const mon = MONTH_ABBRS[parsed.getMonth()];
    const yr = String(parsed.getFullYear()).slice(-2);
    return `${day} ${mon} ${yr}`;
  }

  return str;
};

export const getCanteenCurrentDate = (): string => {
  return formatCanteenDate(new Date());
};
