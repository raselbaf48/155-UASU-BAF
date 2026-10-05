import XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getCanteenConfig } from './canteenSettings';
import { sortCanteenMembersByOfficeSeniority, isTxBelongingToMember } from './canteenSeniority';
import { getTxCategory, getTxMonthKey, BillCategory } from '../pages/MemberDB';

// Convert English numbers to Bengali numerals
export const toBengaliNum = (num: number | string): string => {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => bn[parseInt(d, 10)]);
};

// Map BAF military rank to Bengali official abbreviation matching the Excel template
export const formatRankBn = (rankStr?: string): string => {
  if (!rankStr) return '';
  const r = rankStr.toUpperCase().trim();

  // If already Bengali
  if (r.includes('মাঃওঃঅঃ') || r.includes('মাস্টার ওয়ারেন্ট') || r.includes('মাস্টার ওয়ারেন্ট')) return 'মাঃওঃঅঃ';
  if (r.includes('সিঃওঃঅঃ') || r.includes('সিনিয়র ওয়ারেন্ট') || r.includes('সিনিয়র ওয়ারেন্ট')) return 'সিঃওঃঅঃ';
  if (r.includes('ওঃঅঃ') || r.includes('ওয়ারেন্ট') || r.includes('ওয়ারেন্ট')) return 'ওঃঅঃ';
  if (r.includes('সার্জেন্ট') || r.includes('সার্জেণ্ট')) return 'সার্জেন্ট';
  if (r.includes('কর্পোরাল')) return 'কর্পোরাল';
  if (r.includes('এলএসি')) return 'এলএসি';
  if (r.includes('এসি')) return 'এসি';

  // Warrant Officers (JCOs)
  if (r === 'MWO' || r.includes('MASTER WARRANT')) return 'মাঃওঃঅঃ';
  if (r === 'SWO' || r.includes('SENIOR WARRANT')) return 'সিঃওঃঅঃ';
  if (r === 'WO' || r.includes('WARRANT')) return 'ওঃঅঃ';

  // Airmen NCOs & ORs
  if (r === 'SGT' || r.includes('SERGEANT')) return 'সার্জেন্ট';
  if (r === 'CPL' || r.includes('CORPORAL')) return 'কর্পোরাল';
  if (r === 'LAC' || r.includes('LEADING AIRCRAFTMAN')) return 'এলএসি';
  if (r === 'AC' || r.includes('AIRCRAFTMAN')) return 'এসি';

  // Commissioned Officers
  if (r === 'ACM' || r.includes('CHIEF MARSHAL')) return 'এয়ার চিফ মার্শাল';
  if (r === 'AM' || r === 'AIR MSHL') return 'এয়ার মার্শাল';
  if (r === 'AVM') return 'এয়ার ভাইস মার্শাল';
  if (r === 'AIR CDRE' || r.includes('COMMODORE')) return 'এয়ার কমোডর';
  if (r === 'GP CAPT' || r.includes('GROUP CAPTAIN')) return 'গ্রুপ ক্যাপ্টেন';
  if (r === 'WG CDR' || r.includes('WING COMMANDER')) return 'উইং কমাঃ';
  if (r === 'SQN LDR' || r.includes('SQUADRON LEADER')) return 'স্কোঃ লীঃ';
  if (r === 'FLT LT' || r.includes('FLIGHT LIEUTENANT')) return 'ফ্লাঃ লেঃ';
  if (r === 'FLG OFFR' || r === 'FG OFFR' || r.includes('FLYING OFFICER')) return 'ফ্লাঃ অঃ';
  if (r === 'PLT OFFR' || r.includes('PILOT OFFICER')) return 'পাইলট অফিসার';
  if (r === '-') return '-';
  if (r === 'CIV' || r.includes('CIVILIAN') || r.includes('বেসামরিক')) return 'সিভিলিয়ান';

  return rankStr;
};

