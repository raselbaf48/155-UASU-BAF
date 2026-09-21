import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Trash2, Banknote, X, Save, Edit2, AlertTriangle, CheckCircle2, 
  Calendar, Tag, FileText, ArrowLeft, Boxes, PackagePlus, UserCheck, Layers, 
  HelpCircle, RefreshCw, ChevronDown, CreditCard, Wallet
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { 
  autoRestockFromExpense, 
  getRawInventoryItems, 
  saveRawInventoryItems,
  RawInventoryItem,
  RawStockLog,
  RAW_LOGS_STORAGE_KEY
} from '../utils/recipeManager';
import { supabase } from '../../../supabase';

export interface ExpenseRecord {
  id: string | number;
  date: string;
  desc: string;
  subdesc?: string;
  category?: string;
  paymentMethod?: 'Cash' | 'UCB' | 'Due' | string;
  amount: number;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  detailedPerson?: string;
  isCustom?: boolean;
  rawItemId?: string;
}

const STORAGE_KEY = 'canteen_expenses';
const LAST_PRICES_KEY = 'canteen_expense_last_unit_prices';

export interface ExpenseItemEntry {
  uid: string;
  isCustom: boolean;
  rawItemId: string;
  itemName: string;
  qty: number | '';
  unit: string;
  unitPrice: number | '';
  amount: number;
}

