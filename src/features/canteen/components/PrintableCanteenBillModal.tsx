import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, FileSpreadsheet, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { BillCategory, getTxCategory, getTxMonthKey } from '../pages/MemberDB';
import { getCanteenConfig } from '../utils/canteenSettings';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';
import {
  toBengaliNum,
  formatRankBn,
  formatMemberNameBn,
  getMonthNamesBn,
  exportCanteenBillToExcel
} from '../utils/exportCanteenBillExcel';

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

  useEffect(() => {
    setInternalMonth(selectedMonth);
  }, [selectedMonth]);

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

  // Sort members strictly according to Office Nominal Roll Seniority
  const sortedMembers = useMemo(() => {
    return sortCanteenMembersByOfficeSeniority(members);
  }, [members]);

  // Compute detailed financial calculations for every member
  const rows = useMemo(() => {
    return sortedMembers.map((member, index) => {
      const memberTxs = allTxs.filter(
        (tx) => tx.airman_id === member.airman_id || (member['BD No'] && tx.bdNo === member['BD No'])
      );

      const rankFormatted = formatRankBn(member['Rank'] || member.rank || '');
      const rawName = member['Surname'] || member['Full Name'] || member['Name'] || '';
      const nameFormatted = formatMemberNameBn(rawName);

      let currentPeriodCharges = 0;
      let currentPeriodPayments = 0;
      let previousDue = 0;
      let previousAdvance = 0;

      if (activeMonth === 'ALL') {
        const memberTotalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
        const memberTotalAdvance = Number(member.Advance ?? member.advance ?? member.ogrim ?? 0);
        const charges = memberTxs
          .filter((tx) => {
            const cat = getTxCategory(tx);
            const catMatch = selectedCategory === 'ALL' || cat === selectedCategory;
            return catMatch && tx.type !== 'BILL PAYMENT';
          })
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const payments = memberTxs
          .filter((tx) => {
            const cat = getTxCategory(tx);
            const catMatch = selectedCategory === 'ALL' || cat === selectedCategory;
            return catMatch && tx.type === 'BILL PAYMENT';
          })
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        currentPeriodCharges = Math.max(memberTotalDue, charges - payments);
        currentPeriodPayments = payments;
        previousDue = 0;
        previousAdvance = memberTotalAdvance;
      } else {
        // Specific Month
        const currentMonthTxs = memberTxs.filter((tx) => {
          const cat = getTxCategory(tx);
          const catMatch = selectedCategory === 'ALL' || cat === selectedCategory;
          const txMonth = getTxMonthKey(tx.date);
          return catMatch && txMonth === activeMonth;
        });

        currentPeriodCharges = currentMonthTxs
          .filter((tx) => tx.type !== 'BILL PAYMENT')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        currentPeriodPayments = currentMonthTxs
          .filter((tx) => tx.type === 'BILL PAYMENT')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        // Previous dues & advances prior to this month
        const olderTxs = memberTxs.filter((tx) => {
          const cat = getTxCategory(tx);
          const catMatch = selectedCategory === 'ALL' || cat === selectedCategory;
          const txMonth = getTxMonthKey(tx.date);
          return catMatch && txMonth && txMonth < activeMonth;
        });

        const olderCharges = olderTxs
          .filter((tx) => tx.type !== 'BILL PAYMENT')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const olderPayments = olderTxs
          .filter((tx) => tx.type === 'BILL PAYMENT')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const olderNet = olderCharges - olderPayments;
        if (olderNet > 0) {
          previousDue = olderNet;
          previousAdvance = 0;
        } else if (olderNet < 0) {
          previousDue = 0;
          previousAdvance = Math.abs(olderNet);
        } else {
          const memberTotalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
          const memberTotalAdvance = Number(member.Advance ?? member.advance ?? member.ogrim ?? 0);
          const netThisMonth = Math.max(0, currentPeriodCharges - currentPeriodPayments);
          const diff = memberTotalDue - netThisMonth;
          if (diff > 0) {
            previousDue = diff;
            previousAdvance = 0;
          } else if (memberTotalAdvance > 0) {
            previousAdvance = memberTotalAdvance;
            previousDue = 0;
          } else {
            previousDue = 0;
            previousAdvance = 0;
          }
        }
      }

      const totalBill = currentPeriodCharges + previousDue;
      const paidBill = currentPeriodPayments;
      const totalCredits = previousAdvance + paidBill;

      let advance = 0;
      let remainingDue = 0;

      if (totalCredits >= totalBill) {
        advance = totalCredits - totalBill;
        remainingDue = 0;
      } else {
        remainingDue = totalBill - totalCredits;
        advance = 0;
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
  }, [sortedMembers, allTxs, selectedCategory, activeMonth]);

  // Overall totals
  const totals = useMemo(() => {
    return rows.reduce(
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
  }, [rows]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `CANTEEN_BILL_${unitName.replace(/\s+/g, '_')}_${titleMonthBn.replace(/\s+/g, '_')}`;
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 100);
  };

  const handleExportExcel = () => {
    exportCanteenBillToExcel({
      members,
      allTxs,
      selectedCategory,
      selectedMonth: activeMonth,
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/80 backdrop-blur-md print:bg-white animate-fadeIn print:block print:static print:h-auto print:overflow-visible text-black">
      {/* Top Header Controls (Hidden on Print) */}
      <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 shadow-2xl print:hidden z-10">
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
      <div className="flex-1 overflow-auto print:overflow-visible bg-slate-800/60 print:bg-white p-3 sm:p-6 print:p-0 flex justify-center print:block">
        <style type="text/css">
          {`
            @media print {
              @page { 
                size: ${orientation}; 
                margin: 5mm; 
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
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
                {categoryTitle}ঃ {unitName}
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
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-700 font-normal border border-black">
                        কোনো সদস্যের রেকর্ড পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
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
