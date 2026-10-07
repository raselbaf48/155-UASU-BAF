import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Trash2, Banknote, X, Save, Edit2, AlertTriangle, CheckCircle2, 
  Calendar, Tag, FileText, Boxes, UserCheck, Layers, 
  Wallet, ShoppingCart, DollarSign, Store, Utensils,
  Check, PackagePlus, History, Clock, ArrowDownLeft, ArrowUpRight,
  Filter, CheckSquare, Sparkles, ChevronRight, User
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { 
  autoRestockFromExpense, 
  getRawInventoryItems, 
  RawInventoryItem 
} from '../utils/recipeManager';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud } from '../utils/canteenCloudSync';

export const DUE_SHOPS = ['Grocessary Shop', 'Poultry Shop', 'Bake & Bite'] as const;
export type DueShopName = typeof DUE_SHOPS[number];

export interface ExpenseRecord {
  id: string | number;
  date: string;
  desc: string;
  subdesc?: string;
  category?: string;
  paymentMethod?: 'Cash' | 'UCB' | 'Due' | string;
  dueShop?: 'Grocessary Shop' | 'Poultry Shop' | 'Bake & Bite' | string;
  amount: number;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  detailedPerson?: string;
  isCustom?: boolean;
  rawItemId?: string;
  advanceId?: string;
}

export interface BazarAdvance {
  id: string;
  date: string;
  personName: string;
  amount: number;
  spentAmount: number;
  returnAmount: number;
  channel: 'CASH' | 'UCB';
  purpose: string;
  status: 'ACTIVE' | 'SETTLED';
  settledDate?: string;
  notes?: string;
}

const STORAGE_KEY = 'canteen_expenses';
const ADVANCES_KEY = 'canteen_bazar_advances';

interface ItemRowInput {
  id: string;
  desc: string;
  rawItemId?: string;
  category: string;
  qty: number | '';
  unit: string;
  unitPrice: number | '';
  amount: number | '';
}

const CATEGORIES = [
  'Grocery',
  'Poultry',
  'Bakery',
  'Vegetables',
  'Dairy',
  'Spices',
  'Cooking Oil',
  'Beverages',
  'Snacks',
  'Gas & Fuel',
  'Cleaning',
  'Misc'
];

