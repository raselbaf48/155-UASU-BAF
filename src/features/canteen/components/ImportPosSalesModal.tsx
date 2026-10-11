import React, { useState, useRef, useMemo } from 'react';
import { 
  X, Upload, FileSpreadsheet, Download, CheckCircle2, 
  AlertCircle, AlertTriangle, ArrowRight, Loader2, RefreshCw,
  Search, Check, Trash2, ShoppingCart, UserCheck, DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../supabase';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { deductRawStockForSales } from '../utils/recipeManager';
import { getCanteenMenuCache, setCanteenMenuCache, normalizeCatalogKey, isOneTimeBoxItem } from '../utils/canteenMenuData';
import { formatCanteenDate, toYMDDate } from '../utils/dateUtils';

interface ImportPosSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: any[];
  catalog: any[];
  onImportComplete?: () => void;
}

interface ParsedSaleRow {
  rowId: string;
  date: string;
  bdNo: string;
  rank: string;
  memberName: string;
  matchedMember: any | null;
  menuItemName: string;
  matchedMenuItem: any | null;
  qty: number;
  unitPrice: number;
  discount: number;
  totalAmount: number;
  paymentMode: 'DUE' | 'PAID';
  remarks?: string;
  isValid: boolean;
  warning?: string;
  selected: boolean;
}

