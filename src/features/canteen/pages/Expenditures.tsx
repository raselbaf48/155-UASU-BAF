import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Trash2, Banknote, X, Save, Edit2, AlertTriangle, CheckCircle2, 
  Calendar, Tag, FileText, ArrowLeft, Boxes, PackagePlus, UserCheck, Layers, 
  HelpCircle, RefreshCw, ChevronDown, CreditCard, Wallet, ShoppingCart, 
  ArrowRight, ArrowDownLeft, RotateCcw, Sparkles, TrendingDown, DollarSign,
  Clock, Check, Eye, Filter, Cloud, CloudUpload
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
import { SaveButton } from '../components/SaveButton';
import { pushKeyToCloud, pullKeyFromCloud } from '../utils/canteenCloudSync';

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
  advanceId?: string;
}

export interface BazarAdvance {
  id: string;
  date: string;
  person: string;
  advanceAmount: number;
  paymentMethod: 'Cash' | 'UCB';
  purpose?: string;
  bazarTotalAmount: number;
  remainingAmount: number;
  status: 'PENDING_BAZAR' | 'PENDING_RETURN' | 'SETTLED' | 'EXCESS_PAID';
  returnAmount?: number;
  returnMethod?: 'Cash' | 'UCB';
  returnDate?: string;
  notes?: string;
  bazarItemsSummary?: string;
}