export const Expenditures: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPage, setIsAddPage] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Raw Inventory items for selection
  const [rawItems, setRawItems] = useState<RawInventoryItem[]>([]);

  // Civilian members for Detailed Person
  const [civilians, setCivilians] = useState<Array<{ id: string; name: string }>>([]);
  const [detailedPerson, setDetailedPerson] = useState<string>('Civ Tanvir');

  // Shared Date and Payment Method for batch entry
  const [batchDate, setBatchDate] = useState<string>(formatCanteenDate(new Date()));
  const [batchPaymentMethod, setBatchPaymentMethod] = useState<'Cash' | 'UCB' | 'Due'>('Cash');

  // Selected item rows in Add Page
  const [itemRows, setItemRows] = useState<ExpenseItemEntry[]>([]);

  // Last unit prices store
  const [lastUnitPrices, setLastUnitPrices] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LAST_PRICES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // State for editing an existing row
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Sync with localStorage & events
  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setExpenses(raw ? JSON.parse(raw) : []);
      } catch {
        setExpenses([]);
      }
      try {
        setRawItems(getRawInventoryItems());
      } catch {
        setRawItems([]);
      }
      try {
        const rawPrices = localStorage.getItem(LAST_PRICES_KEY);
        if (rawPrices) setLastUnitPrices(JSON.parse(rawPrices));
      } catch {
        // ignore
      }
    };

    handleSync();
    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_raw_inventory_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_raw_inventory_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Fetch Civilian members from Supabase Canteen table
  useEffect(() => {
    const fetchCivilians = async () => {
      try {
        const { data, error } = await supabase.from('Canteen_Member').select('*');
        if (!error && data) {
          const civList = data
            .filter((m: any) => {
              const rank = (m.Rank || m.rank || '').toUpperCase();
              return rank.includes('CIV');
            })
            .map((m: any) => {
              const rank = m.Rank || m.rank || 'Civ';
              const name = m.Surname || m.surname || m.Name || m.name || '';
              return {
                id: m.airman_id || m['BD No'] || name,
                name: `${rank} ${name}`.trim()
              };
            });

          // Ensure default Civ Tanvir is present
          const hasTanvir = civList.some(c => c.name.toLowerCase().includes('tanvir'));
          if (!hasTanvir) {
            civList.unshift({ id: 'civ-tanvir', name: 'Civ Tanvir' });
          }

          // Also make sure Civ Nur Nabi or any others are available if not present
          const hasNurNabi = civList.some(c => c.name.toLowerCase().includes('nur nabi'));
          if (!hasNurNabi) {
            civList.push({ id: 'civ-nurnabi', name: 'Civ Nur Nabi' });
          }

          setCivilians(civList);
          // Set default to Civ Tanvir
          const defaultCiv = civList.find(c => c.name.toLowerCase().includes('tanvir'));
          if (defaultCiv) {
            setDetailedPerson(defaultCiv.name);
          } else if (civList.length > 0) {
            setDetailedPerson(civList[0].name);
          }
        } else {
          // Fallback civilians list
          setCivilians([
            { id: 'civ-tanvir', name: 'Civ Tanvir' },
            { id: 'civ-nurnabi', name: 'Civ Nur Nabi' }
          ]);
          setDetailedPerson('Civ Tanvir');
        }
      } catch (err) {
        console.warn('Failed to load Civilians from Supabase, using defaults:', err);
        setCivilians([
          { id: 'civ-tanvir', name: 'Civ Tanvir' },
          { id: 'civ-nurnabi', name: 'Civ Nur Nabi' }
        ]);
        setDetailedPerson('Civ Tanvir');
      }
    };

    fetchCivilians();
  }, []);

  const saveToStorage = (updated: ExpenseRecord[]) => {
    setExpenses(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('canteen_expenses_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.warn('Failed to save expenses:', err);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Helper to open Add Page with fresh default items
  const handleOpenAddPage = () => {
    setBatchDate(formatCanteenDate(new Date()));
    setBatchPaymentMethod('Cash');

    // Pre-populate with first raw item if empty
    const currentRaws = getRawInventoryItems();
    setRawItems(currentRaws);

    if (currentRaws.length > 0) {
      const first = currentRaws[0];
      const savedPrice = lastUnitPrices[first.id] !== undefined ? lastUnitPrices[first.id] : first.unitCost;
      const initialQty = 1;
      setItemRows([
        {
          uid: 'row-' + Date.now(),
          isCustom: false,
          rawItemId: first.id,
          itemName: first.name,
          qty: initialQty,
          unit: first.unit,
          unitPrice: savedPrice,
          amount: Math.round(initialQty * savedPrice)
        }
      ]);
    } else {
      setItemRows([
        {
          uid: 'row-' + Date.now(),
          isCustom: false,
          rawItemId: '',
          itemName: '',
          qty: '',
          unit: 'kg',
          unitPrice: '',
          amount: 0
        }
      ]);
    }

    setIsAddPage(true);
  };

  // Toggle or add a raw item to the batch selection
  const handleAddRawItemRow = (raw: RawInventoryItem) => {
    const savedPrice = lastUnitPrices[raw.id] !== undefined ? lastUnitPrices[raw.id] : raw.unitCost;
    const initialQty = 1;
    const newEntry: ExpenseItemEntry = {
      uid: 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      isCustom: false,
      rawItemId: raw.id,
      itemName: raw.name,
      qty: initialQty,
      unit: raw.unit,
      unitPrice: savedPrice,
      amount: Math.round(initialQty * savedPrice)
    };
    setItemRows(prev => [...prev, newEntry]);
  };

  // Add a Custom item row (does NOT restock inventory)
  const handleAddCustomRow = () => {
    const newEntry: ExpenseItemEntry = {
      uid: 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      isCustom: true,
      rawItemId: '',
      itemName: '',
      qty: 1,
      unit: 'item',
      unitPrice: '',
      amount: 0
    };
    setItemRows(prev => [...prev, newEntry]);
  };

  // Remove a row
  const handleRemoveRow = (uid: string) => {
    setItemRows(prev => prev.filter(r => r.uid !== uid));
  };

  // Update a field in a row
  const handleUpdateRowField = (uid: string, field: keyof ExpenseItemEntry, value: any) => {
    setItemRows(prev => prev.map(row => {
      if (row.uid !== uid) return row;

      const updated = { ...row, [field]: value };

      // If rawItemId changed, auto fill name, unit, and last price
      if (field === 'rawItemId') {
        const selected = rawItems.find(r => r.id === value);
        if (selected) {
          updated.itemName = selected.name;
          updated.unit = selected.unit;
          const rememberedPrice = lastUnitPrices[selected.id] !== undefined ? lastUnitPrices[selected.id] : selected.unitCost;
          updated.unitPrice = rememberedPrice;
        }
      }

      // Auto calculate Amount = Qty * Unit Price
      const q = typeof updated.qty === 'number' ? updated.qty : parseFloat(String(updated.qty)) || 0;
      const p = typeof updated.unitPrice === 'number' ? updated.unitPrice : parseFloat(String(updated.unitPrice)) || 0;
      updated.amount = Math.round(q * p * 100) / 100;

      return updated;
    }));
  };

  // Save all items from Add Page
  const handleSaveBatchExpenses = () => {
    const validRows = itemRows.filter(r => {
      const hasName = r.itemName.trim().length > 0;
      const hasAmount = r.amount > 0;
      return hasName && hasAmount;
    });

    if (validRows.length === 0) {
      alert('অনুগ্রহ করে কমপক্ষে একটি আইটেমের নাম, পরিমাণ (Qty) এবং ইউনিট দর (Unit Price) সঠিকভাবে প্রদান করুন।');
      return;
    }

    const newRecords: ExpenseRecord[] = [];
    const updatedLastPrices = { ...lastUnitPrices };
    let restockedCount = 0;

    validRows.forEach((row, idx) => {
      const q = typeof row.qty === 'number' ? row.qty : parseFloat(String(row.qty)) || 1;
      const p = typeof row.unitPrice === 'number' ? row.unitPrice : parseFloat(String(row.unitPrice)) || 0;

      // Save last unit price for the item
      if (!row.isCustom && row.rawItemId) {
        updatedLastPrices[row.rawItemId] = p;
      } else if (row.isCustom && row.itemName.trim()) {
        updatedLastPrices[`custom_${row.itemName.trim().toUpperCase()}`] = p;
      }

      const recId = 'exp-' + Date.now() + '-' + idx + '-' + Math.floor(Math.random() * 1000);
      const record: ExpenseRecord = {
        id: recId,
        date: batchDate ? formatCanteenDate(batchDate) : formatCanteenDate(new Date()),
        desc: row.itemName.trim().toUpperCase(),
        paymentMethod: batchPaymentMethod || 'Cash',
        amount: row.amount,
        qty: q,
        unit: row.unit || 'kg',
        unitPrice: p,
        detailedPerson: detailedPerson || 'Civ Tanvir',
        isCustom: row.isCustom,
        rawItemId: row.rawItemId || undefined
      };

      newRecords.push(record);

      // Auto-restock ONLY if NOT custom
      if (!row.isCustom) {
        const restockRes = autoRestockFromExpense({
          desc: record.desc,
          amount: record.amount,
          date: record.date,
          rawItemId: row.rawItemId || undefined,
          rawItemQty: q
        });
        if (restockRes && restockRes.success) {
          restockedCount++;
        }
      }
    });

    // Save expenses
    const updatedExpenses = [...newRecords, ...expenses];
    saveToStorage(updatedExpenses);

    // Save last unit prices
    setLastUnitPrices(updatedLastPrices);
    try {
      localStorage.setItem(LAST_PRICES_KEY, JSON.stringify(updatedLastPrices));
    } catch (e) {
      console.warn('Failed to save last unit prices:', e);
    }

    setIsAddPage(false);
    setItemRows([]);

    if (restockedCount > 0) {
      showToast(`${newRecords.length} টি খরচের হিসাব যুক্ত হয়েছে এবং ${restockedCount} টি কাঁচামাল স্টকে স্বয়ংক্রিয় রিস্টক হয়েছে!`);
    } else {
      showToast(`${newRecords.length} টি খরচের হিসাব সফলভাবে যুক্ত করা হয়েছে!`);
    }
  };

  const handleOpenEdit = (expense: ExpenseRecord) => {
    setEditingExpense({ ...expense });
    setConfirmDeleteId(null);
  };

  const handleUpdateExpense = () => {
    if (!editingExpense || !editingExpense.desc.trim() || Number(editingExpense.amount) <= 0) return;

    const q = Number(editingExpense.qty) || 1;
    const p = Number(editingExpense.unitPrice) || 0;
    const autoAmount = q > 0 && p > 0 ? Math.round(q * p * 100) / 100 : Number(editingExpense.amount) || 0;

    const updatedList = expenses.map(e => {
      if (e.id === editingExpense.id) {
        return {
          ...editingExpense,
          date: formatCanteenDate(editingExpense.date),
          desc: editingExpense.desc.trim().toUpperCase(),
          paymentMethod: editingExpense.paymentMethod || 'Cash',
          amount: autoAmount,
          qty: q,
          unit: editingExpense.unit || 'kg',
          unitPrice: p,
          detailedPerson: editingExpense.detailedPerson || 'Civ Tanvir'
        };
      }
      return e;
    });

    saveToStorage(updatedList);
    setEditingExpense(null);
    showToast('খরচের রেকর্ড সফলভাবে হালনাগাদ করা হয়েছে!');
  };

  const handleDelete = (id: string | number) => {
    const updated = expenses.filter(e => e.id !== id);
    saveToStorage(updated);
    if (editingExpense && editingExpense.id === id) {
      setEditingExpense(null);
    }
    setConfirmDeleteId(null);
    showToast('রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে!');
  };

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const filtered = expenses.filter(e => {
    const term = searchTerm.toLowerCase();
    return (
      e.desc.toLowerCase().includes(term) ||
      (e.detailedPerson && e.detailedPerson.toLowerCase().includes(term)) ||
      (e.paymentMethod && e.paymentMethod.toLowerCase().includes(term)) ||
      e.date.toLowerCase().includes(term)
    );
  });

  const batchTotalAmount = itemRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Dedicated Separate Page for Adding Record
  if (isAddPage) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed top-6 right-6 z-[200] bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-in slide-in-from-top-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs">{notification}</span>
          </div>
        )}

        {/* Back Button & Header */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setIsAddPage(false)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO EXPENDITURES</span>
          </button>
        </div>

        {/* Form Page Card */}
        <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-2xl border border-slate-800 space-y-8">
          <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                <Plus className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                  ADD NEW EXPENDITURE
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                  একসাথে একাধিক আইটেম নির্বাচন, রেট ও ডিটেইলার হিসাব এন্ট্রি
                </p>
              </div>
            </div>

            {/* Total Batch Amount Badge */}
            <div className="bg-indigo-500/10 border border-indigo-500/30 px-6 py-3 rounded-2xl flex items-center space-x-3">
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                BATCH TOTAL (মোট টাকা):
              </span>
              <span className="text-2xl font-black text-white tracking-tight">
                ৳{batchTotalAmount.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          {/* Common Settings: Date, Detailer Person, Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-950/60 p-5 rounded-3xl border border-slate-800/80">
            {/* Date */}
            <div>
              <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>DATE (তারিখ)</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. 21 Sep 26"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>

            {/* Detailed Person */}
            <div>
              <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block flex items-center space-x-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>DETAILER PERSON (দায়িত্বপ্রাপ্ত সদস্য)</span>
              </label>
              <select 
                value={detailedPerson}
                onChange={(e) => setDetailedPerson(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {civilians.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block flex items-center space-x-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                <span>PAYMENT METHOD (পেমেন্ট মাধ্যম)</span>
              </label>
              <select 
                value={batchPaymentMethod}
                onChange={(e) => setBatchPaymentMethod(e.target.value as 'Cash' | 'UCB' | 'Due')}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              >
                <option value="Cash">Cash (নগদ)</option>
                <option value="UCB">UCB</option>
                <option value="Due">Due (বাকি)</option>
              </select>
            </div>
          </div>

          {/* Quick Raw Item Multi-Select Badges */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Boxes className="w-4 h-4 text-indigo-400" />
                <span>MULTIPLE ITEM SELECT (কাঁচামাল তালিকা থেকে একাধিক আইটেম নির্বাচন করুন)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-bold">
                ক্লিক করলেই নিচের এন্ট্রি লিস্টে যোগ হবে
              </span>
            </div>

            <div className="flex flex-wrap gap-2 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 max-h-40 overflow-y-auto">
              {rawItems.map(raw => {
                const isAlreadyAdded = itemRows.some(r => !r.isCustom && r.rawItemId === raw.id);
                return (
                  <button
                    key={raw.id}
                    type="button"
                    onClick={() => handleAddRawItemRow(raw)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border ${
                      isAlreadyAdded
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{raw.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                      {raw.unit}
                    </span>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items Table / Row Entries */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>EXPENDITURE ITEMS LIST (নির্বাচিত খরচ তালিকা)</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">
                  {itemRows.length} টি
                </span>
              </h3>

              {/* Add Custom Item Button */}
              <button
                type="button"
                onClick={handleAddCustomRow}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ADD CUSTOM ITEM (ইনভেন্টরিতে যুক্ত হবে না)</span>
              </button>
            </div>

            {/* Grid Table of Item Rows */}
            <div className="space-y-3">
              {itemRows.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800 text-slate-400 text-xs font-bold">
                  কোনো আইটেম যোগ করা হয়নি। উপরের তালিকা থেকে আইটেমে ক্লিক করুন অথবা &quot;+ ADD CUSTOM ITEM&quot; বাটনে চাপুন।
                </div>
              ) : (
                itemRows.map((row, index) => (
                  <div 
                    key={row.uid}
                    className={`p-4 rounded-2xl border transition-all ${
                      row.isCustom 
                        ? 'bg-amber-950/20 border-amber-500/30' 
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      
                      {/* SL & Tag */}
                      <div className="md:col-span-1 flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        {row.isCustom ? (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                            Custom
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">
                            Auto
                          </span>
                        )}
                      </div>

                      {/* Item Name */}
                      <div className="md:col-span-4">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          ITEM NAME (আইটেমের নাম)
                        </label>
                        {row.isCustom ? (
                          <input 
                            type="text"
                            placeholder="e.g. Bazar Rickshaw/Bag/Misc"
                            value={row.itemName}
                            onChange={(e) => handleUpdateRowField(row.uid, 'itemName', e.target.value)}
                            className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs font-black text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        ) : (
                          <select
                            value={row.rawItemId}
                            onChange={(e) => handleUpdateRowField(row.uid, 'rawItemId', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">আইটেম নির্বাচন করুন...</option>
                            {rawItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.nameBn}) • {item.unit} {item.wastagePercentage ? `[${item.wastagePercentage}% Wastage]` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Qty */}
                      <div className="md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          QTY (পরিমাণ)
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          placeholder="1"
                          value={row.qty}
                          onChange={(e) => handleUpdateRowField(row.uid, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                        />
                        {(() => {
                          if (row.isCustom || !row.rawItemId) return null;
                          const rawObj = rawItems.find(r => r.id === row.rawItemId);
                          const wPct = Number(rawObj?.wastagePercentage) || 0;
                          const qVal = typeof row.qty === 'number' ? row.qty : parseFloat(String(row.qty)) || 0;
                          if (wPct > 0 && qVal > 0) {
                            const waste = Math.round((qVal * (wPct / 100)) * 1000) / 1000;
                            const net = Math.round((qVal - waste) * 1000) / 1000;
                            return (
                              <div className="mt-1 text-[10px] text-amber-400 font-semibold leading-tight text-center">
                                -{waste} অপচয় ({wPct}%)<br />
                                <span className="text-emerald-400 font-black">নিট: +{net} {row.unit}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Unit */}
                      <div className="md:col-span-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          UNIT
                        </label>
                        <input 
                          type="text"
                          placeholder="kg"
                          value={row.unit}
                          onChange={(e) => handleUpdateRowField(row.uid, 'unit', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2.5 text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                        />
                      </div>

                      {/* Unit Price (Rate) */}
                      <div className="md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                          <span>UNIT PRICE (দর ৳)</span>
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          placeholder="Last rate"
                          value={row.unitPrice}
                          onChange={(e) => handleUpdateRowField(row.uid, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                        />
                      </div>

                      {/* Amount (Auto Calculate) */}
                      <div className="md:col-span-1 text-right">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          AMOUNT (মোট ৳)
                        </label>
                        <div className="py-2.5 text-xs font-black text-white">
                          ৳{row.amount.toLocaleString('en-US')}
                        </div>
                      </div>

                      {/* Delete Row Button */}
                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.uid)}
                          className="p-2 text-rose-400 hover:text-white hover:bg-rose-600/20 rounded-xl transition-colors"
                          title="আইটেমটি বাদ দিন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Total summary */}
            {itemRows.length > 0 && (
              <div className="flex justify-end items-center pt-2">
                <div className="text-right bg-slate-950/60 border border-slate-800 px-5 py-2.5 rounded-2xl">
                  <span className="text-xs text-slate-400 font-bold uppercase mr-2">সর্বমোট:</span>
                  <span className="text-lg font-black text-emerald-400">৳{batchTotalAmount.toLocaleString('en-US')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-slate-800 flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => setIsAddPage(false)}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-colors"
            >
              CANCEL
            </button>
            <button 
              type="button"
              onClick={handleSaveBatchExpenses}
              className="px-8 py-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-lg shadow-indigo-500/25 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>SAVE EXPENDITURE RECORDS (৳{batchTotalAmount.toLocaleString('en-US')})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs">{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">EXPENDITURES</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              MANAGER OPERATIONS NODE • MULTI-ITEM SELECTION & DETAILER TRACKING
            </p>
          </div>
        </div>

        <button 
          onClick={handleOpenAddPage} 
          className="flex items-center space-x-2 px-5 py-3 bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-md shadow-indigo-500/20 rounded-xl text-[10px] font-black tracking-widest uppercase transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>ADD RECORD</span>
        </button>
      </div>

      {/* Stats and Search */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Total Spending */}
        <div className="md:w-1/3 bg-slate-900 rounded-3xl p-8 shadow-sm border-2 border-[#4f46e5] flex flex-col justify-center min-h-[140px]">
          <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">TOTAL SPENDING</p>
          <h3 className="text-4xl font-black text-white tracking-tighter">৳{total.toLocaleString('en-US')}</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">
            {expenses.length} TOTAL EXPENDITURE RECORDS
          </p>
        </div>

        {/* Search */}
        <div className="md:w-2/3 flex items-center">
          <div className="relative w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search expenses by item, detailer, payment method or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-full pl-14 pr-6 py-5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
        
        {/* Table Header Bar */}
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">
                EXPENDITURE RECORDS LIST
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {filtered.length} of {expenses.length} records shown • Click any row to edit or remove
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">ITEM NAME</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">QTY & UNIT</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">UNIT PRICE</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">DETAILED PERSON</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">PAYMENT METHOD</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    {expenses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Banknote className="w-8 h-8 text-slate-600 mb-1" />
                        <span className="text-slate-300 font-black">No expenditure records yet</span>
                        <span className="text-slate-500 text-[10px] normal-case">
                          নতুন খরচের হিসাব এন্ট্রি করতে উপরের &quot;+ ADD RECORD&quot; বাটনে ক্লিক করুন।
                        </span>
                      </div>
                    ) : (
                      'No expenditure records matching search criteria'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((expense) => (
                  <tr 
                    key={expense.id} 
                    onClick={() => handleOpenEdit(expense)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    title="রেকর্ডটি দেখতে, পরিবর্তন বা ডিলিট করতে ক্লিক করুন"
                  >
                    {/* Date */}
                    <td className="py-4 px-6 text-[11px] font-mono font-bold text-slate-300 whitespace-nowrap">
                      {formatCanteenDate(expense.date)}
                    </td>

                    {/* Item Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-black text-white uppercase group-hover:text-indigo-300 transition-colors">
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
                    <td className="py-4 px-6 text-center text-xs font-bold text-slate-300">
                      {expense.qty !== undefined ? (
                        <span>
                          {expense.qty} <span className="text-slate-500 text-[10px]">{expense.unit || 'kg'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Unit Price */}
                    <td className="py-4 px-6 text-center text-xs font-mono font-bold text-indigo-300">
                      {expense.unitPrice ? (
                        <span>৳{expense.unitPrice}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Detailed Person */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold">
                        <UserCheck className="w-3 h-3 mr-1" />
                        <span>{expense.detailedPerson || 'Civ Tanvir'}</span>
                      </span>
                    </td>

                    {/* Payment Method */}
                    <td className="py-4 px-6 text-center">
                      {expense.paymentMethod === 'UCB' ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-[10px] font-black tracking-wider uppercase">
                          UCB
                        </span>
                      ) : expense.paymentMethod === 'Due' ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black tracking-wider uppercase">
                          Due
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black tracking-wider uppercase">
                          Cash
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-6 text-right text-sm font-black text-white">
                      ৳{Number(expense.amount).toLocaleString('en-US')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Edit & Delete Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-xl shadow-2xl animate-in zoom-in-95 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    EDIT / REMOVE EXPENDITURE
                  </h3>
                  <p className="text-xs text-slate-400">
                    খরচের বিবরণ পরিবর্তন করুন অথবা রেকর্ডটি মুছে ফেলুন
                  </p>
                </div>
              </div>

              <button 
                onClick={() => { setEditingExpense(null); setConfirmDeleteId(null); }}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    DATE
                  </label>
                  <input 
                    type="text"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Detailed Person */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    DETAILED PERSON
                  </label>
                  <select 
                    value={editingExpense.detailedPerson || 'Civ Tanvir'}
                    onChange={(e) => setEditingExpense({ ...editingExpense, detailedPerson: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {civilians.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Item Name */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  ITEM NAME (বিবরণ)
                </label>
                <input 
                  type="text"
                  value={editingExpense.desc}
                  onChange={(e) => setEditingExpense({ ...editingExpense, desc: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                />
              </div>

              {/* Qty, Unit, Unit Price, Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    QTY (পরিমাণ)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={editingExpense.qty ?? ''}
                    onChange={(e) => {
                      const q = parseFloat(e.target.value) || 0;
                      const p = Number(editingExpense.unitPrice) || 0;
                      setEditingExpense({
                        ...editingExpense,
                        qty: q,
                        amount: p > 0 ? Math.round(q * p * 100) / 100 : editingExpense.amount
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    UNIT (একক)
                  </label>
                  <input 
                    type="text"
                    value={editingExpense.unit || ''}
                    onChange={(e) => setEditingExpense({ ...editingExpense, unit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    UNIT PRICE (দর ৳)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={editingExpense.unitPrice ?? ''}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      const q = Number(editingExpense.qty) || 1;
                      setEditingExpense({
                        ...editingExpense,
                        unitPrice: p,
                        amount: Math.round(q * p * 100) / 100
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Payment Method */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    PAYMENT METHOD (পেমেন্ট মাধ্যম)
                  </label>
                  <select 
                    value={editingExpense.paymentMethod || 'Cash'}
                    onChange={(e) => setEditingExpense({ ...editingExpense, paymentMethod: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash (নগদ)</option>
                    <option value="UCB">UCB</option>
                    <option value="Due">Due (বাকি)</option>
                  </select>
                </div>

                {/* Amount (Total) */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    AMOUNT (টাকা ৳)
                  </label>
                  <input 
                    type="number"
                    value={editingExpense.amount || ''}
                    onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDelete(editingExpense.id)}
                className="px-4 py-3 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>REMOVE RECORD</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => { setEditingExpense(null); setConfirmDeleteId(null); }}
                  className="flex-1 sm:flex-initial px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleUpdateExpense}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-md shadow-indigo-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>SAVE CHANGES</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Quick Delete Confirmation Modal */}
      {confirmDeleteId && !editingExpense && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[170] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">রেকর্ডটি মুছে ফেলতে চান?</h4>
              <p className="text-xs text-slate-400 mt-1">
                এই খরচের রেকর্ডটি চিরতরে মুছে যাবে।
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider"
              >
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
