/**
 * Pure transaction categorization and date helpers.
 * Zero UI dependencies — breaks circular dependency with MemberDB.
 */

export type BillCategory = 'ALL' | 'CANTEEN' | 'UNIT_FUND' | 'OTHERS';

// Extract YYYY-MM from date string with robust support for "DD Mon YY", "DD-Mon-YY", Bengali, "YYYY-MM", etc.
export const getTxMonthKey = (dateStr: any): string => {
  if (!dateStr) return '';
  if (typeof dateStr === 'object' && dateStr.monthKey) return String(dateStr.monthKey).trim();

  let str = String(dateStr).trim();
  if (!str || str === '-') return '';

  // Already standard format YYYY-MM
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }

  // ISO format: 2025-03-01...
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 7);
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const month = dmyMatch[2].padStart(2, '0');
    return `${dmyMatch[3]}-${month}`;
  }

  // English 3-letter month: 01 Mar 25 or 01-Mar-2025
  const monMatch = str.match(/(?:^|\s|-)(\d{1,2})?[\s\-]*([A-Za-z]{3,9})[\s\-]*(\d{2,4})/);
  if (monMatch) {
    const monStr = monMatch[2].toLowerCase();
    const monthsMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    for (const [prefix, num] of Object.entries(monthsMap)) {
      if (monStr.startsWith(prefix)) {
        let yr = monMatch[3];
        if (yr.length === 2) yr = `20${yr}`;
        return `${yr}-${num}`;
      }
    }
  }

  return '';
};

// Categorize transaction into CANTEEN, UNIT_FUND, or OTHERS
export const getTxCategory = (tx: any): 'CANTEEN' | 'UNIT_FUND' | 'OTHERS' => {
  if (!tx) return 'CANTEEN';
  if (tx.billType) {
    const b = String(tx.billType).toUpperCase();
    if (b === 'UNIT_FUND' || b.includes('UNIT')) return 'UNIT_FUND';
    if (b === 'OTHERS' || b.includes('OTHER')) return 'OTHERS';
    if (b === 'CANTEEN') return 'CANTEEN';
  }
  if (tx.category) {
    const c = String(tx.category).toUpperCase();
    if (c === 'UNIT_FUND' || c.includes('UNIT')) return 'UNIT_FUND';
    if (c === 'OTHERS' || c.includes('OTHER')) return 'OTHERS';
    if (c === 'CANTEEN') return 'CANTEEN';
  }
  const txId = String(tx.id || '').toLowerCase();
  if (txId.includes('unit_fund') || txId.includes('unit-fund') || txId.includes('unitfund')) return 'UNIT_FUND';
  if (txId.includes('others') || txId.includes('other-fund') || txId.includes('tx-others')) return 'OTHERS';

  const desc = String(tx.items || tx.purpose || tx.type || tx.description || tx.note || '').toLowerCase();
  if (desc.includes('unit fund') || desc.includes('unit_fund') || desc.includes('ইউনিট ফান্ড') || desc.includes('unit fund bill')) return 'UNIT_FUND';
  if (
    desc.includes('others') || 
    desc.includes('other bill') || 
    desc.includes('অন্যান্য') || 
    desc.includes('other fund')
  ) {
    return 'OTHERS';
  }

  return 'CANTEEN';
};