// Comprehensive English to Bengali name dictionary for members
export const formatMemberNameBn = (name?: string): string => {
  if (!name) return '';
  const trimmed = name.trim();

  // If already contains Bengali characters, return as is
  if (/[\u0980-\u09FF]/.test(trimmed)) {
    return trimmed;
  }

  const nameMap: Record<string, string> = {
    'Mostafa': 'মোস্তফা',
    'Mashiur': 'মশিউর',
    'Jahid': 'জাহিদ',
    'Mojaffar': 'মোজাফফর',
    'A. Baten': 'আঃ বাতেন',
    'Baten': 'বাতেন',
    'Shahin': 'শাহীন',
    'Lutfar': 'লুৎফর',
    'Aminul': 'আমিনুল',
    'Uzzal': 'উজ্জ্বল',
    'Riaz': 'রিয়াজ',
    'Mobarak': 'মোবারক',
    'Rubel': 'রুবেল',
    'Absar': 'আবসার',
    'Mahid': 'মাহিদ',
    'Asad': 'আসাদ',
    'Fokrul': 'ফকরুল',
    'Fakrul': 'ফকরুল',
    'A. Gafur': 'আঃ গফুর',
    'Gafur': 'গফুর',
    'Mehedi': 'মেহেদী',
    'Mahedi': 'মেহেদী',
    'Mustakim': 'মুস্তাকিম',
    'Shishir': 'শিশির',
    'Sojib': 'সজীব',
    'Sajib': 'সজীব',
    'Shohel': 'সোহেল',
    'Ripon': 'রিপন',
    'Imran': 'ইমরান',
    'Omar': 'ওমর',
    'Nahid': 'নাহিদ',
    'Rakib': 'রাকিব',
    'Akash': 'আকাশ',
    'Saidul': 'সাইদুল',
    'Nishad': 'নিশাদ',
    'Zakirul': 'জাকিরুল',
    'Ahasan': 'আহসান',
    'Koraishi': 'কোরাইশী',
    'Maraz': 'মারাজ',
    'Joy': 'জয়',
    'Shariful': 'শরিফুল',
    'Rasel': 'রাসেল',
    'Ismail': 'ইসমাইল',
    'Tusar': 'তুষার',
    'Harun': 'হারুন',
    'Hridoy': 'হৃদয়',
    'Zubayer': 'জুবায়ের',
    'Ashraful': 'আশরাফুল',
    'Rashed': 'রাশেদ',
    'Adnan': 'আদনান',
    'Tanvir': 'তানভীর',
    'Akramul': 'আকরামুল',
    'Nur Nabi': 'নূর নবী',
    'A. Rahman': 'আঃ রহমান',
    'Rahman': 'রহমান',
    'Khairul': 'খাইরুল',
    'Kamrul': 'কামরুল',
    'Kabir': 'কবির',
    'Sojol': 'সজল',
    'Sajal': 'সজল',
    'Amjad': 'আমজাদ',
    'Monir': 'মনির',
    'Habib': 'হাবিব',
    'Saiful': 'সাইফুল',
    'Tareq': 'তারেক',
    'Al Amin': 'আল আমিন',
    'Arif': 'আরিফ',
    'Fahim': 'ফাহিম',
    'Sumon': 'সুমন',
    'Masud': 'মাসুদ',
    'Shamim': 'শামীম',
    'Sabbir': 'সাব্বির',
    'Shakil': 'শাকিল',
    'Mahfuz': 'মাহফুজ',
    'Sharif': 'শরীফ',
    'Selim': 'সেলিম',
    'Sultan': 'সুলতান',
    'Shohana': 'সোহানা',
    'Sonia': 'সোনিয়া',
    'Mizan': 'মিজান',
    'Musabbir': 'মুসাব্বির',
    'Ashik': 'আশিক',
    'Nur Nobi': 'নূর নবী',
    'Irfan': 'ইরফান',
    'Unit Guest': 'ইউনিট গেস্ট',
    'Guest': 'গেস্ট'
  };

  // Direct case-insensitive lookup
  const lower = trimmed.toLowerCase();
  for (const [enKey, bnVal] of Object.entries(nameMap)) {
    if (enKey.toLowerCase() === lower) {
      return bnVal;
    }
  }

  // Compound name lookup (e.g., 'Md. Mostafa', 'A. Baten')
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    const translatedWords = words.map(w => {
      const wClean = w.replace(/[.,]/g, '');
      const wLower = wClean.toLowerCase();
      if (wLower === 'md' || wLower === 'mohammed') return 'মোঃ';
      if (wLower === 'a') return 'আঃ';
      for (const [enKey, bnVal] of Object.entries(nameMap)) {
        if (enKey.toLowerCase() === wLower) return bnVal;
      }
      return w;
    });
    return translatedWords.join(' ');
  }

  return trimmed;
};

