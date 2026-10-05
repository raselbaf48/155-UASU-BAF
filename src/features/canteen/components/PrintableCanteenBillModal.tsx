import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, FileSpreadsheet, ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
import { BillCategory, getTxCategory, getTxMonthKey } from '../pages/MemberDB';
import { getCanteenConfig } from '../utils/canteenSettings';
import { 
  sortCanteenMembersByOfficeSeniority, 
  isOfficerMember, 
  isAirmanMember, 
  isCivilianMember 
} from '../utils/canteenSeniority';
import { 
  getMemberBanglaName, 
  getMemberBanglaRank 
} from '../utils/memberBanglaNames';
import {
  toBengaliNum,
  formatRankBn,
  formatMemberNameBn,
  getMonthNamesBn,
  exportCanteenBillToExcel
} from '../utils/exportCanteenBillExcel';

export type MemberRoleFilter = 'OVERALL' | 'OFFICER' | 'AIRMEN' | 'CIVILIAN';

// Robust matcher to ensure 100% accurate link between canteen member and transaction records
export const isTxBelongingToMember = (member: any, tx: any): boolean => {
  if (!member || !tx) return false;
  const mAirman = String(member.airman_id || member.airmanId || '').trim().toLowerCase();
  const txAirman = String(tx.airman_id || tx.airmanId || '').trim().toLowerCase();
  if (mAirman && txAirman && mAirman === txAirman) return true;

  const mBdClean = String(member['BD No'] || member.bdNo || member.bd_no || member.airman_id || '').replace(/\D/g, '');
  const txBdClean = String(tx.bdNo || tx['BD No'] || tx.bd_no || tx.airman_id || '').replace(/\D/g, '');
  const mBdCleanNoZero = mBdClean.replace(/^0+/, '');
  const txBdCleanNoZero = txBdClean.replace(/^0+/, '');
  if (mBdClean && txBdClean && (mBdClean === txBdClean || (mBdCleanNoZero && mBdCleanNoZero === txBdCleanNoZero))) {
    return true;
  }

  const mSurname = String(member['Surname'] || member.surname || '').trim().toLowerCase();
  const mRank = String(member['Rank'] || member.rank || '').trim().toLowerCase();
  if (mSurname && tx.memberName) {
    const txName = String(tx.memberName).toLowerCase();
    if (txName.includes(mSurname) && (!mRank || txName.includes(mRank))) {
      return true;
    }
  }

  return false;
};

// Helper to determine if a transaction is a valid non-reverted payment
const isPaymentTx = (tx: any): boolean => {
  if (!tx) return false;
  const isPay = tx.type === 'BILL PAYMENT' || tx.type === 'PAYMENT';
  if (!isPay) return false;
  if (tx.isReverted || tx.status === 'REVERTED') return false;
  if (String(tx.items || '').includes('[বাতিল / REVERTED]')) return false;
  return true;
};

// Helper to check category match
const isCategoryMatch = (tx: any, cat: BillCategory): boolean => {
  if (cat === 'ALL') return true;
  if (isPaymentTx(tx)) {
    return tx.billType === 'ALL' || tx.billType === cat || !tx.billType;
  }
  return getTxCategory(tx) === cat;
};

interface PrintableCanteenBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: any[];
  allTxs: any[];
  selectedCategory: BillCategory;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
}

const formatAmountBn = (amount: number, showZero: boolean = false): string => {
  if (!amount || amount <= 0) {
    return showZero ? '৳০' : '';
  }
  const formattedWithCommas = Math.round(amount).toLocaleString('en-IN');
  return `৳${toBengaliNum(formattedWithCommas)}`;
};

