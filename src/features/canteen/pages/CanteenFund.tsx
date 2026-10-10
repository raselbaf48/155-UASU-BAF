import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, Landmark, CreditCard, Receipt, ArrowRightLeft, 
  X, RefreshCw, CheckCircle2, AlertCircle, Building2, Briefcase, PieChart, Layers, Trash2, Loader2
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { ExpenseRecord, BazarAdvance } from './Expenditures';
import { UnitFundSection } from './UnitFundSection';
import { OthersFundSection } from './OthersFundSection';
import { AllFundsOverviewSection } from './AllFundsOverviewSection';
import { getTxCategory } from './MemberDB';
import { 
  pushKeyToCloud, 
  recordDeletedExpenseId, 
  recordDeletedTxId,
  getDeletedTxIds,
  getDeletedExpenseIds,
  getDeletedAdvanceIds
} from '../utils/canteenCloudSync';
import { playSuccessChime } from '../utils/audioFeedback';

export interface FundTransfer {
  id: string;
  date: string;
  from: 'CASH' | 'UCB';
  to: 'CASH' | 'UCB';
  amount: number;
  note?: string;
}

const TRANSFERS_KEY = 'canteen_fund_transfers';
const TXS_KEY = 'canteen_txs';
const EXPENSES_KEY = 'canteen_expenses';
const ADVANCES_KEY = 'canteen_bazar_advances';

export type ActiveFundType = 'CANTEEN' | 'UNIT' | 'OTHERS' | 'OVERVIEW';