// Bengali month names and formatting
export const getMonthNamesBn = (monthKey: string): { currMonthBn: string; prevMonthBn: string; titleMonthBn: string } => {
  const bnMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  if (!monthKey || monthKey === 'ALL') {
    const now = new Date();
    const currM = bnMonths[now.getMonth()];
    const prevM = bnMonths[(now.getMonth() - 1 + 12) % 12];
    const yearShort = String(now.getFullYear()).slice(-2);
    const yearBn = toBengaliNum(yearShort);
    return {
      currMonthBn: currM,
      prevMonthBn: prevM,
      titleMonthBn: `সকল মাস (${currM} ${yearBn})`
    };
  }

  const parts = monthKey.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1-12
  const currM = bnMonths[month - 1];
  const prevM = bnMonths[(month - 2 + 12) % 12];
  const yearShort = String(year).slice(-2);
  const yearBn = toBengaliNum(yearShort);

  return {
    currMonthBn: currM,
    prevMonthBn: prevM,
    titleMonthBn: `${currM} ${yearBn}`
  };
};

export const formatBengaliMonthYear = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') return 'সকল মাস';
  const parts = String(monthKey).split('-');
  if (parts.length < 2) return monthKey;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const bnMonths = [
    '', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const mName = bnMonths[month] || parts[1];
  const yBn = toBengaliNum(year);
  return `${mName} ${yBn}`;
};

// Helper to determine if a transaction is a valid non-reverted payment
export const isPaymentTx = (tx: any): boolean => {
  if (!tx) return false;
  const isPay = tx.type === 'BILL PAYMENT' || tx.type === 'PAYMENT';
  if (!isPay) return false;
  if (tx.isReverted || tx.status === 'REVERTED') return false;
  if (String(tx.items || '').includes('[বাতিল / REVERTED]')) return false;
  return true;
};

/**
 * Resolves the billing month key for a PAYMENT transaction according to the 25th-to-24th billing cycle:
 * - Payments made between 25th of month M and 24th of month M+1 count as payments for month M.
 *   Example: 25 Sep to 24 Oct -> "2026-09"
 *            25 Oct to 24 Nov -> "2026-10"
 *            25 Nov to 24 Dec -> "2026-11"
 *            25 Dec to 24 Jan -> "2026-12"
 */
