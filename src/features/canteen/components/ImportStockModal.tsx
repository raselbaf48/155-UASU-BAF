import React, { useState, useRef } from 'react';
import { 
  X, Upload, FileSpreadsheet, Download, CheckCircle2, 
  AlertCircle, AlertTriangle, ArrowRight, Loader2, RefreshCw,
  Search, Check, Trash2, Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { RawInventoryItem, RawStockLog, InventoryItemType, isReadymadeItem, cleanPureBanglaName } from '../utils/recipeManager';
import { supabase } from '../../../supabase';
import { formatNumber } from '../i18n';

interface ImportStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: RawInventoryItem[];
  onStockUpdated: (updatedItems: RawInventoryItem[], newLogs: RawStockLog[]) => Promise<void> | void;
}

interface ParsedStockRow {
  rowId: string;
  matchedItem: RawInventoryItem | null;
  importId: string;
  name: string;
  nameBn: string;
  unit: string;
  classification: InventoryItemType;
  oldStock: number;
  newStock: number;
  minStockAlert?: number;
  unitCost?: number;
  supplier?: string;
  selected: boolean;
  isNew: boolean;
}

export const ImportStockModal: React.FC<ImportStockModalProps> = ({
  isOpen,
  onClose,
  items,
  onStockUpdated,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStockRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate and download Excel template with current items prefilled
  const handleDownloadTemplate = () => {
    try {
      const templateData = items.map((it, idx) => ({
        'Ser no': idx + 1,
        'Item Name Bangla': cleanPureBanglaName(it.nameBn || it.name),
        'Unit': it.unit || 'pcs',
        'Current Stock': it.currentStock,
        'Min Stock Alert': it.minStockAlert,
        'Unit Cost': it.unitCost,
      }));

      const worksheet = XLSX.utils.json_to_sheet(templateData);

      // Freeze Heading Row (Row 1 stays fixed when scrolling)
      worksheet['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, activePane: 'bottomLeft' }];
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 10 }, // Ser no
        { wch: 32 }, // Item Name Bangla
        { wch: 12 }, // Unit
        { wch: 16 }, // Current Stock
        { wch: 16 }, // Min Stock Alert
        { wch: 16 }, // Unit Cost
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory_Stock');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Canteen_Inventory_Stock_Template_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to download template:', err);
      setErrorMessage('Failed to generate template file. Please try again.');
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

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (!rawJson || rawJson.length === 0) {
        throw new Error('The uploaded file contains no data rows.');
      }

      // Build lookup maps for fast matching
      const idMap = new Map<string, RawInventoryItem>();
      const nameMap = new Map<string, RawInventoryItem>();
      const nameBnMap = new Map<string, RawInventoryItem>();

      items.forEach(it => {
        if (it.id) idMap.set(it.id.toLowerCase().trim(), it);
        if (it.name) nameMap.set(it.name.toLowerCase().trim(), it);
        if (it.nameBn) nameBnMap.set(it.nameBn.toLowerCase().trim(), it);
      });

      const rows: ParsedStockRow[] = [];

      rawJson.forEach((row, index) => {
        // Find fields with flexible key names
        const findField = (keys: string[]): any => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                return row[rowKey];
              }
            }
          }
          return undefined;
        };

        const rawSerNo = findField(['Ser no', 'Ser No', 'Serial', 'SL', 'Sl', 'ক্রমিক', 'নম্বর']);
        const rawNameBn = String(findField(['Item Name Bangla', 'Item Name (Bangla)', 'Bangla Name', 'Name Bangla', 'নাম', 'আইটেম', 'Item Name', 'Name']) || '').trim();
        const rawStock = findField(['Current Stock', 'Initial Stock', 'Innitial Stock', 'Stock', 'Quantity', 'Qty', 'স্টক', 'পরিমাণ']);
        const rawMin = findField(['Min Stock Alert', 'Min Alert', 'Min Stock', 'সতর্কতা']);
        const rawCost = findField(['Unit Cost', 'Unit Cost (Tk)', 'Cost', 'Price', 'দর', 'মূল্য']);
        const rawUnit = String(findField(['Unit', 'একক']) || '').trim();

        if (!rawNameBn && !rawSerNo && rawStock === undefined) {
          // Skip completely empty row
          return;
        }

        // Match existing item
        let matched: RawInventoryItem | null = null;
        const cleanBnInput = cleanPureBanglaName(rawNameBn).toLowerCase();

        // 1. Match by pure Bengali name
        if (cleanBnInput) {
          matched = items.find(it => {
            const itPureBn = cleanPureBanglaName(it.nameBn || '').toLowerCase();
            return itPureBn === cleanBnInput;
          }) || null;

          if (!matched) {
            matched = items.find(it => {
              const itPureBn = cleanPureBanglaName(it.nameBn || '').toLowerCase();
              return itPureBn.includes(cleanBnInput) || cleanBnInput.includes(itPureBn);
            }) || null;
          }

          if (!matched) {
            matched = items.find(it => it.name.toLowerCase() === cleanBnInput || it.name.toLowerCase().includes(cleanBnInput)) || null;
          }
        }

        // 2. Fallback to matching by Ser no if present
        const parsedSer = parseInt(String(rawSerNo || ''), 10);
        if (!matched && !isNaN(parsedSer) && parsedSer >= 1 && parsedSer <= items.length) {
          matched = items[parsedSer - 1];
        }

        const parsedStockNum = (rawStock !== '' && rawStock !== undefined && !isNaN(Number(rawStock)))
          ? Math.max(0, Number(rawStock))
          : (matched ? matched.currentStock : 0);

        const parsedMinNum = (rawMin !== '' && rawMin !== undefined && !isNaN(Number(rawMin)))
          ? Math.max(0, Number(rawMin))
          : (matched ? matched.minStockAlert : 5);

        const parsedCostNum = (rawCost !== '' && rawCost !== undefined && !isNaN(Number(rawCost)))
          ? Math.max(0, Number(rawCost))
          : (matched ? matched.unitCost : 0);

        const resolvedClass: InventoryItemType = matched 
          ? (matched.itemType || (isReadymadeItem(matched) ? 'READY_MADE' : 'RAW'))
          : 'RAW';

        const displayBn = matched ? cleanPureBanglaName(matched.nameBn || matched.name) : cleanPureBanglaName(rawNameBn || `Item ${index + 1}`);

        rows.push({
          rowId: `row-${index}-${Date.now()}`,
          matchedItem: matched,
          importId: matched ? matched.id : `raw-import-${Date.now()}-${index}`,
          name: matched ? matched.name : (rawNameBn || `Item ${index + 1}`),
          nameBn: displayBn,
          unit: matched ? matched.unit : (rawUnit || 'pcs'),
          classification: resolvedClass,
          oldStock: matched ? matched.currentStock : 0,
          newStock: parsedStockNum,
          minStockAlert: parsedMinNum,
          unitCost: parsedCostNum,
          supplier: matched?.supplier || '',
          selected: true,
          isNew: !matched,
        });
      });

      if (rows.length === 0) {
        throw new Error('No valid items found in the file. Please check column headers.');
      }

      setParsedRows(rows);
    } catch (err: any) {
      console.error('Error processing file:', err);
      setErrorMessage(err.message || 'Failed to read file. Please verify it is a valid Excel or CSV spreadsheet.');
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  const handleToggleRow = (rowId: string) => {
    setParsedRows(prev => prev.map(r => r.rowId === rowId ? { ...r, selected: !r.selected } : r));
  };

  const handleNewStockChange = (rowId: string, val: string) => {
    const num = Math.max(0, Number(val) || 0);
    setParsedRows(prev => prev.map(r => r.rowId === rowId ? { ...r, newStock: num } : r));
  };

  const handleConfirmImport = async () => {
    const selectedRows = parsedRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      setErrorMessage('Please select at least one item to update.');
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const updatedItemsMap = new Map<string, RawInventoryItem>();
      items.forEach(it => updatedItemsMap.set(it.id, { ...it }));

      const newLogs: RawStockLog[] = [];
      const supabaseUpserts: any[] = [];

      selectedRows.forEach((row, idx) => {
        let targetItem: RawInventoryItem;
        const oldStock = row.matchedItem ? (updatedItemsMap.get(row.matchedItem.id)?.currentStock ?? row.matchedItem.currentStock) : 0;
        const newStock = row.newStock;
        const stockDiff = Math.round((newStock - oldStock) * 100) / 100;

        if (row.matchedItem) {
          const existing = updatedItemsMap.get(row.matchedItem.id) || row.matchedItem;

          // Replace existing with imported inputs directly
          targetItem = {
            ...existing,
            currentStock: newStock,
            minStockAlert: row.minStockAlert !== undefined ? row.minStockAlert : existing.minStockAlert,
            unitCost: row.unitCost !== undefined ? row.unitCost : existing.unitCost,
            nameBn: cleanPureBanglaName(existing.nameBn || row.nameBn),
            lastRestockedDate: today,
          };
        } else {
          // New item from import
          targetItem = {
            id: row.importId.startsWith('raw-') ? row.importId : `raw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: row.name,
            nameBn: cleanPureBanglaName(row.nameBn || row.name),
            itemType: row.classification || 'RAW',
            unit: row.unit || 'pcs',
            currentStock: newStock,
            minStockAlert: row.minStockAlert || 5,
            unitCost: row.unitCost || 0,
            lastRestockedDate: today,
            supplier: row.supplier || '',
            notes: 'Imported via Excel Stock Update',
          };
        }

        // Full history preservation: record previous stock, new stock, difference and unit cost
        newLogs.push({
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${idx}`,
          itemId: targetItem.id,
          itemName: targetItem.name,
          type: stockDiff < 0 ? 'WASTAGE' : 'RESTOCK',
          quantity: Math.abs(stockDiff),
          unit: targetItem.unit,
          previousStock: oldStock,
          newStock: newStock,
          cost: targetItem.unitCost * Math.abs(stockDiff),
          date: today,
          notes: `ইমপোর্ট স্টক আপডেট (পূর্ববর্তী স্টক: ${oldStock}, নতুন স্টক: ${newStock}, দর: ৳${targetItem.unitCost})`,
        });

        updatedItemsMap.set(targetItem.id, targetItem);

        // Prepare Supabase record
        supabaseUpserts.push({
          id: targetItem.id,
          name: targetItem.name,
          nameBn: targetItem.nameBn || '',
          unit: targetItem.unit,
          "Sub Unit": targetItem.subUnit || null,
          currentStock: targetItem.currentStock,
          minStockAlert: targetItem.minStockAlert,
          unitCost: targetItem.unitCost,
          wastagePercentage: targetItem.wastagePercentage ?? 0,
          lastRestockedDate: targetItem.lastRestockedDate || today,
          supplier: targetItem.supplier || '',
          DP: targetItem.dp || targetItem.DP || null,
          itemType: targetItem.itemType || 'RAW',
          notes: targetItem.notes || '',
        });
      });

      const finalItems = Array.from(updatedItemsMap.values());

      // Sync to Supabase Canteen_Inventory table
      if (supabaseUpserts.length > 0) {
        const { error } = await supabase.from('Canteen_Inventory').upsert(supabaseUpserts, { onConflict: 'id' });
        if (error) {
          console.warn('Note on Supabase Canteen_Inventory upsert:', error);
        }
      }

      await onStockUpdated(finalItems, newLogs);
      setSuccessMessage(`সফলভাবে ${selectedRows.length} টি আইটেমের স্টক আপডেট করা হয়েছে এবং হিস্ট্রিতে সংরক্ষিত হয়েছে!`);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to apply stock import:', err);
      setErrorMessage(err.message || 'Failed to update stock. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const filteredDisplayRows = parsedRows.filter(r => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      r.name.toLowerCase().includes(q) ||
      r.nameBn.toLowerCase().includes(q) ||
      r.importId.toLowerCase().includes(q)
    );
  });

  const selectedCount = parsedRows.filter(r => r.selected).length;
  const matchedCount = parsedRows.filter(r => !r.isNew).length;
  const newCount = parsedRows.filter(r => r.isNew).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Import & Update Initial Stock
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Excel / CSV
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Excel বা CSV ফাইল আপলোড করে সকল আইটেমের স্টক এক ক্লিকে আপডেট করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Messages */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action Row: Template Download & Upload Area */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1: Download Template */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-wider mb-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>ধাপ ১: টেমপ্লেট সংগ্রহ</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  বর্তমান সকল আইটেম সহ এক্সেল টেমপ্লেট ডাউনলোড করুন এবং স্টক সংখ্যা লিখে পুনরায় আপলোড করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Download Template (.xlsx)</span>
              </button>
            </div>

            {/* Step 2: Upload Area */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="md:col-span-2 border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-slate-950/70 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
            >
              <input 
                ref={fileInputRef} 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5 transition-colors">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                {file ? file.name : 'Click to Upload or Drag & Drop Excel/CSV File'}
              </span>
              <p className="text-xs text-slate-400 mt-1">
                Supports .xlsx, .xls, or .csv (Headers: Item ID, Item Name, Current Stock)
              </p>
              {isProcessing && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing spreadsheet...</span>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Parsed Data Preview & Confirmation */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold text-slate-300">
                    Total: <strong className="text-white">{parsedRows.length}</strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-emerald-400 font-bold">
                    Matched: <strong>{matchedCount}</strong>
                  </span>
                  {newCount > 0 && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs text-blue-400 font-bold">
                        New: <strong>{newCount}</strong>
                      </span>
                    </>
                  )}
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-indigo-400 font-bold">
                    Selected: <strong>{selectedCount}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search preview..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="pl-8 pr-3 py-1 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-48"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(selectedCount !== parsedRows.length)}
                    className="px-2.5 py-1 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    {selectedCount === parsedRows.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40 max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === parsedRows.length && parsedRows.length > 0}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-emerald-500 focus:ring-emerald-400"
                        />
                      </th>
                      <th className="py-2.5 px-3 font-bold">Item Name</th>
                      <th className="py-2.5 px-3 font-bold">Type</th>
                      <th className="py-2.5 px-3 font-bold">Unit</th>
                      <th className="py-2.5 px-3 font-bold text-right">Old Stock</th>
                      <th className="py-2.5 px-3 font-bold text-right w-28">New Stock</th>
                      <th className="py-2.5 px-3 font-bold text-right">Change</th>
                      <th className="py-2.5 px-3 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredDisplayRows.map((row) => {
                      const diff = Math.round((row.newStock - row.oldStock) * 100) / 100;
                      return (
                        <tr 
                          key={row.rowId}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            row.selected ? 'bg-slate-900/40' : 'opacity-60'
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleRow(row.rowId)}
                              className="rounded text-emerald-500 focus:ring-emerald-400"
                            />
                          </td>
                          <td className="py-2 px-3 font-medium text-white">
                            <div className="font-bold text-emerald-300">{row.nameBn}</div>
                            {row.name && row.name !== row.nameBn && (
                              <div className="text-[10px] text-slate-400 font-sans">{row.name}</div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.classification === 'READY_MADE'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            }`}>
                              {row.classification === 'READY_MADE' ? '🥐 Readymate' : '🌾 Raw'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300 font-mono">
                            {row.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">
                            {row.oldStock}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.newStock}
                              onChange={(e) => handleNewStockChange(row.rowId, e.target.value)}
                              className="w-24 px-2 py-1 text-right bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {diff > 0 ? (
                              <span className="text-emerald-400">+{diff}</span>
                            ) : diff < 0 ? (
                              <span className="text-rose-400">{diff}</span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.isNew ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                New Item
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Matched
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel / বাতিল
          </button>

          <div className="flex items-center gap-3">
            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isApplying || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying Stock Updates...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Update Stock ({selectedCount} Items)</span>
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