export const ImportPosSalesModal: React.FC<ImportPosSalesModalProps> = ({
  isOpen,
  onClose,
  members,
  catalog,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSaleRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'WARNING'>('ALL');
  
  // Options
  const [updateMemberDue, setUpdateMemberDue] = useState(true);
  const [deductStock, setDeductStock] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate and download Excel template with sample rows in requested format
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'Date (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
          'BD No': 'BD/10234',
          'Rank': 'SGT',
          'Member Name': 'Rahman',
          'Menu Item': 'EGG NOODLES',
          'Quantity': 2,
          'Unit Price': 30,
          'Discount': 0,
          'Total Amount': 60,
          'Payment Mode (DUE/PAID)': 'DUE',
          'Remarks': 'Regular Order'
        },
        {
          'Date (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
          'BD No': 'BD/10567',
          'Rank': 'CPL',
          'Member Name': 'Karim',
          'Menu Item': 'MILK TEA',
          'Quantity': 3,
          'Unit Price': 10,
          'Discount': 0,
          'Total Amount': 30,
          'Payment Mode (DUE/PAID)': 'PAID',
          'Remarks': 'Evening Snacks'
        },
        {
          'Date (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
          'BD No': 'BD/10890',
          'Rank': 'LAC',
          'Member Name': 'Hasan',
          'Menu Item': 'CHICKEN BIRIYANI',
          'Quantity': 1,
          'Unit Price': 120,
          'Discount': 0,
          'Total Amount': 120,
          'Payment Mode (DUE/PAID)': 'DUE',
          'Remarks': 'Dinner'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);

      // Freeze Heading Row (Row 1 stays fixed)
      worksheet['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, activePane: 'bottomLeft' }];
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

      // Optimized Column Widths
      worksheet['!cols'] = [
        { wch: 18 }, // Date
        { wch: 15 }, // BD No
        { wch: 12 }, // Rank
        { wch: 22 }, // Member Name
        { wch: 24 }, // Menu Item
        { wch: 12 }, // Quantity
        { wch: 14 }, // Unit Price
        { wch: 12 }, // Discount
        { wch: 16 }, // Total Amount
        { wch: 22 }, // Payment Mode
        { wch: 20 }, // Remarks
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'POS_Sales_Template');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `POS_Sales_Import_Template_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to download POS sales template:', err);
      setErrorMessage('Failed to generate template file. Please try again.');
    }
  };

  const parseExcelDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      // Excel serial date number
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    const str = String(val).trim();
    const ymd = toYMDDate(str);
    if (ymd) return ymd;
    return new Date().toISOString().split('T')[0];
  };

  const normalizeMode = (val: any): 'DUE' | 'PAID' => {
    const s = String(val || '').toUpperCase().trim();
    if (s.includes('PAID') || s.includes('CASH') || s.includes('নগদ') || s.includes('পরিশোধ')) {
      return 'PAID';
    }
    return 'DUE';
  };

  const processFile = async (uploadedFile: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawJson.length === 0) {
        setErrorMessage('The uploaded file contains no data rows.');
        setIsProcessing(false);
        return;
      }

      // Member lookup map
      const memberMap = new Map<string, any>();
      members.forEach((m: any) => {
        const id = String(m.airman_id || '').toLowerCase().trim();
        const bd = String(m['BD No'] || m.bdNo || '').toLowerCase().trim();
        if (id) memberMap.set(id, m);
        if (bd) memberMap.set(bd, m);
      });

      // Catalog lookup map
      const catalogList = catalog.filter((it: any) => !isOneTimeBoxItem(it));

      const parsed: ParsedSaleRow[] = rawJson.map((row, index) => {
        // Field discovery
        let rawDate = row['Date (YYYY-MM-DD)'] || row['Date'] || row['date'] || row['তারিখ'] || row['DATE'] || '';
        let rawBd = row['BD No'] || row['BD NO'] || row['bdNo'] || row['বিডি নম্বর'] || row['Airman ID'] || row['Member ID'] || row['Service No'] || '';
        let rawRank = row['Rank'] || row['rank'] || row['পদবী'] || '';
        let rawName = row['Member Name'] || row['Name'] || row['সদস্যের নাম'] || row['নাম'] || '';
        let rawItem = row['Menu Item'] || row['Item Name'] || row['আইটেমের নাম'] || row['Item'] || row['খাবার'] || row['ITEM'] || '';
        let rawQty = row['Quantity'] || row['Qty'] || row['পরিমাণ'] || row['সংখ্যা'] || row['QTY'] || 1;
        let rawPrice = row['Unit Price'] || row['Price'] || row['দর'] || row['মূল্য'] || row['Rate'] || '';
        let rawDiscount = row['Discount'] || row['ছাড়'] || 0;
        let rawTotal = row['Total Amount'] || row['Amount'] || row['মোট টাকা'] || row['মোট'] || '';
        let rawMode = row['Payment Mode (DUE/PAID)'] || row['Payment Mode'] || row['Status'] || row['পেমেন্ট মোড'] || row['MODE'] || 'DUE';
        let rawRemarks = row['Remarks'] || row['মন্তব্য'] || row['Note'] || '';

        const bdStr = String(rawBd).trim();
        const parsedDate = parseExcelDate(rawDate);
        const qtyNum = Math.max(1, parseInt(String(rawQty), 10) || 1);
        const discountNum = Math.max(0, parseFloat(String(rawDiscount)) || 0);

        // Find matching member
        const matchedMem = bdStr ? (memberMap.get(bdStr.toLowerCase()) || null) : null;
        let finalRank = rawRank || (matchedMem?.Rank || matchedMem?.rank || '');
        let finalName = rawName || ([matchedMem?.Rank || matchedMem?.rank, matchedMem?.Surname || matchedMem?.surname || matchedMem?.Name || matchedMem?.name].filter(Boolean).join(' ') || '');

        // Find matching menu item
        const normSearch = normalizeCatalogKey(String(rawItem));
        const matchedItem = catalogList.find((it: any) => {
          const itEn = normalizeCatalogKey(it.name || it.name_en || '');
          const itBn = normalizeCatalogKey(it.name_bn || it.nameBn || it['Name (BN)'] || '');
          const itId = String(it.id || '').toLowerCase().trim();
          return (normSearch && (itEn === normSearch || itBn === normSearch || itEn.includes(normSearch) || normSearch.includes(itEn))) ||
                 (rawItem && itId === String(rawItem).toLowerCase().trim());
        }) || null;

        let unitPriceNum = parseFloat(String(rawPrice));
        if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
          unitPriceNum = matchedItem ? Number(matchedItem.price || 0) : 0;
        }

        let totalAmountNum = parseFloat(String(rawTotal));
        if (isNaN(totalAmountNum) || totalAmountNum <= 0) {
          totalAmountNum = Math.max(0, (qtyNum * unitPriceNum) - discountNum);
        }

        const mode = normalizeMode(rawMode);

        const warnings: string[] = [];
        if (!bdStr) {
          warnings.push('BD No missing');
        } else if (!matchedMem) {
          warnings.push('Member not found in DB');
        }

        if (!rawItem && !matchedItem) {
          warnings.push('Menu Item missing');
        } else if (!matchedItem) {
          warnings.push('Item not matched with Menu catalog');
        }

        if (totalAmountNum <= 0) {
          warnings.push('Total Amount is 0');
        }

        const isValid = warnings.length === 0;

        return {
          rowId: `pos_import_${index}_${Date.now()}`,
          date: parsedDate,
          bdNo: bdStr,
          rank: finalRank,
          memberName: finalName || bdStr || 'Customer',
          matchedMember: matchedMem,
          menuItemName: matchedItem?.name || String(rawItem).trim() || 'Menu Item',
          matchedMenuItem: matchedItem,
          qty: qtyNum,
          unitPrice: unitPriceNum,
          discount: discountNum,
          totalAmount: totalAmountNum,
          paymentMode: mode,
          remarks: String(rawRemarks).trim(),
          isValid,
          warning: warnings.length > 0 ? warnings.join(', ') : undefined,
          selected: true
        };
      });

      setParsedRows(parsed);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error parsing sales file:', err);
      setErrorMessage(`Failed to parse file: ${err?.message || 'Invalid Excel/CSV format'}`);
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const toggleSelectRow = (rowId: string) => {
    setParsedRows(prev => prev.map(r => r.rowId === rowId ? { ...r, selected: !r.selected } : r));
  };

  const toggleSelectAll = () => {
    const allSelected = parsedRows.every(r => r.selected);
    setParsedRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const removeRow = (rowId: string) => {
    setParsedRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const filteredDisplayRows = useMemo(() => {
    return parsedRows.filter(r => {
      if (filterMode === 'VALID' && !r.isValid) return false;
      if (filterMode === 'WARNING' && r.isValid) return false;
      if (searchFilter) {
        const s = searchFilter.toLowerCase();
        return r.bdNo.toLowerCase().includes(s) || 
               r.memberName.toLowerCase().includes(s) || 
               r.menuItemName.toLowerCase().includes(s) || 
               r.date.includes(s);
      }
      return true;
    });
  }, [parsedRows, filterMode, searchFilter]);

  const summary = useMemo(() => {
    const selectedRows = parsedRows.filter(r => r.selected);
    const totalQty = selectedRows.reduce((sum, r) => sum + r.qty, 0);
    const totalAmount = selectedRows.reduce((sum, r) => sum + r.totalAmount, 0);
    const dueAmount = selectedRows.filter(r => r.paymentMode === 'DUE').reduce((sum, r) => sum + r.totalAmount, 0);
    const paidAmount = selectedRows.filter(r => r.paymentMode === 'PAID').reduce((sum, r) => sum + r.totalAmount, 0);
    const validCount = selectedRows.filter(r => r.isValid).length;
    const warningCount = selectedRows.length - validCount;

    return {
      count: selectedRows.length,
      totalQty,
      totalAmount,
      dueAmount,
      paidAmount,
      validCount,
      warningCount
    };
  }, [parsedRows]);

  // Execute Import & commit to canteen_txs, Member Due, and Raw Stock
  const handleExecuteImport = async () => {
    const rowsToImport = parsedRows.filter(r => r.selected);
    if (rowsToImport.length === 0) {
      setErrorMessage('No rows selected for import.');
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const newTransactions: any[] = [];
      const memberDueIncrements = new Map<string, number>();
      const stockDeductionList: Array<{ menuItemId: string; menuItemName: string; qty: number }> = [];

      for (const row of rowsToImport) {
        const txDateStr = formatCanteenDate(row.date);
        const airmanId = row.matchedMember?.airman_id || row.bdNo;
        const tx = {
          id: Date.now() + Math.random(),
          date: txDateStr,
          airman_id: airmanId,
          bdNo: row.bdNo,
          memberName: row.memberName,
          rank: row.rank || '',
          items: `${row.menuItemName} (${row.qty})`,
          soldItems: [{
            menuItemId: row.matchedMenuItem?.id || `item-${Date.now()}`,
            menuItemName: row.menuItemName,
            price: row.unitPrice,
            qty: row.qty
          }],
          originalAmount: (row.qty * row.unitPrice),
          discount: row.discount,
          amount: row.totalAmount,
          type: 'SALE',
          status: row.paymentMode,
          paymentStatus: row.paymentMode,
          gateway: row.paymentMode === 'PAID' ? 'CASH' : 'DUE',
          paymentMethod: row.paymentMode === 'PAID' ? 'CASH' : 'DUE',
          notes: row.remarks ? `Imported: ${row.remarks}` : 'Imported via Excel POS Sales'
        };

        newTransactions.push(tx);

        if (updateMemberDue && row.paymentMode === 'DUE') {
          const currentAdd = memberDueIncrements.get(airmanId) || 0;
          memberDueIncrements.set(airmanId, currentAdd + row.totalAmount);
        }

        if (deductStock) {
          stockDeductionList.push({
            menuItemId: row.matchedMenuItem?.id || '',
            menuItemName: row.menuItemName,
            qty: row.qty
          });
        }
      }

      // 1. Append transactions to canteen_txs in localStorage & Cloud
      const existingTxs: any[] = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const mergedTxs = [...newTransactions, ...existingTxs];
      localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
      await pushKeyToCloud('canteen_txs', mergedTxs).catch(() => {});

      // 2. Update Member Dues in Supabase & memory if enabled
      if (updateMemberDue && memberDueIncrements.size > 0) {
        for (const [airmanId, addDue] of memberDueIncrements.entries()) {
          const targetMem = members.find(m => m.airman_id === airmanId || m['BD No'] === airmanId);
          if (targetMem) {
            const currentDue = Number(targetMem.Due ?? targetMem.due ?? targetMem.baki ?? 0);
            const newDue = currentDue + addDue;
            supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', targetMem.airman_id).then();
          }
        }
      }

      // 3. Deduct stock from raw inventory & menu cache if enabled
      if (deductStock && stockDeductionList.length > 0) {
        deductRawStockForSales(stockDeductionList);

        try {
          const currentCache = getCanteenMenuCache();
          if (currentCache && currentCache.length > 0) {
            const updatedCache = currentCache.map((menuItem: any) => {
              const matches = stockDeductionList.filter(s =>
                String(s.menuItemId) === String(menuItem.id) ||
                normalizeCatalogKey(s.menuItemName) === normalizeCatalogKey(menuItem.name || menuItem.name_en || '')
              );
              if (matches.length > 0) {
                const totalSold = matches.reduce((sum, m) => sum + m.qty, 0);
                const currentItemStock = menuItem.stock !== undefined ? Number(menuItem.stock) : (menuItem.max !== undefined ? Number(menuItem.max) : 50);
                const newStock = Math.max(0, currentItemStock - totalSold);
                return { ...menuItem, stock: newStock, max: newStock };
              }
              return menuItem;
            });
            setCanteenMenuCache(updatedCache);
          }
        } catch (e) {
          console.warn('Error adjusting menu stock cache:', e);
        }
      }

      // 4. Dispatch global realtime events
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_fund_updated'));
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('storage'));

      setSuccessMessage(`✅ Successfully imported ${newTransactions.length} POS sales transactions (Total ৳${summary.totalAmount.toLocaleString()})!`);

      if (onImportComplete) {
        onImportComplete();
      }

      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Failed to commit sales import:', err);
      setErrorMessage(`Failed to complete import: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>POS Sales Bulk Import (Excel / CSV)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  XLSX / CSV
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ইমপোর্ট করুন পূর্বের ও অফলাইন বিক্রি রেকর্ড (মেম্বার ও আইটেম অটো-ম্যাচিং সহ)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-950/70 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-black tracking-wider transition-all shadow-sm cursor-pointer"
              title="Download Excel Template"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download Template (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">

          {/* Success or Error Notice */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Step 1: Upload Box (If no file parsed yet) */}
          {parsedRows.length === 0 ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-3xl p-8 sm:p-12 text-center bg-slate-950/40 hover:bg-emerald-950/10 transition-all cursor-pointer group flex flex-col items-center justify-center space-y-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isProcessing ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    {isProcessing ? 'ফাইল প্রসেস করা হচ্ছে...' : 'ক্লিক করুন বা ড্র্যাগ করে ফেলুন (Drag & Drop)'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    সাপোর্টেড ফরম্যাট: .xlsx, .xls, .csv
                  </p>
                </div>
              </div>

              {/* Template Format Guideline Box */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 text-xs space-y-2 text-slate-300">
                <div className="font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>এক্সেল টেমপ্লেট কলাম নির্দেশিকা:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 pt-1">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">1. Date</span>
                    <span>YYYY-MM-DD</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">2. BD No</span>
                    <span>মেম্বার আইডি</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">3. Menu Item</span>
                    <span>মেনু আইটেমের নাম</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">4. Quantity</span>
                    <span>পরিমাণ (সংখ্যা)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">5. Unit Price</span>
                    <span>আইটেম মূল্য (ঐচ্ছিক)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">6. Discount</span>
                    <span>ছাড় (ঐচ্ছিক)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">7. Total Amount</span>
                    <span>মোট টাকা (ঐচ্ছিক)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-200 block">8. Payment Mode</span>
                    <span>DUE অথবা PAID</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Parsed Table Review */
            <div className="space-y-4">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Selected</span>
                  <span className="text-lg font-black text-white">{summary.count} / {parsedRows.length}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Items Qty</span>
                  <span className="text-lg font-black text-indigo-400">{summary.totalQty} pcs</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Due Sales</span>
                  <span className="text-lg font-black text-amber-400">৳{summary.dueAmount.toLocaleString()}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Sales</span>
                  <span className="text-lg font-black text-emerald-400">৳{summary.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                  >
                    {parsedRows.every(r => r.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                  <div className="flex rounded-xl bg-slate-900 p-0.5 border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterMode('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterMode === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      All ({parsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('VALID')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterMode === 'VALID' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Valid ({summary.validCount})
                    </button>
                    {summary.warningCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode('WARNING')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterMode === 'WARNING' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Warnings ({summary.warningCount})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-1 sm:max-w-xs">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search member, item, BD no..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setFile(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                    title="Upload another file"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto max-h-[42vh]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">✓</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">BD No</th>
                        <th className="px-3 py-2.5">Member Name</th>
                        <th className="px-3 py-2.5">Menu Item</th>
                        <th className="px-3 py-2.5 text-center">Qty</th>
                        <th className="px-3 py-2.5 text-right">Price</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                        <th className="px-3 py-2.5 text-center">Mode</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredDisplayRows.map((row) => (
                        <tr 
                          key={row.rowId} 
                          className={`hover:bg-slate-800/40 transition-colors ${!row.selected ? 'opacity-40' : ''}`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleSelectRow(row.rowId)}
                              className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-400">{row.date}</td>
                          <td className="px-3 py-2 font-bold text-white">{row.bdNo}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center space-x-1.5">
                              {row.rank && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold">
                                  {row.rank}
                                </span>
                              )}
                              <span className="font-bold truncate max-w-[140px]">{row.memberName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-bold text-emerald-400">{row.menuItemName}</td>
                          <td className="px-3 py-2 text-center font-bold">{row.qty}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-400">৳{row.unitPrice}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-white">৳{row.totalAmount}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              row.paymentMode === 'PAID'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            }`}>
                              {row.paymentMode}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                                <Check className="w-3.5 h-3.5" /> Matched
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-bold" title={row.warning}>
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[130px]">{row.warning}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(row.rowId)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execution Options */}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5">
                <div className="text-xs font-black text-slate-300 uppercase tracking-wider">
                  ইমপোর্ট অপশন ও সমন্বয়:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center space-x-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={updateMemberDue}
                      onChange={(e) => setUpdateMemberDue(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold text-white block">সদস্যের বকেয়ায় যোগ করুন (Update Member Due)</span>
                      <span className="text-[10px] text-slate-400">DUE ট্রানজ্যাকশনগুলোর টাকা সংশ্লিষ্ট মেম্বারের ব্যালেন্সে যোগ হবে</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={deductStock}
                      onChange={(e) => setDeductStock(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold text-white block">স্টক সমন্বয় করুন (Deduct Inventory Stock)</span>
                      <span className="text-[10px] text-slate-400">রেসিপি অনুযায়ী কাঁচামাল ও মেনু স্টক স্বয়ংক্রিয়ভাবে কমে যাবে</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {parsedRows.length > 0 && (
              <span>
                {summary.count} rows selected • Total: <strong className="text-white">৳{summary.totalAmount.toLocaleString()}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isApplying || summary.count === 0}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black tracking-wider uppercase transition-all shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ইমপোর্ট হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ইমপোর্ট নিশ্চিত করুন ({summary.count})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