export const getPaymentCycleMonthKey = (dateVal: any): string => {
  if (!dateVal) return '';

  let year: number | null = null;
  let month: number | null = null; // 1-12
  let day: number | null = null; // 1-31

  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) {
      year = dateVal.getFullYear();
      month = dateVal.getMonth() + 1;
      day = dateVal.getDate();
    }
  } else if (typeof dateVal === 'number' || (/^\d{10,13}$/).test(String(dateVal).trim())) {
    const d = new Date(Number(dateVal));
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
  } else {
    let str = String(dateVal).trim();
    if (!str || str === '-') return '';

    // Bengali numerals conversion
    const bnDigits: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    str = str.replace(/[০-৯]/g, (ch) => bnDigits[ch] || ch);

    // 1. ISO format or YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (ymdMatch) {
      year = parseInt(ymdMatch[1], 10);
      month = parseInt(ymdMatch[2], 10);
      day = parseInt(ymdMatch[3], 10);
    } else {
      // 2. Format DD-MM-YYYY or DD/MM/YYYY
      const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (dmyMatch) {
        day = parseInt(dmyMatch[1], 10);
        month = parseInt(dmyMatch[2], 10);
        year = parseInt(dmyMatch[3], 10);
      } else {
        // 3. Format "DD Mon YY" or "DD Mon YYYY" (e.g. "02 Oct 26", "28-Sep-2026", "Mon, 05 Oct 2026")
        const MONTH_MAP: Record<string, number> = {
          jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
          jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
        };
        const dmyAlphaMatch = str.match(/(?:^|[,\s])(\d{1,2})[\s\-\/\.]+([A-Za-z]{3,9})[\s\-\/\.]+(\d{2,4})/);
        if (dmyAlphaMatch) {
          day = parseInt(dmyAlphaMatch[1], 10);
          const monStr = dmyAlphaMatch[2].slice(0, 3).toLowerCase();
          month = MONTH_MAP[monStr] || null;
          let yr = parseInt(dmyAlphaMatch[3], 10);
          if (yr < 100) yr += 2000;
          year = yr;
        } else {
          // 4. Bengali month names e.g. "০২ অক্টোবর ২০২৬" or "25 সেপ্টেম্বর 26"
          const BN_MONTH_MAP: Record<string, number> = {
            'জানু': 1, 'ফেব্রু': 2, 'মার্চ': 3, 'এপ্রি': 4, 'মে': 5, 'জুন': 6,
            'জুলাই': 7, 'আগস্ট': 8, 'সেপ্টে': 9, 'অক্টো': 10, 'নভে': 11, 'ডিসে': 12
          };
          const bnMatch = str.match(/^(\d{1,2})[\s\-\/\.]+([^\d\s\-\/\.]+)/);
          if (bnMatch) {
            day = parseInt(bnMatch[1], 10);
            const rawMon = bnMatch[2].trim();
            for (const [k, v] of Object.entries(BN_MONTH_MAP)) {
              if (rawMon.includes(k)) {
                month = v;
                break;
              }
            }
            const yrMatch = str.match(/\d{2,4}$/);
            if (yrMatch) {
              let yr = parseInt(yrMatch[0], 10);
              if (yr < 100) yr += 2000;
              year = yr;
            }
          } else {
            // 5. Try native Date parsing
            const parsed = new Date(str);
            if (!isNaN(parsed.getTime())) {
              year = parsed.getFullYear();
              month = parsed.getMonth() + 1;
              day = parsed.getDate();
            }
          }
        }
      }
    }
  }

  if (year && month && day) {
    if (day >= 25) {
      return `${year}-${String(month).padStart(2, '0')}`;
    } else {
      let prevM = month - 1;
      let prevY = year;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      return `${prevY}-${String(prevM).padStart(2, '0')}`;
    }
  }

  return getTxMonthKey(dateVal);
};

export interface ExportCanteenBillParams {
  members: any[];
  allTxs: any[];
  selectedCategory: BillCategory;
  selectedMonth: string;
  filterLabel?: string;
  dueOnly?: boolean;
  getBanglaName?: (m: any) => string;
  getBanglaRank?: (m: any) => string;
}

