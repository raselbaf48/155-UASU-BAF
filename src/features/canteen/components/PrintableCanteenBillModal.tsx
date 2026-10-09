import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, FileSpreadsheet, ChevronLeft, ChevronRight, Calendar, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { toBlob as htmlToImageToBlob, toCanvas as htmlToImageToCanvas } from 'html-to-image';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
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
  exportCanteenBillToExcel,
  getPaymentCycleMonthKey
} from '../utils/exportCanteenBillExcel';
import { WhatsAppIcon } from '../pages/MemberDB';
import { buildWhatsAppMultipleBillMessage } from '../utils/canteenWhatsAppTemplate';


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
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState<boolean>(false);
  const [whatsAppShareSuccess, setWhatsAppShareSuccess] = useState<string | null>(null);

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
  // Payments strictly belong to the month they were paid in (25th-24th shifting rule removed)
  const getMonthKeyOfTx = (tx: any): string => {
    if (isPaymentTx(tx)) {
      const cycleKey = getPaymentCycleMonthKey(tx.date || tx.timestamp || tx.created_at || tx.createdAt);
      if (cycleKey) return cycleKey;
      if (tx.monthKey) return tx.monthKey;
      return '';
    }
    return tx.monthKey || getTxMonthKey(tx.date) || '';
  };

  // Compute detailed financial calculations for every member
  const computeEffectiveCharges = (txList: any[]): number => {
    let salesTotal = 0;
    const initialTxsByGroup = new Map<string, any[]>();

    txList.forEach((tx) => {
      if (!tx || isPaymentTx(tx) || tx.type === 'REVERTED' || tx.isReverted || tx.status === 'REVERTED' || String(tx.items || '').includes('[বাতিল')) return;

      // Paid cash sales are settled instantly at counter and do NOT constitute unpaid due
      const isPaidSale = (tx.status === 'PAID' || tx.paymentStatus === 'PAID' || String(tx.gateway || tx.paymentMethod || '').toUpperCase() === 'CASH');
      if (isPaidSale) return;

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

      const rankFormatted = getMemberBanglaRank(member) || formatRankBn(member['Rank'] || member.rank || '');
      const rawName = member['Surname'] || member['Full Name'] || member['Name'] || '';
      // Fetch Bengali name (Civilian members retain their real Bengali name e.g. তানভীর, শরীফ; Rank is সিভিলিয়ান)
      const nameFormatted = getMemberBanglaName(member) || formatMemberNameBn(rawName) || rawName;

      let currentPeriodCharges = 0;
      let currentPeriodPayments = 0;
      let previousDue = 0;
      let previousAdvance = 0;
      let canteenBill = 0;
      let unitFund = 0;
      let othersFund = 0;
      let totalBill = 0;
      let paidBill = 0;
      let advance = 0;
      let remainingDue = 0;

      const memberTotalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
      const memberTotalAdvance = Number(member.Advance ?? member.advance ?? member.ogrim ?? 0);

      if (activeMonth === 'ALL') {
        const canteenTxs = memberTxs.filter((tx) => getTxCategory(tx) === 'CANTEEN');
        const unitFundTxs = memberTxs.filter((tx) => getTxCategory(tx) === 'UNIT_FUND');
        const othersFundTxs = memberTxs.filter((tx) => getTxCategory(tx) === 'OTHERS');

        canteenBill = computeEffectiveCharges(canteenTxs);
        unitFund = computeEffectiveCharges(unitFundTxs);
        othersFund = computeEffectiveCharges(othersFundTxs);
        currentPeriodCharges = canteenBill + unitFund + othersFund;

        const allPayments = memberTxs
          .filter((tx) => isPaymentTx(tx))
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        currentPeriodPayments = allPayments;
        previousDue = 0;
        previousAdvance = memberTotalAdvance;
        totalBill = Math.max(memberTotalDue + allPayments, currentPeriodCharges);
        paidBill = allPayments;
        remainingDue = memberTotalDue;
        advance = memberTotalAdvance;
      } else {
        // Specific Month (e.g. '2026-09', '2026-07', '2026-10')

        // 1. Prior Period: strictly transactions dated prior to this month
        const priorTxs = memberTxs.filter((tx) => {
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
        const currentMonthTxs = memberTxs.filter((tx) => getMonthKeyOfTx(tx) === activeMonth);
        const canteenTxs = currentMonthTxs.filter((tx) => getTxCategory(tx) === 'CANTEEN');
        const unitFundTxs = currentMonthTxs.filter((tx) => getTxCategory(tx) === 'UNIT_FUND');
        const othersFundTxs = currentMonthTxs.filter((tx) => getTxCategory(tx) === 'OTHERS');

        canteenBill = computeEffectiveCharges(canteenTxs);
        unitFund = computeEffectiveCharges(unitFundTxs);
        othersFund = computeEffectiveCharges(othersFundTxs);
        currentPeriodCharges = canteenBill + unitFund + othersFund;

        // Gross charges before deducting previous advance
        const grossCharges = previousDue + currentPeriodCharges;

        // Total bill for this month: due - previous advance
        totalBill = Math.max(0, grossCharges - previousAdvance);

        // 3. Current Month Payments: payments that belong to activeMonth's payment cycle (25th of month to 24th of next month)
        const currentMonthPayments = memberTxs
          .filter((tx) => isPaymentTx(tx) && getMonthKeyOfTx(tx) === activeMonth)
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        paidBill = currentMonthPayments;
        currentPeriodPayments = paidBill;

        // Any unused previous advance carried over
        const unusedPreviousAdvance = Math.max(0, previousAdvance - grossCharges);

        if (paidBill >= totalBill) {
          remainingDue = 0;
          advance = unusedPreviousAdvance + (paidBill - totalBill);
        } else {
          const rawDue = totalBill - paidBill;
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
        canteenBill,
        unitFund,
        othersFund,
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

  // Dynamic Auto-Hide of Columns: If after filtering any column is completely empty (all 0), it automatically hides
  const rawShowColPreviousDue = useMemo(() => displayedRows.some((r) => (r.previousDue || 0) > 0), [displayedRows]);
  const rawShowColPreviousAdvance = useMemo(() => displayedRows.some((r) => (r.previousAdvance || 0) > 0), [displayedRows]);
  const rawShowColCanteenBill = useMemo(() => displayedRows.some((r) => (r.canteenBill || 0) > 0), [displayedRows]);
  const rawShowColUnitFund = useMemo(() => displayedRows.some((r) => (r.unitFund || 0) > 0), [displayedRows]);
  const rawShowColOthersFund = useMemo(() => displayedRows.some((r) => (r.othersFund || 0) > 0), [displayedRows]);
  const rawShowColTotalBill = useMemo(() => displayedRows.some((r) => (r.totalBill || 0) > 0), [displayedRows]);
  const rawShowColPaidBill = useMemo(() => displayedRows.some((r) => (r.paidBill || 0) > 0), [displayedRows]);
  const rawShowColAdvance = useMemo(() => displayedRows.some((r) => (r.advance || 0) > 0), [displayedRows]);
  const rawShowColRemainingDue = useMemo(() => displayedRows.some((r) => (r.remainingDue || 0) > 0), [displayedRows]);

  const hasAnyBillData = rawShowColPreviousDue || rawShowColPreviousAdvance || rawShowColCanteenBill || rawShowColUnitFund || rawShowColOthersFund || rawShowColTotalBill || rawShowColPaidBill || rawShowColAdvance || rawShowColRemainingDue;

  const showColPreviousDue = rawShowColPreviousDue;
  const showColPreviousAdvance = rawShowColPreviousAdvance;
  const showColCanteenBill = rawShowColCanteenBill || (!hasAnyBillData);
  const showColUnitFund = rawShowColUnitFund;
  const showColOthersFund = rawShowColOthersFund;
  const showColTotalBill = rawShowColTotalBill || (!hasAnyBillData);
  const showColPaidBill = rawShowColPaidBill;
  const showColAdvance = rawShowColAdvance;
  const showColRemainingDue = rawShowColRemainingDue || (!hasAnyBillData);

  const visibleColumnsCount = useMemo(() => {
    let count = 3; // ser, rank, name
    if (showColPreviousDue) count++;
    if (showColPreviousAdvance) count++;
    if (showColCanteenBill) count++;
    if (showColUnitFund) count++;
    if (showColOthersFund) count++;
    if (showColTotalBill) count++;
    if (showColPaidBill) count++;
    if (showColAdvance) count++;
    if (showColRemainingDue) count++;
    return count;
  }, [
    showColPreviousDue,
    showColPreviousAdvance,
    showColCanteenBill,
    showColUnitFund,
    showColOthersFund,
    showColTotalBill,
    showColPaidBill,
    showColAdvance,
    showColRemainingDue
  ]);

  // Totals calculated strictly for the currently displayed rows
  const totals = useMemo(() => {
    return displayedRows.reduce(
      (acc, r) => {
        acc.previousDue += r.previousDue;
        acc.previousAdvance += r.previousAdvance;
        acc.canteenBill += r.canteenBill;
        acc.unitFund += r.unitFund;
        acc.othersFund += r.othersFund;
        acc.totalBill += r.totalBill;
        acc.paidBill += r.paidBill;
        acc.advance += r.advance;
        acc.remainingDue += r.remainingDue;
        return acc;
      },
      { previousDue: 0, previousAdvance: 0, canteenBill: 0, unitFund: 0, othersFund: 0, totalBill: 0, paidBill: 0, advance: 0, remainingDue: 0 }
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

  const handleShareToWhatsApp = async () => {
    const element = document.getElementById('print-canteen-bill-content');
    if (!element) return;

    setIsSharingWhatsApp(true);
    try {
      const canteenConfig = getCanteenConfig();
      const managerName = canteenConfig?.managerName || 'LAC Nishad';
      
      // 1. Build the Multiple / Group message text
      const shareMessage = buildWhatsAppMultipleBillMessage({
        monthKey: activeMonth,
        managerName
      });

      // 2. High-resolution canvas capture of the bill table container (scale 2 for crisp retina text)
      let blob: Blob | null = null;

      // Determine required full dimensions so all columns are rendered completely without clipping or excess blank space
      const tableEl = element.querySelector('table');
      const tableContentWidth = tableEl
        ? Math.ceil(Math.max(tableEl.scrollWidth, tableEl.offsetWidth, tableEl.getBoundingClientRect().width))
        : Math.ceil(element.scrollWidth);

      // Clean 20px padding on left & right (no arbitrary 1200 or 960 width)
      const capturePaddingX = 20;
      const targetWidth = Math.ceil(tableContentWidth + capturePaddingX * 2);
      const targetHeight = Math.ceil(element.scrollHeight || element.offsetHeight);

      // Helper to trim excess white space from right side of canvas
      const trimCanvasRight = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        try {
          const ctx = sourceCanvas.getContext('2d');
          if (!ctx) return sourceCanvas;
          const w = sourceCanvas.width;
          const h = sourceCanvas.height;
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          let rightmostX = 0;
          for (let x = w - 1; x >= 0; x--) {
            let colHasContent = false;
            for (let y = 0; y < h; y += 2) {
              const idx = (y * w + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];
              if (a > 30 && (r < 248 || g < 248 || b < 248)) {
                colHasContent = true;
                rightmostX = x;
                break;
              }
            }
            if (colHasContent) break;
          }

          if (rightmostX > 50) {
            const scaleFactor = w > 1000 ? 2 : 1;
            const rightPad = capturePaddingX * scaleFactor;
            const newW = Math.min(w, rightmostX + rightPad);
            if (newW < w - 10) {
              const trimmed = document.createElement('canvas');
              trimmed.width = newW;
              trimmed.height = h;
              const tCtx = trimmed.getContext('2d');
              if (tCtx) {
                tCtx.fillStyle = '#ffffff';
                tCtx.fillRect(0, 0, newW, h);
                tCtx.drawImage(sourceCanvas, 0, 0, newW, h, 0, 0, newW, h);
                return trimmed;
              }
            }
          }
        } catch (trimErr) {
          console.warn('Right whitespace trim note:', trimErr);
        }
        return sourceCanvas;
      };

      // Method A: html-to-image toCanvas (Crisp retina, native rendering, then trim right margin)
      try {
        const rawCanvas = await htmlToImageToCanvas(element, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true,
          fontEmbedCSS: '',
          cacheBust: true,
          width: targetWidth,
          height: targetHeight,
          style: {
            width: `${targetWidth}px`,
            minWidth: `${targetWidth}px`,
            maxWidth: `${targetWidth}px`,
            paddingLeft: `${capturePaddingX}px`,
            paddingRight: `${capturePaddingX}px`,
            boxSizing: 'border-box',
            margin: '0',
            transform: 'none',
            boxShadow: 'none',
          },
          filter: (node) => {
            if (node instanceof HTMLElement && (node.classList.contains('print:hidden') || node.classList.contains('no-print'))) {
              return false;
            }
            return true;
          }
        });

        if (rawCanvas) {
          const finalCanvas = trimCanvasRight(rawCanvas);
          blob = await new Promise<Blob | null>((resolve) => finalCanvas.toBlob(resolve, 'image/png'));
        }
      } catch (imgErr) {
        console.warn('html-to-image capture attempt failed, trying fallback:', imgErr);
      }

      // Method B Fallback: html2canvas with bulletproof oklch sanitizer proxy
      if (!blob) {
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = 1;
        colorCanvas.height = 1;
        const colorCtx = colorCanvas.getContext('2d');
        const convertOklch = (str: string): string => {
          if (!str || typeof str !== 'string' || !str.includes('oklch')) return str;
          return str.replace(/oklch\([^)]+\)/gi, (match) => {
            if (!colorCtx) return '#000000';
            try {
              colorCtx.fillStyle = '#000000';
              colorCtx.fillStyle = match;
              return colorCtx.fillStyle || '#000000';
            } catch {
              return '#000000';
            }
          });
        };

        const createStyleProxy = (style: CSSStyleDeclaration) => {
          return new Proxy(style, {
            get(target, prop) {
              if (prop === 'getPropertyValue') {
                return (name: string) => {
                  const val = target.getPropertyValue(name);
                  return convertOklch(val);
                };
              }
              const val = (target as any)[prop];
              if (typeof val === 'function') {
                return val.bind(target);
              }
              if (typeof val === 'string' && val.includes('oklch')) {
                return convertOklch(val);
              }
              return val;
            }
          });
        };

        const originalGetComputedStyle = window.getComputedStyle;
        try {
          window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
            const s = originalGetComputedStyle.call(window, elt, pseudoElt);
            return createStyleProxy(s);
          };

          const rawCanvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            width: targetWidth,
            windowWidth: targetWidth,
            onclone: (clonedDoc) => {
              const clonedTarget = clonedDoc.getElementById('print-canteen-bill-content');
              if (clonedTarget) {
                clonedTarget.style.width = `${targetWidth}px`;
                clonedTarget.style.minWidth = `${targetWidth}px`;
                clonedTarget.style.maxWidth = `${targetWidth}px`;
                clonedTarget.style.paddingLeft = `${capturePaddingX}px`;
                clonedTarget.style.paddingRight = `${capturePaddingX}px`;
                clonedTarget.style.boxSizing = 'border-box';
                clonedTarget.style.margin = '0';
              }
              const clonedTable = clonedTarget ? clonedTarget.querySelector('table') : null;
              if (clonedTable) {
                clonedTable.style.width = '100%';
                clonedTable.style.minWidth = '100%';
                clonedTable.style.maxWidth = '100%';
                clonedTable.style.margin = '0 auto';
              }
              if (clonedDoc.defaultView) {
                const clonedOrig = clonedDoc.defaultView.getComputedStyle;
                clonedDoc.defaultView.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
                  const s = clonedOrig.call(clonedDoc.defaultView, elt, pseudoElt);
                  return createStyleProxy(s);
                };
              }
              // Convert any inline and style tag occurrences
              clonedDoc.querySelectorAll('style').forEach((styleTag) => {
                if (styleTag.textContent && styleTag.textContent.includes('oklch')) {
                  styleTag.textContent = convertOklch(styleTag.textContent);
                }
              });
              clonedDoc.querySelectorAll<HTMLElement>('*').forEach((el) => {
                if (el.style) {
                  if (el.style.color && el.style.color.includes('oklch')) el.style.color = convertOklch(el.style.color);
                  if (el.style.backgroundColor && el.style.backgroundColor.includes('oklch')) el.style.backgroundColor = convertOklch(el.style.backgroundColor);
                  if (el.style.borderColor && el.style.borderColor.includes('oklch')) el.style.borderColor = convertOklch(el.style.borderColor);
                }
              });
            }
          });
          const finalCanvas = trimCanvasRight(rawCanvas);
          blob = await new Promise<Blob | null>((resolve) => finalCanvas.toBlob(resolve, 'image/png'));
        } finally {
          window.getComputedStyle = originalGetComputedStyle;
        }
      }

      if (!blob) throw new Error('Could not generate image blob');

      const cleanMonth = titleMonthBn.replace(/\s+/g, '_');
      const roleSuffix = roleFilter === 'OFFICER' ? '_অফিসার' : roleFilter === 'AIRMEN' ? '_বিমানসেনা' : roleFilter === 'CIVILIAN' ? '_সিভিলিয়ান' : '';
      const dueSuffix = dueFilter === 'DUE' ? '_বকেয়া' : '';
      const fileName = `ক্যান্টিন_বিল_${cleanMonth}${roleSuffix}${dueSuffix}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // 3. If Web Share API supports file sharing (Mobile Android / iOS / APK):
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `ক্যান্টিন বিল - ${titleMonthBn}`,
            text: shareMessage
          });
          setWhatsAppShareSuccess('✅ হোয়াটসঅ্যাপে বিলের ছবি ও মেসেজ শেয়ার করা হয়েছে!');
          setTimeout(() => setWhatsAppShareSuccess(null), 5000);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return; // User closed dialog
          console.warn('Navigator share error, falling back:', err);
        }
      }

      // 4. Fallback for Desktop PC or browsers where navigator.canShare({ files }) is not available:
      // Download the generated image & copy text & open WhatsApp
      saveAs(blob, fileName);
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(shareMessage);
        } catch {}
      }

      // Open WhatsApp with pre-filled message
      try {
        const waLink = document.createElement('a');
        waLink.href = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
        waLink.target = '_blank';
        waLink.rel = 'noopener noreferrer';
        document.body.appendChild(waLink);
        waLink.click();
        document.body.removeChild(waLink);
      } catch (openErr) {
        console.warn('Could not open WhatsApp window:', openErr);
      }
      setWhatsAppShareSuccess('✅ বিলের ছবি ডাউনলোড হয়েছে এবং মেসেজ কপি হয়েছে! হোয়াটসঅ্যাপে ছবি ও মেসেজ পেস্ট করে পাঠান।');
      setTimeout(() => setWhatsAppShareSuccess(null), 7000);

    } catch (err: any) {
      console.error('WhatsApp share error:', err);
      setWhatsAppShareSuccess('❌ ছবি তৈরি করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
      setTimeout(() => setWhatsAppShareSuccess(null), 7000);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="canteen-bill-modal-portal fixed inset-0 z-[100] flex flex-col bg-slate-950 print:bg-white text-black">
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

          {/* WhatsApp Share Button */}
          <button
            type="button"
            onClick={handleShareToWhatsApp}
            disabled={isSharingWhatsApp}
            className="flex items-center justify-center space-x-1.5 px-3.5 sm:px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl font-black text-xs transition-all shadow-md shadow-[#25D366]/30 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
            title="ছবি সহ হোয়াটসঅ্যাপে পাঠান (Share Bill Preview with Image on WhatsApp)"
          >
            {isSharingWhatsApp ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <WhatsAppIcon className="w-4 h-4 text-white" />
            )}
            <span className="text-center whitespace-nowrap">WHATSAPP (ছবি সহ শেয়ার)</span>
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

      {/* WhatsApp Share Success Toast Alert */}
      {whatsAppShareSuccess && (
        <div className="bg-emerald-950/95 border-b border-emerald-500/40 text-emerald-200 px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-fadeIn shrink-0 print:hidden shadow-md">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{whatsAppShareSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setWhatsAppShareSuccess(null)}
            className="text-emerald-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}


      {/* Printable Content Area */}
      <div className="canteen-bill-print-area flex-1 overflow-auto print:overflow-visible bg-slate-950 print:bg-white p-2 sm:p-6 print:p-0 flex flex-col items-center justify-start print:block">
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

            .sutonny-font, .sutonny-font * {
              font-family: 'SuttonyMJ', 'SutonnyMJ', 'SutonnyOMJ', 'Sutonny MJ', 'Noto Serif Bengali', 'Tiro Bangla', 'SolaimanLipi', 'Kalpurush', serif !important;
            }
          `}
        </style>

        {/* Paper Container: Real A4 Dimensions ensure all columns are visible and never clipped */}
        <div
          id="print-canteen-bill-content"
          className={`sutonny-font mx-auto h-fit shrink-0 bg-white text-black print:shadow-none print:border-none border border-slate-300 shadow-2xl p-3 sm:p-6 print:p-0 print:m-0 transition-all ${
            orientation === 'landscape'
              ? 'w-[297mm] min-w-[297mm] print:w-full print:min-w-0'
              : 'w-[210mm] min-w-[210mm] print:w-full print:min-w-0'
          }`}
        >
          <div className="w-full">
            {/* Header: Exact 3-line format requested */}
            <div className="text-center mb-4 space-y-0.5">
              <h1 className="text-base sm:text-lg font-bold text-black tracking-wide">
                {roleFilter === 'OFFICER'
                  ? 'ক্যান্টিন বিলঃ অফিসার'
                  : roleFilter === 'AIRMEN'
                  ? 'ক্যান্টিন বিলঃ বিমানসেনা'
                  : roleFilter === 'CIVILIAN'
                  ? 'ক্যান্টিন বিলঃ সিভিলিয়ান'
                  : 'ক্যান্টিন বিলঃ অফিসার/বিমানসেনা/সিভিলিয়ান'
                }
              </h1>
              <h2 className="text-sm sm:text-base font-bold text-black">
                {unitName}
              </h2>
              <h3 className="text-xs sm:text-sm font-bold text-black">
                মাসঃ {currMonthBn}
              </h3>
            </div>

            {/* Official Table: All Heading cells are Center Aligned, Dynamic Auto-Hide of empty columns */}
            <div className="w-full overflow-x-visible print:overflow-visible">
              <table
                className="w-full border-collapse border border-black text-[11px] font-normal"
                style={{ pageBreakInside: 'auto', tableLayout: 'auto' }}
              >
                <thead
                  className="bg-slate-200 print:bg-slate-200 text-black font-bold"
                  style={{ backgroundColor: '#e2e8f0', color: '#000000', display: 'table-header-group' }}
                >
                  <tr className="border border-black font-bold text-center">
                    <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-9">
                      ক্রমিক<br />নং
                    </th>
                    <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-16">
                      পদবী
                    </th>
                    <th className="p-1.5 border border-black font-bold text-center align-middle min-w-[110px] w-auto">
                      নাম
                    </th>
                    {showColPreviousDue && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        বকেয়া বিল<br /><span className="text-[10px] font-normal">({prevMonthBn})</span>
                      </th>
                    )}
                    {showColPreviousAdvance && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        অগ্রীম বিল<br /><span className="text-[10px] font-normal">({prevMonthBn})</span>
                      </th>
                    )}
                    {showColCanteenBill && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        ক্যান্টিন বিল<br /><span className="text-[10px] font-normal">({currMonthBn})</span>
                      </th>
                    )}
                    {showColUnitFund && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        ইউনিট ফান্ড
                      </th>
                    )}
                    {showColOthersFund && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        অন্যান্য
                      </th>
                    )}
                    {showColTotalBill && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        সর্বমোট<br />বিল
                      </th>
                    )}
                    {showColPaidBill && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        পরিশোধিত<br />বিল
                      </th>
                    )}
                    {showColAdvance && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-14">
                        অগ্রিম
                      </th>
                    )}
                    {showColRemainingDue && (
                      <th className="p-1.5 border border-black font-bold text-center align-middle whitespace-nowrap w-20">
                        বকেয়া
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="font-normal text-black" style={{ color: '#000000' }}>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumnsCount} className="p-8 text-center font-normal border border-black" style={{ color: '#334155' }}>
                        {dueFilter === 'DUE' ? 'এই মাসে কোনো বকেয়া নেই (No Due Members Found)' : 'কোনো সদস্যের রেকর্ড পাওয়া যায়নি'}
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row, index) => {
                      const isEven = index % 2 === 0;
                      const rowBg = isEven ? '#ffffff' : '#f1f5f9';
                      return (
                        <tr
                          key={row.ser}
                          className={`border border-black font-normal ${isEven ? 'bg-white' : 'bg-slate-100'}`}
                          style={{ backgroundColor: rowBg, color: '#000000' }}
                        >
                          <td className="py-1 px-1 border border-black font-normal text-center align-middle text-[11px] whitespace-nowrap">{row.serBn}</td>
                          <td className="py-1 px-1.5 border border-black font-normal text-center align-middle text-[11px] whitespace-nowrap">{row.rank}</td>
                          <td className="py-1 px-2 border border-black font-normal text-left align-middle text-[11px] font-medium">{row.name}</td>
                          {showColPreviousDue && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap">
                              {formatAmountBn(row.previousDue)}
                            </td>
                          )}
                          {showColPreviousAdvance && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap">
                              {formatAmountBn(row.previousAdvance)}
                            </td>
                          )}
                          {showColCanteenBill && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap">
                              {formatAmountBn(row.canteenBill)}
                            </td>
                          )}
                          {showColUnitFund && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap">
                              {formatAmountBn(row.unitFund)}
                            </td>
                          )}
                          {showColOthersFund && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap">
                              {formatAmountBn(row.othersFund)}
                            </td>
                          )}
                          {showColTotalBill && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap font-medium">
                              {formatAmountBn(row.totalBill)}
                            </td>
                          )}
                          {showColPaidBill && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap" style={{ color: '#047857' }}>
                              {formatAmountBn(row.paidBill)}
                            </td>
                          )}
                          {showColAdvance && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap" style={{ color: '#3730a3' }}>
                              {formatAmountBn(row.advance)}
                            </td>
                          )}
                          {showColRemainingDue && (
                            <td className="py-1 px-1.5 border border-black font-normal text-right align-middle text-[11px] whitespace-nowrap font-semibold" style={{ color: '#be123c' }}>
                              {formatAmountBn(row.remainingDue)}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}

                  {/* Summary Row - Strictly Normal Font */}
                  <tr className="font-bold border border-black" style={{ backgroundColor: '#e2e8f0' }}>
                    <td colSpan={3} className="py-1.5 px-2 border border-black text-center font-bold align-middle text-[11px]">
                      সর্বমোট
                    </td>
                    {showColPreviousDue && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap">
                        {formatAmountBn(totals.previousDue, true)}
                      </td>
                    )}
                    {showColPreviousAdvance && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap">
                        {formatAmountBn(totals.previousAdvance, true)}
                      </td>
                    )}
                    {showColCanteenBill && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap">
                        {formatAmountBn(totals.canteenBill, true)}
                      </td>
                    )}
                    {showColUnitFund && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap">
                        {formatAmountBn(totals.unitFund, true)}
                      </td>
                    )}
                    {showColOthersFund && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap">
                        {formatAmountBn(totals.othersFund, true)}
                      </td>
                    )}
                    {showColTotalBill && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap">
                        {formatAmountBn(totals.totalBill, true)}
                      </td>
                    )}
                    {showColPaidBill && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap" style={{ color: '#047857' }}>
                        {formatAmountBn(totals.paidBill, true)}
                      </td>
                    )}
                    {showColAdvance && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap" style={{ color: '#3730a3' }}>
                        {formatAmountBn(totals.advance, true)}
                      </td>
                    )}
                    {showColRemainingDue && (
                      <td className="py-1.5 px-1.5 border border-black font-bold text-right align-middle text-[11px] whitespace-nowrap" style={{ color: '#be123c' }}>
                        {formatAmountBn(totals.remainingDue, true)}
                      </td>
                    )}
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