export const CanteenFund: React.FC = () => {
  // Top-level Fund Selector
  const [activeFundCategory, setActiveFundCategory] = useState<ActiveFundType>('CANTEEN');
  const [unitFundNet, setUnitFundNet] = useState<number>(0);
  const [othersFundNet, setOthersFundNet] = useState<number>(0);

  const [reports, setReports] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [advances, setAdvances] = useState<BazarAdvance[]>([]);
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'CASH' | 'UCB' | 'TRANSFERS' | 'EXPENSES'>('ALL');

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState<'CASH' | 'UCB'>('CASH');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');
  const [expToDelete, setExpToDelete] = useState<any | null>(null);
  const [isDeletingExp, setIsDeletingExp] = useState(false);

  const loadData = () => {
    try {
      const rawTxs = localStorage.getItem(TXS_KEY);
      const parsedTxs: any[] = rawTxs ? JSON.parse(rawTxs) : [];
      const delTxIds = getDeletedTxIds();
      const txs = Array.isArray(parsedTxs) ? parsedTxs.filter(t => t && !delTxIds.has(String(t.id))) : [];
      setReports(txs);

      const rawExps = localStorage.getItem(EXPENSES_KEY);
      let rawParsedExps: any[] = rawExps ? JSON.parse(rawExps) : [];
      const delExpIds = getDeletedExpenseIds();
      let exps = Array.isArray(rawParsedExps) ? rawParsedExps.filter(e => e && !delExpIds.has(String(e.id))) : [];

      // Automatically clean up any orphaned Others/Unit Fund batch bill expenses
      // whose underlying transactions were deleted from Others/Unit Fund history
      if (Array.isArray(exps) && Array.isArray(txs)) {
        let cleaned = false;

        // Collect all active others and unit fund transactions
        const activeOtherTxs = txs.filter((t: any) => {
          if (!t) return false;
          const bType = String(t.billType || t.category || '').toUpperCase();
          const tId = String(t.id || '').toLowerCase();
          const tItems = String(t.items || '').toLowerCase();
          return bType === 'OTHERS' || tId.includes('others') || tItems.includes('others bill') || tItems.includes('other bill');
        });

        const activeUnitTxs = txs.filter((t: any) => {
          if (!t) return false;
          const bType = String(t.billType || t.category || '').toUpperCase();
          const tId = String(t.id || '').toLowerCase();
          const tItems = String(t.items || '').toLowerCase();
          return bType === 'UNIT_FUND' || tId.includes('unit_fund') || tItems.includes('unit fund');
        });

        const matchedTxIds = new Set<string>();

        const filteredExps = exps.filter((e: any) => {
          if (!e) return false;
          const eDesc = String(e.desc || '').toUpperCase();
          const eCat = String(e.category || '').toLowerCase();
          const eId = String(e.id || '').toLowerCase();

          const isOthersExp = 
            eCat.includes('others') || 
            eDesc.startsWith('OTHERS BILL') || 
            eId.startsWith('exp-others-');
          const isUnitExp = 
            eCat.includes('unit') || 
            eDesc.startsWith('UNIT FUND') || 
            eId.startsWith('exp-unit_fund-');

          if (!isOthersExp && !isUnitExp) {
            return true;
          }

          const candidateTxs = isOthersExp ? activeOtherTxs : activeUnitTxs;

          // 1. Exact match by batchExpenseId
          let matchingTxs = candidateTxs.filter((t: any) => 
            t.batchExpenseId && String(t.batchExpenseId).toLowerCase() === eId
          );

          // 2. If no direct batchExpenseId match and expense was not an exp- batch, match unassigned txs
          if (matchingTxs.length === 0 && !eId.startsWith('exp-')) {
            const eDate = e.date || '';
            matchingTxs = candidateTxs.filter((t: any) => {
              if (matchedTxIds.has(String(t.id))) return false;
              if (t.batchExpenseId) return false;
              const tDate = t.date || '';
              return tDate === eDate || (Math.abs(new Date(tDate).getTime() - new Date(eDate).getTime()) < 86400000);
            });
          }

          // If no active transactions exist for this batch, delete it permanently!
          if (matchingTxs.length === 0) {
            recordDeletedExpenseId(String(e.id));
            cleaned = true;
            return false;
          }

          // Mark transactions as matched
          matchingTxs.forEach((t: any) => matchedTxIds.add(String(t.id)));

          // Compute exact remaining active sum
          const activeBatchSum = matchingTxs.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
          if (activeBatchSum <= 0) {
            recordDeletedExpenseId(String(e.id));
            cleaned = true;
            return false;
          }

          if (Math.abs(Number(e.amount) - activeBatchSum) > 0.01) {
            e.amount = activeBatchSum;
            cleaned = true;
          }

          // Build dynamic member breakdown: "kar jonno kto amount"
          const memberList = matchingTxs.map((t: any) => {
            const name = String(t.memberName || t.name || '').trim() || (t.bdNo ? `BD-${t.bdNo}` : 'Member');
            const bd = t.bdNo ? ` (BD-${t.bdNo})` : '';
            const amt = Number(t.amount) || 0;
            return {
              name,
              bdNo: t.bdNo,
              amount: amt,
              label: `${name}${bd}: ৳${amt.toLocaleString('en-US')}`
            };
          });

          e.memberBreakdown = memberList;
          if (memberList.length === 1) {
            e.detailedPerson = memberList[0].label;
          } else {
            e.detailedPerson = memberList.map(m => m.label).join(' • ');
          }
          e.subdesc = `Kar Jonno: ${memberList.map(m => m.label).join(', ')}`;

          return true;
        });

        // Reverse Reconciliation: Ensure ANY active Others / Unit Fund transactions in canteen_txs
        // that are not yet in Capital (canteen_expenses) get automatically created and displayed!
        const allActiveFundTxs = [...activeOtherTxs, ...activeUnitTxs];
        const unmatchedTxs = allActiveFundTxs.filter((t: any) => !matchedTxIds.has(String(t.id)));

        if (unmatchedTxs.length > 0) {
          const groups = new Map<string, any[]>();
          unmatchedTxs.forEach((t: any) => {
            const key = t.batchExpenseId || `grp-${getTxCategory(t)}-${t.date || t.created_at || t.id}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(t);
          });

          groups.forEach((grpTxs, grpKey) => {
            const sample = grpTxs[0];
            const cat = getTxCategory(sample);
            const isUnit = cat === 'UNIT_FUND';
            const grpSum = grpTxs.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
            if (grpSum <= 0) return;

            const memberList = grpTxs.map((t: any) => {
              const name = String(t.memberName || t.name || '').trim() || (t.bdNo ? `BD-${t.bdNo}` : 'Member');
              const bd = t.bdNo ? ` (BD-${t.bdNo})` : '';
              const amt = Number(t.amount) || 0;
              return {
                name,
                bdNo: t.bdNo,
                amount: amt,
                label: `${name}${bd}: ৳${amt.toLocaleString('en-US')}`
              };
            });

            const methodStr = String(sample.paymentMethod || sample.method || sample.source || 'Cash');
            const isUcb = methodStr.toLowerCase().includes('ucb') || methodStr.toLowerCase().includes('bank');
            const targetStaff = sample.staffName || (sample.note && sample.note.includes('Tanvir') ? 'Civ Tanvir' : undefined);
            const finalMethod = isUcb ? 'UCB' : (methodStr.startsWith('Cash (') ? methodStr : (targetStaff ? `Cash (${targetStaff})` : 'Cash (Manager)'));

            const detailedPerson = memberList.length === 1 ? memberList[0].label : memberList.map(m => m.label).join(' • ');
            const autoExpId = sample.batchExpenseId || (grpKey.startsWith('grp-') ? `exp-${grpKey.slice(4)}` : grpKey);

            filteredExps.unshift({
              id: autoExpId,
              date: sample.date || formatCanteenDate(new Date().toISOString()),
              desc: `${isUnit ? 'UNIT FUND' : 'OTHERS BILL'}: ${sample.items || sample.purpose || (isUnit ? 'Unit Fund Subscription' : 'Others Bill')}`.toUpperCase(),
              subdesc: `Kar Jonno: ${memberList.map(m => m.label).join(', ')} [${finalMethod}]`,
              category: isUnit ? 'Unit Fund' : 'Others Bill',
              paymentMethod: finalMethod,
              amount: grpSum,
              detailedPerson,
              memberBreakdown: memberList,
              isCustom: true
            });
            cleaned = true;
          });
        }

        exps = filteredExps;
        if (cleaned) {
          localStorage.setItem(EXPENSES_KEY, JSON.stringify(exps));
          pushKeyToCloud(EXPENSES_KEY, exps).catch(() => {});
        }
      }

      setExpenses(Array.isArray(exps) ? exps : []);
    } catch (_err) {
      setExpenses([]);
    }

    try {
      const rawTrs = localStorage.getItem(TRANSFERS_KEY);
      const trs = rawTrs ? JSON.parse(rawTrs) : [];
      setTransfers(Array.isArray(trs) ? trs : []);
    } catch (_err) {
      setTransfers([]);
    }

    try {
      const rawAdvs = localStorage.getItem(ADVANCES_KEY);
      const parsedAdvs = rawAdvs ? JSON.parse(rawAdvs) : [];
      const delAdvIds = getDeletedAdvanceIds();
      const advs = Array.isArray(parsedAdvs) ? parsedAdvs.filter((a: any) => a && !delAdvIds.has(String(a.id))) : [];
      setAdvances(advs);
    } catch (_err) {
      setAdvances([]);
    }

    try {
      const uInflows = JSON.parse(localStorage.getItem('baf_unit_fund_inflows') || '[]');
      const uExpenses = JSON.parse(localStorage.getItem('baf_unit_fund_expenses') || '[]');
      const inSum = uInflows.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
      const exSum = uExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      setUnitFundNet(inSum - exSum);
    } catch {
      setUnitFundNet(0);
    }

    try {
      const oInflows = JSON.parse(localStorage.getItem('baf_others_fund_inflows') || '[]');
      const oExpenses = JSON.parse(localStorage.getItem('baf_others_fund_expenses') || '[]');
      const inSum = oInflows.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
      const exSum = oExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      setOthersFundNet(inSum - exSum);
    } catch {
      setOthersFundNet(0);
    }
  };

  useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    window.addEventListener('canteen_txs_updated', handleSync);
    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_transfers_updated', handleSync);
    window.addEventListener('canteen_bazar_advances_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('unit_fund_updated', handleSync);
    window.addEventListener('others_fund_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_txs_updated', handleSync);
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_transfers_updated', handleSync);
      window.removeEventListener('canteen_bazar_advances_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('unit_fund_updated', handleSync);
      window.removeEventListener('others_fund_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // 1. Inflow from Bill Payments, Bazar Advance Returns & POS Paid Cash Sales (Manager Cash)
  const billPaymentCash = reports
    .filter(r => {
      const isGwCash = String(r.gateway || r.paymentMethod || '').toUpperCase() === 'CASH';
      const isCollection = r.type === 'BILL PAYMENT' || r.type === 'BAZAR_RETURN' || r.type === 'ADVANCE_RETURN';
      const isPaidSale = (r.type === 'SALE' || r.type === 'PURCHASE') && (r.status === 'PAID' || r.paymentStatus === 'PAID' || isGwCash);
      return (isCollection || isPaidSale) && isGwCash;
    })
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const billPaymentUCB = reports
    .filter(r => (r.type === 'BILL PAYMENT' || r.type === 'BAZAR_RETURN' || r.type === 'ADVANCE_RETURN') && String(r.gateway || '').toUpperCase() === 'UCB')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // 2. Outflow from Expenditures
  const isCashMethod = (m?: string) => {
    const lower = String(m || 'cash').toLowerCase().trim();
    return lower === 'cash' || lower.startsWith('cash');
  };
  const isUcbMethod = (m?: string) => {
    const lower = String(m || '').toLowerCase().trim();
    return lower === 'ucb' || lower.startsWith('ucb') || lower.includes('bank');
  };

  const expenseCash = expenses
    .filter(exp => isCashMethod(exp.paymentMethod))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const expenseUCB = expenses
    .filter(exp => isUcbMethod(exp.paymentMethod))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // 3. Transfers In/Out
  // Cash To UCB: Cash decreases, UCB increases
  const cashToUcbTotal = transfers
    .filter(t => t.from === 'CASH' && t.to === 'UCB')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // UCB To Cash: UCB decreases, Cash increases
  const ucbToCashTotal = transfers
    .filter(t => t.from === 'UCB' && t.to === 'CASH')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // Net Balances
  const totalCash = billPaymentCash - expenseCash - cashToUcbTotal + ucbToCashTotal;
  const totalUCB = billPaymentUCB - expenseUCB + cashToUcbTotal - ucbToCashTotal;
  const totalFund = totalCash + totalUCB;

  // Outstanding Staff Advance Calculation:
  // Active advances currently held by staff (unspent advance balance of ACTIVE advances only).
  // Once an advance is settled, its remaining active balance is ৳0 and it is excluded.
  const staffAdvanceAmount = useMemo(() => {
    const activeAdvances = advances.filter(a => {
      const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
      return a.status === 'ACTIVE' && !isSettled;
    });
    return activeAdvances.reduce((sum, a) => {
      const advAmt = Number(a.amount) || 0;
      const spent = Number(a.spentAmount) || 0;
      const returned = Number(a.returnAmount) || 0;
      const unspent = Math.max(0, advAmt - spent - returned);
      return sum + unspent;
    }, 0);
  }, [advances]);

  // Manager holds all cash minus active advance in hands of staff
  const managerCash = Math.max(0, totalCash - staffAdvanceAmount);

  // Lists for logs
  const cashPayments = reports.filter(r => {
    const isGwCash = String(r.gateway || r.paymentMethod || '').toUpperCase() === 'CASH';
    const isCollection = r.type === 'BILL PAYMENT' || r.type === 'BAZAR_RETURN' || r.type === 'ADVANCE_RETURN';
    const isPaidSale = (r.type === 'SALE' || r.type === 'PURCHASE') && (r.status === 'PAID' || r.paymentStatus === 'PAID' || isGwCash);
    return (isCollection || isPaidSale) && isGwCash;
  });
  const ucbPayments = reports.filter(r => (r.type === 'BILL PAYMENT' || r.type === 'BAZAR_RETURN' || r.type === 'ADVANCE_RETURN') && String(r.gateway || '').toUpperCase() === 'UCB');

  const cashExpenses = expenses.filter(e => {
    const d = String(e.desc || '').toLowerCase();
    return isCashMethod(e.paymentMethod) && !d.includes('advance settle payout') && !d.includes('cash advance');
  });
  const ucbExpenses = expenses.filter(e => {
    const d = String(e.desc || '').toLowerCase();
    return isUcbMethod(e.paymentMethod) && !d.includes('advance settle payout') && !d.includes('cash advance');
  });

  // Helper to extract upto month text for Bill Payments (e.g., "upto Sep 26")
  const getBillPaymentUptoText = (r: any): string => {
    const monthNames: Record<string, string> = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
      '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };

    // 1. If r.billMonth is YYYY-MM
    const mKey = r.billMonth || r.monthKey;
    if (mKey && /^\d{4}-\d{2}$/.test(mKey)) {
      const [y, m] = mKey.split('-');
      const mName = monthNames[m] || 'Sep';
      const yShort = y.slice(-2);
      return `upto ${mName} ${yShort}`;
    }

    // 2. If r.lastDateCovered is present (e.g. "26/09/2026" or "Sep 26")
    if (r.lastDateCovered) {
      const lastDate = String(r.lastDateCovered).trim();
      if (lastDate.toLowerCase().includes('upto')) {
        return lastDate.replace(/^\(?upto\s*/i, 'upto ').replace(/\)$/, '').trim();
      }
      const parts = lastDate.split('/');
      if (parts.length === 3) {
        const mName = monthNames[parts[1].padStart(2, '0')] || parts[1];
        const yShort = parts[2].slice(-2);
        return `upto ${mName} ${yShort}`;
      }
      if (/^[A-Za-z]{3}\s*\d{2,4}$/.test(lastDate)) {
        const p = lastDate.split(/\s+/);
        return `upto ${p[0]} ${p[1].slice(-2)}`;
      }
    }

    // 3. Extract from r.items if it contains date or Bengali month
    const itemsStr = String(r.items || '');
    if (itemsStr) {
      const bnMonths: Record<string, string> = {
        'জানুয়ারি': 'Jan', 'ফেব্রুয়ারি': 'Feb', 'মার্চ': 'Mar', 'এপ্রিল': 'Apr',
        'মে': 'May', 'জুন': 'Jun', 'জুলাই': 'Jul', 'আগস্ট': 'Aug',
        'সেপ্টেম্বর': 'Sep', 'অক্টোবর': 'Oct', 'নভেম্বর': 'Nov', 'ডিসেম্বর': 'Dec'
      };
      for (const [bnM, enM] of Object.entries(bnMonths)) {
        if (itemsStr.includes(bnM)) {
          const yearMatch = itemsStr.match(/20(\d{2})/);
          const yShort = yearMatch ? yearMatch[1] : '26';
          return `upto ${enM} ${yShort}`;
        }
      }
      const dateMatch = itemsStr.match(/(\d{2})\/(\d{2})\/(?:20)?(\d{2})/);
      if (dateMatch) {
        const mName = monthNames[dateMatch[2]] || 'Sep';
        return `upto ${mName} ${dateMatch[3]}`;
      }
    }

    // 4. Fallback from r.date or previous month of payment
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const prevMIdx = (d.getMonth() === 0 ? 11 : d.getMonth() - 1);
        const prevYear = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
        return `upto ${enMonths[prevMIdx]} ${String(prevYear).slice(-2)}`;
      }
    }

    return 'upto Sep 26';
  };

  // Unified All Fund Logs list ("Capital e Fund logs e akta all option add korba jekhane sob dekha jbe")
  const allLogs = useMemo(() => {
    interface UnifiedLogItem {
      id: string;
      rawExp?: any;
      date: string;
      logType: 'INFLOW' | 'EXPENSE' | 'TRANSFER' | 'CASH_ADVANCE' | 'CASH_REFUND' | 'PAYMENT';
      title: string;
      subtitle?: string;
      channel: string;
      amount: number;
      rawDate: number;
    }

    const items: UnifiedLogItem[] = [];

    // 1. Inflows (Cash & UCB)
    reports.forEach((r, idx) => {
      const isGwCash = String(r.gateway || r.paymentMethod || '').toUpperCase() === 'CASH';
      const isGwUcb = String(r.gateway || r.paymentMethod || '').toUpperCase() === 'UCB';
      const isCollection = r.type === 'BILL PAYMENT' || r.type === 'BAZAR_RETURN' || r.type === 'ADVANCE_RETURN';
      const isPaidSale = (r.type === 'SALE' || r.type === 'PURCHASE') && (r.status === 'PAID' || r.paymentStatus === 'PAID' || isGwCash);
      if (!isCollection && !isPaidSale) return;
      const gw = isGwCash ? 'CASH' : isGwUcb ? 'UCB' : 'CASH';
      const amt = Number(r.amount) || 0;
      if (amt <= 0) return;
      const dStr = r.date || '';
      const dVal = new Date(dStr).getTime() || 0;
      const isRefund = r.type === 'BAZAR_RETURN' || r.type === 'ADVANCE_RETURN';
      const isBillPayment = r.type === 'BILL PAYMENT' || (!isPaidSale && !isRefund);

      let logType: 'INFLOW' | 'CASH_REFUND' | 'PAYMENT' = 'INFLOW';
      let title = '';
      let subtitle: string | undefined = undefined;

      if (isRefund) {
        logType = 'CASH_REFUND';
        title = r.memberName || r.customerName || 'Cash Refund';
        subtitle = undefined;
      } else if (isBillPayment) {
        logType = 'PAYMENT';
        const person = r.memberName || r.customerName || (r.bdNo ? `BD-${r.bdNo}` : 'Member');
        const uptoStr = getBillPaymentUptoText(r);
        title = `${person}\n(${uptoStr})`;
        subtitle = undefined;
      } else {
        logType = 'INFLOW';
        title = `POS Cash Sale: ${r.memberName || r.customerName || 'Customer'}`;
        subtitle = `Cash Sale • ${r.items || 'Menu Items'} (Manager Cash Drawer)`;
      }

      items.push({
        id: `inflow-${r.id || idx}`,
        date: dStr,
        logType,
        title,
        subtitle,
        channel: gw,
        amount: amt,
        rawDate: dVal
      });
    });

    // 2. Expenses (Cash & UCB)
    expenses.forEach((e, idx) => {
      const isCash = isCashMethod(e.paymentMethod);
      const isUcb = isUcbMethod(e.paymentMethod);
      if (!isCash && !isUcb) return;
      const descLower = String(e.desc || '').toLowerCase();
      if (e.category === 'Refund' || descLower.includes('cash refund') || descLower.includes('উদ্বৃত্ত ফেরত')) return;
      const amt = Number(e.amount) || 0;
      if (amt <= 0) return;
      const dStr = e.date || '';
      const dVal = new Date(dStr).getTime() || 0;
      const isAdvanceDesc = descLower.includes('advance') || descLower.includes('অগ্রিম');

      const isOthersOrUnit = 
        String(e.category || '').toLowerCase().includes('others') || 
        String(e.category || '').toLowerCase().includes('unit') ||
        descLower.startsWith('others bill') || 
        descLower.startsWith('unit fund');

      let title = e.desc || 'Expense Item';
      let subtitle: string | undefined = undefined;

      if (isAdvanceDesc) {
        title = e.detailedPerson || 'Staff Advance';
        subtitle = undefined;
      } else if (isOthersOrUnit) {
        let cleanPurpose = String(e.desc || '')
          .replace(/^OTHERS\s*BILL\s*:\s*/i, '')
          .replace(/^OTHER\s*BILL\s*:\s*/i, '')
          .replace(/^UNIT\s*FUND\s*:\s*/i, '')
          .replace(/^UNIT\s*FUND\s*BILL\s*:\s*/i, '')
          .trim() || (String(e.category || '').toLowerCase().includes('unit') ? 'Unit Fund Bill' : 'Others Bill');

        let memberNamesList: string[] = [];
        if (e.memberBreakdown && Array.isArray(e.memberBreakdown) && e.memberBreakdown.length > 0) {
          memberNamesList = e.memberBreakdown
            .map((m: any) => String(m.name || '').trim())
            .filter(Boolean);
        } else if (e.detailedPerson && !e.detailedPerson.startsWith('Staff:') && !e.detailedPerson.startsWith('Manager:')) {
          const cleanP = e.detailedPerson.split(':')[0].replace(/\(BD-[^)]+\)/i, '').trim();
          if (cleanP) memberNamesList.push(cleanP);
        }

        const memberStr = memberNamesList.join(', ');
        title = memberStr ? `${cleanPurpose}\n(${memberStr})` : cleanPurpose;
        subtitle = undefined;
      } else {
        subtitle = `${e.detailedPerson ? `Staff: ${e.detailedPerson}` : 'Canteen Expense'} • ${e.category || 'General'}`;
      }

      const channelDisplay = isUcb 
        ? 'UCB' 
        : (e.paymentMethod && String(e.paymentMethod).startsWith('Cash (') ? String(e.paymentMethod).toUpperCase() : 'CASH');

      items.push({
        id: `exp-${e.id || idx}`,
        rawExp: e,
        date: dStr,
        logType: isAdvanceDesc ? 'CASH_ADVANCE' : 'EXPENSE',
        title,
        subtitle,
        channel: channelDisplay,
        amount: amt,
        rawDate: dVal
      });
    });

    // 3. Transfers
    transfers.forEach((t, idx) => {
      const amt = Number(t.amount) || 0;
      if (amt <= 0) return;
      const dStr = t.date || '';
      const dVal = new Date(dStr).getTime() || 0;
      items.push({
        id: `tr-${t.id || idx}`,
        date: dStr,
        logType: 'TRANSFER',
        title: `Transfer: ${t.from} → ${t.to}`,
        subtitle: t.note || 'Inter-fund transfer',
        channel: `${t.from} → ${t.to}`,
        amount: amt,
        rawDate: dVal
      });
    });

    // 4. Staff Advances & Settle Return History
    advances.forEach((a, idx) => {
      // 4a. Advance Add / Issue
      if (Number(a.amount) > 0 && !a.id.includes('settle-topup')) {
        const dStr = a.date || '';
        const dVal = new Date(dStr).getTime() || 0;
        items.push({
          id: `adv-add-${a.id || idx}`,
          date: dStr,
          logType: 'CASH_ADVANCE',
          title: a.personName || 'Staff Advance',
          subtitle: undefined,
          channel: 'CASH',
          amount: Number(a.amount) || 0,
          rawDate: dVal
        });
      }

      // 4b. Settle Return to Cash (if not already recorded in reports)
      if (Number(a.returnAmount) > 0) {
        const alreadyInReports = reports.some(r => 
          (r.type === 'ADVANCE_RETURN' || r.type === 'BAZAR_RETURN') && 
          (r.memberName === a.personName || String(r.items || '').includes(a.personName)) &&
          Math.abs(Number(r.amount) - Number(a.returnAmount)) < 0.01
        );
        if (!alreadyInReports) {
          const dStr = a.settledDate || a.date || '';
          const dVal = new Date(dStr).getTime() || 0;
          items.push({
            id: `adv-return-${a.id || idx}`,
            date: dStr,
            logType: 'CASH_REFUND',
            title: a.personName || 'Staff Refund',
            subtitle: undefined,
            channel: 'CASH',
            amount: Number(a.returnAmount) || 0,
            rawDate: dVal
          });
        }
      }

      // 4c. Settle Top-up (Deficit Payout from Cash)
      if (a.id.includes('settle-topup') || a.purpose?.includes('Settle Top-up')) {
        const dStr = a.date || '';
        const dVal = new Date(dStr).getTime() || 0;
        items.push({
          id: `adv-topup-${a.id || idx}`,
          date: dStr,
          logType: 'CASH_ADVANCE',
          title: a.personName || 'Staff Advance',
          subtitle: undefined,
          channel: 'CASH',
          amount: Number(a.amount) || 0,
          rawDate: dVal
        });
      }
    });

    return items.sort((a, b) => b.rawDate - a.rawDate);
  }, [reports, expenses, transfers, advances]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleConfirmDeleteExp = async () => {
    if (!expToDelete || isDeletingExp) return;
    setIsDeletingExp(true);
    try {
      const targetId = String(expToDelete.id);
      recordDeletedExpenseId(targetId);

      const rawExps = localStorage.getItem(EXPENSES_KEY);
      const exps = rawExps ? JSON.parse(rawExps) : [];
      const updated = exps.filter((e: any) => String(e.id) !== targetId);
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(updated));
      await pushKeyToCloud(EXPENSES_KEY, updated).catch(() => {});
      setExpenses(updated);
      window.dispatchEvent(new Event('canteen_expenses_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      playSuccessChime();
      showToast('খরচ রেকর্ড সফলভাবে ডিলিট করা হয়েছে!');
    } catch (e) {
      console.error('Delete expense error:', e);
      showToast('ডিলিট করতে সমস্যা হয়েছে');
    } finally {
      setIsDeletingExp(false);
      setExpToDelete(null);
    }
  };

  // Handle Transfer Submit
  const handleExecuteTransfer = () => {
    setTransferError('');
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন (Amount > 0)');
      return;
    }

    const sourceFundBalance = transferFrom === 'CASH' ? totalCash : totalUCB;
    if (amt > sourceFundBalance) {
      setTransferError(`পর্যাপ্ত ব্যালেন্স নেই! ${transferFrom} ফান্ডে বর্তমান ব্যালেন্স ৳${sourceFundBalance}`);
      return;
    }

    const transferTo: 'CASH' | 'UCB' = transferFrom === 'CASH' ? 'UCB' : 'CASH';

    const newTransfer: FundTransfer = {
      id: 'tr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: formatCanteenDate(new Date()),
      from: transferFrom,
      to: transferTo,
      amount: amt,
      note: transferNote.trim() || `Fund transfer from ${transferFrom} to ${transferTo}`
    };

    const updatedTransfers = [newTransfer, ...transfers];
    setTransfers(updatedTransfers);
    try {
      localStorage.setItem(TRANSFERS_KEY, JSON.stringify(updatedTransfers));
      window.dispatchEvent(new Event('canteen_transfers_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to save fund transfer:', err);
    }

    setShowTransferModal(false);
    setTransferAmount('');
    setTransferNote('');
    showToast(`৳${amt.toLocaleString('en-US')} সফলভাবে ${transferFrom} থেকে ${transferTo}-এ ট্রান্সফার করা হয়েছে!`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Fund Hub Selector Tabs */}
      <div className="bg-slate-900/95 backdrop-blur-xl p-2 rounded-2xl border border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-hide shadow-xl">
        <button
          type="button"
          onClick={() => setActiveFundCategory('CANTEEN')}
          className={`flex-1 min-w-[170px] py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeFundCategory === 'CANTEEN'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.01]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Wallet className="w-4 h-4 text-indigo-400" />
          <span>CANTEEN FUND</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
            activeFundCategory === 'CANTEEN' ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-400'
          }`}>
            ৳{totalFund.toLocaleString('en-US')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFundCategory('UNIT')}
          className={`flex-1 min-w-[170px] py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeFundCategory === 'UNIT'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.01]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span>UNIT FUND</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
            activeFundCategory === 'UNIT' ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-400'
          }`}>
            ৳{unitFundNet.toLocaleString('en-US')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFundCategory('OTHERS')}
          className={`flex-1 min-w-[170px] py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeFundCategory === 'OTHERS'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30 scale-[1.01]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Briefcase className="w-4 h-4 text-amber-400" />
          <span>OTHERS FUND</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
            activeFundCategory === 'OTHERS' ? 'bg-white/20 text-white' : 'bg-slate-800 text-amber-400'
          }`}>
            ৳{othersFundNet.toLocaleString('en-US')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFundCategory('OVERVIEW')}
          className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
            activeFundCategory === 'OVERVIEW'
              ? 'bg-slate-700 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
          title="All Funds Overview"
        >
          <PieChart className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">OVERVIEW</span>
        </button>
      </div>

      {/* 1. UNIT FUND SECTION */}
      {activeFundCategory === 'UNIT' && <UnitFundSection />}

      {/* 2. OTHERS FUND SECTION */}
      {activeFundCategory === 'OTHERS' && <OthersFundSection />}

      {/* 3. ALL FUNDS OVERVIEW */}
      {activeFundCategory === 'OVERVIEW' && (
        <AllFundsOverviewSection onSelectFund={(fund) => setActiveFundCategory(fund)} />
      )}

      {/* 4. CANTEEN FUND SECTION (Original) */}
      {activeFundCategory === 'CANTEEN' && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <Wallet className="w-6 h-6 text-indigo-500" />
                CANTEEN FUND (ক্যান্টিন তহবিল)
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                PAYMENT COLLECTIONS, EXPENDITURE DEDUCTIONS & FUND TRANSFERS
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Transfer Button */}
              <button
                type="button"
                onClick={() => {
                  setTransferError('');
                  setTransferAmount('');
                  setTransferNote('');
                  setShowTransferModal(true);
                }}
                className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-2 shadow-lg shadow-indigo-500/25 active:translate-y-0.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>TRANSFER FUND</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
                title="Refresh Fund Data"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">SYNC</span>
              </button>
            </div>
          </div>

      {/* Metrics Cards (Reflecting real balance = Collections - Expenditures +/- Transfers) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Fund */}
        <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/30 text-indigo-500 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              NET FUND
            </span>
          </div>
          <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">TOTAL CURRENT FUND</p>
          <h3 className={`text-4xl font-black tracking-tighter ${totalFund >= 0 ? 'text-white' : 'text-rose-400'}`}>
            ৳{totalFund.toLocaleString('en-US')}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium mt-2">
            নগদ ও ব্যাংক (UCB) মোট সংরক্ষিত বর্তমান তহবিল
          </p>
        </div>

        {/* Total Cash */}
        <div className="bg-emerald-900/20 rounded-[2rem] p-6 shadow-sm border border-emerald-900/40">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/50 text-emerald-300 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              CASH IN HAND
            </span>
          </div>
          <p className="text-[8px] font-black text-emerald-400 tracking-widest uppercase mb-1">TOTAL CASH</p>
          <h3 className={`text-4xl font-black tracking-tighter ${totalCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ৳{totalCash.toLocaleString('en-US')}
          </h3>

          {/* Cash Location Breakdown: Manager vs Staff */}
          <div className="mt-4 pt-3 border-t border-emerald-800/40 space-y-2">
            <div className="flex items-center justify-between text-[9px] font-black tracking-widest text-emerald-300/80 uppercase">
              <span>ক্যাশ বণ্টন (LOCATION BREAKDOWN)</span>
              <span className="font-mono text-emerald-400 text-[10px]">মোট ৳{totalCash.toLocaleString('en-US')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/80 p-3 rounded-2xl border border-emerald-800/40 shadow-inner">
                <span className="text-[10px] text-slate-400 block font-bold mb-1">ম্যানেজার (Manager)</span>
                <span className="font-mono font-black text-emerald-300 text-base">
                  ৳{managerCash.toLocaleString('en-US')}
                </span>
                <span className="text-[9px] text-slate-500 block mt-1 font-medium leading-tight">
                  ক্যাশ - স্টাফ অগ্রিম
                </span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-2xl border border-emerald-800/40 shadow-inner">
                <span className="text-[10px] text-slate-400 block font-bold mb-1">স্টাফ অগ্রিম (Staff)</span>
                <span className="font-mono font-black text-amber-400 text-base">
                  ৳{staffAdvanceAmount.toLocaleString('en-US')}
                </span>
                <span className="text-[9px] text-slate-500 block mt-1 font-medium leading-tight">
                  হাতে থাকা অগ্রিম
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-medium mt-3 pt-2 border-t border-emerald-900/30 flex flex-col space-y-0.5">
            <span className="text-emerald-400/90 font-bold">+ বিল কালেকশন: ৳{billPaymentCash.toLocaleString('en-US')}</span>
            <span className="text-rose-400/90 font-bold">- খরচ বিয়োগ: ৳{expenseCash.toLocaleString('en-US')}</span>
            {(cashToUcbTotal > 0 || ucbToCashTotal > 0) && (
              <span className="text-indigo-400/90 font-bold">
                +/- ট্রান্সফার: {ucbToCashTotal - cashToUcbTotal >= 0 ? `+৳${(ucbToCashTotal - cashToUcbTotal).toLocaleString('en-US')}` : `-৳${Math.abs(ucbToCashTotal - cashToUcbTotal).toLocaleString('en-US')}`}
              </span>
            )}
          </div>
        </div>

        {/* Total UCB */}
        <div className="bg-blue-900/20 rounded-[2rem] p-6 shadow-sm border border-blue-900/40">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-900/50 text-blue-300 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              BANK / UCB
            </span>
          </div>
          <p className="text-[8px] font-black text-blue-400 tracking-widest uppercase mb-1">TOTAL UCB</p>
          <h3 className={`text-4xl font-black tracking-tighter ${totalUCB >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            ৳{totalUCB.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-2 flex flex-col space-y-0.5">
            <span className="text-blue-400/90 font-bold">+ বিল কালেকশন: ৳{billPaymentUCB.toLocaleString('en-US')}</span>
            <span className="text-rose-400/90 font-bold">- খরচ বিয়োগ: ৳{expenseUCB.toLocaleString('en-US')}</span>
            {(cashToUcbTotal > 0 || ucbToCashTotal > 0) && (
              <span className="text-indigo-400/90 font-bold">
                +/- ট্রান্সফার: {cashToUcbTotal - ucbToCashTotal >= 0 ? `+৳${(cashToUcbTotal - ucbToCashTotal).toLocaleString('en-US')}` : `-৳${Math.abs(cashToUcbTotal - ucbToCashTotal).toLocaleString('en-US')}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Statement & Activity Section */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-indigo-500" />
            <span>FUND LEDGER & LOGS</span>
          </h3>
          
          <div className="flex bg-slate-800 rounded-xl p-1 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'ALL' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              ALL LOGS ({allLogs.length})
            </button>
            <button 
              onClick={() => setActiveTab('CASH')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'CASH' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              CASH INFLOW ({cashPayments.length})
            </button>
            <button 
              onClick={() => setActiveTab('UCB')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'UCB' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              UCB INFLOW ({ucbPayments.length})
            </button>
            <button 
              onClick={() => setActiveTab('EXPENSES')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'EXPENSES' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              EXPENSE DEDUCTIONS ({cashExpenses.length + ucbExpenses.length})
            </button>
            <button 
              onClick={() => setActiveTab('TRANSFERS')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'TRANSFERS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              TRANSFERS ({transfers.length})
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {/* TAB 0: ALL Fund Logs */}
          {activeTab === 'ALL' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Description / কার জন্য কত খরচ</th>
                  <th className="p-4">Channel / Account</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 font-medium">
                {allLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      No fund activity logs found
                    </td>
                  </tr>
                ) : (
                  allLogs.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{formatCanteenDate(item.date)}</td>
                      <td className="p-4">
                        {item.logType === 'CASH_REFUND' ? (
                          <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
                            Refund
                          </span>
                        ) : item.logType === 'CASH_ADVANCE' ? (
                          <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-950/70 text-amber-400 border border-amber-500/40">
                            Advance
                          </span>
                        ) : item.logType === 'PAYMENT' || item.logType === 'INFLOW' ? (
                          <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                            Payment
                          </span>
                        ) : item.logType === 'EXPENSE' ? (
                          <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-950/60 text-rose-400 border border-rose-500/30">
                            Expense
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-950/60 text-indigo-400 border border-indigo-500/30">
                            ⇄ Transfer
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white text-xs whitespace-pre-line leading-relaxed">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5 whitespace-pre-line">
                            {item.subtitle}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${
                          item.channel.includes('CASH') && !item.channel.includes('→')
                            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40'
                            : item.channel.includes('UCB') && !item.channel.includes('→')
                            ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40'
                            : item.channel.includes('→')
                            ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-800/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {item.channel}
                        </span>
                      </td>
                      <td className={`p-4 text-right font-black font-mono text-xs ${
                        item.logType === 'INFLOW' || item.logType === 'CASH_REFUND' || item.logType === 'PAYMENT'
                          ? 'text-emerald-400' 
                          : item.logType === 'CASH_ADVANCE'
                          ? 'text-amber-400'
                          : item.logType === 'EXPENSE' 
                          ? 'text-rose-400' 
                          : 'text-indigo-400'
                      }`}>
                        {item.logType === 'INFLOW' || item.logType === 'CASH_REFUND' || item.logType === 'PAYMENT'
                          ? `+৳${item.amount.toLocaleString('en-US')}` 
                          : item.logType === 'CASH_ADVANCE'
                          ? `-৳${item.amount.toLocaleString('en-US')}`
                          : item.logType === 'EXPENSE' 
                          ? `-৳${item.amount.toLocaleString('en-US')}` 
                          : `৳${item.amount.toLocaleString('en-US')}`}
                      </td>
                      <td className="p-4 text-center">
                        {item.rawExp ? (
                          <button
                            type="button"
                            onClick={() => setExpToDelete(item.rawExp)}
                            title="Delete Expense Record"
                            className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/70 border border-transparent hover:border-rose-500/40 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {/* TAB 1 & 2: Cash / UCB Inflow */}
          {(activeTab === 'CASH' || activeTab === 'UCB') && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                  <th className="p-4">Date</th>
                  <th className="p-4">Member ID / Name</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Gateway</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 font-medium">
                {(activeTab === 'CASH' ? cashPayments : ucbPayments).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                      No collections found for {activeTab}
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'CASH' ? cashPayments : ucbPayments).map((tx, idx) => (
                    <tr key={tx.id || idx} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono">{formatCanteenDate(tx.date)}</td>
                      <td className="p-4">
                        <span className="text-indigo-400 font-bold">{tx.memberName || tx.airman_id}</span>
                        {tx.bdNo && <span className="text-slate-500 text-[10px] ml-1.5 font-mono">(BD-{tx.bdNo})</span>}
                        {(tx.type === 'ADVANCE_RETURN' || tx.type === 'BAZAR_RETURN') && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                            CASH REFUND
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400">
                        {(tx.type === 'ADVANCE_RETURN' || tx.type === 'BAZAR_RETURN') ? 'Advance Return (ফেরত ক্যাশ)' : (tx.items || 'Bill Payment')}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${activeTab === 'CASH' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40' : 'bg-blue-900/30 text-blue-400 border border-blue-800/40'}`}>
                          {tx.gateway}
                        </span>
                      </td>
                      <td className="p-4 text-right font-black text-emerald-400 font-mono">
                        +৳{Number(tx.amount || 0).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: Expense Deductions */}
          {activeTab === 'EXPENSES' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                  <th className="p-4">Date</th>
                  <th className="p-4">Item Name & Member Details</th>
                  <th className="p-4">কার জন্য (Member / Recipient)</th>
                  <th className="p-4">Paid From</th>
                  <th className="p-4 text-right">Deducted Amount</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 font-medium">
                {expenses.filter(e => isCashMethod(e.paymentMethod) || isUcbMethod(e.paymentMethod)).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      No expenditure deductions found for Cash or UCB
                    </td>
                  </tr>
                ) : (
                  expenses
                    .filter(e => isCashMethod(e.paymentMethod) || isUcbMethod(e.paymentMethod))
                    .map((exp) => (
                      <tr key={exp.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-mono">{formatCanteenDate(exp.date)}</td>
                        <td className="p-4 font-bold text-white text-xs">
                          <div>
                            {(() => {
                              let clean = String(exp.desc || '')
                                .replace(/^OTHERS\s*BILL\s*:\s*/i, '')
                                .replace(/^OTHER\s*BILL\s*:\s*/i, '')
                                .replace(/^UNIT\s*FUND\s*:\s*/i, '')
                                .replace(/^UNIT\s*FUND\s*BILL\s*:\s*/i, '')
                                .trim();
                              let mNames = '';
                              if (exp.memberBreakdown && Array.isArray(exp.memberBreakdown) && exp.memberBreakdown.length > 0) {
                                mNames = exp.memberBreakdown.map((m: any) => m.name).filter(Boolean).join(', ');
                              }
                              return mNames ? `${clean} (${mNames})` : clean;
                            })()}
                          </div>
                        </td>
                        <td className="p-4 text-slate-300 font-medium">
                          {exp.memberBreakdown && Array.isArray(exp.memberBreakdown) && exp.memberBreakdown.length > 0
                            ? exp.memberBreakdown.map((m: any) => `${m.name}${m.bdNo ? ` (BD-${m.bdNo})` : ''}`).join(', ')
                            : (exp.detailedPerson || 'Staff / Manager')}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[9px] font-black tracking-wider uppercase border ${isUcbMethod(exp.paymentMethod) ? 'bg-blue-900/30 text-blue-400 border-blue-800/40' : 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40'}`}>
                            {exp.paymentMethod || 'Cash'}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-rose-400 font-mono">
                          -৳{Number(exp.amount || 0).toLocaleString('en-US')}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => setExpToDelete(exp)}
                            title="Delete Expense Record"
                            className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/70 border border-transparent hover:border-rose-500/40 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 4: Fund Transfers */}
          {activeTab === 'TRANSFERS' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                  <th className="p-4">Date</th>
                  <th className="p-4">From Account</th>
                  <th className="p-4">To Account</th>
                  <th className="p-4">Transfer Note</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 font-medium">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                      No fund transfers recorded yet. Use &quot;TRANSFER FUND&quot; to transfer between Cash and UCB.
                    </td>
                  </tr>
                ) : (
                  transfers.map((tr) => (
                    <tr key={tr.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono">{formatCanteenDate(tr.date)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${tr.from === 'CASH' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                          {tr.from}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${tr.to === 'CASH' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                          {tr.to}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{tr.note || '-'}</td>
                      <td className="p-4 text-right font-black text-indigo-400 font-mono">
                        ৳{Number(tr.amount || 0).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Fund Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[180] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    FUND TRANSFER
                  </h3>
                  <p className="text-xs text-slate-400">
                    Transfer balance between Cash and UCB funds
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {transferError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Transfer Direction Selector */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  TRANSFER DIRECTION
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTransferFrom('CASH')}
                    className={`py-3 px-4 rounded-xl text-xs font-black transition-all border flex flex-col items-center space-y-1 ${
                      transferFrom === 'CASH'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 font-bold">CASH → UCB</span>
                    <span className="font-mono text-xs">Cash Available: ৳{totalCash}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferFrom('UCB')}
                    className={`py-3 px-4 rounded-xl text-xs font-black transition-all border flex flex-col items-center space-y-1 ${
                      transferFrom === 'UCB'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 font-bold">UCB → CASH</span>
                    <span className="font-mono text-xs">UCB Available: ৳{totalUCB}</span>
                  </button>
                </div>
              </div>

              {/* Transfer Amount */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  TRANSFER AMOUNT (৳)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-lg font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Optional Note */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  NOTE (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank cash deposit / Canteen petty cash"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/25"
              >
                CONFIRM TRANSFER
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Expense Record Confirmation Modal */}
      {expToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-white text-center">খরচ রেকর্ড ডিলিট করবেন?</h4>
            <p className="text-xs text-slate-300 text-center mt-2 leading-relaxed">
              আপনি কি নিশ্চিত যে <strong className="text-white font-bold">"{expToDelete.desc}"</strong> বাবদ{' '}
              <strong className="text-rose-400 font-mono font-bold">৳{Number(expToDelete.amount || 0).toLocaleString()}</strong> এর খরচ রেকর্ডটি ক্যাপিটাল লগ থেকে সম্পূর্ণ মুছে ফেলতে চান?
            </p>
            <div className="flex items-center space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setExpToDelete(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExp}
                disabled={isDeletingExp}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                {isDeletingExp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>ডিলিট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

    </div>
  );
};