export async function exportCanteenBillToExcel({
  members,
  allTxs,
  selectedCategory,
  selectedMonth,
  filterLabel,
  dueOnly,
  getBanglaName,
  getBanglaRank,
}: ExportCanteenBillParams) {
  const cfg = getCanteenConfig();
  const unitName = '১৫৫ ইউএএসইউ বিএএফ';
  const { currMonthBn, prevMonthBn, titleMonthBn } = getMonthNamesBn(selectedMonth);

  // 1. Sort members strictly according to Office Nominal Roll Seniority
  const sortedMembers = sortCanteenMembersByOfficeSeniority(members);

  // Common Border Style for official gridlines
  const cellBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  // Header Titles
  const categoryTitle = selectedCategory === 'CANTEEN'
    ? 'ক্যান্টিন বিল'
    : selectedCategory === 'UNIT_FUND'
    ? 'ইউনিট ফান্ড বিল'
    : selectedCategory === 'OTHERS'
    ? 'অন্যান্য বিল'
    : 'ক্যান্টিন বিল';

  // 2. Prepare worksheet AOA (Array of Arrays)
  const aoa: any[][] = [];

  // Row 1: Empty padding row
  aoa.push([]);

  // Row 2: Title "ক্যান্টিন বিলঃ ১৫৫ ইউএএসইউ বিএএফ"
  aoa.push(['', '', '', `${categoryTitle}ঃ ${unitName}`]);

  // Row 3: Subtitle with group filter and due filter if specified ('বিমানসেনা' and 'বকেয়া বিল' are hidden as requested)
  const filterTitleBn = filterLabel === 'OFFICER' 
    ? ' (অফিসার)' 
    : filterLabel === 'CIVILIAN' 
    ? ' (সিভিলিয়ান)' 
    : '';
  aoa.push(['', '', '', `মাসঃ ${titleMonthBn}${filterTitleBn}`]);

  // Row 4: Empty separator
  aoa.push([]);

  // Row 5: Exact 12 Table Column Headers
  const headers = [
    'ক্রমিক\nনং',
    'পদবী',
    'নাম',
    `বকেয়া বিল\n(${prevMonthBn})`,
    `অগ্রীম বিল\n(${prevMonthBn})`,
    `ক্যান্টিন বিল\n(${currMonthBn})`,
    'ইউনিট ফান্ড',
    'অন্যান্য',
    'সর্বমোট\nবিল',
    'পরিশোধিত\nবিল',
    'অগ্রিম',
    'বকেয়া'
  ];
  aoa.push(headers);

  // Totals accumulators
  let sumPreviousDue = 0;
  let sumPreviousAdvance = 0;
  let sumCanteenBill = 0;
  let sumUnitFund = 0;
  let sumOthersFund = 0;
  let sumTotalBill = 0;
  let sumPaidBill = 0;
  let sumAdvance = 0;
  let sumRemainingDue = 0;

  let serialCounter = 0;

  const isCategoryMatch = (tx: any, cat: BillCategory): boolean => {
    if (cat === 'ALL') return true;
    if (isPaymentTx(tx)) {
      return tx.billType === 'ALL' || tx.billType === cat || !tx.billType;
    }
    return getTxCategory(tx) === cat;
  };

  const getMonthKeyOfTx = (tx: any): string => {
    if (isPaymentTx(tx)) {
      return getPaymentCycleMonthKey(tx.date || tx.timestamp || tx.created_at);
    }
    return tx.monthKey || getTxMonthKey(tx.date) || '';
  };

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

  // 3. Process each member row
  sortedMembers.forEach((member, index) => {
    const memberTxs = allTxs.filter((tx) => isTxBelongingToMember(member, tx));
    const memberCategoryTxs = memberTxs.filter((tx) => isCategoryMatch(tx, selectedCategory));

    const rankFormatted = (getBanglaRank ? getBanglaRank(member) : null) || formatRankBn(member['Rank'] || member.rank || '');
    const rawName = member['Surname'] || member['Full Name'] || member['Name'] || '';
    const nameFormatted = (getBanglaName ? getBanglaName(member) : null) || formatMemberNameBn(rawName) || rawName;

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

    if (selectedMonth === 'ALL') {
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
      // Specific Month Selected (e.g. '2026-09', '2026-07', '2026-10')

      // 1. Prior Period: strictly transactions dated prior to this month
      const priorTxs = memberCategoryTxs.filter((tx) => {
        const m = getMonthKeyOfTx(tx);
        return m && m < selectedMonth;
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

      // 2. Current Month Charges: transactions belonging specifically to selectedMonth
      const currentMonthTxs = memberCategoryTxs.filter((tx) => getMonthKeyOfTx(tx) === selectedMonth);
      const canteenTxs = currentMonthTxs.filter((tx) => getTxCategory(tx) === 'CANTEEN');
      const unitFundTxs = currentMonthTxs.filter((tx) => getTxCategory(tx) === 'UNIT_FUND');
      const othersFundTxs = currentMonthTxs.filter((tx) => getTxCategory(tx) === 'OTHERS');
      
      const canteenBill = computeEffectiveCharges(canteenTxs);
      const unitFund = computeEffectiveCharges(unitFundTxs);
      const othersFund = computeEffectiveCharges(othersFundTxs);
      currentPeriodCharges = canteenBill + unitFund + othersFund;

      totalBill = previousDue + currentPeriodCharges;

      // 3. Current Month Payments: payments that belong to selectedMonth's payment cycle (25th of month to 24th of next month)
      const currentMonthPayments = memberCategoryTxs
        .filter((tx) => isPaymentTx(tx) && getMonthKeyOfTx(tx) === selectedMonth)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      paidBill = currentMonthPayments;
      currentPeriodPayments = paidBill;

      const totalCredits = previousAdvance + paidBill;
      if (totalCredits >= totalBill) {
        advance = totalCredits - totalBill;
        remainingDue = 0;
      } else {
        const rawDue = totalBill - totalCredits;
        remainingDue = memberTotalDue === 0 ? 0 : Math.min(rawDue, memberTotalDue);
        advance = 0;
      }
    }

    // If dueOnly filter is active, skip members with zero remaining due
    if (dueOnly && remainingDue <= 0) {
      return;
    }

    serialCounter += 1;

    // Accumulate sums
    sumPreviousDue += previousDue;
    sumPreviousAdvance += previousAdvance;
    sumCanteenBill += (selectedMonth === 'ALL' ? currentPeriodCharges : computeEffectiveCharges(memberCategoryTxs.filter(tx => getMonthKeyOfTx(tx) === selectedMonth && getTxCategory(tx) === 'CANTEEN')));
    sumUnitFund += computeEffectiveCharges(memberCategoryTxs.filter(tx => (selectedMonth === 'ALL' || getMonthKeyOfTx(tx) === selectedMonth) && getTxCategory(tx) === 'UNIT_FUND'));
    sumOthersFund += computeEffectiveCharges(memberCategoryTxs.filter(tx => (selectedMonth === 'ALL' || getMonthKeyOfTx(tx) === selectedMonth) && getTxCategory(tx) === 'OTHERS'));
    sumTotalBill += totalBill;
    sumPaidBill += paidBill;
    sumAdvance += advance;
    sumRemainingDue += remainingDue;

    const rowCanteenBill = selectedMonth === 'ALL'
      ? computeEffectiveCharges(memberCategoryTxs.filter((tx) => getTxCategory(tx) === 'CANTEEN'))
      : computeEffectiveCharges(memberCategoryTxs.filter((tx) => getMonthKeyOfTx(tx) === selectedMonth && getTxCategory(tx) === 'CANTEEN'));
    const rowUnitFund = selectedMonth === 'ALL'
      ? computeEffectiveCharges(memberCategoryTxs.filter((tx) => getTxCategory(tx) === 'UNIT_FUND'))
      : computeEffectiveCharges(memberCategoryTxs.filter((tx) => getMonthKeyOfTx(tx) === selectedMonth && getTxCategory(tx) === 'UNIT_FUND'));
    const rowOthersFund = selectedMonth === 'ALL'
      ? computeEffectiveCharges(memberCategoryTxs.filter((tx) => getTxCategory(tx) === 'OTHERS'))
      : computeEffectiveCharges(memberCategoryTxs.filter((tx) => getMonthKeyOfTx(tx) === selectedMonth && getTxCategory(tx) === 'OTHERS'));

    aoa.push([
      toBengaliNum(serialCounter),                          // ক্রমিক নং
      rankFormatted,                                        // পদবী
      nameFormatted,                                        // নাম (বাংলায়)
      previousDue > 0 ? previousDue : '',                   // বকেয়া বিল (আগের মাস)
      previousAdvance > 0 ? previousAdvance : '',           // অগ্রীম বিল (আগের মাস)
      rowCanteenBill > 0 ? rowCanteenBill : '',             // ক্যান্টিন বিল (এই মাস)
      rowUnitFund > 0 ? rowUnitFund : '',                   // ইউনিট ফান্ড
      rowOthersFund > 0 ? rowOthersFund : '',               // অন্যান্য
      totalBill > 0 ? totalBill : '',                       // সর্বমোট বিল
      paidBill > 0 ? paidBill : '',                         // পরিশোধিত বিল
      advance > 0 ? advance : '',                           // অগ্রিম
      remainingDue > 0 ? remainingDue : '',                 // বকেয়া
    ]);
  });

  // 4. Append Total Summary Row (for 12 columns)
  aoa.push([
    'সর্বমোট',
    '',
    '',
    sumPreviousDue > 0 ? sumPreviousDue : '',
    sumPreviousAdvance > 0 ? sumPreviousAdvance : '',
    sumCanteenBill > 0 ? sumCanteenBill : '',
    sumUnitFund > 0 ? sumUnitFund : '',
    sumOthersFund > 0 ? sumOthersFund : '',
    sumTotalBill > 0 ? sumTotalBill : '',
    sumPaidBill > 0 ? sumPaidBill : '',
    sumAdvance > 0 ? sumAdvance : '',
    sumRemainingDue > 0 ? sumRemainingDue : '',
  ]);

  // Convert AOA to Sheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set Merges for Title and Totals
  ws['!merges'] = [
    // Title row (Row index 1: Row 2 in Excel) merged from col 2 to col 7
    { s: { r: 1, c: 2 }, e: { r: 1, c: 7 } },
    // Subtitle row (Row index 2: Row 3 in Excel) merged from col 2 to col 7
    { s: { r: 2, c: 2 }, e: { r: 2, c: 7 } },
    // Total row 'সর্বমোট' merged from col 0 to col 2
    { s: { r: 5 + sortedMembers.length, c: 0 }, e: { r: 5 + sortedMembers.length, c: 2 } },
  ];

  // Set Row Heights
  ws['!rows'] = [
    { hpt: 12 }, // Row 1
    { hpt: 26 }, // Row 2 (Title)
    { hpt: 20 }, // Row 3 (Subtitle)
    { hpt: 10 }, // Row 4 (Gap)
    { hpt: 32 }, // Row 5 (Headers)
    ...Array(sortedMembers.length).fill({ hpt: 20 }), // Data Rows
    { hpt: 24 }, // Total Row
  ];

  // Set Column Widths for 12 columns
  ws['!cols'] = [
    { wch: 8 },  // ক্রমিক নং
    { wch: 14 }, // পদবী
    { wch: 20 }, // নাম
    { wch: 16 }, // বকেয়া বিল (আগের মাস)
    { wch: 16 }, // অগ্রীম বিল (আগের মাস)
    { wch: 16 }, // ক্যান্টিন বিল (এই মাস)
    { wch: 14 }, // ইউনিট ফান্ড
    { wch: 14 }, // অন্যান্য
    { wch: 14 }, // সর্বমোট বিল
    { wch: 14 }, // পরিশোধিত বিল
    { wch: 12 }, // অগ্রিম
    { wch: 14 }, // বকেয়া
  ];

  // 6. Style Cells using Arial Font
  const FONT_NAME = 'Arial';
  const totalRowIndex = 5 + sortedMembers.length;

  // Title Style (Centered)
  const titleCellAddr = XLSX.utils.encode_cell({ r: 1, c: 2 });
  if (ws[titleCellAddr]) {
    ws[titleCellAddr].s = {
      font: { name: FONT_NAME, sz: 14, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }

  // Subtitle Style (Centered)
  const subTitleCellAddr = XLSX.utils.encode_cell({ r: 2, c: 2 });
  if (ws[subTitleCellAddr]) {
    ws[subTitleCellAddr].s = {
      font: { name: FONT_NAME, sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }

  // Header Row (r = 4): ALL CELLS CENTER ALIGNED
  for (let c = 0; c < 12; c++) {
    const addr = XLSX.utils.encode_cell({ r: 4, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { name: FONT_NAME, sz: 11, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: cellBorder,
        fill: { fgColor: { rgb: 'F2F4F7' } }
      };
    }
  }

  // Data Rows (r = 5 to 5 + sortedMembers.length - 1): Font Arial, All Center Aligned, ONLY Name & Rank Left Aligned
  for (let i = 0; i < sortedMembers.length; i++) {
    const r = 5 + i;
    for (let c = 0; c < 12; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) {
        ws[addr] = { t: 's', v: '' };
      }
      const isLeftAlign = (c === 1 || c === 2); // c=1 is Rank, c=2 is Name
      const rowBgColor = i % 2 === 0 ? { rgb: 'FFFFFF' } : { rgb: 'F8FAFC' };
      ws[addr].s = {
        font: { name: FONT_NAME, sz: 11, color: { rgb: '000000' } },
        alignment: {
          vertical: 'center',
          horizontal: isLeftAlign ? 'left' : 'center',
          wrapText: false
        },
        border: cellBorder,
        fill: { fgColor: rowBgColor }
      };
    }
  }

  // Total Row Style (r = totalRowIndex): All Center Aligned
  for (let c = 0; c < 12; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalRowIndex, c });
    if (!ws[addr]) {
      ws[addr] = { t: 's', v: '' };
    }
    ws[addr].s = {
      font: { name: FONT_NAME, sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: {
        vertical: 'center',
        horizontal: 'center',
        wrapText: false
      },
      border: cellBorder,
      fill: { fgColor: { rgb: 'E5E7EB' } }
    };
  }

  // Freeze Heading Rows (Rows 1 to 5 are frozen)
  ws['!views'] = [
    { state: 'frozen', xSplit: 0, ySplit: 5, activePane: 'bottomLeft', topLeftCell: 'A6' }
  ];

  // 7. Create Workbook and Append Sheet
  const wb = XLSX.utils.book_new();
  const sheetTitle = filterLabel && filterLabel !== 'OVERALL' ? `BILL (${filterLabel})` : 'CANTEEN BILL';
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  // 8. Generate Excel binary buffer and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filterSuffix = filterLabel && filterLabel !== 'OVERALL' ? ` (${filterLabel})` : '';
  const filename = `CANTEEN MANAGEMENT - ${titleMonthBn}${filterSuffix}.xlsx`;

  try {
    const zip = await JSZip.loadAsync(wbout);
    let sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
    if (sheetXml) {
      sheetXml = sheetXml.replace(
        /<sheetView workbookViewId="0"[^>]*\/>/g,
        '<sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView>'
      );
      zip.file('xl/worksheets/sheet1.xml', sheetXml);
      const finalBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(finalBlob, filename);
      return filename;
    }
  } catch (zipErr) {
    console.warn('Freeze pane zip injection warning:', zipErr);
  }

  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);

  return filename;
}
