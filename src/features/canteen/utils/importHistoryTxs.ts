import { pushKeyToCloud, pullKeyFromCloud } from './canteenCloudSync';
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
 * Reconciles and extracts missing transactions from all batches in canteen_bill_import_history
 * and merges them into canteen_txs so that past imports (like Aug, Sep) immediately show
 * in Member Profile -> Transaction History and in Monthly filtered views.
 */
export async function syncImportHistoryToTransactions(): Promise<any[]> {
  if (typeof window === 'undefined') return [];

  try {
    // 1. Load batches from localStorage and cloud
    let batches: BillImportBatch[] = [];
    try {
      const raw = localStorage.getItem('canteen_bill_import_history');
      if (raw) batches = JSON.parse(raw);
    } catch {}

    try {
      const cloudBatches = await pullKeyFromCloud('canteen_bill_import_history');
      if (Array.isArray(cloudBatches) && cloudBatches.length > 0) {
        const batchMap = new Map<string, BillImportBatch>();
        [...batches, ...cloudBatches].forEach(b => {
          if (b && b.id) batchMap.set(b.id, b);
        });
        batches = Array.from(batchMap.values());
        try {
          localStorage.setItem('canteen_bill_import_history', JSON.stringify(batches));
        } catch {}
      } else if (batches.length > 0) {
        // Cloud didn't have batches yet, push local batches up
        await pushKeyToCloud('canteen_bill_import_history', batches);
      }
    } catch (e) {
      console.warn('[importHistoryTxs] Cloud pull error for import history:', e);
    }

    // 2. Load existing transactions
    let existingTxs: any[] = [];
    try {
      existingTxs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    } catch {}

    const txMap = new Map<string, any>();
    const contentSignatures = new Set<string>();

    existingTxs.forEach((t) => {
      if (t && t.id) {
        txMap.set(String(t.id), t);
      }
      const bd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
      const mKey = t.monthKey || getTxMonthKey(t.date);
      const bType = String(t.billType || 'CANTEEN');
      const amt = Number(t.amount || 0);
      const typ = String(t.type || '');
      if (bd && mKey && amt > 0) {
        contentSignatures.add(`${bd}_${mKey}_${typ}_${bType}_${amt}`);
      }
    });

    let newTxAdded = false;

    // 3. Synthesize transactions for every batch item
    if (Array.isArray(batches) && batches.length > 0) {
      for (const batch of batches) {
        if (!batch.items || !Array.isArray(batch.items)) continue;

        const targetMonth = batch.targetMonth;
        const lastMonth = batch.lastMonth || (() => {
          const parts = targetMonth.split('-').map(Number);
          const p = new Date(parts[0], parts[1] - 2, 1);
          return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
        })();

        for (const item of batch.items) {
          const cleanBd = String(item.bdNo || item.airman_id || '').replace(/\D/g, '');
          const memberName = `${item.rank || ''} ${item.surname || ''}`.trim() || `BD-${cleanBd}`;
          const rank = item.rank || '';
          const airman_id = item.airman_id || (cleanBd ? `airman-${cleanBd}` : undefined);
          const bdNo = item.bdNo || (cleanBd ? `BD/${cleanBd}` : '');

          // A. Due Last Month (e.g. August)
          if (item.dueLastMonth > 0) {
            const sig = `${cleanBd}_${lastMonth}_INITIAL_BILL_CANTEEN_${item.dueLastMonth}`;
            const customId = `import-${batch.id}-${cleanBd}-dueLast`;
            if (!contentSignatures.has(sig) && !txMap.has(customId)) {
              const tx = {
                id: customId,
                date: getFormattedDateForMonth(lastMonth, 28),
                monthKey: lastMonth,
                airman_id,
                bdNo,
                memberName,
                rank,
                items: `বকেয়া বিল (${formatBengaliMonthYear(lastMonth)})`,
                soldItems: [],
                amount: item.dueLastMonth,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'CANTEEN'
              };
              txMap.set(customId, tx);
              contentSignatures.add(sig);
              newTxAdded = true;
            }
          }

          // B. Advance Last Month
          if (item.advanceLastMonth > 0) {
            const sig = `${cleanBd}_${lastMonth}_BILL PAYMENT_CANTEEN_${item.advanceLastMonth}`;
            const customId = `import-${batch.id}-${cleanBd}-advLast`;
            if (!contentSignatures.has(sig) && !txMap.has(customId)) {
              const tx = {
                id: customId,
                date: getFormattedDateForMonth(lastMonth, 25),
                monthKey: lastMonth,
                airman_id,
                bdNo,
                memberName,
                rank,
                items: `অগ্রীম জমা / Advance (${formatBengaliMonthYear(lastMonth)})`,
                soldItems: [],
                amount: item.advanceLastMonth,
                type: 'BILL PAYMENT',
                gateway: 'ADVANCE',
                billType: 'CANTEEN'
              };
              txMap.set(customId, tx);
              contentSignatures.add(sig);
              newTxAdded = true;
            }
          }

          // C. Due This Month (e.g. September)
          if (item.dueThisMonth > 0) {
            const sig = `${cleanBd}_${targetMonth}_INITIAL_BILL_CANTEEN_${item.dueThisMonth}`;
            const customId = `import-${batch.id}-${cleanBd}-dueThis`;
            if (!contentSignatures.has(sig) && !txMap.has(customId)) {
              const tx = {
                id: customId,
                date: getFormattedDateForMonth(targetMonth, 28),
                monthKey: targetMonth,
                airman_id,
                bdNo,
                memberName,
                rank,
                items: `ক্যান্টিন বিল (${formatBengaliMonthYear(targetMonth)})`,
                soldItems: [],
                amount: item.dueThisMonth,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'CANTEEN'
              };
              txMap.set(customId, tx);
              contentSignatures.add(sig);
              newTxAdded = true;
            }
          }

          // D. Fallback if row only had a single amount or importedAmount
          if (
            item.dueThisMonth === 0 &&
            item.dueLastMonth === 0 &&
            (item.importedAmount > 0 || (item.resultingDue - (item.previousDue || 0)) > 0)
          ) {
            const amount = item.importedAmount || Math.max(0, item.resultingDue - (item.previousDue || 0));
            const sig = `${cleanBd}_${targetMonth}_INITIAL_BILL_CANTEEN_${amount}`;
            const customId = `import-${batch.id}-${cleanBd}-fallbackAmount`;
            if (!contentSignatures.has(sig) && !txMap.has(customId)) {
              const tx = {
                id: customId,
                date: getFormattedDateForMonth(targetMonth, 28),
                monthKey: targetMonth,
                airman_id,
                bdNo,
                memberName,
                rank,
                items: `মাসিক বিল (${formatBengaliMonthYear(targetMonth)})`,
                soldItems: [],
                amount,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'CANTEEN'
              };
              txMap.set(customId, tx);
              contentSignatures.add(sig);
              newTxAdded = true;
            }
          }

          // E. Unit Fund
          if ((item.unitFund || 0) > 0) {
            const sig = `${cleanBd}_${targetMonth}_INITIAL_BILL_UNIT_FUND_${item.unitFund}`;
            const customId = `import-${batch.id}-${cleanBd}-unitFund`;
            if (!contentSignatures.has(sig) && !txMap.has(customId)) {
              const tx = {
                id: customId,
                date: getFormattedDateForMonth(targetMonth, 28),
                monthKey: targetMonth,
                airman_id,
                bdNo,
                memberName,
                rank,
                items: `ইউনিট ফান্ড (${formatBengaliMonthYear(targetMonth)})`,
                soldItems: [],
                amount: item.unitFund,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'UNIT_FUND'
              };
              txMap.set(customId, tx);
              contentSignatures.add(sig);
              newTxAdded = true;
            }
          }

          // F. Others Fund
          if ((item.othersFund || 0) > 0) {
            const sig = `${cleanBd}_${targetMonth}_INITIAL_BILL_OTHERS_${item.othersFund}`;
            const customId = `import-${batch.id}-${cleanBd}-othersFund`;
            if (!contentSignatures.has(sig) && !txMap.has(customId)) {
              const tx = {
                id: customId,
                date: getFormattedDateForMonth(targetMonth, 28),
                monthKey: targetMonth,
                airman_id,
                bdNo,
                memberName,
                rank,
                items: `অন্যান্য ফান্ড (${formatBengaliMonthYear(targetMonth)})`,
                soldItems: [],
                amount: item.othersFund,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'OTHERS'
              };
              txMap.set(customId, tx);
              contentSignatures.add(sig);
              newTxAdded = true;
            }
          }
        }
      }
    }

    // 4. Auto-reconciliation for any members with Due > 0 who currently lack corresponding transaction records
    try {
      let membersList: any[] = [];
      try {
        const rawM = localStorage.getItem('canteen_members_cache');
        if (rawM) membersList = JSON.parse(rawM);
      } catch {}

      if (!Array.isArray(membersList) || membersList.length === 0) {
        const { data: cloudMembers } = await supabase.from('Canteen_Member').select('*');
        if (Array.isArray(cloudMembers) && cloudMembers.length > 0) {
          membersList = cloudMembers;
        }
      }

      if (Array.isArray(membersList) && membersList.length > 0) {
        const defaultTargetMonth = (() => {
          const now = new Date();
          const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
        })();

        for (const m of membersList) {
          const totalMemberDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
          if (totalMemberDue <= 0) continue;

          const cleanBd = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
          const airmanId = String(m.airman_id || '').toLowerCase();

          // Calculate current total debits and payments recorded for this member
          let memberDebits = 0;
          let memberPayments = 0;

          for (const tx of txMap.values()) {
            const txBd = String(tx.bdNo || tx.airman_id || '').replace(/\D/g, '');
            const txAirman = String(tx.airman_id || '').toLowerCase();
            const matches = (cleanBd && txBd && (cleanBd === txBd || cleanBd.replace(/^0+/, '') === txBd.replace(/^0+/, ''))) ||
              (airmanId && txAirman && airmanId === txAirman);

            if (matches) {
              const amt = Number(tx.amount || 0);
              if (tx.type === 'BILL PAYMENT') {
                memberPayments += amt;
              } else {
                memberDebits += amt;
              }
            }
          }

          // Ensure member's original bill is always preserved even if payments were made
          const missingDue = Math.round((Math.max(0, totalMemberDue + memberPayments - memberDebits)) * 100) / 100;

          if (missingDue > 0) {
            const autoId = `init-auto-due-${cleanBd || airmanId || Math.random()}`;
            if (!txMap.has(autoId)) {
              const tx = {
                id: autoId,
                date: getFormattedDateForMonth(defaultTargetMonth, 28),
                monthKey: defaultTargetMonth,
                airman_id: m.airman_id || (cleanBd ? `airman-${cleanBd}` : undefined),
                bdNo: m['BD No'] || m.bdNo || (cleanBd ? `BD/${cleanBd}` : ''),
                memberName: `${m.Rank || m.rank || ''} ${m.Surname || m.surname || ''}`.trim() || `BD-${cleanBd}`,
                rank: m.Rank || m.rank || '',
                items: `প্রারম্ভিক বকেয়া বিল (${formatBengaliMonthYear(defaultTargetMonth)})`,
                soldItems: [],
                amount: missingDue,
                type: 'INITIAL_BILL',
                gateway: 'DUE',
                billType: 'CANTEEN'
              };
              txMap.set(autoId, tx);
              newTxAdded = true;
            }
          }
        }
      }
    } catch (reconcileErr) {
      console.warn('[importHistoryTxs] Auto-reconciliation member dues error:', reconcileErr);
    }

    const mergedTxs = Array.from(txMap.values());

    if (newTxAdded) {
      try {
        localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
        await pushKeyToCloud('canteen_txs', mergedTxs);
        window.dispatchEvent(new Event('canteen_txs_updated'));
        window.dispatchEvent(new Event('canteen_state_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.warn('[importHistoryTxs] Error persisting reconciled transactions:', err);
      }
    }

    return mergedTxs;
  } catch (err) {
    console.error('[importHistoryTxs] syncImportHistoryToTransactions error:', err);
    try {
      return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    } catch {
      return [];
    }
  }
}
