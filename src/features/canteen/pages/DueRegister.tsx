import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Banknote, UserCheck, RefreshCw, Calendar, Filter, 
  AlertCircle, FileText, CheckCircle2, Store, ShoppingCart, 
  Utensils, Layers, Check, X, ArrowRight, DollarSign, Wallet,
  Upload, Download, FileSpreadsheet, Plus, Trash2, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { formatCanteenDate } from '../utils/dateUtils';
import { ExpenseRecord, DUE_SHOPS, DueShopName } from './Expenditures';
import { pushKeyToCloud } from '../utils/canteenCloudSync';

const EXPENSES_STORAGE_KEY = 'canteen_expenses';

export const resolveExpenseDueShop = (expense: Partial<ExpenseRecord>): DueShopName => {
  if (expense.dueShop) {
    const s = String(expense.dueShop).trim();
    if (s === 'Poultry Shop' || s.toLowerCase().includes('poultry')) return 'Poultry Shop';
    if (s === 'Bake & Bite' || s.toLowerCase().includes('bake') || s.toLowerCase().includes('bite')) return 'Bake & Bite';
    return 'Grocessary Shop';
  }
  const desc = String(expense.desc || '').toLowerCase();
  if (
    desc.includes('bake') || 
    desc.includes('bite') || 
    desc.includes('bread') || 
    desc.includes('biscuit') || 
    desc.includes('cake') || 
    desc.includes('toast') || 
    desc.includes('patties') || 
    desc.includes('bakery')
  ) {
    return 'Bake & Bite';
  }
  if (
    desc.includes('poultry') || 
    desc.includes('chicken') || 
    desc.includes('broiler') || 
    desc.includes('murgi') || 
    desc.includes('egg') || 
    desc.includes('dim') || 
    desc.includes('cock') || 
    desc.includes('meat')
  ) {
    return 'Poultry Shop';
  }
  return 'Grocessary Shop';
};

interface ParsedDueRow {
  id: string;
  date: string;
  shop: DueShopName;
  desc: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
  detailedPerson: string;
}