export const Expenditures: React.FC = () => {
  // Main states
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [advances, setAdvances] = useState<BazarAdvance[]>(() => {
    try {
      const raw = localStorage.getItem(ADVANCES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [rawItems, setRawItems] = useState<RawInventoryItem[]>([]);
  const [civilians, setCivilians] = useState<Array<{ id: string; name: string }>>([
    { id: 'civ-tanvir', name: 'Civ Tanvir' },
    { id: 'civ-nurnabi', name: 'Civ Nur Nabi' }
  ]);

  // Main UI Mode / Modal States
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAdvanceRegisterModal, setShowAdvanceRegisterModal] = useState(false);

  // Search & Filters for Main Table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'Cash' | 'UCB' | 'Due'>('ALL');
  const [filterShop, setFilterShop] = useState<'ALL' | DueShopName>('ALL');
  const [filterPerson, setFilterPerson] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | 'THIS_MONTH' | 'TODAY'>('ALL');

  // History Modal Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyChannelFilter, setHistoryChannelFilter] = useState<'ALL' | 'Cash' | 'UCB' | 'Due'>('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'TODAY'>('ALL');

  // New Expense Form State
  const [formDate, setFormDate] = useState(formatCanteenDate(new Date()));
  const [formPerson, setFormPerson] = useState('Civ Tanvir');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'Cash' | 'UCB' | 'Due'>('Cash');
  const [formDueShop, setFormDueShop] = useState<DueShopName>('Grocessary Shop');
  const [itemRows, setItemRows] = useState<ItemRowInput[]>([
    {
      id: 'row-1',
      desc: '',
      category: 'Grocery',
      qty: 1,
      unit: 'kg',
      unitPrice: '',
      amount: ''
    }
  ]);

  // Inventory Item Selector in Form (like Member Selection in POS Sales)
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');

  // Register Advance Form State
  const [advDate, setAdvDate] = useState(formatCanteenDate(new Date()));
  const [advPerson, setAdvPerson] = useState('Civ Tanvir');
  const [advAmount, setAdvAmount] = useState<number | ''>('');
  const [advChannel, setAdvChannel] = useState<'CASH' | 'UCB'>('CASH');
  const [advPurpose, setAdvPurpose] = useState('Daily Bazar Advance');

  // Advance Settle / Return Modal State
  const [settlingAdvance, setSettlingAdvance] = useState<BazarAdvance | null>(null);
  const [settleSpent, setSettleSpent] = useState<number | ''>('');
  const [settleReturn, setSettleReturn] = useState<number | ''>('');
  const [settleNotes, setSettleNotes] = useState('');

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);

  // Delete Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | number | null>(null);

  // UI state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial load & data listener
  useEffect(() => {
    setRawItems(getRawInventoryItems());

    // Pull from cloud silently
    const pullCloud = async () => {
      try {
        const cloudExp = await pullKeyFromCloud(STORAGE_KEY);
        if (Array.isArray(cloudExp)) {
          const localExp: ExpenseRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
          const map = new Map<string, ExpenseRecord>();
          [...cloudExp, ...localExp].forEach(e => {
            if (e && e.id) map.set(String(e.id), e);
          });
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          setExpenses(merged);
        }

        const cloudAdv = await pullKeyFromCloud(ADVANCES_KEY);
        if (Array.isArray(cloudAdv)) {
          const localAdv: BazarAdvance[] = JSON.parse(localStorage.getItem(ADVANCES_KEY) || '[]');
          const advMap = new Map<string, BazarAdvance>();
          [...cloudAdv, ...localAdv].forEach(a => {
            if (a && a.id) advMap.set(String(a.id), a);
          });
          const mergedAdv = Array.from(advMap.values());
          localStorage.setItem(ADVANCES_KEY, JSON.stringify(mergedAdv));
          setAdvances(mergedAdv);
        }
      } catch (err) {
        console.warn('Expense sync error:', err);
      }
    };
    pullCloud();

    // Fetch civilians from Canteen_Member
    const fetchCivilians = async () => {
      try {
        const { data } = await supabase.from('Canteen_Member').select('*');
        if (data && Array.isArray(data)) {
          const civList = data
            .filter((m: any) => {
              const rank = (m.Rank || m.rank || '').toUpperCase();
              return rank.includes('CIV');
            })
            .map((m: any) => ({
              id: m.airman_id || m['BD No'] || m.Name || m.name,
              name: `${m.Rank || 'Civ'} ${m.Surname || m.surname || m.Name || ''}`.trim()
            }));

          if (!civList.some(c => c.name.toLowerCase().includes('tanvir'))) {
            civList.unshift({ id: 'civ-tanvir', name: 'Civ Tanvir' });
          }
          if (!civList.some(c => c.name.toLowerCase().includes('nur nabi'))) {
            civList.push({ id: 'civ-nurnabi', name: 'Civ Nur Nabi' });
          }
          setCivilians(civList);
        }
      } catch {}
    };

    fetchCivilians();

    const handleSync = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setExpenses(raw ? JSON.parse(raw) : []);
      } catch {}
      try {
        const rawAdv = localStorage.getItem(ADVANCES_KEY);
        setAdvances(rawAdv ? JSON.parse(rawAdv) : []);
      } catch {}
      setRawItems(getRawInventoryItems());
    };

    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_bazar_advances_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_bazar_advances_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Today & Month strings
  const todayStr = useMemo(() => formatCanteenDate(new Date()), []);
  const currentMonthKey = useMemo(() => {
    const parts = todayStr.split('-');
    return parts.length >= 2 ? `${parts[1]}-${parts[2]}` : '';
  }, [todayStr]);

  // Calculate Metrics
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let ucb = 0;
    let due = 0;
    let grocDue = 0;
    let poultryDue = 0;
    let bakeDue = 0;

    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      total += amt;

      const method = String(e.paymentMethod || '').toLowerCase();
      if (method === 'cash') {
        cash += amt;
      } else if (method === 'ucb') {
        ucb += amt;
      } else if (method === 'due') {
        due += amt;
        const shop = String(e.dueShop || '').toLowerCase();
        if (shop.includes('poultry')) poultryDue += amt;
        else if (shop.includes('bake') || shop.includes('bite')) bakeDue += amt;
        else grocDue += amt;
      }
    });

    const activeAdvances = advances.filter(a => a.status === 'ACTIVE');
    const totalActiveAdvance = activeAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    return { total, cash, ucb, due, grocDue, poultryDue, bakeDue, totalActiveAdvance, activeAdvancesCount: activeAdvances.length };
  }, [expenses, advances]);

  // Filtered List for Main Table
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const search = searchTerm.toLowerCase();
      const matchSearch = 
        !search ||
        (e.desc || '').toLowerCase().includes(search) ||
        (e.date || '').toLowerCase().includes(search) ||
        (e.detailedPerson || '').toLowerCase().includes(search) ||
        (e.category || '').toLowerCase().includes(search) ||
        (e.dueShop || '').toLowerCase().includes(search);

      const method = String(e.paymentMethod || '').toLowerCase();
      let matchMethod = true;
      if (filterMethod === 'Cash') matchMethod = method === 'cash';
      else if (filterMethod === 'UCB') matchMethod = method === 'ucb';
      else if (filterMethod === 'Due') {
        matchMethod = method === 'due';
        if (matchMethod && filterShop !== 'ALL') {
          const shop = String(e.dueShop || '').toLowerCase();
          if (filterShop === 'Poultry Shop') matchMethod = shop.includes('poultry');
          else if (filterShop === 'Bake & Bite') matchMethod = shop.includes('bake') || shop.includes('bite');
          else matchMethod = !shop.includes('poultry') && !shop.includes('bake');
        }
      }

      const matchPerson = filterPerson === 'ALL' || e.detailedPerson === filterPerson;

      let matchDate = true;
      if (filterDateRange === 'TODAY') {
        matchDate = e.date === todayStr;
      } else if (filterDateRange === 'THIS_MONTH') {
        matchDate = (e.date || '').endsWith(currentMonthKey);
      }

      return matchSearch && matchMethod && matchPerson && matchDate;
    });
  }, [expenses, searchTerm, filterMethod, filterShop, filterPerson, filterDateRange, todayStr, currentMonthKey]);

  // Filtered List for History Modal
  const filteredHistory = useMemo(() => {
    return expenses.filter(e => {
      const search = historySearch.toLowerCase();
      const matchSearch = 
        !search ||
        (e.desc || '').toLowerCase().includes(search) ||
        (e.date || '').toLowerCase().includes(search) ||
        (e.detailedPerson || '').toLowerCase().includes(search) ||
        (e.category || '').toLowerCase().includes(search) ||
        (e.dueShop || '').toLowerCase().includes(search);

      const method = String(e.paymentMethod || '').toLowerCase();
      let matchMethod = true;
      if (historyChannelFilter === 'Cash') matchMethod = method === 'cash';
      else if (historyChannelFilter === 'UCB') matchMethod = method === 'ucb';
      else if (historyChannelFilter === 'Due') matchMethod = method === 'due';

      let matchDate = true;
      if (historyDateFilter === 'TODAY') {
        matchDate = e.date === todayStr;
      } else if (historyDateFilter === 'THIS_MONTH') {
        matchDate = (e.date || '').endsWith(currentMonthKey);
      }

      return matchSearch && matchMethod && matchDate;
    });
  }, [expenses, historySearch, historyChannelFilter, historyDateFilter, todayStr, currentMonthKey]);

  // Inventory Items filtering for Item Selection panel (Like POS Sales Member selection)
  const availableInventoryCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('ALL');
    rawItems.forEach(i => {
      if (i.category) cats.add(i.category.trim());
    });
    return Array.from(cats);
  }, [rawItems]);

  const filteredRawInventory = useMemo(() => {
    return rawItems.filter(item => {
      const s = inventorySearch.toLowerCase();
      const matchesSearch = 
        !s ||
        (item.name || '').toLowerCase().includes(s) ||
        (item.nameBn || '').toLowerCase().includes(s) ||
        (item.category || '').toLowerCase().includes(s);

      const matchesCat = inventoryCategoryFilter === 'ALL' || item.category === inventoryCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [rawItems, inventorySearch, inventoryCategoryFilter]);

  // Select an inventory item into current row or append new row
  const handleSelectInventoryItem = (item: RawInventoryItem) => {
    const itemName = item.nameBn || item.name;
    const cat = item.category || 'Grocery';
    const rate = item.unitCost || '';
    const unit = item.unit || 'kg';

    setItemRows(prev => {
      // Find if first row is completely empty, use it
      const firstEmptyIndex = prev.findIndex(r => !r.desc.trim() && !r.amount);
      if (firstEmptyIndex !== -1) {
        return prev.map((r, i) => {
          if (i !== firstEmptyIndex) return r;
          const qty = r.qty || 1;
          const amt = typeof rate === 'number' && rate > 0 ? Number(qty) * rate : r.amount;
          return {
            ...r,
            desc: itemName,
            category: cat,
            rawItemId: item.id,
            unit: unit,
            unitPrice: rate,
            qty: qty,
            amount: amt
          };
        });
      }

      // Check if already in rows, just increment qty
      const existingIdx = prev.findIndex(r => r.rawItemId === item.id || r.desc === itemName);
      if (existingIdx !== -1) {
        return prev.map((r, i) => {
          if (i !== existingIdx) return r;
          const newQty = (parseFloat(r.qty as any) || 0) + 1;
          const p = parseFloat(r.unitPrice as any) || 0;
          return {
            ...r,
            qty: newQty,
            amount: p > 0 ? Math.round(newQty * p) : r.amount
          };
        });
      }

      // Otherwise append new row
      return [
        ...prev,
        {
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          desc: itemName,
          category: cat,
          rawItemId: item.id,
          qty: 1,
          unit: unit,
          unitPrice: rate,
          amount: typeof rate === 'number' && rate > 0 ? rate : ''
        }
      ];
    });

    showToast(`✓ Added "${itemName}" to voucher items!`);
  };

  // Add another manual row
  const handleAddRow = () => {
    setItemRows(prev => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        desc: '',
        category: formPaymentMethod === 'Due' && formDueShop === 'Poultry Shop' ? 'Poultry' :
                  formPaymentMethod === 'Due' && formDueShop === 'Bake & Bite' ? 'Bakery' : 'Grocery',
        qty: 1,
        unit: 'kg',
        unitPrice: '',
        amount: ''
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (itemRows.length <= 1) return;
    setItemRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof ItemRowInput, value: any) => {
    setItemRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };

      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? parseFloat(value) : parseFloat(r.qty as any);
        const p = field === 'unitPrice' ? parseFloat(value) : parseFloat(r.unitPrice as any);
        if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
          updated.amount = Math.round(q * p);
        }
      }

      return updated;
    }));
  };

  // Form total amount
  const formTotalAmount = useMemo(() => {
    return itemRows.reduce((sum, r) => sum + (parseFloat(r.amount as any) || 0), 0);
  }, [itemRows]);

  // Save new expenses
  const handleSaveNewExpenses = async () => {
    const validRows = itemRows.filter(r => r.desc.trim() && (parseFloat(r.amount as any) > 0 || (parseFloat(r.qty as any) > 0 && parseFloat(r.unitPrice as any) > 0)));

    if (validRows.length === 0) {
      alert('Please enter at least one valid item name and amount.');
      return;
    }

    setIsSaving(true);
    try {
      const newRecords: ExpenseRecord[] = validRows.map((r, idx) => {
        const qtyNum = parseFloat(r.qty as any) || undefined;
        const priceNum = parseFloat(r.unitPrice as any) || undefined;
        let amt = parseFloat(r.amount as any);
        if (isNaN(amt) || amt <= 0) {
          amt = (qtyNum && priceNum) ? qtyNum * priceNum : 0;
        }

        return {
          id: `exp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          date: formDate,
          desc: r.desc.trim(),
          category: r.category || 'Grocery',
          paymentMethod: formPaymentMethod,
          dueShop: formPaymentMethod === 'Due' ? formDueShop : undefined,
          qty: qtyNum,
          unit: r.unit || 'kg',
          unitPrice: priceNum,
          amount: amt,
          detailedPerson: formPerson,
          rawItemId: r.rawItemId,
          isCustom: !r.rawItemId
        };
      });

      const updatedAll = [...newRecords, ...expenses];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
      setExpenses(updatedAll);

      // Auto restock raw inventory if linked
      for (const rec of newRecords) {
        if (rec.rawItemId && rec.qty) {
          try {
            autoRestockFromExpense({
              desc: rec.desc,
              amount: rec.amount,
              date: rec.date,
              rawItemId: rec.rawItemId,
              rawItemQty: rec.qty
            });
          } catch {}
        }
      }

      // Push to cloud
      try {
        await pushKeyToCloud(STORAGE_KEY, updatedAll);
      } catch (err) {
        console.warn('Could not push to cloud:', err);
      }

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updatedAll }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(`✅ Saved ${newRecords.length} expense item(s) totaling ৳${formTotalAmount.toLocaleString()}!`);
      
      setShowAddForm(false);
      setItemRows([
        {
          id: 'row-1',
          desc: '',
          category: 'Grocery',
          qty: 1,
          unit: 'kg',
          unitPrice: '',
          amount: ''
        }
      ]);
    } catch (err: any) {
      alert(`Failed to save: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Register New Bazar Advance
  const handleSaveNewAdvance = async () => {
    const amt = parseFloat(String(advAmount));
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid advance amount (> 0).');
      return;
    }

    try {
      const newAdv: BazarAdvance = {
        id: `adv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: advDate,
        personName: advPerson,
        amount: amt,
        spentAmount: 0,
        returnAmount: 0,
        channel: advChannel,
        purpose: advPurpose.trim() || 'Daily Bazar Advance',
        status: 'ACTIVE'
      };

      const updatedAdvances = [newAdv, ...advances];
      localStorage.setItem(ADVANCES_KEY, JSON.stringify(updatedAdvances));
      setAdvances(updatedAdvances);

      try {
        await pushKeyToCloud(ADVANCES_KEY, updatedAdvances);
      } catch {}

      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(`✅ Advance ৳${amt.toLocaleString()} issued to ${advPerson}!`);
      setAdvAmount('');
      setAdvPurpose('Daily Bazar Advance');
    } catch (err: any) {
      alert(`Failed to issue advance: ${err?.message || 'Error'}`);
    }
  };

  // Settle / Return Bazar Advance
  const handleConfirmSettleAdvance = async () => {
    if (!settlingAdvance) return;
    const spent = parseFloat(String(settleSpent)) || 0;
    const returned = parseFloat(String(settleReturn)) || 0;

    try {
      const updatedAdvances = advances.map(a => {
        if (a.id === settlingAdvance.id) {
          return {
            ...a,
            spentAmount: spent,
            returnAmount: returned,
            status: 'SETTLED' as const,
            settledDate: formatCanteenDate(new Date()),
            notes: settleNotes.trim() || a.notes
          };
        }
        return a;
      });

      localStorage.setItem(ADVANCES_KEY, JSON.stringify(updatedAdvances));
      setAdvances(updatedAdvances);

      try {
        await pushKeyToCloud(ADVANCES_KEY, updatedAdvances);
      } catch {}

      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(`✅ Advance settled for ${settlingAdvance.personName} (Spent: ৳${spent}, Returned: ৳${returned})`);
      setSettlingAdvance(null);
      setSettleSpent('');
      setSettleReturn('');
      setSettleNotes('');
    } catch (err: any) {
      alert(`Settle failed: ${err?.message || 'Error'}`);
    }
  };

  // Update an existing expense
  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    setIsSaving(true);
    try {
      const updatedAll = expenses.map(e => String(e.id) === String(editingExpense.id) ? editingExpense : e);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
      setExpenses(updatedAll);

      try {
        await pushKeyToCloud(STORAGE_KEY, updatedAll);
      } catch {}

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updatedAll }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(`✅ Expense updated successfully!`);
      setEditingExpense(null);
    } catch (err: any) {
      alert(`Failed to update: ${err?.message || 'Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete an expense
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const updatedAll = expenses.filter(e => String(e.id) !== String(deleteTargetId));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
      setExpenses(updatedAll);

      try {
        await pushKeyToCloud(STORAGE_KEY, updatedAll);
      } catch {}

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updatedAll }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(`🗑️ Expense record deleted.`);
      setDeleteTargetId(null);
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Error'}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      
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
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  EXPENCE REGISTER
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black border border-indigo-500/30">
                  DAILY EXPENSES
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Canteen Daily Expenses & Purchase Register • খরচের হিসাব
              </p>
            </div>
          </div>
        </div>

        {/* Top Action Buttons: Add Expense, Advance Register, and History (Sync button removed) */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto flex-wrap gap-y-2">
          {/* + ADD EXPENSE */}
          <button
            type="button"
            onClick={() => setShowAddForm(prev => !prev)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-2 shadow-md cursor-pointer active:scale-95 ${
              showAddForm
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 border border-rose-500/40'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-600/30 border border-indigo-400/40'
            }`}
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showAddForm ? 'CLOSE FORM' : '+ ADD EXPENSE'}</span>
          </button>

          {/* REGISTER ADVANCE BUTTON */}
          <button
            type="button"
            onClick={() => setShowAdvanceRegisterModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-2 shadow-md shadow-amber-600/30 cursor-pointer active:scale-95 border border-amber-400/40"
            title="Manage bazar advance issued to staff/civilians"
          >
            <Clock className="w-4 h-4" />
            <span>REGISTER ADVANCE</span>
            {metrics.activeAdvancesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white text-amber-900 font-mono text-[9px] font-black">
                {metrics.activeAdvancesCount}
              </span>
            )}
          </button>

          {/* HISTORY BUTTON (Replaces Sync option, named 'History') */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-2 border border-slate-700 shadow-sm cursor-pointer active:scale-95"
            title="View full expense records history"
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span>HISTORY</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expense */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              TOTAL EXPENSES
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white font-mono tracking-tight">
            ৳{metrics.total.toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1">
            {expenses.length} Total recorded voucher items
          </p>
        </div>

        {/* Cash Expenses */}
        <div 
          onClick={() => setFilterMethod(filterMethod === 'Cash' ? 'ALL' : 'Cash')}
          className={`border rounded-3xl p-5 cursor-pointer transition-all ${
            filterMethod === 'Cash' 
              ? 'bg-emerald-950/50 border-emerald-500 shadow-lg shadow-emerald-950/40' 
              : 'bg-slate-900 border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              CASH PAID
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
            ৳{metrics.cash.toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {filterMethod === 'Cash' ? 'Filter Active ✓' : 'Click to filter Cash'}
          </p>
        </div>

        {/* UCB Expenses */}
        <div 
          onClick={() => setFilterMethod(filterMethod === 'UCB' ? 'ALL' : 'UCB')}
          className={`border rounded-3xl p-5 cursor-pointer transition-all ${
            filterMethod === 'UCB' 
              ? 'bg-cyan-950/50 border-cyan-500 shadow-lg shadow-cyan-950/40' 
              : 'bg-slate-900 border-slate-800 hover:border-cyan-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
              UCB / BANK PAID
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-cyan-400 font-mono tracking-tight">
            ৳{metrics.ucb.toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {filterMethod === 'UCB' ? 'Filter Active ✓' : 'Click to filter UCB'}
          </p>
        </div>

        {/* Due / Payable */}
        <div 
          onClick={() => setFilterMethod(filterMethod === 'Due' ? 'ALL' : 'Due')}
          className={`border rounded-3xl p-5 cursor-pointer transition-all ${
            filterMethod === 'Due' 
              ? 'bg-amber-950/50 border-amber-500 shadow-lg shadow-amber-950/40' 
              : 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              DUE / PAYABLE
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-400 font-mono tracking-tight">
            ৳{metrics.due.toLocaleString()}
          </h3>
          <div className="flex items-center space-x-1 mt-1 text-[9px] font-mono text-slate-400">
            <span>G: ৳{metrics.grocDue}</span>
            <span>•</span>
            <span>P: ৳{metrics.poultryDue}</span>
            <span>•</span>
            <span>B: ৳{metrics.bakeDue}</span>
          </div>
        </div>
      </div>

      {/* ADD NEW EXPENSE FORM (WITH INVENTORY ITEM SELECTION LIKE POS SALES MEMBER SYSTEM) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <PackagePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      NEW EXPENSE VOUCHER ENTRY
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      ইনভেন্টরি আইটেম সিলেক্ট করুন অথবা সরাসরি নতুন এন্ট্রি দিন
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    VOUCHER TOTAL: ৳{formTotalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Header Fields: Date, Person, Payment Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                {/* Date */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    VOUCHER DATE (তারিখ)
                  </label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Person */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    DETAILER / PERSON (দায়িত্বপ্রাপ্ত ব্যক্তি)
                  </label>
                  <select
                    value={formPerson}
                    onChange={(e) => setFormPerson(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {civilians.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Channel */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    PAYMENT METHOD (পরিশোধ মাধ্যম)
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash (নগদ ক্যাশ)</option>
                    <option value="UCB">UCB (ব্যাংক)</option>
                    <option value="Due">Due (বকেয়া দোকান বিল)</option>
                  </select>
                </div>
              </div>

              {/* If Payment Method is DUE: PROMINENT SHOP SELECTOR */}
              {formPaymentMethod === 'Due' && (
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-950 to-amber-950/30 border-2 border-amber-500/50 rounded-2xl p-4 animate-in fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Store className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black text-amber-300 uppercase tracking-widest">
                        SELECT DUE SHOP (কোন দোকানে বকেয়া হবে):
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400/80">
                      Auto added to Due Register ✓
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {DUE_SHOPS.map(shop => {
                      const isSelected = formDueShop === shop;
                      return (
                        <div
                          key={shop}
                          onClick={() => setFormDueShop(shop)}
                          className={`p-3.5 rounded-xl border text-xs font-black uppercase flex items-center justify-between cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30 scale-[1.02]'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {shop === 'Grocessary Shop' && <ShoppingCart className="w-4 h-4 text-emerald-400" />}
                            {shop === 'Poultry Shop' && <Layers className="w-4 h-4 text-amber-400" />}
                            {shop === 'Bake & Bite' && <Utensils className="w-4 h-4 text-purple-400" />}
                            <span>{shop}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* INVENTORY ITEM PICKER (POS SALES MEMBER SELECTION STYLE) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center space-x-2 uppercase tracking-wider">
                      <Boxes className="w-4 h-4 text-indigo-400" />
                      <span>Select From Raw Inventory (ইনভেন্টরি আইটেম)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      আইটেমে ক্লিক করলে স্বয়ংক্রিয়ভাবে নিচে খরচের ভাউচার তালিকায় যুক্ত হবে
                    </p>
                  </div>

                  <div className="text-xs font-mono text-slate-400">
                    <span>Available: </span>
                    <strong className="text-indigo-400">{filteredRawInventory.length} items</strong>
                  </div>
                </div>

                {/* Search & Category Filter Pills */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      placeholder="Search inventory items (Rice, Dal, Oil, Meat...)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    {inventorySearch && (
                      <button 
                        onClick={() => setInventorySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none shrink-0">
                    {availableInventoryCategories.slice(0, 6).map((cat) => {
                      const isSel = inventoryCategoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setInventoryCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            isSel ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inventory Items Grid */}
                <div className="max-h-[220px] overflow-y-auto pr-1">
                  {filteredRawInventory.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 text-xs">
                      No matching raw inventory items found. You can enter item details manually below.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {filteredRawInventory.map((item) => {
                        const isSelectedInVoucher = itemRows.some(r => r.rawItemId === item.id || r.desc === (item.nameBn || item.name));
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectInventoryItem(item)}
                            className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none active:scale-[0.98] ${
                              isSelectedInVoucher
                                ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                                : 'bg-slate-900/70 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                isSelectedInVoucher
                                  ? 'bg-indigo-600 border-indigo-500 text-white' 
                                  : 'border-slate-700 bg-slate-950 text-transparent'
                              }`}>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-white truncate">
                                  {item.nameBn || item.name}
                                </h5>
                                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                                  <span className="font-mono text-emerald-400">৳{item.unitCost}/{item.unit}</span>
                                  <span>•</span>
                                  <span>Stock: {item.currentStock} {item.unit}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`p-1 rounded-lg text-[10px] font-black uppercase transition-all shrink-0 ${
                                isSelectedInVoucher
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Item Rows Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                    VOUCHER ITEMS LIST ({itemRows.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[11px] font-bold uppercase transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Row</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {itemRows.map((row, idx) => (
                    <div 
                      key={row.id}
                      className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center gap-2.5"
                    >
                      <div className="w-6 text-center text-slate-500 font-mono text-xs hidden md:block">
                        {idx + 1}
                      </div>

                      {/* Item Name */}
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Item Name (e.g. Broiler, Onion, Bread, Rice...)"
                          value={row.desc}
                          onChange={(e) => handleUpdateRow(row.id, 'desc', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                        />
                      </div>

                      {/* Category */}
                      <div className="w-full md:w-32">
                        <select
                          value={row.category}
                          onChange={(e) => handleUpdateRow(row.id, 'category', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-300 focus:outline-none"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Qty & Unit */}
                      <div className="flex items-center space-x-1 w-full md:w-32">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => handleUpdateRow(row.id, 'qty', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-white text-center focus:outline-none font-mono"
                        />
                        <select
                          value={row.unit}
                          onChange={(e) => handleUpdateRow(row.id, 'unit', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-1.5 py-2 text-xs font-bold text-slate-400 focus:outline-none text-center"
                        >
                          <option value="kg">kg</option>
                          <option value="pcs">pcs</option>
                          <option value="litre">litre</option>
                          <option value="pkt">pkt</option>
                          <option value="can">can</option>
                          <option value="gm">gm</option>
                          <option value="box">box</option>
                        </select>
                      </div>

                      {/* Unit Price */}
                      <div className="w-full md:w-24">
                        <input
                          type="number"
                          placeholder="Rate (৳)"
                          value={row.unitPrice}
                          onChange={(e) => handleUpdateRow(row.id, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-300 text-center focus:outline-none font-mono"
                        />
                      </div>

                      {/* Total Amount */}
                      <div className="w-full md:w-28">
                        <input
                          type="number"
                          placeholder="Amount (৳)"
                          value={row.amount}
                          onChange={(e) => handleUpdateRow(row.id, 'amount', e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl px-2.5 py-2 text-xs font-black text-emerald-400 text-right focus:outline-none font-mono"
                        />
                      </div>

                      {/* Delete row */}
                      {itemRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-900 transition-colors self-end md:self-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Action */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveNewExpenses}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving ? 'Saving...' : `SAVE TO EXPENCE REGISTER (৳${formTotalAmount.toLocaleString()})`}
                  </span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items, dates, persons, shops..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-xs font-bold text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {/* Quick Payment Channel Pills */}
          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 overflow-x-auto">
            {(['ALL', 'Cash', 'UCB', 'Due'] as const).map(method => (
              <button
                key={method}
                type="button"
                onClick={() => setFilterMethod(method)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                  filterMethod === method
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {method}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterDateRange('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                filterDateRange === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Dates
            </button>
            <button
              type="button"
              onClick={() => setFilterDateRange('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                filterDateRange === 'THIS_MONTH' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setFilterDateRange('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                filterDateRange === 'TODAY' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
          </div>

          {/* Person Selector */}
          <div className="flex items-center space-x-2">
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold text-emerald-400 focus:outline-none"
            >
              <option value="ALL">All Detailers</option>
              {civilians.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* When Due is Selected: Sub-filter by Shop */}
        {filterMethod === 'Due' && (
          <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/60 overflow-x-auto text-xs">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest shrink-0">
              FILTER SHOP:
            </span>
            <button
              type="button"
              onClick={() => setFilterShop('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase transition-all shrink-0 ${
                filterShop === 'ALL' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white bg-slate-950'
              }`}
            >
              All Shops
            </button>
            {DUE_SHOPS.map(shop => (
              <button
                key={shop}
                type="button"
                onClick={() => setFilterShop(shop)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase transition-all shrink-0 ${
                  filterShop === shop ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white bg-slate-950'
                }`}
              >
                {shop}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Expense Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              EXPENCE RECORDS LIST
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
              Showing {filteredExpenses.length} Records • ৳{filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Item Description</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Qty & Unit</th>
                <th className="py-3.5 px-4 text-center">Rate</th>
                <th className="py-3.5 px-4 text-right">Amount (৳)</th>
                <th className="py-3.5 px-4 text-center">Channel</th>
                <th className="py-3.5 px-4 text-center">Detailer</th>
                <th className="py-3.5 px-4 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs font-bold">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-500 font-bold">
                    No expense records matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense, idx) => {
                  const method = String(expense.paymentMethod || '').trim();
                  const isDue = method.toLowerCase() === 'due';
                  const isCash = method.toLowerCase() === 'cash';
                  const isUcb = method.toLowerCase() === 'ucb';

                  return (
                    <tr 
                      key={expense.id || idx}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="py-3 px-4 text-center text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {expense.date}
                      </td>
                      <td className="py-3 px-4 text-white font-black">
                        <div className="flex items-center space-x-1.5">
                          <span>{expense.desc}</span>
                          {expense.isCustom && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Custom
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                          {expense.category || 'Grocery'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 font-mono">
                        {expense.qty ? `${expense.qty} ${expense.unit || 'kg'}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-amber-300 font-mono">
                        {expense.unitPrice ? `৳${expense.unitPrice}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-white">
                        ৳{Number(expense.amount).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isDue ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            <Store className="w-3 h-3 text-amber-400" />
                            <span>Due • {expense.dueShop || 'Grocessary Shop'}</span>
                          </span>
                        ) : isCash ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Wallet className="w-3 h-3 text-emerald-400" />
                            <span>Cash</span>
                          </span>
                        ) : isUcb ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            <DollarSign className="w-3 h-3 text-cyan-400" />
                            <span>UCB</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            {method || 'Other'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 text-[11px]">
                        {expense.detailedPerson || 'Civ Tanvir'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setEditingExpense(expense)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(expense.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-800 bg-slate-950/80 font-black">
                  <td colSpan={6} className="py-3.5 px-4 text-right text-xs uppercase tracking-widest text-slate-400">
                    TOTAL FILTERED EXPENSES:
                  </td>
                  <td className="py-3.5 px-4 text-right text-base text-emerald-400 font-mono font-black">
                    ৳{filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* HISTORY MODAL (EXPENSE RECORD HISTORY AT TOP OF PAGE) */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      EXPENCE RECORD HISTORY (খরচের ইতিহাস)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      View, search and review all historical expense vouchers
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* History Search & Filters */}
              <div className="p-4 border-b border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search in history..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  {(['ALL', 'Cash', 'UCB', 'Due'] as const).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setHistoryChannelFilter(ch)}
                      className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                        historyChannelFilter === ch ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHistoryDateFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                      historyDateFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryDateFilter('THIS_MONTH')}
                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                      historyDateFilter === 'THIS_MONTH' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryDateFilter('TODAY')}
                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                      historyDateFilter === 'TODAY' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* History Table */}
              <div className="flex-1 overflow-y-auto p-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-center">Rate</th>
                      <th className="py-2.5 px-3 text-right">Amount (৳)</th>
                      <th className="py-2.5 px-3 text-center">Channel</th>
                      <th className="py-2.5 px-3 text-center">Detailer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs font-bold">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          No history records found.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-2.5 px-3 text-white font-black">
                            {item.desc}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {item.category || 'Grocery'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-300 font-mono">
                            {item.qty ? `${item.qty} ${item.unit || 'kg'}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-amber-300 font-mono">
                            {item.unitPrice ? `৳${item.unitPrice}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400">
                            ৳{Number(item.amount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[10px]">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {item.paymentMethod || 'Cash'} {item.dueShop ? `(${item.dueShop})` : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-300 text-[11px]">
                            {item.detailedPerson || 'Civ Tanvir'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* History Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">
                  Total Items: {filteredHistory.length}
                </span>
                <span className="text-sm font-mono font-black text-emerald-400">
                  Total Sum: ৳{filteredHistory.reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString()}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REGISTER ADVANCE MODAL (CIVILIAN / STAFF BAZAR ADVANCE REGISTER) */}
      <AnimatePresence>
        {showAdvanceRegisterModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      REGISTER ADVANCE (বাজার অগ্রিম রেজিস্টার)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      Civilian / Staff বাজার খরচের অগ্রিম টাকা প্রদান ও সমন্বয়
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanceRegisterModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Issue New Advance Form */}
              <div className="p-5 border-b border-slate-800 bg-slate-950/50 space-y-3">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Issue New Bazar Advance (নতুন অগ্রিম প্রদান)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Date</label>
                    <input
                      type="text"
                      value={advDate}
                      onChange={(e) => setAdvDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Person</label>
                    <select
                      value={advPerson}
                      onChange={(e) => setAdvPerson(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-300"
                    >
                      {civilians.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Amount (৳)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-black text-amber-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Channel</label>
                    <select
                      value={advChannel}
                      onChange={(e) => setAdvChannel(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                    >
                      <option value="CASH">CASH</option>
                      <option value="UCB">UCB</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleSaveNewAdvance}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md shadow-amber-600/30 cursor-pointer active:scale-95"
                    >
                      + Issue Advance
                    </button>
                  </div>
                </div>
              </div>

              {/* Active & Settled Advances List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    All Bazar Advances ({advances.length})
                  </h4>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Active Unsettled: ৳{metrics.totalActiveAdvance.toLocaleString()}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/70 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Person</th>
                        <th className="py-2.5 px-3">Purpose</th>
                        <th className="py-2.5 px-3 text-center">Channel</th>
                        <th className="py-2.5 px-3 text-right">Advance (৳)</th>
                        <th className="py-2.5 px-3 text-right">Spent (৳)</th>
                        <th className="py-2.5 px-3 text-right">Returned (৳)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs font-bold">
                      {advances.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-500">
                            No bazar advance recorded yet.
                          </td>
                        </tr>
                      ) : (
                        advances.map((adv) => {
                          const isActive = adv.status === 'ACTIVE';
                          return (
                            <tr key={adv.id} className="hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                                {adv.date}
                              </td>
                              <td className="py-2.5 px-3 text-white font-black">
                                {adv.personName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                                {adv.purpose}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${adv.channel === 'CASH' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'}`}>
                                  {adv.channel}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400">
                                ৳{Number(adv.amount).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                {adv.spentAmount ? `৳${adv.spentAmount.toLocaleString()}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                                {adv.returnAmount ? `৳${adv.returnAmount.toLocaleString()}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  isActive
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {adv.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isActive ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSettlingAdvance(adv);
                                      setSettleSpent(adv.amount);
                                      setSettleReturn(0);
                                    }}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer shadow-sm"
                                  >
                                    Settle / Return
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {adv.settledDate || 'Settled'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SETTLE ADVANCE MODAL */}
      <AnimatePresence>
        {settlingAdvance && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    SETTLE BAZAR ADVANCE
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingAdvance(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Person:</span>
                  <span className="font-bold text-white">{settlingAdvance.personName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Issued Advance:</span>
                  <span className="font-mono font-black text-amber-400">৳{settlingAdvance.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Channel:</span>
                  <span className="font-bold text-white">{settlingAdvance.channel}</span>
                </div>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-400 block mb-1">Spent In Bazar (প্রকৃত বাজার খরচ ৳)</label>
                  <input
                    type="number"
                    value={settleSpent}
                    onChange={(e) => {
                      const sp = parseFloat(e.target.value) || 0;
                      setSettleSpent(sp);
                      const ret = Math.max(0, settlingAdvance.amount - sp);
                      setSettleReturn(ret);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Returned Cash/Balance (ফেরত টাকা ৳)</label>
                  <input
                    type="number"
                    value={settleReturn}
                    onChange={(e) => setSettleReturn(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-emerald-400 font-mono font-black"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Settlement Note (মন্তব্য)</label>
                  <input
                    type="text"
                    placeholder="e.g. Broiler and vegetables purchased, cash returned"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setSettlingAdvance(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettleAdvance}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Confirm Settle
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK EDIT MODAL */}
      <AnimatePresence>
        {editingExpense && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Edit2 className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    EDIT EXPENCE RECORD
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-400 block mb-1">Date</label>
                  <input
                    type="text"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Item Description</label>
                  <input
                    type="text"
                    value={editingExpense.desc}
                    onChange={(e) => setEditingExpense({ ...editingExpense, desc: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Qty</label>
                    <input
                      type="number"
                      value={editingExpense.qty || ''}
                      onChange={(e) => {
                        const q = parseFloat(e.target.value) || 0;
                        const p = Number(editingExpense.unitPrice) || 0;
                        setEditingExpense({
                          ...editingExpense,
                          qty: q,
                          amount: q > 0 && p > 0 ? q * p : editingExpense.amount
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Rate</label>
                    <input
                      type="number"
                      value={editingExpense.unitPrice || ''}
                      onChange={(e) => {
                        const p = parseFloat(e.target.value) || 0;
                        const q = Number(editingExpense.qty) || 0;
                        setEditingExpense({
                          ...editingExpense,
                          unitPrice: p,
                          amount: q > 0 && p > 0 ? q * p : editingExpense.amount
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Total Amount (৳)</label>
                    <input
                      type="number"
                      value={editingExpense.amount}
                      onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-2 py-2 text-emerald-400 text-right font-mono font-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Payment Method</label>
                    <select
                      value={editingExpense.paymentMethod || 'Cash'}
                      onChange={(e) => setEditingExpense({ ...editingExpense, paymentMethod: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UCB">UCB</option>
                      <option value="Due">Due</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Detailer Person</label>
                    <select
                      value={editingExpense.detailedPerson || 'Civ Tanvir'}
                      onChange={(e) => setEditingExpense({ ...editingExpense, detailedPerson: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-300"
                    >
                      {civilians.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* If Due: Shop selector */}
                {String(editingExpense.paymentMethod || '').toLowerCase() === 'due' && (
                  <div>
                    <label className="text-amber-400 block mb-1">Due Shop</label>
                    <select
                      value={editingExpense.dueShop || 'Grocessary Shop'}
                      onChange={(e) => setEditingExpense({ ...editingExpense, dueShop: e.target.value })}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300"
                    >
                      {DUE_SHOPS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Save Changes
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  DELETE EXPENSE?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to remove this record? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
