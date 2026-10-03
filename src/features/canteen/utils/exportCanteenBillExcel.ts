import XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { getCanteenConfig } from './canteenSettings';
import { sortCanteenMembersByOfficeSeniority } from './canteenSeniority';
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
  if (r === 'ACM') return 'এয়ার চিফ মার্শাল';
  if (r === 'AM') return 'এয়ার মার্শাল';
  if (r === 'AVM') return 'এয়ার ভাইস মার্শাল';
  if (r === 'AIR CDRE' || r.includes('COMMODORE')) return 'এয়ার কমোডর';
  if (r === 'GP CAPT' || r.includes('GROUP CAPTAIN')) return 'গ্রুপ ক্যাপ্টেন';
  if (r === 'WG CDR' || r.includes('WING COMMANDER')) return 'উইং কমান্ডার';
  if (r === 'SQN LDR' || r.includes('SQUADRON LEADER')) return 'স্কোয়াড্রন লিডার';
  if (r === 'FLT LT' || r.includes('FLIGHT LIEUTENANT')) return 'ফ্লাইট লেফটেন্যান্ট';
  if (r === 'FG OFFR' || r.includes('FLYING OFFICER')) return 'ফ্লাইং অফিসার';
  if (r === 'PLT OFFR' || r.includes('PILOT OFFICER')) return 'পাইলট অফিসার';
  if (r === 'CIV' || r.includes('CIVILIAN')) return 'বেসামরিক';

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
    'Sultan': 'সুলতান'
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

export interface ExportCanteenBillParams {
  members: any[];
  allTxs: any[];
  selectedCategory: BillCategory;
  selectedMonth: string;
}

export function exportCanteenBillToExcel({
  members,
  allTxs,
  selectedCategory,
  selectedMonth,
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

  // Row 3: Subtitle "মাসঃ জুন ২৫"
  aoa.push(['', '', '', `মাসঃ ${titleMonthBn}`]);

  // Row 4: Empty separator
  aoa.push([]);

  // Row 5: Exact 10 Table Column Headers
  const headers = [
    'ক্রমিক\nনং',
    'পদবী',
    'নাম',
    `বকেয়া বিল\n(${prevMonthBn})`,
    `অগ্রীম বিল\n(${prevMonthBn})`,
    `${categoryTitle}\n(${currMonthBn})`,
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
  let sumTotalBill = 0;
  let sumPaidBill = 0;
  let sumAdvance = 0;
  let sumRemainingDue = 0;

  // 3. Process each member row
  sortedMembers.forEach((member, index) => {
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

    if (selectedMonth === 'ALL') {
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
      // Specific Month Selected
      const currentMonthTxs = memberTxs.filter((tx) => {
        const cat = getTxCategory(tx);
        const catMatch = selectedCategory === 'ALL' || cat === selectedCategory;
        const txMonth = getTxMonthKey(tx.date);
        return catMatch && txMonth === selectedMonth;
      });

      currentPeriodCharges = currentMonthTxs
        .filter((tx) => tx.type !== 'BILL PAYMENT')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      currentPeriodPayments = currentMonthTxs
        .filter((tx) => tx.type === 'BILL PAYMENT')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      // Calculate previous due and advance before this month
      const olderTxs = memberTxs.filter((tx) => {
        const cat = getTxCategory(tx);
        const catMatch = selectedCategory === 'ALL' || cat === selectedCategory;
        const txMonth = getTxMonthKey(tx.date);
        return catMatch && txMonth && txMonth < selectedMonth;
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

    // Accumulate sums
    sumPreviousDue += previousDue;
    sumPreviousAdvance += previousAdvance;
    sumCanteenBill += currentPeriodCharges;
    sumTotalBill += totalBill;
    sumPaidBill += paidBill;
    sumAdvance += advance;
    sumRemainingDue += remainingDue;

    aoa.push([
      toBengaliNum(index + 1),                              // ক্রমিক নং
      rankFormatted,                                        // পদবী
      nameFormatted,                                        // নাম (বাংলায়)
      previousDue > 0 ? previousDue : '',                   // বকেয়া বিল (আগের মাস)
      previousAdvance > 0 ? previousAdvance : '',           // অগ্রীম বিল (আগের মাস)
      currentPeriodCharges > 0 ? currentPeriodCharges : '', // ক্যান্টিন বিল (এই মাস)
      totalBill > 0 ? totalBill : '',                       // সর্বমোট বিল
      paidBill > 0 ? paidBill : '',                         // পরিশোধিত বিল
      advance > 0 ? advance : '',                           // অগ্রিম
      remainingDue > 0 ? remainingDue : '',                 // বকেয়া
    ]);
  });

  // 4. Append Total Summary Row (for 10 columns)
  aoa.push([
    'সর্বমোট',
    '',
    '',
    sumPreviousDue > 0 ? sumPreviousDue : '',
    sumPreviousAdvance > 0 ? sumPreviousAdvance : '',
    sumCanteenBill > 0 ? sumCanteenBill : '',
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

  // Set Column Widths for 10 columns
  ws['!cols'] = [
    { wch: 8 },  // ক্রমিক নং
    { wch: 14 }, // পদবী
    { wch: 20 }, // নাম
    { wch: 16 }, // বকেয়া বিল (আগের মাস)
    { wch: 16 }, // অগ্রীম বিল (আগের মাস)
    { wch: 16 }, // ক্যান্টিন বিল (এই মাস)
    { wch: 14 }, // সর্বমোট বিল
    { wch: 14 }, // পরিশোধিত বিল
    { wch: 12 }, // অগ্রিম
    { wch: 14 }, // বকেয়া
  ];

  // 6. Style Cells using SutonnyMJ / Bengali Font
  const FONT_NAME = 'SutonnyMJ';
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
  for (let c = 0; c < 10; c++) {
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

  // Data Rows (r = 5 to 5 + sortedMembers.length - 1)
  for (let i = 0; i < sortedMembers.length; i++) {
    const r = 5 + i;
    for (let c = 0; c < 10; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) {
        ws[addr] = { t: 's', v: '' };
      }
      ws[addr].s = {
        font: { name: FONT_NAME, sz: 11, color: { rgb: '000000' } },
        alignment: {
          vertical: 'center',
          horizontal: c === 0 ? 'center' : c === 1 ? 'center' : c === 2 ? 'left' : 'right',
          wrapText: false
        },
        border: cellBorder
      };
    }
  }

  // Total Row Style (r = totalRowIndex)
  for (let c = 0; c < 10; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalRowIndex, c });
    if (!ws[addr]) {
      ws[addr] = { t: 's', v: '' };
    }
    ws[addr].s = {
      font: { name: FONT_NAME, sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: {
        vertical: 'center',
        horizontal: c <= 2 ? 'center' : 'right',
        wrapText: false
      },
      border: cellBorder,
      fill: { fgColor: { rgb: 'E5E7EB' } }
    };
  }

  // 7. Create Workbook and Append Sheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CANTEEN BILL (Airman)');

  // 8. Generate Excel binary buffer and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `CANTEEN MANAGEMENT - ${titleMonthBn}.xlsx`;
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);

  return filename;
}