export const DueRegister: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');
  const [selectedShop, setSelectedShop] = useState<'ALL' | DueShopName>('ALL');

  // Settle modal state
  const [settleExpense, setSettleExpense] = useState<ExpenseRecord | null>(null);
  const [settleMethod, setSettleMethod] = useState<'Cash' | 'UCB'>('Cash');
  const [isSettling, setIsSettling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Bulk Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInputMode, setImportInputMode] = useState<'paste' | 'file'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedDueRow[]>([]);
  const [defaultShop, setDefaultShop] = useState<DueShopName>('Grocessary Shop');
  const [defaultPerson, setDefaultPerson] = useState('Civ Tanvir');
  const [defaultDate, setDefaultDate] = useState(formatCanteenDate(new Date()));
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDueExpenses = () => {
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];
      // Only keep records with paymentMethod === 'Due'
      const dueRecords = all.filter(e => String(e.paymentMethod || '').trim().toLowerCase() === 'due');
      setExpenses(dueRecords);
    } catch {
      setExpenses([]);
    }
  };

  useEffect(() => {
    loadDueExpenses();

    const handleSync = () => loadDueExpenses();
    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Compute shop-wise totals
  const grocessaryExpenses = useMemo(() => expenses.filter(e => resolveExpenseDueShop(e) === 'Grocessary Shop'), [expenses]);
  const poultryExpenses = useMemo(() => expenses.filter(e => resolveExpenseDueShop(e) === 'Poultry Shop'), [expenses]);
  const bakeAndBiteExpenses = useMemo(() => expenses.filter(e => resolveExpenseDueShop(e) === 'Bake & Bite'), [expenses]);

  const grocessaryTotal = useMemo(() => grocessaryExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [grocessaryExpenses]);
  const poultryTotal = useMemo(() => poultryExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [poultryExpenses]);
  const bakeAndBiteTotal = useMemo(() => bakeAndBiteExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [bakeAndBiteExpenses]);
  const grandTotalDue = grocessaryTotal + poultryTotal + bakeAndBiteTotal;

  // Filter list
  const filtered = expenses.filter((expense) => {
    const expenseShop = resolveExpenseDueShop(expense);

    const matchesSearch = 
      expense.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expense.detailedPerson && expense.detailedPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (expense.date && expense.date.toLowerCase().includes(searchTerm.toLowerCase())) ||
      expenseShop.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPerson = 
      selectedPerson === 'ALL' || (expense.detailedPerson || 'Civ Tanvir') === selectedPerson;

    const matchesShop = 
      selectedShop === 'ALL' || expenseShop === selectedShop;

    return matchesSearch && matchesPerson && matchesShop;
  });

  const totalFilteredAmount = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Extract distinct detailed persons
  const distinctPersons = Array.from(new Set(expenses.map(e => e.detailedPerson || 'Civ Tanvir'))).filter(Boolean);

  const handleConfirmSettle = async () => {
    if (!settleExpense) return;
    setIsSettling(true);

    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];

      // Update the settled record from Due to Cash/UCB
      const updated = all.map(e => {
        if (String(e.id) === String(settleExpense.id)) {
          return {
            ...e,
            paymentMethod: settleMethod,
            settledDate: formatCanteenDate(new Date()),
            settledMethod: settleMethod
          };
        }
        return e;
      });

      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));
      try {
        await pushKeyToCloud(EXPENSES_STORAGE_KEY, updated);
      } catch (err) {
        console.warn('Could not push updated expenses to cloud:', err);
      }

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      const shopName = resolveExpenseDueShop(settleExpense);
      setToastMessage(`✅ ৳${settleExpense.amount.toLocaleString()} due for ${shopName} has been paid via ${settleMethod}!`);
      setTimeout(() => setToastMessage(''), 4500);

      setSettleExpense(null);
      loadDueExpenses();
    } catch (err: any) {
      alert(`Error settling due: ${err?.message || 'Failed'}`);
    } finally {
      setIsSettling(false);
    }
  };

  // Helper function to format various date representations into DD-MM-YYYY
  const parseRawDate = (raw: any): string => {
    if (!raw) return defaultDate;
    const str = String(raw).trim();
    if (!str) return defaultDate;

    // Excel serial number
    if (/^\d{5}$/.test(str)) {
      try {
        const dateObj = XLSX.SSF.parse_date_code(Number(str));
        if (dateObj) {
          const d = String(dateObj.d).padStart(2, '0');
          const m = String(dateObj.m).padStart(2, '0');
          const y = dateObj.y;
          return `${d}-${m}-${y}`;
        }
      } catch {}
    }

    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${day}-${month}-${year}`;
    }

    // Match YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${day}-${month}-${year}`;
    }

    return str;
  };

  // Parse raw text (tab or comma separated rows)
  const parseTextToRows = (text: string) => {
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const result: ParsedDueRow[] = [];

    // Check if line 1 is header
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeader = 
      firstLine.includes('date') || 
      firstLine.includes('shop') || 
      firstLine.includes('item') || 
      firstLine.includes('desc') || 
      firstLine.includes('amount') ||
      firstLine.includes('তারিখ') ||
      firstLine.includes('বকেয়া');

    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach((line, idx) => {
      // Split by tab or comma
      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t').map(c => c.trim());
      } else if (line.includes(',')) {
        // Simple comma split
        cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      } else {
        // Space / delimiter fallback
        cols = line.split(/\s{2,}/).map(c => c.trim());
      }

      if (cols.length === 0 || !cols.some(c => c)) return;

      // Detect columns
      // Expected: Date | Shop | Item / Desc | Qty | Unit | Unit Price | Amount | Person
      // Positional fallbacks:
      let rowDate = '';
      let rowShopStr = '';
      let rowDesc = '';
      let rowQty = 0;
      let rowUnit = 'kg';
      let rowUnitPrice = 0;
      let rowAmount = 0;
      let rowPerson = defaultPerson;

      if (cols.length >= 7) {
        rowDate = cols[0];
        rowShopStr = cols[1];
        rowDesc = cols[2];
        rowQty = parseFloat(cols[3].replace(/[^\d.]/g, '')) || 0;
        rowUnit = cols[4] || 'kg';
        rowUnitPrice = parseFloat(cols[5].replace(/[^\d.]/g, '')) || 0;
        rowAmount = parseFloat(cols[6].replace(/[^\d.]/g, '')) || 0;
        if (cols[7]) rowPerson = cols[7];
      } else if (cols.length >= 4) {
        // Date | Item | Amount | Shop (or person)
        rowDate = cols[0];
        rowDesc = cols[1];
        rowAmount = parseFloat(cols[2].replace(/[^\d.]/g, '')) || 0;
        rowShopStr = cols[3] || '';
        if (cols[4]) rowPerson = cols[4];
      } else if (cols.length === 3) {
        // Date | Item | Amount
        rowDate = cols[0];
        rowDesc = cols[1];
        rowAmount = parseFloat(cols[2].replace(/[^\d.]/g, '')) || 0;
      } else if (cols.length === 2) {
        // Item | Amount
        rowDesc = cols[0];
        rowAmount = parseFloat(cols[1].replace(/[^\d.]/g, '')) || 0;
      } else {
        rowDesc = cols[0];
      }

      // If amount is 0 and qty & unitPrice provided, compute it
      if (rowAmount === 0 && rowQty > 0 && rowUnitPrice > 0) {
        rowAmount = rowQty * rowUnitPrice;
      }

      // Detect shop
      let detectedShop: DueShopName = defaultShop;
      const lowerShop = rowShopStr.toLowerCase();
      if (lowerShop.includes('poultry') || lowerShop.includes('chicken') || lowerShop.includes('murgi')) {
        detectedShop = 'Poultry Shop';
      } else if (lowerShop.includes('bake') || lowerShop.includes('bite') || lowerShop.includes('bread') || lowerShop.includes('bakery')) {
        detectedShop = 'Bake & Bite';
      } else if (lowerShop.includes('grocessary') || lowerShop.includes('grocery') || lowerShop.includes('দোকান')) {
        detectedShop = 'Grocessary Shop';
      } else {
        // Auto resolve from description
        detectedShop = resolveExpenseDueShop({ desc: rowDesc, dueShop: defaultShop });
      }

      const formattedDate = parseRawDate(rowDate);

      result.push({
        id: `due-import-row-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        date: formattedDate,
        shop: detectedShop,
        desc: rowDesc || 'Due item',
        qty: rowQty,
        unit: rowUnit || 'kg',
        unitPrice: rowUnitPrice,
        amount: rowAmount,
        detailedPerson: rowPerson || defaultPerson
      });
    });

    setParsedRows(result);
  };

  // Handle file upload (.xlsx, .xls, .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawJson || rawJson.length === 0) {
          alert('Uploaded file is empty.');
          return;
        }

        // Convert 2D array to text lines
        const textLines = rawJson
          .filter(row => row && row.length > 0 && row.some(cell => cell !== undefined && cell !== ''))
          .map(row => row.map(cell => (cell !== undefined && cell !== null ? String(cell).trim() : '')).join('\t'));

        const combinedText = textLines.join('\n');
        setPastedText(combinedText);
        parseTextToRows(combinedText);
        setImportInputMode('paste');
      } catch (err: any) {
        alert(`Failed to parse file: ${err?.message || 'Invalid format'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    try {
      const sampleData = [
        {
          Date: '01-10-2026',
          Shop: 'Grocessary Shop',
          'Item Description': 'Nazirshail Rice (50kg Bag)',
          Qty: 50,
          Unit: 'kg',
          'Unit Price': 85,
          Amount: 4250,
          Person: 'Civ Tanvir'
        },
        {
          Date: '02-10-2026',
          Shop: 'Poultry Shop',
          'Item Description': 'Broiler Chicken',
          Qty: 25,
          Unit: 'kg',
          'Unit Price': 195,
          Amount: 4875,
          Person: 'Civ Tanvir'
        },
        {
          Date: '03-10-2026',
          Shop: 'Bake & Bite',
          'Item Description': 'Special Bread & Toast',
          Qty: 40,
          Unit: 'pkt',
          'Unit Price': 60,
          Amount: 2400,
          Person: 'Civ Tanvir'
        },
        {
          Date: '04-10-2026',
          Shop: 'Grocessary Shop',
          'Item Description': 'Soybean Oil (5L Cans)',
          Qty: 6,
          Unit: 'can',
          'Unit Price': 850,
          Amount: 5100,
          Person: 'Civ Nur Nabi'
        },
        {
          Date: '05-10-2026',
          Shop: 'Poultry Shop',
          'Item Description': 'Farm Eggs (Layer)',
          Qty: 100,
          Unit: 'pcs',
          'Unit Price': 12,
          Amount: 1200,
          Person: 'Civ Tanvir'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Due_Register_Import');
      XLSX.writeFile(wb, 'Canteen_Due_Register_MultiDate_Sample.xlsx');
    } catch (err) {
      alert('Error creating sample Excel file');
    }
  };

  // Copy sample format text
  const handleCopySampleFormat = () => {
    const sample = [
      'Date\tShop\tItem Description\tQty\tUnit\tUnit Price\tAmount\tPerson',
      '01-10-2026\tGrocessary Shop\tNazirshail Rice\t50\tkg\t85\t4250\tCiv Tanvir',
      '02-10-2026\tPoultry Shop\tBroiler Chicken\t25\tkg\t195\t4875\tCiv Tanvir',
      '03-10-2026\tBake & Bite\tSpecial Bread & Toast\t40\tpkt\t60\t2400\tCiv Tanvir',
      '04-10-2026\tGrocessary Shop\tSoybean Oil 5L\t6\tcan\t850\t5100\tCiv Nur Nabi'
    ].join('\n');

    navigator.clipboard.writeText(sample);
    setPastedText(sample);
    parseTextToRows(sample);
    setToastMessage('📋 Sample format loaded into text area!');
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Remove a row from parsed preview
  const handleRemoveParsedRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  // Confirm and Import into Canteen Expenses
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) {
      alert('No valid due records to import.');
      return;
    }

    setIsImporting(true);
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];

      const newRecords: ExpenseRecord[] = parsedRows.map((r, idx) => ({
        id: `exp-due-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        date: r.date || defaultDate,
        desc: r.desc,
        category: r.shop === 'Poultry Shop' ? 'Poultry' : r.shop === 'Bake & Bite' ? 'Bakery' : 'Grocery',
        paymentMethod: 'Due',
        dueShop: r.shop,
        qty: r.qty > 0 ? r.qty : undefined,
        unit: r.unit || 'kg',
        unitPrice: r.unitPrice > 0 ? r.unitPrice : undefined,
        amount: Number(r.amount) || (r.qty > 0 && r.unitPrice > 0 ? r.qty * r.unitPrice : 0),
        detailedPerson: r.detailedPerson || defaultPerson,
        isCustom: true
      }));

      // Combine existing with newly imported records
      const updated = [...newRecords, ...all];

      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));

      try {
        await pushKeyToCloud(EXPENSES_STORAGE_KEY, updated);
      } catch (err) {
        console.warn('Cloud sync error during Due import:', err);
      }

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      const totalImportAmount = newRecords.reduce((s, r) => s + r.amount, 0);
      const distinctImportDates = Array.from(new Set(newRecords.map(r => r.date)));

      setToastMessage(`✅ Successfully imported ${newRecords.length} due records (৳${totalImportAmount.toLocaleString()}) across ${distinctImportDates.length} dates!`);
      setTimeout(() => setToastMessage(''), 5000);

      setIsImportModalOpen(false);
      setParsedRows([]);
      setPastedText('');
      loadDueExpenses();
    } catch (err: any) {
      alert(`Import failed: ${err?.message || 'Error saving due records'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Compute import statistics
  const importSummary = useMemo(() => {
    const totalAmount = parsedRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const grocCount = parsedRows.filter(r => r.shop === 'Grocessary Shop').length;
    const poultryCount = parsedRows.filter(r => r.shop === 'Poultry Shop').length;
    const bakeCount = parsedRows.filter(r => r.shop === 'Bake & Bite').length;
    const datesCount = new Set(parsedRows.map(r => r.date)).size;

    return { totalAmount, grocCount, poultryCount, bakeCount, datesCount };
  }, [parsedRows]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  DUE REGISTER
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black border border-amber-500/30">
                  3 SHOPS
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Grocessary Shop • Poultry Shop • Bake & Bite • বকেয়া খরচের রেজিস্টার
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* IMPORT DUE DATA BUTTON */}
          <button
            type="button"
            onClick={() => {
              setIsImportModalOpen(true);
              setParsedRows([]);
              setPastedText('');
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-2 shadow-md shadow-amber-600/30 cursor-pointer active:scale-95 border border-amber-400/40"
            title="Import multiple dates due records at once from Excel or text"
          >
            <Upload className="w-4 h-4" />
            <span>IMPORT DUE DATA</span>
          </button>

          <button
            type="button"
            onClick={loadDueExpenses}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-2 border border-slate-700 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* 3 SHOPS + TOTAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Grocessary Shop */}
        <div 
          onClick={() => setSelectedShop(selectedShop === 'Grocessary Shop' ? 'ALL' : 'Grocessary Shop')}
          className={`rounded-3xl p-5 border transition-all cursor-pointer relative overflow-hidden group select-none ${
            selectedShop === 'Grocessary Shop'
              ? 'bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 border-emerald-500 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              GROCESSARY SHOP
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight font-mono">
            ৳{grocessaryTotal.toLocaleString('en-US')}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px]">
            <span className="text-slate-400 font-bold">{grocessaryExpenses.length} Due Items</span>
            <span className="text-emerald-400 font-black">
              {selectedShop === 'Grocessary Shop' ? 'Active Filter ✓' : 'Click to View →'}
            </span>
          </div>
        </div>

        {/* Card 2: Poultry Shop */}
        <div 
          onClick={() => setSelectedShop(selectedShop === 'Poultry Shop' ? 'ALL' : 'Poultry Shop')}
          className={`rounded-3xl p-5 border transition-all cursor-pointer relative overflow-hidden group select-none ${
            selectedShop === 'Poultry Shop'
              ? 'bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 border-amber-500 shadow-lg shadow-amber-950/50 ring-2 ring-amber-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              POULTRY SHOP
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight font-mono">
            ৳{poultryTotal.toLocaleString('en-US')}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px]">
            <span className="text-slate-400 font-bold">{poultryExpenses.length} Due Items</span>
            <span className="text-amber-400 font-black">
              {selectedShop === 'Poultry Shop' ? 'Active Filter ✓' : 'Click to View →'}
            </span>
          </div>
        </div>

        {/* Card 3: Bake & Bite */}
        <div 
          onClick={() => setSelectedShop(selectedShop === 'Bake & Bite' ? 'ALL' : 'Bake & Bite')}
          className={`rounded-3xl p-5 border transition-all cursor-pointer relative overflow-hidden group select-none ${
            selectedShop === 'Bake & Bite'
              ? 'bg-gradient-to-br from-purple-950/70 via-slate-900 to-slate-950 border-purple-500 shadow-lg shadow-purple-950/50 ring-2 ring-purple-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-purple-500/50 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
              BAKE & BITE
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight font-mono">
            ৳{bakeAndBiteTotal.toLocaleString('en-US')}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px]">
            <span className="text-slate-400 font-bold">{bakeAndBiteExpenses.length} Due Items</span>
            <span className="text-purple-400 font-black">
              {selectedShop === 'Bake & Bite' ? 'Active Filter ✓' : 'Click to View →'}
            </span>
          </div>
        </div>

        {/* Card 4: Total Due Summary */}
        <div 
          onClick={() => setSelectedShop('ALL')}
          className={`rounded-3xl p-5 border transition-all cursor-pointer relative overflow-hidden select-none ${
            selectedShop === 'ALL'
              ? 'bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 border-indigo-500 shadow-lg shadow-indigo-950/50 ring-2 ring-indigo-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
              TOTAL DUE BALANCE
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-400 tracking-tight font-mono">
            ৳{grandTotalDue.toLocaleString('en-US')}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px]">
            <span className="text-slate-400 font-bold">{expenses.length} Records Total</span>
            <span className="text-indigo-400 font-black">
              {selectedShop === 'ALL' ? 'Showing All ✓' : 'Show All →'}
            </span>
          </div>
        </div>

      </div>

      {/* Shop Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedShop('ALL')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-2 border ${
            selectedShop === 'ALL'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
          }`}
        >
          <span>ALL SHOPS</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/80 font-mono">
            ৳{grandTotalDue.toLocaleString()}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedShop('Grocessary Shop')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-2 border ${
            selectedShop === 'Grocessary Shop'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
          <span>GROCESSARY SHOP</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/80 font-mono">
            ৳{grocessaryTotal.toLocaleString()}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedShop('Poultry Shop')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-2 border ${
            selectedShop === 'Poultry Shop'
              ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>POULTRY SHOP</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/80 font-mono">
            ৳{poultryTotal.toLocaleString()}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedShop('Bake & Bite')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-2 border ${
            selectedShop === 'Bake & Bite'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
          }`}
        >
          <Utensils className="w-3.5 h-3.5 text-purple-400" />
          <span>BAKE & BITE</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/80 font-mono">
            ৳{bakeAndBiteTotal.toLocaleString()}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search due items, date, shop, or detailed person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
            />
          </div>

          {/* Filter by detailed person */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap hidden sm:inline">
              PERSON:
            </span>
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="ALL">ALL CIVILIANS</option>
              {distinctPersons.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table: Shop-Wise Due Expenditure records */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              DUE EXPENDITURE RECORDS {selectedShop !== 'ALL' && `• ${selectedShop.toUpperCase()}`}
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              Showing {filtered.length} Due Entries • ৳{totalFilteredAmount.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">SHOP / VENDOR</th>
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ITEM NAME</th>
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">QTY & UNIT</th>
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">UNIT PRICE</th>
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">DETAILED PERSON</th>
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AMOUNT</th>
                <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    {expenses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Banknote className="w-8 h-8 text-slate-600 mb-1" />
                        <span className="text-slate-300 font-black">No due expenditure records found</span>
                        <span className="text-slate-500 text-[10px] normal-case">
                          When you add an expenditure with Payment Method "Due" and select a shop (Grocessary Shop, Poultry Shop, or Bake & Bite), or use the "IMPORT DUE DATA" button, it will appear here automatically.
                        </span>
                      </div>
                    ) : (
                      'No due records matching filter criteria'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((expense) => {
                  const shopName = resolveExpenseDueShop(expense);
                  const isGrocessary = shopName === 'Grocessary Shop';
                  const isPoultry = shopName === 'Poultry Shop';

                  return (
                    <tr 
                      key={expense.id} 
                      className="hover:bg-slate-800/60 transition-colors group"
                    >
                      {/* Date */}
                      <td className="py-4 px-5 text-[11px] font-mono font-bold text-slate-300 whitespace-nowrap">
                        {formatCanteenDate(expense.date)}
                      </td>

                      {/* Shop Name Badge */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wider uppercase border ${
                          isGrocessary
                            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30'
                            : isPoultry
                            ? 'bg-amber-950/50 text-amber-300 border-amber-500/30'
                            : 'bg-purple-950/50 text-purple-300 border-purple-500/30'
                        }`}>
                          {isGrocessary ? (
                            <ShoppingCart className="w-3 h-3 text-emerald-400" />
                          ) : isPoultry ? (
                            <Layers className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Utensils className="w-3 h-3 text-purple-400" />
                          )}
                          <span>{shopName}</span>
                        </span>
                      </td>

                      {/* Item Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-2">
                          <p className="text-xs font-black text-white uppercase group-hover:text-amber-300 transition-colors">
                            {expense.desc}
                          </p>
                          {expense.isCustom && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Custom
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Qty & Unit */}
                      <td className="py-4 px-5 text-center text-xs font-bold text-slate-300">
                        {expense.qty !== undefined ? (
                          <span>
                            {expense.qty} <span className="text-slate-500 text-[10px]">{expense.unit || 'kg'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Unit Price */}
                      <td className="py-4 px-5 text-center text-xs font-mono font-bold text-amber-300">
                        {expense.unitPrice ? (
                          <span>৳{expense.unitPrice}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Detailed Person */}
                      <td className="py-4 px-5 text-center">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold">
                          <UserCheck className="w-3 h-3 mr-1" />
                          <span>{expense.detailedPerson || 'Civ Tanvir'}</span>
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-5 text-right text-sm font-black text-amber-400 font-mono">
                        ৳{Number(expense.amount).toLocaleString('en-US')}
                      </td>

                      {/* Action: Pay / Settle Due */}
                      <td className="py-4 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => setSettleExpense(expense)}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-emerald-500/30 shadow-sm cursor-pointer active:scale-95 flex items-center space-x-1 mx-auto"
                          title="Settle / Pay this due bill"
                        >
                          <Check className="w-3 h-3" />
                          <span>Pay Due</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-800 bg-slate-950/80 font-black">
                  <td colSpan={6} className="py-4 px-5 text-right text-xs uppercase tracking-widest text-slate-400">
                    TOTAL DUE ({selectedShop === 'ALL' ? 'ALL SHOPS' : selectedShop.toUpperCase()}):
                  </td>
                  <td className="py-4 px-5 text-right text-base text-amber-400 font-mono font-black">
                    ৳{totalFilteredAmount.toLocaleString('en-US')}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* BULK IMPORT MODAL FOR MULTI-DATE DUE DATA */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl p-6 sm:p-7 space-y-6 my-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">
                        BULK IMPORT DUE RECORDS
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                        Multi-Date Support
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-bold">
                      একসাথে একাধিক তারিখের বকেয়া ডেটা (Excel / CSV / Copy-Paste) সরাসরি ইমপোর্ট করুন
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sample Actions Bar & Defaults */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <button
                    type="button"
                    onClick={handleDownloadSampleExcel}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-emerald-500/30 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopySampleFormat}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Load Demo Data</span>
                  </button>
                </div>

                {/* Default Fallback Settings */}
                <div className="flex items-center space-x-3 text-xs flex-wrap gap-y-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Default Shop:</span>
                    <select
                      value={defaultShop}
                      onChange={(e) => setDefaultShop(e.target.value as DueShopName)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-300 focus:outline-none"
                    >
                      {DUE_SHOPS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Default Person:</span>
                    <input
                      type="text"
                      value={defaultPerson}
                      onChange={(e) => setDefaultPerson(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white w-28 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Input Mode Selector */}
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setImportInputMode('paste')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center justify-center space-x-2 ${
                    importInputMode === 'paste'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Paste Text / Excel Columns</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportInputMode('file');
                    fileInputRef.current?.click();
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center justify-center space-x-2 ${
                    importInputMode === 'file'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Excel / CSV File (.xlsx, .csv)</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Text Area for Paste Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>
                    Paste format: <code className="text-amber-300 font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded">Date | Shop | Item | Qty | Unit | Rate | Amount | Person</code>
                  </span>
                  <span className="text-slate-500">Supports tab/comma separated multi-date data</span>
                </div>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    parseTextToRows(e.target.value);
                  }}
                  placeholder={`Example paste rows from Excel / Sheets:\n01-10-2026\tGrocessary Shop\tNazirshail Rice\t50\tkg\t85\t4250\tCiv Tanvir\n02-10-2026\tPoultry Shop\tBroiler Chicken\t25\tkg\t195\t4875\tCiv Tanvir\n03-10-2026\tBake & Bite\tSpecial Bread & Toast\t40\tpkt\t60\t2400\tCiv Tanvir`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Live Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        PREVIEW ({parsedRows.length} VALID ROWS)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-400 font-bold">Total Due:</span>
                      <span className="text-amber-400 font-mono font-black text-sm">
                        ৳{importSummary.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center space-x-2 text-[10px] font-black flex-wrap gap-y-1">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Grocessary: {importSummary.grocCount}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Poultry: {importSummary.poultryCount}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Bake & Bite: {importSummary.bakeCount}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Dates: {importSummary.datesCount}
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Shop</th>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-center">Rate</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Person</th>
                          <th className="py-2.5 px-3 text-center">Del</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {parsedRows.map((r, idx) => (
                          <tr key={r.id} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-300">{r.date}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                r.shop === 'Grocessary Shop' ? 'bg-emerald-500/10 text-emerald-400' :
                                r.shop === 'Poultry Shop' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-purple-500/10 text-purple-400'
                              }`}>
                                {r.shop}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-white">{r.desc}</td>
                            <td className="py-2 px-3 text-center text-slate-300 font-mono">
                              {r.qty > 0 ? `${r.qty} ${r.unit}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-center text-amber-300 font-mono">
                              {r.unitPrice > 0 ? `৳${r.unitPrice}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-black text-amber-400">
                              ৳{Number(r.amount).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-300 text-[11px]">{r.detailedPerson}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveParsedRow(r.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
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
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={parsedRows.length === 0 || isImporting}
                  onClick={handleExecuteImport}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-600/30 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {isImporting 
                      ? 'Importing Records...' 
                      : `Confirm & Import (${parsedRows.length} Rows • ৳${importSummary.totalAmount.toLocaleString()})`}
                  </span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settle Due Modal */}
      <AnimatePresence>
        {settleExpense && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      Settle Due Bill (বকেয়া পরিশোধ)
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {resolveExpenseDueShop(settleExpense)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettleExpense(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bill Details */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Item:</span>
                  <span className="font-black text-white">{settleExpense.desc}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Shop:</span>
                  <span className="font-bold text-amber-300">{resolveExpenseDueShop(settleExpense)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Date:</span>
                  <span className="font-mono text-slate-300">{formatCanteenDate(settleExpense.date)}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <span className="text-slate-300 font-black uppercase">Payable Due Amount:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    ৳{Number(settleExpense.amount).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Settlement Payment Method Selection */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Select Payment Source (কোন মাধ্যমে পরিশোধ করবেন):
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettleMethod('Cash')}
                    className={`p-3 rounded-2xl border text-xs font-black uppercase flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      settleMethod === 'Cash'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Cash (ক্যাশ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettleMethod('UCB')}
                    className={`p-3 rounded-2xl border text-xs font-black uppercase flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      settleMethod === 'UCB'
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>UCB (ব্যাংক)</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setSettleExpense(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSettling}
                  onClick={handleConfirmSettle}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSettling ? 'Processing...' : `Confirm Pay (৳${settleExpense.amount.toLocaleString()})`}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
