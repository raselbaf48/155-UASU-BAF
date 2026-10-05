import { pushKeyToCloud, queuePushKeyToCloud, pullKeyFromCloud, getDeletedTxIds } from './canteenCloudSync';
import { getTxMonthKey } from '../pages/MemberDB';
import { formatBengaliMonthYear } from './exportCanteenBillExcel';

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
 * 1. Permanently drops any user-deleted transactions (tombstones).
 * 2. Permanently drops phantom auto-generated due records ('init-auto-due-', 'init-due-', 'বকেয়া ও প্রারম্ভিক বিল').
 * 3. Enforces single instance per unique transaction ID.
 * 4. Enforces single initial bill per member per month and category (prevents double billing).
 * NOTE: This is a pure deduplication function and NEVER marks valid items as tombstoned.
 */
export function deduplicateCanteenTransactions(txs: any[]): any[] {
  if (!Array.isArray(txs)) return [];
  const deletedIds = getDeletedTxIds();
  const seenIds = new Set<string>();
  const idDeduped: any[] = [];

  // Sort newest first so latest valid transaction is preferred
  const sorted = [...txs].sort((a, b) => {
    const timeA = new Date(a?.created_at || a?.createdAt || a?.timestamp || a?.date || 0).getTime() || (typeof a?.timestamp === 'number' ? a.timestamp : 0);
    const timeB = new Date(b?.created_at || b?.createdAt || b?.timestamp || b?.date || 0).getTime() || (typeof b?.timestamp === 'number' ? b.timestamp : 0);
    if (timeA !== timeB) return timeB - timeA;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });

  for (const t of sorted) {
    if (!t || !t.id) continue;
    const tId = String(t.id).trim();
    if (deletedIds.has(tId)) continue;
    if (tId.startsWith('init-auto-due-') || tId.startsWith('init-due-')) continue;
    if (String(t.items || '').includes('বকেয়া ও প্রারম্ভিক বিল')) continue;
    if (seenIds.has(tId)) continue;
    seenIds.add(tId);
    idDeduped.push(t);
  }

  // Second pass: Deduplicate duplicate initial bills for the exact same member, month, and billType
  const result: any[] = [];
  const seenInitialBills = new Map<string, any>(); // key: `${cleanBd}_${monthKey}_${billType}` -> tx

  for (const t of idDeduped) {
    const isInitial = t.type === 'INITIAL_BILL' || 
      String(t.items || '').includes('ক্যান্টিন বিল') || 
      String(t.items || '').includes('বকেয়া বিল');

    if (isInitial) {
      const cleanBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
      const month = t.monthKey || getTxMonthKey(t.date);
      const billType = t.billType || 'CANTEEN';
      const key = `${cleanBd}_${month}_${billType}`;

      if (cleanBd && month && seenInitialBills.has(key)) {
        // Drop duplicate initial bill without tombstoning
        continue;
      }
      if (cleanBd && month) {
        seenInitialBills.set(key, t);
      }
      result.push(t);
    } else {
      result.push(t);
    }
  }

  return result;
}

/**
 * Reconciles transactions from local, cloud, and import history:
 * - Reads all batches from canteen_bill_import_history.
 * - Ensures every batch has its transactions safely populated in canteen_txs.
 * - If transactions from an import batch are missing, reconstructs them from batch.items.
 * - Deduplicates transactions so no double bills exist.
 * - Persists the clean, synchronized state to localStorage and Supabase.
 */