export const PrintableCanteenBillModal: React.FC<PrintableCanteenBillModalProps> = ({
  isOpen,
  onClose,
  members,
  allTxs,
  selectedCategory,
  selectedMonth,
  onMonthChange,
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('portrait');
  const [internalMonth, setInternalMonth] = useState<string>(selectedMonth);
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>('OVERALL');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'DUE'>('ALL');
  const [banglaVersion, setBanglaVersion] = useState<number>(0);

  // Live state synchronized with storage and cloud events for true realtime updates
  const [liveTxs, setLiveTxs] = useState<any[]>(allTxs);
  const [liveMembers, setLiveMembers] = useState<any[]>(members);

  const loadFreshState = useCallback(() => {
    let txsToUse = allTxs;
    try {
      const rawTxs = localStorage.getItem('canteen_txs');
      if (rawTxs) {
        const parsed = JSON.parse(rawTxs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          txsToUse = parsed;
        }
      }
    } catch {}
    if (Array.isArray(txsToUse)) {
      setLiveTxs(txsToUse);
    }

    let membersToUse = members;
    try {
      const rawMembers = localStorage.getItem('canteen_members_cache');
      if (rawMembers) {
        const parsed = JSON.parse(rawMembers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          membersToUse = parsed;
        }
      }
    } catch {}
    if (Array.isArray(membersToUse)) {
      setLiveMembers(membersToUse);
    }
    setBanglaVersion((v) => v + 1);
  }, [allTxs, members]);

  useEffect(() => {
    setInternalMonth(selectedMonth);
  }, [selectedMonth]);

  // When props change or print modal opens, load freshest state immediately
  useEffect(() => {
    loadFreshState();
  }, [isOpen, allTxs, members, loadFreshState]);

  // Realtime update listener on payments, transactions, member updates, and bangla names
  useEffect(() => {
    const handleSync = () => {
      loadFreshState();
    };

    window.addEventListener('canteen_txs_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('canteen_members_updated', handleSync);
    window.addEventListener('canteen_member_bangla_names_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('canteen_txs_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('canteen_members_updated', handleSync);
      window.removeEventListener('canteen_member_bangla_names_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadFreshState]);

  const activeMonth = internalMonth || selectedMonth;

  const cfg = getCanteenConfig();
  const unitName = '১৫৫ ইউএএসইউ বিএএফ';
  const { currMonthBn, prevMonthBn, titleMonthBn } = getMonthNamesBn(activeMonth);

  const categoryTitle = selectedCategory === 'CANTEEN'
    ? 'ক্যান্টিন বিল'
    : selectedCategory === 'UNIT_FUND'
    ? 'ইউনিট ফান্ড বিল'
    : selectedCategory === 'OTHERS'
    ? 'অন্যান্য বিল'
    : 'ক্যান্টিন বিল';

  const handlePrevMonth = () => {
    if (activeMonth === 'ALL') {
      const now = new Date();
      const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setInternalMonth(mKey);
      if (onMonthChange) onMonthChange(mKey);
      return;
    }
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setInternalMonth(prevKey);
    if (onMonthChange) onMonthChange(prevKey);
  };

  const handleNextMonth = () => {
    if (activeMonth === 'ALL') {
      const now = new Date();
      const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setInternalMonth(mKey);
      if (onMonthChange) onMonthChange(mKey);
      return;
    }
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setInternalMonth(nextKey);
    if (onMonthChange) onMonthChange(nextKey);
  };

  // Group member counts for badge indicators
  const officerCount = useMemo(() => liveMembers.filter(isOfficerMember).length, [liveMembers]);
  const airmenCount = useMemo(() => liveMembers.filter(isAirmanMember).length, [liveMembers]);
  const civilianCount = useMemo(() => liveMembers.filter(isCivilianMember).length, [liveMembers]);

  // Filter members based on selected role filter
  const filteredMembers = useMemo(() => {
    if (roleFilter === 'OFFICER') {
      return liveMembers.filter(isOfficerMember);
    }
    if (roleFilter === 'AIRMEN') {
      return liveMembers.filter(isAirmanMember);
    }
    if (roleFilter === 'CIVILIAN') {
      return liveMembers.filter(isCivilianMember);
    }
    return liveMembers;
  }, [liveMembers, roleFilter]);

  // Sort members strictly according to Office Nominal Roll Seniority
  const sortedMembers = useMemo(() => {
    return sortCanteenMembersByOfficeSeniority(filteredMembers);
  }, [filteredMembers]);

  // Helper to extract comparable YYYY-MM key from any transaction
  const getMonthKeyOfTx = (tx: any): string => {
    return tx.monthKey || getTxMonthKey(tx.date) || '';
  };

  // Compute detailed financial calculations for every member
  const computeEffectiveCharges = (txList: any[]): number => {
    let salesTotal = 0;
    const initialTxsByGroup = new Map<string, any[]>();

    txList.forEach((tx) => {
      if (!tx || isPaymentTx(tx) || tx.type === 'REVERTED' || tx.isReverted || tx.status === 'REVERTED' || String(tx.items || '').includes('[বাতিল')) return;

      const isInit = tx.type === 'INITIAL_BILL' || 
        tx.type === 'AMOUNT_CHANGE' ||
        tx.isAmountChange ||
        String(tx.id || '').startsWith('tx-init-') || 
        String(tx.id || '').startsWith('init-') || 
        String(tx.items || '').includes('ক্যান্টিন বিল') || 
        String(tx.items || '').includes('বকেয়া বিল') ||
        String(tx.items || '').includes('Changed amount from');

      if (!isInit) {
        salesTotal += Number(tx.amount || 0);
      } else {
        const mKey = tx.monthKey || getTxMonthKey(tx.date) || 'DEFAULT';
        const cKey = getTxCategory(tx);
        const groupKey = `${mKey}__${cKey}`;
        if (!initialTxsByGroup.has(groupKey)) {
          initialTxsByGroup.set(groupKey, []);
        }
        initialTxsByGroup.get(groupKey)!.push(tx);
      }
    });

    let initialBillsTotal = 0;
    initialTxsByGroup.forEach((groupTxs) => {
      if (groupTxs.length === 1) {
        initialBillsTotal += Number(groupTxs[0].amount || 0);
      } else {
        const sorted = [...groupTxs].sort((a, b) => {
          if (a.isAmountChange && !b.isAmountChange) return -1;
          if (!a.isAmountChange && b.isAmountChange) return 1;
          const timeA = new Date(a.created_at || a.createdAt || a.timestamp || 0).getTime() || 0;
          const timeB = new Date(b.created_at || b.createdAt || b.timestamp || 0).getTime() || 0;
          if (timeA !== timeB) return timeB - timeA;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
        initialBillsTotal += Number(sorted[0].amount || 0);
      }
    });

    return salesTotal + initialBillsTotal;
  };

  const rows = useMemo(() => {
    return sortedMembers.map((member, index) => {
      // 100% reliable transaction matching by BD No, ID, or surname
      const memberTxs = liveTxs.filter((tx) => isTxBelongingToMember(member, tx));
      const memberCategoryTxs = memberTxs.filter((tx) => isCategoryMatch(tx, selectedCategory));

      const rankFormatted = getMemberBanglaRank(member) || formatRankBn(member['Rank'] || member.rank || '');
      const rawName = member['Surname'] || member['Full Name'] || member['Name'] || '';
      // Fetch Bengali name (Civilian members retain their real Bengali name e.g. তানভীর, শরীফ; Rank is সিভিলিয়ান)
      const nameFormatted = getMemberBanglaName(member) || formatMemberNameBn(rawName) || rawName;

      let currentPeriodCharges = 0;
      let currentPeriodPayments = 0;
      let previousDue = 0;
      let previousAdvance = 0;
      let totalBill = 0;
      let paidBill = 0;
      let advance = 0;
      let remainingDue = 0;

      const memberTotalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
      const memberTotalAdvance = Number(member.Advance ?? member.advance ?? member.ogrim ?? 0);

      if (activeMonth === 'ALL') {
        const allCharges = computeEffectiveCharges(memberCategoryTxs);

        const allPayments = memberCategoryTxs
          .filter((tx) => isPaymentTx(tx))
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        currentPeriodCharges = allCharges;
        currentPeriodPayments = allPayments;
        previousDue = 0;
        previousAdvance = memberTotalAdvance;
        totalBill = Math.max(memberTotalDue + allPayments, allCharges);
        paidBill = allPayments;
        remainingDue = memberTotalDue;
        advance = memberTotalAdvance;
      } else {
        // Specific Month (e.g. '2026-09', '2026-07', '2026-10')

        // 1. Prior Period: strictly transactions dated prior to this month
        const priorTxs = memberCategoryTxs.filter((tx) => {
          const m = getMonthKeyOfTx(tx);
          return m && m < activeMonth;
        });

        const priorCharges = computeEffectiveCharges(priorTxs);

        const priorPayments = priorTxs
          .filter((tx) => isPaymentTx(tx))
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const priorNet = priorCharges - priorPayments;
        if (priorNet > 0) {
          previousDue = priorNet;
          previousAdvance = 0;
        } else if (priorNet < 0) {
          previousDue = 0;
          previousAdvance = Math.abs(priorNet);
        } else {
          previousDue = 0;
          previousAdvance = 0;
        }

        // 2. Current Month Charges: transactions belonging specifically to activeMonth
        const currentMonthTxs = memberCategoryTxs.filter((tx) => getMonthKeyOfTx(tx) === activeMonth);
        currentPeriodCharges = computeEffectiveCharges(currentMonthTxs);

        // Total bill for this month
        totalBill = previousDue + currentPeriodCharges;

        // 3. Post-Paid Canteen Realtime Payment Settlement:
        // In post-paid canteen, bills for activeMonth are collected in activeMonth and activeMonth+1 (e.g. October for September)
        // Payments made during or after prior period that apply to this statement:
        const paymentsAfterPrior = memberCategoryTxs
          .filter((tx) => isPaymentTx(tx) && getMonthKeyOfTx(tx) >= activeMonth)
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const allPaymentsToDate = memberCategoryTxs
          .filter((tx) => isPaymentTx(tx))
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const effectivePayments = Math.max(paymentsAfterPrior, Math.max(0, allPaymentsToDate - priorPayments));

        paidBill = effectivePayments;
        currentPeriodPayments = paidBill;

        const totalCredits = previousAdvance + effectivePayments;
        if (totalCredits >= totalBill) {
          advance = totalCredits - totalBill;
          remainingDue = 0;
        } else {
          const rawDue = totalBill - totalCredits;
          // If member has already fully cleared balance in ledger (memberTotalDue === 0), reflect 0
          remainingDue = memberTotalDue === 0 ? 0 : Math.min(rawDue, memberTotalDue);
          advance = 0;
        }
      }

      return {
        ser: index + 1,
        serBn: toBengaliNum(index + 1),
        rank: rankFormatted,
        name: nameFormatted,
        previousDue,
        previousAdvance,
        canteenBill: currentPeriodCharges,
        totalBill,
        paidBill,
        advance,
        remainingDue,
      };
    });
  }, [sortedMembers, liveTxs, selectedCategory, activeMonth, banglaVersion]);

  // Count of members who have outstanding due in this view
  const dueCount = useMemo(() => {
    return rows.filter((r) => r.remainingDue > 0).length;
  }, [rows]);

  // Filter rows based on dueFilter (All vs Due) and re-index Serial No (১, ২, ৩...)
  const displayedRows = useMemo(() => {
    const list = dueFilter === 'DUE' ? rows.filter((r) => r.remainingDue > 0) : rows;
    return list.map((r, idx) => ({
      ...r,
      ser: idx + 1,
      serBn: toBengaliNum(idx + 1),
    }));
  }, [rows, dueFilter]);

  // Totals calculated strictly for the currently displayed rows
  const totals = useMemo(() => {
    return displayedRows.reduce(
      (acc, r) => {
        acc.previousDue += r.previousDue;
        acc.previousAdvance += r.previousAdvance;
        acc.canteenBill += r.canteenBill;
        acc.totalBill += r.totalBill;
        acc.paidBill += r.paidBill;
        acc.advance += r.advance;
        acc.remainingDue += r.remainingDue;
        return acc;
      },
      { previousDue: 0, previousAdvance: 0, canteenBill: 0, totalBill: 0, paidBill: 0, advance: 0, remainingDue: 0 }
    );
  }, [displayedRows]);

  const handlePrint = () => {
    const originalTitle = document.title;
    const filterSuffix = roleFilter === 'OFFICER' ? '_OFFICER' : roleFilter === 'AIRMEN' ? '_AIRMEN' : roleFilter === 'CIVILIAN' ? '_CIVILIAN' : '';
    const dueSuffix = dueFilter === 'DUE' ? '_DUE_ONLY' : '';
    document.title = `CANTEEN_BILL_${unitName.replace(/\s+/g, '_')}_${titleMonthBn.replace(/\s+/g, '_')}${filterSuffix}${dueSuffix}`;

    // Explicitly hide root so the browser never prints the background dashboard
    const rootEl = document.getElementById('root');
    const prevDisplay = rootEl ? rootEl.style.display : '';
    if (rootEl) {
      rootEl.style.setProperty('display', 'none', 'important');
    }

    const restoreRoot = () => {
      if (rootEl) {
        if (prevDisplay) {
          rootEl.style.display = prevDisplay;
        } else {
          rootEl.style.removeProperty('display');
        }
      }
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreRoot);
    };

    window.addEventListener('afterprint', restoreRoot);

    setTimeout(() => {
      window.print();
      // Fallback restore in case afterprint does not fire in some browsers
      setTimeout(restoreRoot, 1000);
    }, 150);
  };

  const handleExportExcel = () => {
    exportCanteenBillToExcel({
      members: filteredMembers,
      allTxs: liveTxs,
      selectedCategory,
      selectedMonth: activeMonth,
      filterLabel: roleFilter !== 'OVERALL' ? roleFilter : undefined,
      dueOnly: dueFilter === 'DUE',
      getBanglaName: (m) => getMemberBanglaName(m),
      getBanglaRank: (m) => getMemberBanglaRank(m) || formatRankBn(m['Rank'] || m.rank || ''),
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="canteen-bill-modal-portal fixed inset-0 z-[100] flex flex-col bg-slate-950/80 backdrop-blur-md animate-fadeIn text-black">
      {/* Top Header Controls (Hidden on Print) */}
      <div className="canteen-print-controls-bar flex-none bg-slate-900 border-b border-slate-700 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 shadow-2xl print:hidden z-10">
        <div className="flex items-center space-x-3 text-white">
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer shrink-0"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs sm:text-sm font-black tracking-wider leading-tight uppercase flex items-center space-x-2">
              <span className="text-indigo-400">📄</span>
              <span>CANTEEN BILL PRINT &amp; PDF PREVIEW</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Office App Format • Use 'Save as PDF' to download PDF
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
          {/* Month Selector with Left and Right Arrows */}
          <div className="flex items-center bg-slate-800/90 rounded-xl px-1.5 py-1 border border-slate-700">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="পূর্ববর্তী মাস (Previous Month)"
            >
              <ChevronLeft className="w-4 h-4 text-indigo-400" />
            </button>
            <div className="px-2.5 py-0.5 text-center min-w-[100px] select-none">
              <span className="text-xs font-black text-white flex items-center justify-center space-x-1">
                <Calendar className="w-3 h-3 text-indigo-400 mr-1" />
                <span>{titleMonthBn}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="পরবর্তী মাস (Next Month)"
            >
              <ChevronRight className="w-4 h-4 text-indigo-400" />
            </button>
          </div>

          {/* Group Filter Selector: Overall / Officer / Airmen / Civilian */}
          <div className="grid grid-cols-4 w-full sm:flex sm:w-auto items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 shadow-inner gap-1">
            <button
              type="button"
              onClick={() => setRoleFilter('OVERALL')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shrink-0 ${
                roleFilter === 'OVERALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="সকল সদস্য (Overall - All Members)"
            >
              <span>Overall</span>
              <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full font-mono font-bold ${
                roleFilter === 'OVERALL' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'
              }`}>
                {liveMembers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRoleFilter('OFFICER')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shrink-0 ${
                roleFilter === 'OFFICER'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="শুধুমাত্র অফিসার (Officers Only)"
            >
              <span>Officer</span>
              <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full font-mono font-bold ${
                roleFilter === 'OFFICER' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'
              }`}>
                {officerCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRoleFilter('AIRMEN')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shrink-0 ${
                roleFilter === 'AIRMEN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="শুধুমাত্র বিমানসেনা (Airmen Only)"
            >
              <span>Airmen</span>
              <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full font-mono font-bold ${
                roleFilter === 'AIRMEN' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'
              }`}>
                {airmenCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRoleFilter('CIVILIAN')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shrink-0 ${
                roleFilter === 'CIVILIAN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="শুধুমাত্র সিভিলিয়ান (Civilian Only)"
            >
              <span>Civilian</span>
              <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full font-mono font-bold ${
                roleFilter === 'CIVILIAN' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'
              }`}>
                {civilianCount}
              </span>
            </button>
          </div>

          {/* Due Filter: All vs Due Only */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 shadow-inner">
            <button
              type="button"
              onClick={() => setDueFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                dueFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="সকল সদস্যের বিল (All Bills)"
            >
              <span>All</span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                dueFilter === 'ALL' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'
              }`}>
                {rows.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDueFilter('DUE')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                dueFilter === 'DUE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-400 hover:text-white hover:bg-rose-950/40'
              }`}
              title="শুধুমাত্র বকেয়া থাকা সদস্য (Due Only)"
            >
              <span>Due</span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                dueFilter === 'DUE' ? 'bg-rose-800 text-rose-100' : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
              }`}>
                {dueCount}
              </span>
            </button>
          </div>

          {/* Page Orientation Selector */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Portrait mode"
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Landscape mode"
            >
              Landscape
            </button>
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer border border-emerald-600/40 shadow-sm"
            title="Download official Excel (.xlsx) file"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span className="text-center">Export Excel (.xlsx)</span>
          </button>

          {/* Print / Save as PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center space-x-1.5 px-4 sm:px-5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs sm:text-sm shadow-lg shadow-indigo-900/30 transition-all cursor-pointer active:translate-y-0.5"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-center uppercase tracking-wide">Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Content Area */}
      <div className="canteen-bill-print-area flex-1 overflow-auto print:overflow-visible bg-slate-800/60 print:bg-white p-3 sm:p-6 print:p-0 flex justify-center print:block">
        <style type="text/css">
          {`
            @media print {
              /* 1. HIDE ENTIRE ROOT APPLICATION OUTSIDE THIS MODAL */
              #root {
                display: none !important;
                visibility: hidden !important;
              }

              /* 2. BODY & HTML RESETS */
              html, body {
                background: #ffffff !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              @page { 
                size: A4 ${orientation} !important; 
                margin: 5mm 6mm !important; 
              }

              /* 3. PORTAL CONTAINER IN NORMAL PRINT FLOW */
              .canteen-bill-modal-portal {
                position: static !important;
                display: block !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
                backdrop-filter: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
              }

              /* 4. HIDE HEADER CONTROLS */
              .canteen-print-controls-bar,
              .print\\:hidden {
                display: none !important;
                visibility: hidden !important;
              }

              /* 5. PAPER SHEET CONTAINER */
              .canteen-bill-print-area {
                display: block !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }

              #print-canteen-bill-content {
                display: block !important;
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: 0 !important;
                margin: 0 auto !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
                color: #000000 !important;
              }

              table {
                page-break-inside: auto !important;
                width: 100% !important;
              }
              tr {
                page-break-inside: avoid !important;
                page-break-after: auto !important;
              }
              thead {
                display: table-header-group !important;
              }
              tfoot {
                display: table-footer-group !important;
              }
            }

            .sutonny-font {
              font-family: 'SutonnyMJ', 'SolaimanLipi', 'Kalpurush', 'Nikosh', 'Bangla', sans-serif !important;
            }
          `}
        </style>

        {/* Paper Container */}
        <div
          id="print-canteen-bill-content"
          className={`sutonny-font mx-auto h-fit shrink-0 bg-white text-black print:shadow-none print:border-none border border-slate-300 shadow-2xl p-4 sm:p-8 print:p-0 print:m-0 transition-all ${
            orientation === 'landscape'
              ? 'w-full sm:w-[297mm] min-h-[210mm] print:w-full print:min-h-0'
              : 'w-full sm:w-[210mm] min-h-[297mm] print:w-full print:min-h-0'
          }`}
        >
          <div className="w-full">
            {/* Header: Centered Titles - ONLY Headlines are BOLD */}
            <div className="text-center mb-4 space-y-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-wide text-black">
                {categoryTitle}ঃ {unitName}{roleFilter === 'OFFICER' ? ' (অফিসার)' : roleFilter === 'AIRMEN' ? ' (বিমানসেনা)' : roleFilter === 'CIVILIAN' ? ' (সিভিলিয়ান)' : ''}{dueFilter === 'DUE' ? ' (বকেয়া তালিকা)' : ''}
              </h1>
              <h2 className="text-sm sm:text-base font-bold text-black">
                মাসঃ {titleMonthBn}
              </h2>
            </div>

            {/* Official 10-Column Table: Heading Row is BOLD, Below is strictly NORMAL FONT */}
            <div className="w-full overflow-x-auto print:overflow-visible">
              <table
                className="no-zebra w-full border-collapse border border-black text-[12px] font-normal"
                style={{ pageBreakInside: 'auto' }}
              >
                <thead
                  className="bg-slate-100 print:bg-slate-100 text-black font-bold"
                  style={{ backgroundColor: '#f1f5f9', color: '#000000', display: 'table-header-group' }}
                >
                  <tr className="border border-black font-bold">
                    <th className="p-2 border border-black font-bold text-center align-middle w-10">
                      ক্রমিক<br />নং
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-20">
                      পদবী
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-32">
                      নাম
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-24">
                      বকেয়া বিল<br />({prevMonthBn})
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-24">
                      অগ্রীম বিল<br />({prevMonthBn})
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-24">
                      {categoryTitle}<br />({currMonthBn})
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-24">
                      সর্বমোট<br />বিল
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-24">
                      পরিশোধিত<br />বিল
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-16">
                      অগ্রিম
                    </th>
                    <th className="p-2 border border-black font-bold text-center align-middle w-20">
                      বকেয়া
                    </th>
                  </tr>
                </thead>

                <tbody className="font-normal text-black">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-700 font-normal border border-black">
                        {dueFilter === 'DUE' ? 'এই মাসে কোনো বকেয়া নেই (No Due Members Found)' : 'কোনো সদস্যের রেকর্ড পাওয়া যায়নি'}
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row) => (
                      <tr key={row.ser} className="border border-black hover:bg-slate-50 print:hover:bg-transparent font-normal">
                        <td className="p-1.5 border border-black font-normal text-center align-middle">{row.serBn}</td>
                        <td className="p-1.5 border border-black font-normal text-center align-middle">{row.rank}</td>
                        <td className="p-1.5 border border-black font-normal text-left px-2.5 align-middle">{row.name}</td>
                        <td className="p-1.5 border border-black font-normal text-right px-2 align-middle">
                          {formatAmountBn(row.previousDue)}
                        </td>
                        <td className="p-1.5 border border-black font-normal text-right px-2 align-middle">
                          {formatAmountBn(row.previousAdvance)}
                        </td>
                        <td className="p-1.5 border border-black font-normal text-right px-2 align-middle">
                          {formatAmountBn(row.canteenBill)}
                        </td>
                        <td className="p-1.5 border border-black font-normal text-right px-2 align-middle">
                          {formatAmountBn(row.totalBill)}
                        </td>
                        <td className="p-1.5 border border-black font-normal text-right px-2 text-emerald-800 align-middle">
                          {formatAmountBn(row.paidBill)}
                        </td>
                        <td className="p-1.5 border border-black font-normal text-right px-2 text-indigo-800 align-middle">
                          {formatAmountBn(row.advance)}
                        </td>
                        <td className="p-1.5 border border-black font-normal text-right px-2 text-rose-700 align-middle">
                          {formatAmountBn(row.remainingDue)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Summary Row - Strictly Normal Font */}
                  <tr className="bg-slate-100 print:bg-slate-100 font-normal border border-black">
                    <td colSpan={3} className="p-2 border border-black text-center font-normal align-middle">
                      সর্বমোট
                    </td>
                    <td className="p-2 border border-black font-normal text-right px-2 align-middle">
                      {formatAmountBn(totals.previousDue, true)}
                    </td>
                    <td className="p-2 border border-black font-normal text-right px-2 align-middle">
                      {formatAmountBn(totals.previousAdvance, true)}
                    </td>
                    <td className="p-2 border border-black font-normal text-right px-2 align-middle">
                      {formatAmountBn(totals.canteenBill, true)}
                    </td>
                    <td className="p-2 border border-black font-normal text-right px-2 align-middle">
                      {formatAmountBn(totals.totalBill, true)}
                    </td>
                    <td className="p-2 border border-black font-normal text-right px-2 text-emerald-900 align-middle">
                      {formatAmountBn(totals.paidBill, true)}
                    </td>
                    <td className="p-2 border border-black font-normal text-right px-2 text-indigo-900 align-middle">
                      {formatAmountBn(totals.advance, true)}
                    </td>
                    <td className="p-2 border border-black font-normal text-right px-2 text-rose-900 align-middle">
                      {formatAmountBn(totals.remainingDue, true)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