const STORAGE_KEY = 'canteen_expenses';
const ADVANCES_STORAGE_KEY = 'canteen_bazar_advances';
const LAST_PRICES_KEY = 'canteen_expense_last_unit_prices';
const TXS_STORAGE_KEY = 'canteen_txs';

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
  const [activeTab, setActiveTab] = useState<'ALL_EXPENSES' | 'BAZAR_ADVANCES' | 'ANALYTICS'>('ALL_EXPENSES');
  const [isAddPage, setIsAddPage] = useState(false);
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'Cash' | 'UCB' | 'Due'>('ALL');

  // Expense Records
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Bazar Advances (Procurement Advance Tracker)
  const [advances, setAdvances] = useState<BazarAdvance[]>(() => {
    try {
      const raw = localStorage.getItem(ADVANCES_STORAGE_KEY);
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

  // Bazar Advance Linking in Add Page
  const [isLinkedToAdvance, setIsLinkedToAdvance] = useState(false);
  const [advanceAmountInput, setAdvanceAmountInput] = useState<string>('1000');
  const [linkedAdvanceId, setLinkedAdvanceId] = useState<string>('');

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
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSavedBatch, setIsSavedBatch] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavedEdit, setIsSavedEdit] = useState(false);

  // New Advance Modal State
  const [showNewAdvanceModal, setShowNewAdvanceModal] = useState(false);
  const [newAdvancePerson, setNewAdvancePerson] = useState('Civ Tanvir');
  const [newAdvanceAmount, setNewAdvanceAmount] = useState('1000');
  const [newAdvanceMethod, setNewAdvanceMethod] = useState<'Cash' | 'UCB'>('Cash');
  const [newAdvanceDate, setNewAdvanceDate] = useState(formatCanteenDate(new Date()));
  const [newAdvancePurpose, setNewAdvancePurpose] = useState('দৈনিক রান্নার বাজার (Daily Cooking Bazar)');
  const [debitFromFundNow, setDebitFromFundNow] = useState(false);

  // Receive Return Modal State (টাকা ফেরত গ্রহণ)
  const [selectedAdvanceForReturn, setSelectedAdvanceForReturn] = useState<BazarAdvance | null>(null);
  const [returnAmountInput, setReturnAmountInput] = useState<string>('');
  const [returnMethod, setReturnMethod] = useState<'Cash' | 'UCB'>('Cash');
  const [returnDate, setReturnDate] = useState(formatCanteenDate(new Date()));
  const [returnNote, setReturnNote] = useState('বাজারের উদ্বৃত্ত টাকা ফেরত (Bazar surplus return)');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Sound chime effect for celebration
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  // Dedicated Cloud Synchronization (Pull latest data from Supabase app_settings)
  const syncWithCloud = async (showToastNotice = false) => {
    setIsCloudSyncing(true);
    try {
      // 1. Pull expenses from Supabase Cloud
      const cloudExpenses = await pullKeyFromCloud('canteen_expenses');
      if (Array.isArray(cloudExpenses)) {
        const localExpenses: ExpenseRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const expMap = new Map<string, ExpenseRecord>();
        [...cloudExpenses, ...localExpenses].forEach(e => {
          if (e && e.id) expMap.set(String(e.id), e);
        });
        const merged = Array.from(expMap.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setExpenses(merged);
      }

      // 2. Pull advances from Supabase Cloud
      const cloudAdvances = await pullKeyFromCloud('canteen_bazar_advances');
      if (Array.isArray(cloudAdvances)) {
        const localAdv: BazarAdvance[] = JSON.parse(localStorage.getItem(ADVANCES_STORAGE_KEY) || '[]');
        const advMap = new Map<string, BazarAdvance>();
        [...cloudAdvances, ...localAdv].forEach(a => {
          if (a && a.id) advMap.set(String(a.id), a);
        });
        const mergedAdv = Array.from(advMap.values());
        localStorage.setItem(ADVANCES_STORAGE_KEY, JSON.stringify(mergedAdv));
        setAdvances(mergedAdv);
      }

      // 3. Pull last unit prices
      const cloudPrices = await pullKeyFromCloud('canteen_expense_last_unit_prices');
      if (cloudPrices && typeof cloudPrices === 'object') {
        setLastUnitPrices(cloudPrices);
        localStorage.setItem(LAST_PRICES_KEY, JSON.stringify(cloudPrices));
      }

      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedTime(timeStr);
      if (showToastNotice) {
        showToast('Supabase ক্লাউড থেকে সকল খরচ ও বাজার অগ্রিম সফলভাবে সিঙ্ক হয়েছে! ☁️');
      }
    } catch (err) {
      console.warn('Cloud sync error in Expenditures:', err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Initial cloud sync on mount
  useEffect(() => {
    syncWithCloud(false);
  }, []);

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
        const rawAdv = localStorage.getItem(ADVANCES_STORAGE_KEY);
        setAdvances(rawAdv ? JSON.parse(rawAdv) : []);
      } catch {
        setAdvances([]);
      }
      try {
        setRawItems(getRawInventoryItems());
      } catch {
        setRawItems([]);
      }
      try {
        const rawPrices = localStorage.getItem(LAST_PRICES_KEY);
        if (rawPrices) setLastUnitPrices(JSON.parse(rawPrices));
      } catch {}
    };

    handleSync();
    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_bazar_advances_updated', handleSync);
    window.addEventListener('canteen_raw_inventory_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_bazar_advances_updated', handleSync);
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

          const hasNurNabi = civList.some(c => c.name.toLowerCase().includes('nur nabi'));
          if (!hasNurNabi) {
            civList.push({ id: 'civ-nurnabi', name: 'Civ Nur Nabi' });
          }

          setCivilians(civList);
          const defaultCiv = civList.find(c => c.name.toLowerCase().includes('tanvir'));
          if (defaultCiv) {
            setDetailedPerson(defaultCiv.name);
            setNewAdvancePerson(defaultCiv.name);
          } else if (civList.length > 0) {
            setDetailedPerson(civList[0].name);
            setNewAdvancePerson(civList[0].name);
          }
        } else {
          setCivilians([
            { id: 'civ-tanvir', name: 'Civ Tanvir' },
            { id: 'civ-nurnabi', name: 'Civ Nur Nabi' }
          ]);
          setDetailedPerson('Civ Tanvir');
          setNewAdvancePerson('Civ Tanvir');
        }
      } catch {
        setCivilians([
          { id: 'civ-tanvir', name: 'Civ Tanvir' },
          { id: 'civ-nurnabi', name: 'Civ Nur Nabi' }
        ]);
        setDetailedPerson('Civ Tanvir');
        setNewAdvancePerson('Civ Tanvir');
      }
    };

    fetchCivilians();
  }, []);

  const saveToStorage = async (updated: ExpenseRecord[]) => {
    setExpenses(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('canteen_expenses_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      await pushKeyToCloud('canteen_expenses', updated);
      setLastSyncedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('Failed to save expenses to cloud:', err);
    }
  };

  const saveAdvancesToStorage = async (updatedAdvances: BazarAdvance[]) => {
    setAdvances(updatedAdvances);
    try {
      localStorage.setItem(ADVANCES_STORAGE_KEY, JSON.stringify(updatedAdvances));
      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      await pushKeyToCloud('canteen_bazar_advances', updatedAdvances);
      setLastSyncedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('Failed to save advances to cloud:', err);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper to open Add Page with fresh default items
  const handleOpenAddPage = (preselectedAdvance?: BazarAdvance) => {
    setBatchDate(formatCanteenDate(new Date()));
    setBatchPaymentMethod('Cash');

    if (preselectedAdvance) {
      setIsLinkedToAdvance(true);
      setLinkedAdvanceId(preselectedAdvance.id);
      setDetailedPerson(preselectedAdvance.person);
      setAdvanceAmountInput(String(preselectedAdvance.advanceAmount));
      setBatchPaymentMethod(preselectedAdvance.paymentMethod);
    } else {
      // Check if there is an active advance for the current detailed person
      const pendingAdv = advances.find(a => 
        a.person.toLowerCase() === detailedPerson.toLowerCase() && 
        (a.status === 'PENDING_BAZAR' || a.status === 'PENDING_RETURN')
      );
      if (pendingAdv) {
        setIsLinkedToAdvance(true);
        setLinkedAdvanceId(pendingAdv.id);
        setAdvanceAmountInput(String(pendingAdv.advanceAmount));
        setBatchPaymentMethod(pendingAdv.paymentMethod);
      } else {
        setIsLinkedToAdvance(false);
        setLinkedAdvanceId('');
        setAdvanceAmountInput('1000');
      }
    }

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

  // Add a raw item to the batch selection
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

  // Add a Custom item row
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

  const handleRemoveRow = (uid: string) => {
    setItemRows(prev => prev.filter(r => r.uid !== uid));
  };

  const handleUpdateRowField = (uid: string, field: keyof ExpenseItemEntry, value: any) => {
    setItemRows(prev => prev.map(row => {
      if (row.uid !== uid) return row;

      const updated = { ...row, [field]: value };

      if (field === 'rawItemId') {
        const selected = rawItems.find(r => r.id === value);
        if (selected) {
          updated.itemName = selected.name;
          updated.unit = selected.unit;
          const rememberedPrice = lastUnitPrices[selected.id] !== undefined ? lastUnitPrices[selected.id] : selected.unitCost;
          updated.unitPrice = rememberedPrice;
        }
      }

      const q = typeof updated.qty === 'number' ? updated.qty : parseFloat(String(updated.qty)) || 0;
      const p = typeof updated.unitPrice === 'number' ? updated.unitPrice : parseFloat(String(updated.unitPrice)) || 0;
      updated.amount = Math.round(q * p * 100) / 100;

      return updated;
    }));
  };

  const batchTotalAmount = useMemo(() => {
    return itemRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [itemRows]);

  const advanceAmountNum = parseFloat(advanceAmountInput) || 0;
  const advanceRemainingDiff = advanceAmountNum - batchTotalAmount;

  // Save all items from Add Page
  const handleSaveBatchExpenses = () => {
    const validRows = itemRows.filter(r => {
      const hasName = r.itemName.trim().length > 0;
      const hasAmount = r.amount > 0;
      return hasName && hasAmount;
    });

    if (validRows.length === 0) {
      alert('অনুগ্রহ করে কমপক্ষে একটি আইটেমের নাম, পরিমাণ এবং দর সঠিকভাবে প্রদান করুন।');
      return;
    }

    const newRecords: ExpenseRecord[] = [];
    const updatedLastPrices = { ...lastUnitPrices };
    let restockedCount = 0;
    const itemNamesSummary: string[] = [];

    // Advance ID to link
    const effectiveAdvId = linkedAdvanceId || (isLinkedToAdvance ? 'adv-' + Date.now() : undefined);

    validRows.forEach((row, idx) => {
      const q = typeof row.qty === 'number' ? row.qty : parseFloat(String(row.qty)) || 1;
      const p = typeof row.unitPrice === 'number' ? row.unitPrice : parseFloat(String(row.unitPrice)) || 0;

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
        rawItemId: row.rawItemId || undefined,
        advanceId: effectiveAdvId
      };

      newRecords.push(record);
      itemNamesSummary.push(`${record.desc} (৳${record.amount})`);

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

    setIsSavingBatch(true);

    // Save expenses
    const updatedExpenses = [...newRecords, ...expenses];
    saveToStorage(updatedExpenses);

    // Save/Update Advance Record if linked
    if (isLinkedToAdvance) {
      const advTotal = advanceAmountNum;
      const bazarTotal = batchTotalAmount;
      const remaining = advTotal - bazarTotal;
      const advStatus: BazarAdvance['status'] = 
        remaining > 0 ? 'PENDING_RETURN' : remaining === 0 ? 'SETTLED' : 'EXCESS_PAID';

      const existingIndex = advances.findIndex(a => a.id === linkedAdvanceId);
      let updatedAdvances = [...advances];

      if (existingIndex !== -1) {
        // Update existing advance
        updatedAdvances[existingIndex] = {
          ...updatedAdvances[existingIndex],
          bazarTotalAmount: bazarTotal,
          remainingAmount: remaining,
          status: advStatus,
          bazarItemsSummary: itemNamesSummary.join(', ')
        };
      } else {
        // Create new advance record
        const newAdv: BazarAdvance = {
          id: effectiveAdvId || 'adv-' + Date.now(),
          date: batchDate ? formatCanteenDate(batchDate) : formatCanteenDate(new Date()),
          person: detailedPerson || 'Civ Tanvir',
          advanceAmount: advTotal,
          paymentMethod: (batchPaymentMethod === 'UCB' ? 'UCB' : 'Cash'),
          purpose: 'দৈনিক বাজার খরচ',
          bazarTotalAmount: bazarTotal,
          remainingAmount: remaining,
          status: advStatus,
          bazarItemsSummary: itemNamesSummary.join(', ')
        };
        updatedAdvances = [newAdv, ...updatedAdvances];
      }

      saveAdvancesToStorage(updatedAdvances);
    }

    try {
      localStorage.setItem(LAST_PRICES_KEY, JSON.stringify(updatedLastPrices));
      setLastUnitPrices(updatedLastPrices);
      pushKeyToCloud('canteen_expense_last_unit_prices', updatedLastPrices);
    } catch {}

    setTimeout(() => {
      setIsSavingBatch(false);
      setIsSavedBatch(true);
      playChime();

      setTimeout(() => {
        setIsSavedBatch(false);
        setIsAddPage(false);
        if (isLinkedToAdvance && advanceRemainingDiff > 0) {
          showToast(`বাজার খরচ ৳${batchTotalAmount} সংরক্ষিত! ${detailedPerson}-এর কাছে ৳${advanceRemainingDiff} ফেরত পাওনা রয়েছে।`);
        } else {
          showToast(`মোট ৳${batchTotalAmount.toLocaleString('en-US')} মূল্যের ${newRecords.length}টি খরচ সফলভাবে সংরক্ষিত হয়েছে!`);
        }
      }, 700);
    }, 400);
  };

  // Create a New Advance from Modal
  const handleCreateNewAdvance = () => {
    const amt = parseFloat(newAdvanceAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('অনুগ্রহ করে সঠিক অগ্রিম টাকার পরিমাণ লিখুন (যেমন: 1000)');
      return;
    }

    const advId = 'adv-' + Date.now();
    const newAdv: BazarAdvance = {
      id: advId,
      date: newAdvanceDate ? formatCanteenDate(newAdvanceDate) : formatCanteenDate(new Date()),
      person: newAdvancePerson || 'Civ Tanvir',
      advanceAmount: amt,
      paymentMethod: newAdvanceMethod,
      purpose: newAdvancePurpose || 'দৈনিক বাজার',
      bazarTotalAmount: 0,
      remainingAmount: amt,
      status: 'PENDING_BAZAR'
    };

    const updated = [newAdv, ...advances];
    saveAdvancesToStorage(updated);

    // If manager chose to debit immediately from fund as an advance expense
    if (debitFromFundNow) {
      const expRec: ExpenseRecord = {
        id: 'exp-adv-' + Date.now(),
        date: newAdv.date,
        desc: `বাজার অগ্রিম - ${newAdv.person}`.toUpperCase(),
        paymentMethod: newAdv.paymentMethod,
        amount: amt,
        detailedPerson: newAdv.person,
        isCustom: true,
        advanceId: advId
      };
      saveToStorage([expRec, ...expenses]);
    }

    setShowNewAdvanceModal(false);
    playChime();
    showToast(`${newAdv.person}-কে ৳${amt.toLocaleString('en-US')} বাজার অগ্রিম প্রদান সফল হয়েছে!`);
  };

  // Open Receive Return Modal
  const handleOpenReceiveReturn = (adv: BazarAdvance) => {
    setSelectedAdvanceForReturn(adv);
    setReturnAmountInput(String(Math.max(0, adv.remainingAmount)));
    setReturnMethod(adv.paymentMethod || 'Cash');
    setReturnDate(formatCanteenDate(new Date()));
    setReturnNote(`বাজার উদ্বৃত্ত ফেরত (${adv.person})`);
  };

  // Confirm Return: Return money received into Cash or UCB
  const handleConfirmReturn = async () => {
    if (!selectedAdvanceForReturn) return;
    const returnAmt = parseFloat(returnAmountInput);
    if (isNaN(returnAmt) || returnAmt <= 0) {
      alert('অনুগ্রহ করে ফেরত টাকার সঠিক পরিমাণ লিখুন।');
      return;
    }

    setIsSubmittingReturn(true);

    const adv = selectedAdvanceForReturn;
    const newRemaining = Math.max(0, adv.remainingAmount - returnAmt);
    const newStatus: BazarAdvance['status'] = newRemaining === 0 ? 'SETTLED' : 'PENDING_RETURN';

    const updatedAdvances = advances.map(a => {
      if (a.id === adv.id) {
        return {
          ...a,
          remainingAmount: newRemaining,
          returnAmount: (a.returnAmount || 0) + returnAmt,
          returnMethod,
          returnDate,
          status: newStatus,
          notes: `${a.notes || ''} [ফেরত: ৳${returnAmt} (${returnMethod}) - ${returnDate}]`.trim()
        };
      }
      return a;
    });

    saveAdvancesToStorage(updatedAdvances);

    // Add entry into canteen_txs so CanteenFund.tsx Cash/UCB balance increases!
    try {
      const rawTxs = localStorage.getItem(TXS_STORAGE_KEY);
      const txs = rawTxs ? JSON.parse(rawTxs) : [];
      const returnTx = {
        id: 'bazar-ret-' + Date.now(),
        date: returnDate,
        amount: returnAmt,
        type: 'BAZAR_RETURN',
        gateway: returnMethod.toUpperCase(),
        memberName: adv.person,
        items: `বাজারের অবশিষ্ট ফেরত (${adv.person}) • মূল অগ্রিম: ৳${adv.advanceAmount}, বাজার খরচ: ৳${adv.bazarTotalAmount}, ফেরত: ৳${returnAmt}`,
        note: returnNote
      };
      const updatedTxs = [returnTx, ...txs];
      localStorage.setItem(TXS_STORAGE_KEY, JSON.stringify(updatedTxs));
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      await pushKeyToCloud('canteen_txs', updatedTxs);
    } catch (e) {
      console.warn('Failed to record return transaction:', e);
    }

    setIsSubmittingReturn(false);
    setSelectedAdvanceForReturn(null);
    playChime();
    showToast(`৳${returnAmt.toLocaleString('en-US')} সফলভাবে ${returnMethod}-এ ফেরত জমা হয়েছে!`);
  };

  // Delete an advance record
  const handleDeleteAdvance = (advId: string) => {
    if (!window.confirm('আপনি কি এই বাজার অগ্রিম রেকর্ডটি মুছে ফেলতে চান?')) return;
    const updated = advances.filter(a => a.id !== advId);
    saveAdvancesToStorage(updated);
    showToast('অগ্রিম রেকর্ড মুছে ফেলা হয়েছে!');
  };

  // Delete expense record
  const handleDelete = (id: string | number) => {
    const updated = expenses.filter(e => e.id !== id);
    saveToStorage(updated);
    setConfirmDeleteId(null);
    if (editingExpense) setEditingExpense(null);
    showToast('খরচ রেকর্ড সফলভাবে মুছে ফেলা হয়েছে!');
  };

  // Update existing expense record
  const handleUpdateExpense = () => {
    if (!editingExpense) return;
    setIsSavingEdit(true);

    const updated = expenses.map(e => {
      if (e.id === editingExpense.id) {
        return {
          ...editingExpense,
          desc: editingExpense.desc.trim().toUpperCase(),
          amount: Number(editingExpense.amount) || 0
        };
      }
      return e;
    });

    saveToStorage(updated);

    setTimeout(() => {
      setIsSavingEdit(false);
      setIsSavedEdit(true);
      setTimeout(() => {
        setIsSavedEdit(false);
        setEditingExpense(null);
        showToast('খরচ বিবরণী সফলভাবে আপডেট করা হয়েছে!');
      }, 500);
    }, 300);
  };

  // Filtered expenses
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        (e.desc && e.desc.toLowerCase().includes(term)) ||
        (e.detailedPerson && e.detailedPerson.toLowerCase().includes(term)) ||
        (e.date && e.date.toLowerCase().includes(term)) ||
        (e.paymentMethod && e.paymentMethod.toLowerCase().includes(term));
      
      const matchMethod = filterMethod === 'ALL' || e.paymentMethod === filterMethod;
      return matchSearch && matchMethod;
    });
  }, [expenses, searchTerm, filterMethod]);

  // Statistics
  const total = useMemo(() => {
    return expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  const cashTotal = useMemo(() => {
    return expenses
      .filter(e => String(e.paymentMethod || 'Cash').toLowerCase() === 'cash')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  const ucbTotal = useMemo(() => {
    return expenses
      .filter(e => String(e.paymentMethod || '').toLowerCase() === 'ucb')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  const dueTotal = useMemo(() => {
    return expenses
      .filter(e => String(e.paymentMethod || '').toLowerCase() === 'due')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  // Pending returns sum
  const pendingReturnsTotal = useMemo(() => {
    return advances
      .filter(a => a.status === 'PENDING_RETURN' || a.status === 'PENDING_BAZAR')
      .reduce((sum, a) => sum + Math.max(0, Number(a.remainingAmount) || 0), 0);
  }, [advances]);

  const pendingReturnsCount = useMemo(() => {
    return advances.filter(a => a.status === 'PENDING_RETURN').length;
  }, [advances]);

  // Current Month Spending
  const currentMonthSpending = useMemo(() => {
    const curMonth = new Date().getMonth();
    const curYear = new Date().getFullYear();
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curMonAbbr = MONTHS[curMonth].toLowerCase();

    return expenses
      .filter(e => {
        const dStr = String(e.date || '').toLowerCase();
        return dStr.includes(curMonAbbr);
      })
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  // If in Add Page
  if (isAddPage) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
        
        {/* Top Sticky Bar */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-xl">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsAddPage(false)}
              className="p-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer active:scale-90"
              title="ফিরে যান"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
                <span>ADD NEW EXPENDITURE</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  ভাউচার এন্ট্রি
                </span>
              </h2>
              <p className="text-[11px] font-bold text-slate-400">
                বাজারের কাঁচামাল বা অন্যান্য খরচের হিসাব সংযোজন করুন
              </p>
            </div>
          </div>

          {/* Live Total Badge */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 px-5 py-2.5 rounded-2xl flex items-center space-x-3 shadow-lg">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              TOTAL BAZAR:
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">
              ৳{batchTotalAmount.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* BAZAR ADVANCE INTEGRATION PANEL (বাজার অগ্রিম সমন্বয়) */}
        <div className={`p-5 rounded-3xl border transition-all ${
          isLinkedToAdvance 
            ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/30 border-amber-500/40 shadow-xl shadow-amber-950/20' 
            : 'bg-slate-900/60 border-slate-800'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isLinkedToAdvance ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'}`}>
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center space-x-2">
                  <span>বাজার অগ্রিম লিংক ও সমন্বয় (Bazar Advance Settlement)</span>
                  {isLinkedToAdvance && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                      অগ্রিম সমন্বয় সক্রিয়
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  আজকের বাজারের জন্য কোনো সদস্য/কর্মীকে অগ্রিম টাকা দেওয়া হয়েছিল কি না?
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <label className="inline-flex items-center cursor-pointer select-none self-start sm:self-auto">
              <input 
                type="checkbox"
                checked={isLinkedToAdvance}
                onChange={(e) => setIsLinkedToAdvance(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              <span className="ml-2.5 text-xs font-black text-slate-300">
                {isLinkedToAdvance ? 'অগ্রিম হিসাব চালু' : 'অগ্রিম নেই (সাধারণ খরচ)'}
              </span>
            </label>
          </div>

          {/* When Linked To Advance: Show Advance Form & Live Math */}
          {isLinkedToAdvance && (
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-amber-300 uppercase tracking-wider block mb-1">
                    অগ্রিম গ্রহণকারী (Person)
                  </label>
                  <select
                    value={detailedPerson}
                    onChange={(e) => setDetailedPerson(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {civilians.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-amber-300 uppercase tracking-wider block mb-1">
                    প্রদত্ত অগ্রিম পরিমাণ (Advance Given ৳)
                  </label>
                  <input
                    type="number"
                    value={advanceAmountInput}
                    onChange={(e) => setAdvanceAmountInput(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-amber-300 uppercase tracking-wider block mb-1">
                    প্রদানের মাধ্যম (Payment Method)
                  </label>
                  <select
                    value={batchPaymentMethod}
                    onChange={(e) => setBatchPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Cash">Cash (নগদ)</option>
                    <option value="UCB">UCB</option>
                  </select>
                </div>
              </div>

              {/* Live Settlement Display Card */}
              <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-6 flex-wrap gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">প্রদত্ত অগ্রিম:</span>
                    <span className="font-mono font-black text-white text-sm">৳{advanceAmountNum.toLocaleString()}</span>
                  </div>
                  <div className="text-slate-600 font-black">−</div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">মোট বাজার খরচ:</span>
                    <span className="font-mono font-black text-rose-300 text-sm">৳{batchTotalAmount.toLocaleString()}</span>
                  </div>
                  <div className="text-slate-600 font-black">=</div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">
                      {advanceRemainingDiff >= 0 ? `${detailedPerson}-এর কাছে ফেরতযোগ্য বাকি:` : `${detailedPerson}-কে অতিরিক্ত প্রদেয়:`}
                    </span>
                    <span className={`font-mono font-black text-base ${advanceRemainingDiff >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                      ৳{Math.abs(advanceRemainingDiff).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-amber-300/90 bg-amber-500/10 px-3.5 py-1.5 rounded-xl border border-amber-500/20">
                  {advanceRemainingDiff > 0 ? (
                    <span>💡 বাজার শেষ হলে {detailedPerson} ৳{advanceRemainingDiff} ফেরত দিলে Cash/UCB-তে যুক্ত হবে।</span>
                  ) : advanceRemainingDiff === 0 ? (
                    <span className="text-emerald-400">✓ সম্পূর্ণ হিসাব মিলে গেছে! কোনো ফেরত বাকি নেই।</span>
                  ) : (
                    <span className="text-rose-400">⚠️ বাজার খরচ অগ্রিমের চেয়ে ৳{Math.abs(advanceRemainingDiff)} বেশি হয়েছে!</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Common Settings: Date & Person (if not advance) */}
        {!isLinkedToAdvance && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
            <div>
              <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>তারিখ (Date)</span>
              </label>
              <input 
                type="text" 
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block flex items-center space-x-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ব্যক্তি (Detailed Person)</span>
              </label>
              <select 
                value={detailedPerson}
                onChange={(e) => setDetailedPerson(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {civilians.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block flex items-center space-x-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                <span>পরিশোধের মাধ্যম (Payment Method)</span>
              </label>
              <select 
                value={batchPaymentMethod}
                onChange={(e) => setBatchPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Cash">Cash (নগদ)</option>
                <option value="UCB">UCB</option>
                <option value="Due">Due (বাকি)</option>
              </select>
            </div>
          </div>
        )}

        {/* Quick Raw Item Multi-Select Badges */}
        <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-indigo-400" />
              <span>কাঁচামাল দ্রুত নির্বাচন (RAW INVENTORY ITEMS)</span>
            </label>
            <span className="text-[10px] text-slate-500 font-bold">
              ক্লিক করলেই নিচের ভাউচার তালিকায় যোগ হবে
            </span>
          </div>

          <div className="flex flex-wrap gap-2 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 max-h-36 overflow-y-auto">
            {rawItems.map(raw => {
              const isAlreadyAdded = itemRows.some(r => !r.isCustom && r.rawItemId === raw.id);
              return (
                <button
                  key={raw.id}
                  type="button"
                  onClick={() => handleAddRawItemRow(raw)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border cursor-pointer active:scale-95 ${
                    isAlreadyAdded
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{raw.name}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-slate-400">
                    {raw.unit}
                  </span>
                  <Plus className="w-3 h-3" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Items Table / Row Entries */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>খরচ আইটেম তালিকা (EXPENDITURE ITEMS LIST)</span>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                {itemRows.length} টি
              </span>
            </h3>

            <button
              type="button"
              onClick={handleAddCustomRow}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ কাস্টম আইটেম (ইনভেন্টরিতে যুক্ত হবে না)</span>
            </button>
          </div>

          <div className="space-y-3">
            {itemRows.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800 text-slate-400 text-xs font-bold">
                কোনো আইটেম যোগ করা হয়নি। উপরের কাঁচামাল বাটনে চাপুন অথবা &quot;+ কাস্টম আইটেম&quot; বাটনে ক্লিক করুন।
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
                        আইটেমের নাম (Item Name)
                      </label>
                      {row.isCustom ? (
                        <input 
                          type="text"
                          placeholder="e.g. রিকশা ভাড়া / পলিথিন / বিবিধ"
                          value={row.itemName ?? ""}
                          onChange={(e) => handleUpdateRowField(row.uid, 'itemName', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs font-black text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      ) : (
                        <select
                          value={row.rawItemId ?? ""}
                          onChange={(e) => handleUpdateRowField(row.uid, 'rawItemId', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">আইটেম নির্বাচন করুন...</option>
                          {rawItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.nameBn}) • {item.unit}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 text-center">
                        পরিমাণ (Qty)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="1"
                        value={row.qty ?? ""}
                        onChange={(e) => handleUpdateRowField(row.uid, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono"
                      />
                    </div>

                    {/* Unit */}
                    <div className="md:col-span-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 text-center">
                        একক
                      </label>
                      <input 
                        type="text"
                        placeholder="kg"
                        value={row.unit ?? ""}
                        onChange={(e) => handleUpdateRowField(row.uid, 'unit', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                      />
                    </div>

                    {/* Unit Price (Rate) */}
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 text-right">
                        দর (Rate ৳)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="দর"
                        value={row.unitPrice ?? ""}
                        onChange={(e) => handleUpdateRowField(row.uid, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right font-mono"
                      />
                    </div>

                    {/* Amount */}
                    <div className="md:col-span-1 text-right">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                        মোট (৳)
                      </label>
                      <div className="py-2 text-xs font-black text-white font-mono">
                        ৳{row.amount.toLocaleString('en-US')}
                      </div>
                    </div>

                    {/* Delete Row Button */}
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.uid)}
                        className="p-2 text-rose-400 hover:text-white hover:bg-rose-600/20 rounded-xl transition-colors cursor-pointer"
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
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setIsAddPage(false)}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase transition-all cursor-pointer"
          >
            বাতিল (Cancel)
          </button>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <SaveButton 
              type="button"
              onClick={handleSaveBatchExpenses}
              isSaving={isSavingBatch}
              isSaved={isSavedBatch}
              idleText={`খরচ সংরক্ষণ করুন (৳${batchTotalAmount.toLocaleString('en-US')})`}
              savingText="সংরক্ষণ হচ্ছে..."
              savedText="সফলভাবে সংরক্ষিত! ✓"
              className="w-full sm:w-auto px-8 py-3.5 text-xs font-black tracking-wider shadow-lg shadow-indigo-600/30"
            />
          </div>
        </div>

      </div>
    );
  }

  // MAIN PAGE VIEW
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-[200] bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-xs">{notification}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner shrink-0">
            <Banknote className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                EXPENDITURES & BAZAR HUB
              </h2>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 tracking-wider uppercase">
                Procurement
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
              ডেইলি বাজার অগ্রিম, ভাউচার খরচ এন্ট্রি, নিষ্পত্তি ও ক্যাশ সমন্বয় ব্যবস্থাপনা
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center space-x-2.5 flex-wrap">
          {/* Cloud Sync Status & Action Button */}
          <button
            type="button"
            onClick={() => syncWithCloud(true)}
            disabled={isCloudSyncing}
            className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 text-[11px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer active:scale-95"
            title="Supabase ক্লাউড থেকে সর্বশেষ সকল খরচ ও বাজার অগ্রিম ডাটা রিলোড করুন"
          >
            <Cloud className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-bounce text-amber-400' : 'text-emerald-400'}`} />
            <span>{isCloudSyncing ? 'সিঙ্ক হচ্ছে...' : 'Cloud Synced ✓'}</span>
            {lastSyncedTime && <span className="text-[10px] text-slate-400 font-mono font-normal">({lastSyncedTime})</span>}
          </button>

          {/* Give Advance Button */}
          <button
            type="button"
            onClick={() => setShowNewAdvanceModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-amber-900/30 cursor-pointer active:scale-95"
            title="নতুন বাজার অগ্রিম প্রদান করুন"
          >
            <ShoppingCart className="w-4 h-4 text-amber-200" />
            <span>+ বাজার অগ্রিম</span>
          </button>

          {/* Add Expenses Button */}
          <button 
            type="button"
            onClick={() => handleOpenAddPage()} 
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-indigo-900/30 cursor-pointer active:scale-95"
            title="নতুন খরচ ভাউচার যোগ করুন"
          >
            <Plus className="w-4 h-4 text-indigo-200" />
            <span>+ খরচ ভাউচার এন্ট্রি</span>
          </button>
        </div>
      </div>

      {/* 4 Premium Glassmorphic KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Total Spending */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">সর্বমোট খরচ</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-white font-mono">৳{total.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">{expenses.length} টি ভাউচার রেকর্ড</p>
          </div>
        </div>

        {/* Card 2: Current Month Spending */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">চলতি মাসের খরচ</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">৳{currentMonthSpending.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">বর্তমান মাসের বাজার ব্যয়</p>
          </div>
        </div>

        {/* Card 3: Pending Returns (পাওনা / তানভীরের কাছে বাকি) */}
        <div 
          onClick={() => setActiveTab('BAZAR_ADVANCES')}
          className={`border rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden cursor-pointer transition-all ${
            pendingReturnsTotal > 0 
              ? 'bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-900 border-amber-500/50 hover:border-amber-400 shadow-amber-950/20' 
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
          title="ক্লিক করে বাজার অগ্রিম ও ফেরতযোগ্য বাকি দেখুন"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">অগ্রিম বাকি পাওনা</span>
              {pendingReturnsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-amber-300 font-mono">৳{pendingReturnsTotal.toLocaleString()}</h3>
            <p className="text-[10px] text-amber-400/80 font-bold mt-0.5">
              {pendingReturnsCount > 0 ? `${pendingReturnsCount}টি ফেরত বাকি (ক্লিক করুন)` : 'সব অগ্রিম নিষ্পত্তি সম্পন্ন'}
            </p>
          </div>
        </div>

        {/* Card 4: Cash vs UCB Split */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">পরিশোধের মাধ্যম</span>
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">নগদ (Cash):</span>
              <span className="font-mono font-black text-emerald-400">৳{cashTotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">UCB / ব্যাংক:</span>
              <span className="font-mono font-black text-cyan-400">৳{ucbTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          {/* Tab 1: All Expenses */}
          <button
            type="button"
            onClick={() => setActiveTab('ALL_EXPENSES')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'ALL_EXPENSES'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>সকল খরচ তালিকা ({expenses.length})</span>
          </button>

          {/* Tab 2: Bazar Advances & Settlement Tracker */}
          <button
            type="button"
            onClick={() => setActiveTab('BAZAR_ADVANCES')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer relative ${
              activeTab === 'BAZAR_ADVANCES'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25 ring-1 ring-amber-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>বাজার অগ্রিম ও নিষ্পত্তি ({advances.length})</span>
            {pendingReturnsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                {pendingReturnsCount}
              </span>
            )}
          </button>

          {/* Tab 3: Analytics */}
          <button
            type="button"
            onClick={() => setActiveTab('ANALYTICS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'ANALYTICS'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>আইটেম ও পরিসংখ্যান</span>
          </button>
        </div>

        {/* Quick Payment Method Filter (for All Expenses tab) */}
        {activeTab === 'ALL_EXPENSES' && (
          <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-black uppercase">
            {(['ALL', 'Cash', 'UCB', 'Due'] as const).map(method => (
              <button
                key={method}
                type="button"
                onClick={() => setFilterMethod(method)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMethod === method 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: ALL EXPENSES LIST */}
      {activeTab === 'ALL_EXPENSES' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="আইটেমের নাম, ব্যক্তি (যেমন: Civ Tanvir), পেমেন্ট মেথড বা তারিখ দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 shadow-inner"
            />
          </div>

          {/* Expenditures Table */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">তারিখ</th>
                    <th className="py-3.5 px-4">আইটেমের বিবরণ</th>
                    <th className="py-3.5 px-4 text-center">পরিমাণ</th>
                    <th className="py-3.5 px-4 text-center">দর (৳)</th>
                    <th className="py-3.5 px-4 text-center">দায়িত্বপ্রাপ্ত (Detailer)</th>
                    <th className="py-3.5 px-4 text-center">মাধ্যম</th>
                    <th className="py-3.5 px-4 text-right">মোট টাকা</th>
                    <th className="py-3.5 px-4 text-center w-20">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-bold">
                        কোনো খরচ রেকর্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filtered.map((expense, idx) => (
                      <tr 
                        key={expense.id || idx}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3 px-4 text-center text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                          {expense.date}
                        </td>
                        <td className="py-3 px-4 text-white font-black">
                          <div className="flex items-center space-x-2">
                            <span>{expense.desc}</span>
                            {expense.isCustom && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Custom
                              </span>
                            )}
                            {expense.advanceId && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                অগ্রিম লিংক
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-300">
                          {expense.qty !== undefined && expense.qty !== null ? (
                            <span>{expense.qty} <span className="text-slate-500 text-[10px]">{expense.unit || 'kg'}</span></span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-indigo-300">
                          {expense.unitPrice ? `৳${expense.unitPrice}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                            <UserCheck className="w-3 h-3 mr-1" />
                            <span>{expense.detailedPerson || 'Civ Tanvir'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            expense.paymentMethod === 'UCB' 
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                              : expense.paymentMethod === 'Due'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {expense.paymentMethod || 'Cash'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-white font-mono">
                          ৳{Number(expense.amount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setEditingExpense(expense)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="সম্পাদনা করুন"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(expense.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BAZAR ADVANCES & SETTLEMENT TRACKER (বাজার অগ্রিম ও নিষ্পত্তি) */}
      {activeTab === 'BAZAR_ADVANCES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Section Banner */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/30 border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shrink-0">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <span>বাজার অগ্রিম ও নিষ্পত্তি খাতা (Advance & Settlement Tracker)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  কর্মীকে বাজার করার জন্য অগ্রিম দেওয়া, ভাউচার মিলিয়ে খরচ সমন্বয় ও অবশিষ্ট টাকা ক্যাশে ফেরত গ্রহণ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNewAdvanceModal(true)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer shadow-lg shadow-amber-950/40 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ নতুন অগ্রিম প্রদান</span>
            </button>
          </div>

          {/* Advances Cards Grid */}
          <div className="space-y-4">
            {advances.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
                <ShoppingCart className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 font-bold text-sm">
                  কোনো বাজার অগ্রিম রেকর্ড নেই।
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewAdvanceModal(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center space-x-2 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>প্রথম বাজার অগ্রিম প্রদান করুন</span>
                </button>
              </div>
            ) : (
              advances.map(adv => {
                const isPendingReturn = adv.status === 'PENDING_RETURN';
                const isPendingBazar = adv.status === 'PENDING_BAZAR';
                const isSettled = adv.status === 'SETTLED';

                return (
                  <div
                    key={adv.id}
                    className={`rounded-3xl border p-5 transition-all shadow-md ${
                      isPendingReturn
                        ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40 shadow-amber-950/20'
                        : isPendingBazar
                        ? 'bg-gradient-to-r from-blue-950/30 via-slate-900 to-slate-900 border-blue-500/40'
                        : 'bg-slate-900/80 border-slate-800/80'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      {/* Left: Person & Date */}
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border ${
                          isPendingReturn
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : isPendingBazar
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {adv.person.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <h4 className="text-base font-black text-white">{adv.person}</h4>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              isPendingReturn
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                : isPendingBazar
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}>
                              {isPendingReturn
                                ? `৳${adv.remainingAmount} ফেরত পাওনা`
                                : isPendingBazar
                                ? 'বাজারে রয়েছে (Bazar in progress)'
                                : 'সম্পূর্ণ নিষ্পত্তি (Settled ✓)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            তারিখ: {adv.date} • প্রদানের মাধ্যম: <strong className="text-white">{adv.paymentMethod}</strong> • {adv.purpose || 'বাজার'}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Math Breakdown */}
                      <div className="flex items-center space-x-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">প্রদত্ত অগ্রিম:</span>
                          <span className="font-black text-white text-sm">৳{adv.advanceAmount.toLocaleString()}</span>
                        </div>
                        <div className="text-slate-600 font-black">−</div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">মোট বাজার খরচ:</span>
                          <span className="font-black text-rose-300 text-sm">৳{adv.bazarTotalAmount.toLocaleString()}</span>
                        </div>
                        <div className="text-slate-600 font-black">=</div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">অবশিষ্ট ফেরতযোগ্য:</span>
                          <span className={`font-black text-sm ${adv.remainingAmount > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                            ৳{adv.remainingAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-2 self-end lg:self-center">
                        {isPendingReturn && (
                          <button
                            type="button"
                            onClick={() => handleOpenReceiveReturn(adv)}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-950/30 flex items-center space-x-1.5 cursor-pointer active:scale-95"
                            title="টাকা ফেরত গ্রহণ করে ক্যাশ/UCB-তে যুক্ত করুন"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>টাকা ফেরত গ্রহণ (৳{adv.remainingAmount})</span>
                          </button>
                        )}

                        {isPendingBazar && (
                          <button
                            type="button"
                            onClick={() => handleOpenAddPage(adv)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1.5 cursor-pointer active:scale-95"
                            title="বাজারের ভাউচার হিসাব এন্ট্রি করুন"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>বাজার খরচ এন্ট্রি</span>
                          </button>
                        )}

                        {isSettled && (
                          <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                            <Check className="w-3.5 h-3.5" />
                            <span>হিসাব ক্লোজড ({adv.returnMethod || 'Cash'})</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteAdvance(adv.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="অগ্রিম রেকর্ডটি মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                    {/* Summary items note if present */}
                    {adv.bazarItemsSummary && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-2">
                        <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="truncate">বাজার আইটেম: {adv.bazarItemsSummary}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PROCUREMENT & RAW INVENTORY ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>ব্যক্তি অনুযায়ী বাজার ব্যয়ের সারাংশ (Detailer-wise Breakdown)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {civilians.map(civ => {
                const civExpenses = expenses.filter(e => (e.detailedPerson || '').toLowerCase() === civ.name.toLowerCase());
                const civTotal = civExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                const civPending = advances
                  .filter(a => a.person.toLowerCase() === civ.name.toLowerCase() && a.status === 'PENDING_RETURN')
                  .reduce((s, a) => s + a.remainingAmount, 0);

                return (
                  <div key={civ.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{civ.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{civExpenses.length} টি ভাউচার</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">মোট বাজার:</span>
                      <span className="font-mono font-black text-emerald-400">৳{civTotal.toLocaleString()}</span>
                    </div>
                    {civPending > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-amber-400 font-bold">ফেরত পাওনা:</span>
                        <span className="font-mono font-black text-amber-300">৳{civPending.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: NEW BAZAR ADVANCE MODAL (নতুন বাজার অগ্রিম প্রদান) */}
      {showNewAdvanceModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[180] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    নতুন বাজার অগ্রিম প্রদান
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    বাজার করার জন্য কর্মীকে টাকা অগ্রিম প্রদান
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowNewAdvanceModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  অগ্রিম গ্রহণকারী ব্যক্তি
                </label>
                <select
                  value={newAdvancePerson}
                  onChange={(e) => setNewAdvancePerson(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {civilians.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  অগ্রিম টাকার পরিমাণ (৳)
                </label>
                <input
                  type="number"
                  placeholder="যেমন: 1000"
                  value={newAdvanceAmount}
                  onChange={(e) => setNewAdvanceAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base font-black text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    প্রদানের মাধ্যম
                  </label>
                  <select
                    value={newAdvanceMethod}
                    onChange={(e) => setNewAdvanceMethod(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Cash">Cash (নগদ)</option>
                    <option value="UCB">UCB (ব্যাংক)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    তারিখ
                  </label>
                  <input
                    type="text"
                    value={newAdvanceDate}
                    onChange={(e) => setNewAdvanceDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  উদ্দেশ্য / বিবরণ
                </label>
                <input
                  type="text"
                  value={newAdvancePurpose}
                  onChange={(e) => setNewAdvancePurpose(e.target.value)}
                  placeholder="যেমন: দুপুরের রান্নার বাজার"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowNewAdvanceModal(false)}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleCreateNewAdvance}
                className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-950/40 cursor-pointer"
              >
                অগ্রিম নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVE RETURN MODAL (টাকা ফেরত গ্রহণ) */}
      {selectedAdvanceForReturn && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[190] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    বাজার উদ্বৃত্ত টাকা ফেরত গ্রহণ
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedAdvanceForReturn.person}-এর কাছ থেকে ফেরত টাকা জমা নিন
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedAdvanceForReturn(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Advance summary card */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">প্রদত্ত অগ্রিম:</span>
                <span className="font-black text-white">৳{selectedAdvanceForReturn.advanceAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">মোট বাজার খরচ:</span>
                <span className="font-black text-rose-300">৳{selectedAdvanceForReturn.bazarTotalAmount}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800 text-sm">
                <span className="text-amber-300 font-sans font-bold">ফেরতযোগ্য পাওনা:</span>
                <span className="font-black text-amber-400">৳{selectedAdvanceForReturn.remainingAmount}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  ফেরত গ্রহণের পরিমাণ (৳)
                </label>
                <input
                  type="number"
                  value={returnAmountInput}
                  onChange={(e) => setReturnAmountInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base font-black text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    জমার মাধ্যম (Account)
                  </label>
                  <select
                    value={returnMethod}
                    onChange={(e) => setReturnMethod(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Cash">Cash (নগদ ক্যাশবাক্স)</option>
                    <option value="UCB">UCB (ব্যাংক একাউন্ট)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    ফেরতের তারিখ
                  </label>
                  <input
                    type="text"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  মন্তব্য
                </label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedAdvanceForReturn(null)}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isSubmittingReturn}
                onClick={handleConfirmReturn}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>টাকা ফেরত ক্যাশে জমা নিশ্চিত করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ROW EDIT & DELETE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-xl shadow-2xl animate-in zoom-in-95 space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    EDIT / REMOVE EXPENDITURE
                  </h3>
                </div>
              </div>

              <button 
                onClick={() => { setEditingExpense(null); setConfirmDeleteId(null); }}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    DATE
                  </label>
                  <input 
                    type="text"
                    value={editingExpense.date ?? ""}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

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
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Item Name
                </label>
                <input 
                  type="text"
                  value={editingExpense.desc ?? ""}
                  onChange={(e) => setEditingExpense({ ...editingExpense, desc: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    QTY
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
                    Unit
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
                    UNIT PRICE (৳)
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
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    PAYMENT METHOD
                  </label>
                  <select 
                    value={editingExpense.paymentMethod || 'Cash'}
                    onChange={(e) => setEditingExpense({ ...editingExpense, paymentMethod: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UCB">UCB</option>
                    <option value="Due">Due</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    Total (৳)
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

            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDelete(editingExpense.id)}
                className="px-4 py-3 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Record</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => { setEditingExpense(null); setConfirmDeleteId(null); }}
                  className="flex-1 sm:flex-initial px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <SaveButton
                  type="button"
                  onClick={handleUpdateExpense}
                  isSaving={isSavingEdit}
                  isSaved={isSavedEdit}
                  idleText="SAVE CHANGES"
                  savingText="SAVING..."
                  savedText="RECORD UPDATED! ✓"
                  className="flex-1 sm:flex-initial px-6 py-3"
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* QUICK DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmDeleteId && !editingExpense && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[170] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.88, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Delete this record?</h4>
                <p className="text-xs text-slate-400 mt-1">
                  This expenditure record will be permanently deleted.
                </p>
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-600/30 cursor-pointer active:scale-95"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
