import { saveAs } from 'file-saver';
import {
  formatRankBn,
  formatMemberNameBn,
  formatBengaliMonthYear,
  toBengaliNum
} from './exportCanteenBillExcel';
import { formatItemNameBn } from '../pages/MemberDB';

export interface StatementDateWiseCanvasRow {
  date: string;
  itemsText: string;
  qty: number;
  rate?: number;
  total: number;
  isMerged?: boolean;
}

export interface StatementCanvasData {
  statementMonth: string;
  statementMember: any;
  items: { itemName: string; qty: number; rate: number; total: number }[];
  totalMonthBill: number;
  previousDue: number;
  unitFundBill: number;
  othersFundBill: number;
  effectivePayments: number;
  netPayable: number;
  rankBn?: string;
  nameBn?: string;
  totalDiscount?: number;
  viewMode?: 'ITEM' | 'DATE';
  dateWiseRows?: StatementDateWiseCanvasRow[];
}

/**
 * Check if an item is a generic canteen lump sum bill without itemized food details
 */
export function isGenericCanteenBill(rawName?: string): boolean {
  if (!rawName) return true;
  const n = rawName.trim().toLowerCase();
  return (
    n.includes('ক্যান্টিন বিল') ||
    n.includes('ক্যান্টিন খরচ') ||
    n.includes('মাসিক বিল') ||
    n.includes('changed amount') ||
    n.includes('initial bill') ||
    n.includes('monthly bill') ||
    n.includes('canteen bill') ||
    n.includes('canteen expense')
  );
}

// SutonnyMJ serif font fallback chain for authentic Bengali typography
export const BENGALI_SUTONNY_FONT = '"SuttonyMJ", "SutonnyMJ", "SutonnyOMJ", "Sutonny MJ", "Noto Serif Bengali", "Tiro Bangla", "SolaimanLipi", "Kalpurush", serif';

/**
 * Generates an exact high-resolution canvas matching Pic 2.
 * Uses Sutonny Mj serif typography, normal white table cells (no alternating grey),
 * and merged columns for generic canteen bills.
 */
