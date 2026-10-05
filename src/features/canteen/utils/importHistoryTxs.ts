import { pushKeyToCloud, pullKeyFromCloud, getDeletedTxIds, recordDeletedTxId } from './canteenCloudSync';
import { getTxMonthKey } from '../pages/MemberDB';
import { formatBengaliMonthYear } from './exportCanteenBillExcel';
import { supabase } from '../../../supabase';

export interface BillImportBatchItem {
  airman_id?: string;
  bdNo: string;
  rank?: string;
  surname?: string;
  targetMonth: string;
  lastMonth: string;
  dueLastMonth: number;
  advanceLastMonth: number;
  dueThisMonth: number;
  unitFund: number;
  othersFund: number;
  importedAmount: number;
  resultingDue: number;
  previousDue: number;
  previousAdvance: number;
}

export interface BillImportBatch {
  id: string;
  timestamp: string;
  displayDate: string;
  sourceName: string;
  targetMonth: string;
  lastMonth: string;
  mode: 'SET' | 'ADD';
  totalMembers: number;
  totalAmount: number;
  createdTransactionIds?: (string | number)[];
  items: BillImportBatchItem[];
}

/**
 * Returns formatted date string "DD Mon YY" for a given YYYY-MM key and day
 */
export function getFormattedDateForMonth(monthKey: string, day: number = 28): string {
  const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!monthKey || monthKey === 'ALL') {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')} ${MONTH_ABBRS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
  }
  const parts = monthKey.split('-').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const year = parts[0];
    const monthIndex = parts[1] - 1;
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
    const effectiveDay = Math.min(day, lastDayOfMonth);
    const dayStr = String(effectiveDay).padStart(2, '0');
    const monStr = MONTH_ABBRS[monthIndex] || 'Jan';
    const yrStr = String(year).slice(-2);
    return `${dayStr} ${monStr} ${yrStr}`;
  }
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_ABBRS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Deduplicates canteen transactions:
 * 1. Permanently drops any deleted transactions (tombstones).
 * 2. Permanently drops phantom auto-generated due records ('init-auto-due-', 'init-due-', 'বকেয়া ও প্রারম্ভিক বিল').
 * 3. Enforces single initial bill per member per month (eliminates duplicates where canteen bill was added 2 times).
 */
export function deduplicateCanteenTransactions(txs: any[]): any[] {
  if (!Array.isArray(txs)) return [];
  const deletedIds = getDeletedTxIds();
  const result: any[] = [];
  const seenInitialBills = new Map<string, any>(); // key: `${cleanBd}_${monthKey}_${billType}` -> tx

  // Sort newest first so latest valid transaction is preferred
  const sorted = [...txs].sort((a, b) => {
    const timeA = new Date(a?.created_at || a?.date || 0).getTime();
    const timeB = new Date(b?.created_at || b?.date || 0).getTime();
    return timeB - timeA;
  });

  for (const t of sorted) {
    if (!t || !t.id) continue;
    const tId = String(t.id);
    if (deletedIds.has(tId)) continue;
    if (tId.startsWith('init-auto-due-') || tId.startsWith('init-due-')) continue;
    if (String(t.items || '').includes('বকেয়া ও প্রারম্ভিক বিল')) continue;

    const isInitial = t.type === 'INITIAL_BILL' || 
      String(t.items || '').includes('ক্যান্টিন বিল') || 
      String(t.items || '').includes('বকেয়া বিল');

    if (isInitial) {
      const cleanBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
      const month = t.monthKey || getTxMonthKey(t.date);
      const billType = t.billType || 'CANTEEN';
      const key = `${cleanBd}_${month}_${billType}`;

      if (seenInitialBills.has(key)) {
        // Drop duplicate initial bill and mark tombstone so it never comes back
        recordDeletedTxId(t.id);
        continue;
      }
      seenInitialBills.set(key, t);
      result.push(t);
    } else {
      result.push(t);
    }
  }

  return result;
}

/**
 * Reconciles transactions from local and cloud storage:
 * - Drops deleted and phantom records permanently.
 * - Deduplicates initial bills so no member has multiple bills for the same month.
 * - NEVER synthesizes or resurrects deleted transactions from past batches.
 */
export async function syncImportHistoryToTransactions(): Promise<any[]> {
  if (typeof window === 'undefined') return [];

  try {
    let localTxs: any[] = [];
    try {
      const raw = localStorage.getItem('canteen_txs');
      if (raw) localTxs = JSON.parse(raw);
    } catch {}

    let cloudTxs: any[] = [];
    try {
      const pulled = await pullKeyFromCloud('canteen_txs');
      if (Array.isArray(pulled)) cloudTxs = pulled;
    } catch {}

    const allTxs = [...localTxs, ...cloudTxs];
    const cleaned = deduplicateCanteenTransactions(allTxs);

    // If cleaned count is different from local count, persist clean state
    if (cleaned.length !== localTxs.length) {
      try {
        localStorage.setItem('canteen_txs', JSON.stringify(cleaned));
        await pushKeyToCloud('canteen_txs', cleaned);
      } catch (err) {
        console.warn('[importHistoryTxs] Error persisting cleaned transactions:', err);
      }
    }

    return cleaned;
  } catch (err) {
    console.error('[importHistoryTxs] syncImportHistoryToTransactions error:', err);
    try {
      return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    } catch {
      return [];
    }
  }
}