export async function syncImportHistoryToTransactions(): Promise<any[]> {
  if (typeof window === 'undefined') return [];

  try {
    // 1. Load batches from localStorage & cloud
    let localBatches: BillImportBatch[] = [];
    try {
      const raw = localStorage.getItem('canteen_bill_import_history');
      if (raw) localBatches = JSON.parse(raw);
    } catch {}

    let cloudBatches: BillImportBatch[] = [];
    try {
      const pulled = await pullKeyFromCloud('canteen_bill_import_history');
      if (Array.isArray(pulled)) cloudBatches = pulled;
    } catch {}

    const batchMap = new Map<string, BillImportBatch>();
    [...cloudBatches, ...localBatches].forEach(b => {
      if (b && b.id) batchMap.set(b.id, b);
    });
    const allBatches = Array.from(batchMap.values());

    // 2. Load transactions from localStorage & cloud
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

    const txMap = new Map<string, any>();
    [...localTxs, ...cloudTxs].forEach(t => {
      if (t && t.id) txMap.set(String(t.id), t);
    });

    // 3. For each import batch, ensure its members have their corresponding transactions
    for (const batch of allBatches) {
      if (!Array.isArray(batch.items) || batch.items.length === 0) continue;

      batch.items.forEach(item => {
        const cleanBd = String(item.bdNo || item.airman_id || '').replace(/\D/g, '');
        if (!cleanBd) return;

        const airmanId = item.airman_id || `BD/${cleanBd}`;
        const memberName = `${item.rank || ''} ${item.surname || ''}`.trim() || `BD-${cleanBd}`;

        // a. Due This Month (e.g. September 2026 canteen bill)
        if (item.dueThisMonth > 0) {
          const deterministicId = `tx-import-${batch.id}-${cleanBd}-dueThis`;
          let exists = txMap.has(deterministicId);
          if (!exists && Array.isArray(batch.createdTransactionIds)) {
            exists = batch.createdTransactionIds.some(id => txMap.has(String(id)) && String(id).includes(cleanBd) && String(id).includes('dueThis'));
          }
          if (!exists) {
            const hasMatch = Array.from(txMap.values()).some(t => {
              const tBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
              const tMonth = t.monthKey || getTxMonthKey(t.date);
              return tBd === cleanBd && tMonth === batch.targetMonth && (t.type === 'INITIAL_BILL' || String(t.items || '').includes('ক্যান্টিন বিল'));
            });
            if (!hasMatch) {
              const newTx = {
                id: deterministicId,
                date: getFormattedDateForMonth(batch.targetMonth, 28),
                monthKey: batch.targetMonth,
                airman_id: airmanId,
                bdNo: cleanBd,
                memberName,
                rank: item.rank || '',
                items: `ক্যান্টিন বিল (${formatBengaliMonthYear(batch.targetMonth)})`,
                soldItems: [],
                amount: item.dueThisMonth,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'CANTEEN'
              };
              txMap.set(deterministicId, newTx);
            }
          }
        }

        // b. Due Last Month
        if (item.dueLastMonth > 0) {
          const deterministicId = `tx-import-${batch.id}-${cleanBd}-dueLast`;
          let exists = txMap.has(deterministicId);
          if (!exists && Array.isArray(batch.createdTransactionIds)) {
            exists = batch.createdTransactionIds.some(id => txMap.has(String(id)) && String(id).includes(cleanBd) && String(id).includes('dueLast'));
          }
          if (!exists) {
            const hasMatch = Array.from(txMap.values()).some(t => {
              const tBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
              const tMonth = t.monthKey || getTxMonthKey(t.date);
              return tBd === cleanBd && tMonth === batch.lastMonth && (t.type === 'INITIAL_BILL' || String(t.items || '').includes('বকেয়া বিল'));
            });
            if (!hasMatch) {
              const newTx = {
                id: deterministicId,
                date: getFormattedDateForMonth(batch.lastMonth, 28),
                monthKey: batch.lastMonth,
                airman_id: airmanId,
                bdNo: cleanBd,
                memberName,
                rank: item.rank || '',
                items: `বকেয়া বিল (${formatBengaliMonthYear(batch.lastMonth)})`,
                soldItems: [],
                amount: item.dueLastMonth,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'CANTEEN'
              };
              txMap.set(deterministicId, newTx);
            }
          }
        }

        // c. Unit Fund
        if (item.unitFund > 0) {
          const deterministicId = `tx-import-${batch.id}-${cleanBd}-unitFund`;
          let exists = txMap.has(deterministicId);
          if (!exists) {
            const hasMatch = Array.from(txMap.values()).some(t => {
              const tBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
              const tMonth = t.monthKey || getTxMonthKey(t.date);
              return tBd === cleanBd && tMonth === batch.targetMonth && t.billType === 'UNIT_FUND';
            });
            if (!hasMatch) {
              const newTx = {
                id: deterministicId,
                date: getFormattedDateForMonth(batch.targetMonth, 28),
                monthKey: batch.targetMonth,
                airman_id: airmanId,
                bdNo: cleanBd,
                memberName,
                rank: item.rank || '',
                items: `ইউনিট ফান্ড (${formatBengaliMonthYear(batch.targetMonth)})`,
                soldItems: [],
                amount: item.unitFund,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'UNIT_FUND'
              };
              txMap.set(deterministicId, newTx);
            }
          }
        }

        // d. Others Fund
        if (item.othersFund > 0) {
          const deterministicId = `tx-import-${batch.id}-${cleanBd}-othersFund`;
          let exists = txMap.has(deterministicId);
          if (!exists) {
            const hasMatch = Array.from(txMap.values()).some(t => {
              const tBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
              const tMonth = t.monthKey || getTxMonthKey(t.date);
              return tBd === cleanBd && tMonth === batch.targetMonth && t.billType === 'OTHERS';
            });
            if (!hasMatch) {
              const newTx = {
                id: deterministicId,
                date: getFormattedDateForMonth(batch.targetMonth, 28),
                monthKey: batch.targetMonth,
                airman_id: airmanId,
                bdNo: cleanBd,
                memberName,
                rank: item.rank || '',
                items: `অন্যান্য ফান্ড (${formatBengaliMonthYear(batch.targetMonth)})`,
                soldItems: [],
                amount: item.othersFund,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'OTHERS'
              };
              txMap.set(deterministicId, newTx);
            }
          }
        }
      });
    }

    // 4. Run deduplication
    const allTxsList = Array.from(txMap.values());
    const cleaned = deduplicateCanteenTransactions(allTxsList);

    // 5. Persist clean state to local and cloud only if changed
    try {
      const prevRaw = localStorage.getItem('canteen_txs') || '[]';
      const isChanged = cleaned.length !== localTxs.length || JSON.stringify(cleaned) !== prevRaw;
      localStorage.setItem('canteen_txs', JSON.stringify(cleaned));
      if (isChanged) {
        queuePushKeyToCloud('canteen_txs', cleaned, 2000);
      }
    } catch (err) {
      console.warn('[importHistoryTxs] Error persisting cleaned transactions:', err);
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