export function generateStatementCanvas(data: StatementCanvasData): HTMLCanvasElement {
  const {
    statementMonth,
    statementMember,
    items,
    totalMonthBill,
    previousDue,
    unitFundBill,
    othersFundBill,
    effectivePayments,
    netPayable,
    rankBn,
    nameBn,
    totalDiscount = 0
  } = data;

  const rank = rankBn || formatRankBn(statementMember?.Rank || statementMember?.rank || '');
  const name = nameBn || formatMemberNameBn(statementMember?.Surname || statementMember?.surname || '');
  const monthText = formatBengaliMonthYear(statementMonth);
  const memberFullName = `${rank} ${name}`.trim();

  // Layout measurements (logical pixels at 1x) - tight padding, no excess space
  const cardWidth = 460;
  const paddingX = 16;
  const tableX = paddingX;
  const tableWidth = cardWidth - paddingX * 2; // 428px

  const rowHeight = 40;
  const headerHeight = 110;

  const isDateWise = data.viewMode === 'DATE';
  const dateWiseRows = data.dateWiseRows || [];

  // Calculate table rows count
  let summaryRowsCount = 1; // সর্বমোট প্রদেয় বিল
  if (totalMonthBill > 0) summaryRowsCount++;
  if (totalDiscount && totalDiscount > 0) summaryRowsCount++;
  if (previousDue > 0) summaryRowsCount++;
  if (unitFundBill > 0) summaryRowsCount++;
  if (othersFundBill > 0) summaryRowsCount++;
  if (effectivePayments > 0) summaryRowsCount++;

  const itemsCount = isDateWise 
    ? (dateWiseRows.length > 0 ? dateWiseRows.length : 1)
    : (items && items.length > 0 ? items.length : 1);
  const totalTableRows = 3 + itemsCount + summaryRowsCount;
  const tableHeight = totalTableRows * rowHeight;
  const footerHeight = 24; // Clean padding below table (signatures removed as requested)
  const cardHeight = headerHeight + tableHeight + footerHeight;

  // Retina Scale for razor sharp text
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = cardWidth * scale;
  canvas.height = cardHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // 1. Title Banner (Sutonny Mj font)
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "🍽️ ক্যাফে ইউএভি 🍽️"
  ctx.font = `bold 24px ${BENGALI_SUTONNY_FONT}`;
  ctx.fillText('🍽️ ক্যাফে ইউএভি 🍽️', cardWidth / 2, 42);

  // "মাসিক বিল বিবরণী"
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 16px ${BENGALI_SUTONNY_FONT}`;
  ctx.fillText(isDateWise ? 'মাসিক বিল বিবরণী (তারিখ ভিত্তিক)' : 'মাসিক বিল বিবরণী', cardWidth / 2, 72);

  // Divider line
  ctx.fillStyle = '#000000';
  ctx.fillRect(tableX, 96, tableWidth, 4);

  // 2. Table
  let currentY = headerHeight;

  // Column definitions for items
  // If Item wise (4 columns): [দ্রব্যের নাম: 40%, পরিমাণ: 20%, দর: 20%, মোট: 20%]
  // If Dt wise (5 columns matching prompt): [তারিখ: 18%, বিবরণ: 43%, পরিমাণ: 12%, দর: 13%, মোট: 14%]
  const col1W = isDateWise ? Math.round(tableWidth * 0.18) : Math.round(tableWidth * 0.40);
  const col2W = isDateWise ? Math.round(tableWidth * 0.43) : Math.round(tableWidth * 0.20);
  const col3W = isDateWise ? Math.round(tableWidth * 0.12) : Math.round(tableWidth * 0.20);
  const col4W = isDateWise ? Math.round(tableWidth * 0.13) : tableWidth - (col1W + col2W + col3W);
  const col5W = isDateWise ? tableWidth - (col1W + col2W + col3W + col4W) : 0;

  const col1X = tableX;
  const col2X = col1X + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;
  const col5X = col4X + col4W;

  const drawBorder = (x: number, y: number, w: number, h: number, lw = 1) => {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, h);
  };

  // Helper for 2-column wide rows (e.g. Month, Name) - Normal white background as requested
  const drawRow = (
    text1: string,
    text2: string,
    align1: CanvasTextAlign = 'left',
    align2: CanvasTextAlign = 'left',
    fontSize = 14
  ) => {
    // Col 1
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col1X, currentY, col1W, rowHeight);
    drawBorder(col1X, currentY, col1W, rowHeight);

    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = align1;
    const t1X = align1 === 'left' ? col1X + 10 : (align1 === 'right' ? col1X + col1W - 10 : col1X + col1W / 2);
    ctx.fillText(text1, t1X, currentY + rowHeight / 2 + 1);

    // Col 2 spanning remaining columns - Normal white background
    const restW = tableWidth - col1W;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col2X, currentY, restW, rowHeight);
    drawBorder(col2X, currentY, restW, rowHeight);

    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = align2;
    const t2X = align2 === 'left' ? col2X + 12 : (align2 === 'right' ? col2X + restW - 12 : col2X + restW / 2);
    ctx.fillText(text2, t2X, currentY + rowHeight / 2 + 1);

    currentY += rowHeight;
  };

  // Row 1: মাসের নাম | {monthText}
  drawRow('মাসের নাম', monthText, 'left', 'left', 14);

  // Row 2: পদবী ও নাম | {memberFullName} (Normal white background)
  drawRow('পদবী ও নাম', memberFullName, 'left', 'left', 14);

  // Row 3: Header Row
  const drawHeaderCol = (x: number, w: number, text: string) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, currentY, w, rowHeight);
    drawBorder(x, currentY, w, rowHeight, 1.5);
    ctx.fillStyle = '#000000';
    ctx.font = `bold 14px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, currentY + rowHeight / 2 + 1);
  };

  if (isDateWise) {
    drawHeaderCol(col1X, col1W, 'তারিখ');
    drawHeaderCol(col2X, col2W, 'বিবরণ');
    drawHeaderCol(col3X, col3W, 'পরিমাণ');
    drawHeaderCol(col4X, col4W, 'দর');
    drawHeaderCol(col5X, col5W, 'মোট');
  } else {
    drawHeaderCol(col1X, col1W, 'দ্রব্যের নাম');
    drawHeaderCol(col2X, col2W, 'পরিমাণ');
    drawHeaderCol(col3X, col3W, 'দর');
    drawHeaderCol(col4X, col4W, 'মোট');
  }
  currentY += rowHeight;

  // Helper to draw an item row with 4 columns: দ্রব্যের নাম | পরিমাণ | দর | মোট
  const drawItemRow = (name: string, qty: number | string, rate: number | string, total: number | string) => {
    // Cell 1: দ্রব্যের নাম
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col1X, currentY, col1W, rowHeight);
    drawBorder(col1X, currentY, col1W, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = `bold 13px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(name, col1X + 10, currentY + rowHeight / 2 + 1);

    // Cell 2: পরিমাণ
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col2X, currentY, col2W, rowHeight);
    drawBorder(col2X, currentY, col2W, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = `bold 13px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(toBengaliNum(qty), col2X + col2W / 2, currentY + rowHeight / 2 + 1);

    // Cell 3: দর
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col3X, currentY, col3W, rowHeight);
    drawBorder(col3X, currentY, col3W, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = `bold 13px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`৳${toBengaliNum(rate)}`, col3X + col3W / 2, currentY + rowHeight / 2 + 1);

    // Cell 4: মোট
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col4X, currentY, col4W, rowHeight);
    drawBorder(col4X, currentY, col4W, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = `bold 13px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`৳${toBengaliNum(total)}`, col4X + col4W / 2, currentY + rowHeight / 2 + 1);

    currentY += rowHeight;
  };

  // Helper to draw a Dt-wise row: তারিখ (৭ সেপ্ট) | বিবরণ | পরিমাণ | দর | মোট
  // For non-canteen bills (Unit Fund & Others), merges বিবরণ, পরিমাণ & দর cells
  const drawDateWiseRow = (dateStr: string, itemsText: string, qty: number | string, rate: number | string, total: number | string, isMerged = false) => {
    // Cell 1: তারিখ
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col1X, currentY, col1W, rowHeight);
    drawBorder(col1X, currentY, col1W, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = `bold 12px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, col1X + col1W / 2, currentY + rowHeight / 2 + 1);

    if (isMerged) {
      // Merged Cell spanning বিবরণ, পরিমাণ & দর (col2W + col3W + col4W)
      const mergedW = col2W + col3W + col4W;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(col2X, currentY, mergedW, rowHeight);
      drawBorder(col2X, currentY, mergedW, rowHeight);
      ctx.fillStyle = '#000000';
      ctx.font = `bold 12px ${BENGALI_SUTONNY_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(itemsText, col2X + 8, currentY + rowHeight / 2 + 1);
    } else {
      // Cell 2: বিবরণ
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(col2X, currentY, col2W, rowHeight);
      drawBorder(col2X, currentY, col2W, rowHeight);
      ctx.fillStyle = '#000000';
      ctx.font = `bold 12px ${BENGALI_SUTONNY_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(itemsText, col2X + 6, currentY + rowHeight / 2 + 1);

      // Cell 3: পরিমাণ
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(col3X, currentY, col3W, rowHeight);
      drawBorder(col3X, currentY, col3W, rowHeight);
      ctx.fillStyle = '#000000';
      ctx.font = `bold 12px ${BENGALI_SUTONNY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(toBengaliNum(qty), col3X + col3W / 2, currentY + rowHeight / 2 + 1);

      // Cell 4: দর
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(col4X, currentY, col4W, rowHeight);
      drawBorder(col4X, currentY, col4W, rowHeight);
      ctx.fillStyle = '#000000';
      ctx.font = `bold 12px ${BENGALI_SUTONNY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`৳${toBengaliNum(rate)}`, col4X + col4W / 2, currentY + rowHeight / 2 + 1);
    }

    // Cell 5: মোট
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(col5X, currentY, col5W, rowHeight);
    drawBorder(col5X, currentY, col5W, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = `bold 12px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`৳${toBengaliNum(total)}`, col5X + col5W / 2, currentY + rowHeight / 2 + 1);

    currentY += rowHeight;
  };

  // Data Rows
  if (isDateWise) {
    if (dateWiseRows && dateWiseRows.length > 0) {
      dateWiseRows.forEach((r) => {
        const rowRate = r.rate !== undefined && r.rate > 0 ? r.rate : (r.qty > 0 ? Math.round(r.total / r.qty) : r.total);
        drawDateWiseRow(r.date, r.itemsText, r.qty, rowRate, r.total, r.isMerged);
      });
    } else {
      // Merge all columns: এই মাসে কোনো তারিখ ভিত্তিক বিল নেই
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tableX, currentY, tableWidth, rowHeight);
      drawBorder(tableX, currentY, tableWidth, rowHeight);
      ctx.fillStyle = '#000000';
      ctx.font = `bold 14px ${BENGALI_SUTONNY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('এই মাসে কোনো তারিখ ভিত্তিক বিল নেই', tableX + tableWidth / 2, currentY + rowHeight / 2 + 1);
      currentY += rowHeight;
    }
  } else {
    // Normal white background (all 4 columns visible: দ্রব্যের নাম, পরিমাণ, দর, মোট)
    if (items && items.length > 0) {
      items.forEach((item) => {
        const isGeneric = isGenericCanteenBill(item.itemName);
        const displayName = isGeneric ? `ক্যান্টিন বিল (${monthText})` : formatItemNameBn(item.itemName);
        const qty = item.qty > 0 ? item.qty : 1;
        const rate = item.rate > 0 ? item.rate : Math.round(item.total / qty);
        drawItemRow(displayName, qty, rate, item.total);
      });
    } else if (totalMonthBill > 0) {
      drawItemRow(`ক্যান্টিন বিল (${monthText})`, 1, totalMonthBill, totalMonthBill);
    } else {
      // Merge all 4 columns: এই মাসে কোনো ক্যান্টিন বিল নেই
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tableX, currentY, tableWidth, rowHeight);
      drawBorder(tableX, currentY, tableWidth, rowHeight);
      ctx.fillStyle = '#000000';
      ctx.font = `bold 14px ${BENGALI_SUTONNY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('এই মাসে কোনো ক্যান্টিন বিল নেই', tableX + tableWidth / 2, currentY + rowHeight / 2 + 1);
      currentY += rowHeight;
    }
  }

  // Summary Rows Helper - Normal white background
  const drawSummaryRow = (
    label: string,
    valText: string,
    textValColor = '#000000',
    fontSize = 14
  ) => {
    const valueW = isDateWise ? col5W : col4W;
    const valueX = isDateWise ? col5X : col4X;
    const labelW = tableWidth - valueW;

    // Label spanning preceding columns
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tableX, currentY, labelW, rowHeight);
    drawBorder(tableX, currentY, labelW, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(label, tableX + labelW - 12, currentY + rowHeight / 2 + 1);

    // Last Column: Value (Normal white background)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(valueX, currentY, valueW, rowHeight);
    drawBorder(valueX, currentY, valueW, rowHeight);
    ctx.fillStyle = textValColor;
    ctx.font = `bold ${fontSize}px ${BENGALI_SUTONNY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(valText, valueX + valueW / 2, currentY + rowHeight / 2 + 1);

    currentY += rowHeight;
  };

  // 1. মোট ক্যান্টিন বিল (only if > 0)
  if (totalMonthBill > 0) {
    drawSummaryRow('মোট ক্যান্টিন বিল', `৳${toBengaliNum(totalMonthBill)}`, '#000000');
  }

  // 1.1 ডিসকাউন্ট (if > 0, right below মোট ক্যান্টিন বিল)
  if (totalDiscount && totalDiscount > 0) {
    drawSummaryRow('ডিসকাউন্ট', `-৳${toBengaliNum(totalDiscount)}`, '#059669');
  }

  // 2. বকেয়া বিল (if > 0)
  if (previousDue > 0) {
    drawSummaryRow('বকেয়া বিল', `৳${toBengaliNum(previousDue)}`, '#000000');
  }

  // 3. ইউনিট ফান্ড (if > 0)
  if (unitFundBill > 0) {
    drawSummaryRow('ইউনিট ফান্ড', `৳${toBengaliNum(unitFundBill)}`, '#000000');
  }

  // 4. অন্যান্য (if > 0)
  if (othersFundBill > 0) {
    drawSummaryRow('অন্যান্য', `৳${toBengaliNum(othersFundBill)}`, '#000000');
  }

  // 5. পরিশোধিত বিল (if > 0)
  if (effectivePayments > 0) {
    drawSummaryRow('পরিশোধিত বিল', `-৳${toBengaliNum(effectivePayments)}`, '#059669');
  }

  // 6. সর্বমোট প্রদেয় বিল (Bold Red Text on normal white background)
  drawSummaryRow('সর্বমোট প্রদেয় বিল', `৳${toBengaliNum(netPayable)}`, '#e11d48', 16);

  // Outer border around whole table for clean crisp outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(tableX, headerHeight, tableWidth, currentY - headerHeight);

  return canvas;
}

/**
 * Returns a PNG Blob from StatementCanvasData
 */
export async function generateStatementCanvasBlob(data: StatementCanvasData): Promise<Blob> {
  const canvas = generateStatementCanvas(data);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

/**
 * Saves or shares the statement slip image directly to Android Gallery/Photos or downloads on desktop.
 * Uses native Web Share API on mobile to directly save to Photos/Gallery without Chrome browser download manager.
 */
export async function saveStatementToGalleryOrDownload(
  blob: Blob,
  file: File | null,
  fileName: string
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  const targetFile = file || new File([blob], fileName, { type: 'image/png' });

  // 1. If Web Share API is available (Mobile Android / iOS / Chrome Mobile):
  // Opens Android system share sheet with native "Save to Gallery / Photos" and "WhatsApp"!
  // Bypasses Chrome download notification entirely!
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [targetFile] })) {
    try {
      await navigator.share({
        files: [targetFile],
        title: fileName,
        text: 'ক্যাফে ইউএভি স্টেটমেন্ট স্লিপ'
      });
      return { method: 'share', success: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { method: 'share', success: false }; // User closed dialog
      }
      console.warn('Native share failed, falling back to direct download:', err);
    }
  }

  // 2. Fallback for Desktop PC or browsers without file share:
  try {
    saveAs(blob, fileName);

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return { method: 'download', success: true };
  } catch (err) {
    console.error('File download error:', err);
    return { method: 'download', success: false };
  }
}

/**
 * Legacy download function
 */
export function downloadStatementBlob(blob: Blob, fileName: string): boolean {
  try {
    saveAs(blob, fileName);
    return true;
  } catch (err) {
    console.error('downloadStatementBlob error:', err);
    return false;
  }
}
