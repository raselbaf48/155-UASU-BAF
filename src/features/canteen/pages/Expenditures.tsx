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
  const [newAdvancePurpose, setNewAdvancePurpose] = useState('Daily Cooking Bazar');
  const [debitFromFundNow, setDebitFromFundNow] = useState(false);

  // Receive Return Modal State
  const [selectedAdvanceForReturn, setSelectedAdvanceForReturn] = useState<BazarAdvance | null>(null);
  const [returnAmountInput, setReturnAmountInput] = useState<string>('');
  const [returnMethod, setReturnMethod] = useState<'Cash' | 'UCB'>('Cash');
  const [returnDate, setReturnDate] = useState(formatCanteenDate(new Date()));
  const [returnNote, setReturnNote] = useState('Bazar surplus refund');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Civ Accounts & Ledger States
  const [selectedCivForLedger, setSelectedCivForLedger] = useState<string | null>(null);
  const [selectedCivForSettle, setSelectedCivForSettle] = useState<{ name: string; balance: number } | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<'Cash' | 'UCB'>('Cash');
  const [settleDate, setSettleDate] = useState<string>(formatCanteenDate(new Date()));
  const [settleNote, setSettleNote] = useState<string>('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [showAddCivModal, setShowAddCivModal] = useState(false);
  const [newCivNameInput, setNewCivNameInput] = useState('');

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
        showToast('All expenditures and bazar advances successfully synced with cloud! ☁️');
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

          // Merge custom civilians from local storage
          try {
            const customCivs = JSON.parse(localStorage.getItem('canteen_custom_civilians') || '[]');
            if (Array.isArray(customCivs)) {
              customCivs.forEach((cc: any) => {
                if (cc && cc.name && !civList.some(c => c.name.toLowerCase() === cc.name.toLowerCase())) {
                  civList.push(cc);
                }
              });
            }
          } catch {}

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
  const handleOpenAddPage = (preselectedAdvance?: BazarAdvance, preselectedCivName?: string) => {
    setBatchDate(formatCanteenDate(new Date()));
    setBatchPaymentMethod('Cash');

    const targetPerson = preselectedCivName || preselectedAdvance?.person || detailedPerson || 'Civ Tanvir';
    setDetailedPerson(targetPerson);

    if (preselectedAdvance) {
      setIsLinkedToAdvance(true);
      setLinkedAdvanceId(preselectedAdvance.id);
      setDetailedPerson(preselectedAdvance.person);
      setAdvanceAmountInput(String(preselectedAdvance.advanceAmount));
      setBatchPaymentMethod(preselectedAdvance.paymentMethod);
    } else {
      // Check if there is an active advance for the target person
      const pendingAdv = advances.find(a => 
        a.person.toLowerCase().trim() === targetPerson.toLowerCase().trim() && 
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
      alert('Please provide valid item name, quantity, and unit rate for at least one item.');
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
          purpose: 'Daily Bazar Procurement',
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
          showToast(`Bazar expenditure of ৳${batchTotalAmount.toLocaleString('en-US')} saved! ৳${advanceRemainingDiff.toLocaleString('en-US')} surplus refundable from ${detailedPerson}.`);
        } else {
          showToast(`Total ${newRecords.length} expenditure records (৳${batchTotalAmount.toLocaleString('en-US')}) saved successfully!`);
        }
      }, 700);
    }, 400);
  };

  // Create a New Advance from Modal
  const handleCreateNewAdvance = () => {
    const amt = parseFloat(newAdvanceAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid advance amount (e.g. 1000)');
      return;
    }

    const advId = 'adv-' + Date.now();
    const newAdv: BazarAdvance = {
      id: advId,
      date: newAdvanceDate ? formatCanteenDate(newAdvanceDate) : formatCanteenDate(new Date()),
      person: newAdvancePerson || 'Civ Tanvir',
      advanceAmount: amt,
      paymentMethod: newAdvanceMethod,
      purpose: newAdvancePurpose || 'Daily Bazar',
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
        desc: `BAZAR ADVANCE - ${newAdv.person}`.toUpperCase(),
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
    showToast(`Successfully disbursed ৳${amt.toLocaleString('en-US')} bazar advance to ${newAdv.person}!`);
  };

  // Open Receive Return Modal
  const handleOpenReceiveReturn = (adv: BazarAdvance) => {
    setSelectedAdvanceForReturn(adv);
    setReturnAmountInput(String(Math.max(0, adv.remainingAmount)));
    setReturnMethod(adv.paymentMethod || 'Cash');
    setReturnDate(formatCanteenDate(new Date()));
    setReturnNote(`Bazar surplus refund (${adv.person})`);
  };

  // Confirm Return: Return money received into Cash or UCB
  const handleConfirmReturn = async () => {
    if (!selectedAdvanceForReturn) return;
    const returnAmt = parseFloat(returnAmountInput);
    if (isNaN(returnAmt) || returnAmt <= 0) {
      alert('Please enter a valid refund amount.');
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
          notes: `${a.notes || ''} [Refund: ৳${returnAmt} (${returnMethod}) - ${returnDate}]`.trim()
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
        items: `Bazar Surplus Refund (${adv.person}) • Original Advance: ৳${adv.advanceAmount}, Spent: ৳${adv.bazarTotalAmount}, Refund: ৳${returnAmt}`,
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
    showToast(`৳${returnAmt.toLocaleString('en-US')} successfully deposited to ${returnMethod}!`);
  };

  // Helper to compute individual civilian ledger account balance & stats
  const getCivAccount = (civName: string) => {
    const normName = civName.toLowerCase().trim();

    // 1. All advances given to this person
    const civAdvances = advances.filter(a => a.person.toLowerCase().trim() === normName);
    const totalGiven = civAdvances.reduce((s, a) => s + (Number(a.advanceAmount) || 0), 0);

    // 2. All actual bazar expenses detailed under this person (excluding internal advance fund debits)
    const civExpenses = expenses.filter(e => 
      (e.detailedPerson || '').toLowerCase().trim() === normName &&
      !String(e.id || '').startsWith('exp-adv-')
    );
    const totalSpent = civExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // 3. All cash returns made by this person
    const totalReturned = civAdvances.reduce((s, a) => s + (Number(a.returnAmount) || 0), 0);

    // 4. Excess reimbursements paid to this person if any
    const totalReimbursed = civAdvances.reduce((s, a) => {
      if (a.status === 'SETTLED' && a.remainingAmount < 0) {
        return s + Math.abs(a.remainingAmount);
      }
      return s;
    }, 0);

    // Net balance: money given (+) minus bazar spent (-) minus returned (-) plus reimbursed (+)
    // (+) means "Receivable from staff" (staff owes us)
    // (-) means "Payable to staff" (we owe staff)
    // (0) means "Balanced / Settled"
    const netBalance = totalGiven - totalSpent - totalReturned + totalReimbursed;

    return {
      civName,
      totalGiven,
      totalSpent,
      totalReturned,
      totalReimbursed,
      netBalance,
      advancesCount: civAdvances.length,
      expensesCount: civExpenses.length,
      civExpenses,
      civAdvances
    };
  };

  // Quick Open Give Money / Advance for a specific Civ
  const handleOpenGiveMoneyToCiv = (civName: string) => {
    setNewAdvancePerson(civName);
    setNewAdvanceAmount('1000');
    setNewAdvanceDate(formatCanteenDate(new Date()));
    setNewAdvanceMethod('Cash');
    setDebitFromFundNow(true);
    setShowNewAdvanceModal(true);
  };

  // Quick Open Bazar Expense Entry for a specific Civ
  const handleOpenBazarForCiv = (civName: string) => {
    const pendingAdv = advances.find(a => 
      a.person.toLowerCase().trim() === civName.toLowerCase().trim() && 
      (a.status === 'PENDING_BAZAR' || a.status === 'PENDING_RETURN')
    );
    handleOpenAddPage(pendingAdv, civName);
  };

  // Quick Open Settle / Balance Adjustment for a specific Civ
  const handleOpenSettleCiv = (civName: string, balance: number) => {
    setSelectedCivForSettle({ name: civName, balance });
    setSettleAmountInput(String(Math.abs(balance)));
    setSettleMethod('Cash');
    setSettleDate(formatCanteenDate(new Date()));
    setSettleNote(
      balance > 0 
        ? `Surplus Refund Settlement (${civName})` 
        : `Reimbursement Payout Settlement (${civName})`
    );
  };

  // Confirm Settle / Return or Reimbursement
  const handleConfirmSettle = async () => {
    if (!selectedCivForSettle) return;
    const { name: civName, balance } = selectedCivForSettle;
    const amt = parseFloat(settleAmountInput);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid settlement amount');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      if (balance > 0) {
        // Civ returns surplus cash back to Canteen Fund
        let remainingToReturn = amt;
        const updatedAdvances = advances.map(a => {
          if (a.person.toLowerCase().trim() === civName.toLowerCase().trim() && a.status !== 'SETTLED') {
            const deduct = Math.min(remainingToReturn, Math.max(0, a.remainingAmount));
            if (deduct > 0) {
              remainingToReturn -= deduct;
              const newRem = Math.max(0, a.remainingAmount - deduct);
              return {
                ...a,
                remainingAmount: newRem,
                returnAmount: (a.returnAmount || 0) + deduct,
                returnMethod: settleMethod,
                returnDate: settleDate,
                status: newRem === 0 ? ('SETTLED' as const) : ('PENDING_RETURN' as const),
                notes: `${a.notes || ''} [Refund: ৳${deduct} (${settleMethod}) - ${settleDate}]`.trim()
              };
            }
          }
          return a;
        });

        saveAdvancesToStorage(updatedAdvances);

        // Record BAZAR_RETURN in canteen_txs so CanteenFund Cash/UCB increases
        const rawTxs = localStorage.getItem(TXS_STORAGE_KEY);
        const txs = rawTxs ? JSON.parse(rawTxs) : [];
        const returnTx = {
          id: 'bazar-ret-' + Date.now(),
          date: settleDate,
          amount: amt,
          type: 'BAZAR_RETURN',
          gateway: settleMethod.toUpperCase(),
          memberName: civName,
          items: `Bazar Surplus Refund (${civName})`,
          note: settleNote || `Account Balance Settlement (${civName})`
        };
        const updatedTxs = [returnTx, ...txs];
        localStorage.setItem(TXS_STORAGE_KEY, JSON.stringify(updatedTxs));
        window.dispatchEvent(new Event('canteen_txs_updated'));
        window.dispatchEvent(new Event('canteen_state_updated'));
        await pushKeyToCloud('canteen_txs', updatedTxs);

        showToast(`Successfully received ৳${amt.toLocaleString('en-US')} refund from ${civName}!`);
      } else {
        // Civ spent more from pocket (balance < 0), canteen pays reimbursement from fund
        const updatedAdvances = advances.map(a => {
          if (a.person.toLowerCase().trim() === civName.toLowerCase().trim() && (a.status === 'EXCESS_PAID' || a.remainingAmount < 0)) {
            return {
              ...a,
              status: 'SETTLED' as const,
              notes: `${a.notes || ''} [Reimbursement: ৳${amt} (${settleMethod}) - ${settleDate}]`.trim()
            };
          }
          return a;
        });
        saveAdvancesToStorage(updatedAdvances);

        // Record expense in canteen_expenses to deduct payout from fund
        const expRec: ExpenseRecord = {
          id: 'exp-reimburse-' + Date.now(),
          date: settleDate,
          desc: `BAZAR REIMBURSEMENT - ${civName}`.toUpperCase(),
          paymentMethod: settleMethod,
          amount: amt,
          detailedPerson: civName,
          isCustom: true
        };
        const updatedExpenses = [expRec, ...expenses];
        saveToStorage(updatedExpenses);

        showToast(`Successfully paid ৳${amt.toLocaleString('en-US')} reimbursement to ${civName}!`);
      }

      setSelectedCivForSettle(null);
      playChime();
    } catch (err: any) {
      alert('Settlement failed: ' + (err?.message || 'Error'));
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Add a new Civilian to local storage and active list
  const handleAddNewCivilian = () => {
    const trimmed = newCivNameInput.trim();
    if (!trimmed) return;
    const finalName = trimmed.toLowerCase().startsWith('civ') ? trimmed : `Civ ${trimmed}`;

    if (civilians.some(c => c.name.toLowerCase() === finalName.toLowerCase())) {
      showToast('A staff member with this name already exists!');
      return;
    }

    const newCiv = { id: 'civ-' + Date.now(), name: finalName };
    const updated = [...civilians, newCiv];
    setCivilians(updated);

    try {
      const customCivs = JSON.parse(localStorage.getItem('canteen_custom_civilians') || '[]');
      customCivs.push(newCiv);
      localStorage.setItem('canteen_custom_civilians', JSON.stringify(customCivs));
      pushKeyToCloud('canteen_custom_civilians', customCivs);
    } catch {}

    setNewCivNameInput('');
    setShowAddCivModal(false);
    showToast(`Staff member "${finalName}" added successfully!`);
  };

  // Delete an advance record
  const handleDeleteAdvance = (advId: string) => {
    if (!window.confirm('Are you sure you want to delete this bazar advance record?')) return;
    const updated = advances.filter(a => a.id !== advId);
    saveAdvancesToStorage(updated);
    showToast('Advance record deleted successfully!');
  };

  // Delete expense record
  const handleDelete = (id: string | number) => {
    const updated = expenses.filter(e => e.id !== id);
    saveToStorage(updated);
    setConfirmDeleteId(null);
    if (editingExpense) setEditingExpense(null);
    showToast('Expense record deleted successfully!');
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
        showToast('Expense record updated successfully!');
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
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
                <span>ADD NEW EXPENDITURE</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Voucher Entry
                </span>
              </h2>
              <p className="text-[11px] font-bold text-slate-400">
                Itemize market raw materials or administrative expense vouchers
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

        {/* BAZAR ADVANCE INTEGRATION PANEL */}
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
                  <span>Bazar Advance Link & Settlement</span>
                  {isLinkedToAdvance && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                      Advance Active
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Was cash advance given to this member/staff for today's market procurement?
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
                {isLinkedToAdvance ? 'Linked to Advance' : 'No Advance (Standard Expense)'}
              </span>
            </label>
          </div>

          {/* When Linked To Advance: Show Advance Form & Live Math */}
          {isLinkedToAdvance && (
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-amber-300 uppercase tracking-wider block mb-1">
                    Advance Recipient (Person)
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
                    Advance Given Amount (৳)
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
                    Payment Method
                  </label>
                  <select
                    value={batchPaymentMethod}
                    onChange={(e) => setBatchPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Cash">Cash (Counter)</option>
                    <option value="UCB">UCB</option>
                  </select>
                </div>
              </div>

              {/* Live Settlement Display Card */}
              <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-6 flex-wrap gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Disbursed Advance:</span>
                    <span className="font-mono font-black text-white text-sm">৳{advanceAmountNum.toLocaleString()}</span>
                  </div>
                  <div className="text-slate-600 font-black">−</div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Total Bazar Spent:</span>
                    <span className="font-mono font-black text-rose-300 text-sm">৳{batchTotalAmount.toLocaleString()}</span>
                  </div>
                  <div className="text-slate-600 font-black">=</div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">
                      {advanceRemainingDiff >= 0 ? `Surplus Refundable from ${detailedPerson}:` : `Excess Payable to ${detailedPerson}:`}
                    </span>
                    <span className={`font-mono font-black text-base ${advanceRemainingDiff >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                      ৳{Math.abs(advanceRemainingDiff).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-amber-300/90 bg-amber-500/10 px-3.5 py-1.5 rounded-xl border border-amber-500/20">
                  {advanceRemainingDiff > 0 ? (
                    <span>💡 When bazar completes, {detailedPerson} will refund ৳{advanceRemainingDiff} into Cash/UCB.</span>
                  ) : advanceRemainingDiff === 0 ? (
                    <span className="text-emerald-400">✓ Account perfectly balanced! No refund pending.</span>
                  ) : (
                    <span className="text-rose-400">⚠️ Bazar expenditure exceeded advance by ৳{Math.abs(advanceRemainingDiff)}!</span>
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
                <span>Date</span>
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
                <span>Detailer / Responsible Person</span>
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
                <span>Payment Method</span>
              </label>
              <select 
                value={batchPaymentMethod}
                onChange={(e) => setBatchPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Cash">Cash (Counter)</option>
                <option value="UCB">UCB</option>
                <option value="Due">Due (Payable)</option>
              </select>
            </div>
          </div>
        )}

        {/* Quick Raw Item Multi-Select Badges */}
        <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-indigo-400" />
              <span>QUICK RAW INVENTORY SELECT</span>
            </label>
            <span className="text-[10px] text-slate-500 font-bold">
              Click to quickly add to the voucher table below
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
              <span>EXPENDITURE ITEMS LIST</span>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                {itemRows.length} items
              </span>
            </h3>

            <button
              type="button"
              onClick={handleAddCustomRow}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Custom Item (Non-inventory)</span>
            </button>
          </div>

          <div className="space-y-3">
            {itemRows.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800 text-slate-400 text-xs font-bold">
                No items added yet. Click raw inventory buttons above or "+ Custom Item".
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
                        Item Name
                      </label>
                      {row.isCustom ? (
                        <input 
                          type="text"
                          placeholder="e.g. Rickshaw Fare / Packaging / Misc"
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
                          <option value="">Select item...</option>
                          {rawItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} • {item.unit}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1 text-center">
                        Quantity
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
                        Unit
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
                        Rate (৳)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="Rate"
                        value={row.unitPrice ?? ""}
                        onChange={(e) => handleUpdateRowField(row.uid, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right font-mono"
                      />
                    </div>

                    {/* Amount */}
                    <div className="md:col-span-1 text-right">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                        Total (৳)
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
                        title="Remove item"
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
            Cancel
          </button>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <SaveButton 
              type="button"
              onClick={handleSaveBatchExpenses}
              isSaving={isSavingBatch}
              isSaved={isSavedBatch}
              idleText={`Save Expenditures (৳${batchTotalAmount.toLocaleString('en-US')})`}
              savingText="Saving..."
              savedText="Saved Successfully! ✓"
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
              Daily bazar procurement advances, expense vouchers, civilian ledger & cash reconciliation
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
            title="Reload latest expenditures and advance data from cloud"
          >
            <Cloud className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-bounce text-amber-400' : 'text-emerald-400'}`} />
            <span>{isCloudSyncing ? 'Syncing...' : 'Cloud Synced ✓'}</span>
            {lastSyncedTime && <span className="text-[10px] text-slate-400 font-mono font-normal">({lastSyncedTime})</span>}
          </button>

          {/* Give Advance Button */}
          <button
            type="button"
            onClick={() => setShowNewAdvanceModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-amber-900/30 cursor-pointer active:scale-95"
            title="Disburse new advance cash to staff"
          >
            <ShoppingCart className="w-4 h-4 text-amber-200" />
            <span>+ Bazar Advance</span>
          </button>

          {/* Add Expenses Button */}
          <button 
            type="button"
            onClick={() => handleOpenAddPage()} 
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-indigo-900/30 cursor-pointer active:scale-95"
            title="Record new expense voucher"
          >
            <Plus className="w-4 h-4 text-indigo-200" />
            <span>+ Expense Voucher</span>
          </button>
        </div>
      </div>

      {/* 4 Premium Glassmorphic KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Total Spending */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Expenses</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-white font-mono">৳{total.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">{expenses.length} voucher records</p>
          </div>
        </div>

        {/* Card 2: Current Month Spending */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Current Month</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">৳{currentMonthSpending.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">Expenses recorded this month</p>
          </div>
        </div>

        {/* Card 3: Pending Returns */}
        <div 
          onClick={() => setActiveTab('BAZAR_ADVANCES')}
          className={`border rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden cursor-pointer transition-all ${
            pendingReturnsTotal > 0 
              ? 'bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-900 border-amber-500/50 hover:border-amber-400 shadow-amber-950/20' 
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
          title="Click to view bazar advances and refundable balances"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">Advance Receivable</span>
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
              {pendingReturnsCount > 0 ? `${pendingReturnsCount} pending returns (Click to view)` : 'All advances settled'}
            </p>
          </div>
        </div>

        {/* Card 4: Cash vs UCB Split */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payment Channels</span>
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">Cash:</span>
              <span className="font-mono font-black text-emerald-400">৳{cashTotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">UCB / Bank:</span>
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
            <span>All Expenses ({expenses.length})</span>
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
            <span>Civilian Accounts & Bazar Ledger ({civilians.length})</span>
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
            <span>Procurement Analytics</span>
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
              placeholder="Search item name, person (e.g. Civ Tanvir), payment method or date..."
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
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Item Description</th>
                    <th className="py-3.5 px-4 text-center">Qty</th>
                    <th className="py-3.5 px-4 text-center">Rate (৳)</th>
                    <th className="py-3.5 px-4 text-center">Detailer</th>
                    <th className="py-3.5 px-4 text-center">Channel</th>
                    <th className="py-3.5 px-4 text-right">Total Amount</th>
                    <th className="py-3.5 px-4 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-bold">
                        No expenditure records found.
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
                                Advance Linked
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
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(expense.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete"
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

      {/* TAB 2: BAZAR ADVANCES & SETTLEMENT TRACKER */}
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
                  <span>Civilian Procurement Accounts & Ledger</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Individual account boxes for staff: (+) Balance = Receivable from staff, (-) Balance = Payable to staff
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowAddCivModal(true)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>+ Add Staff Member</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNewAdvanceModal(true)}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer shadow-lg shadow-amber-950/40 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Disburse Cash / Advance</span>
              </button>
            </div>
          </div>

          {/* 1. INDIVIDUAL CIVILIAN RUNNING ACCOUNT BOXES */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Civilian Procurement Accounts (Individual Running Balance)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cash given is credited (+), itemized bazar expenditures are debited (-)
                </p>
              </div>
            </div>

            {/* The Grid of Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {civilians.map(civ => {
                const civAcc = getCivAccount(civ.name);
                const isReceivable = civAcc.netBalance > 0;
                const isPayable = civAcc.netBalance < 0;
                const isSettled = civAcc.netBalance === 0;

                return (
                  <div
                    key={civ.id || civ.name}
                    className={`rounded-3xl border p-5 shadow-lg space-y-4 relative overflow-hidden transition-all ${
                      isReceivable
                        ? 'bg-slate-900/95 border-emerald-500/40 hover:border-emerald-500 shadow-emerald-950/20'
                        : isPayable
                        ? 'bg-slate-900/95 border-rose-500/40 hover:border-rose-500 shadow-rose-950/20'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header: Name and Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm border shrink-0 ${
                          isReceivable
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : isPayable
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {civ.name.replace('Civ ', '').charAt(0) || 'C'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-base font-black text-white truncate">{civ.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Civilian Staff
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {isReceivable ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Receivable (+)</span>
                          </span>
                        ) : isPayable ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            <span>Payable (-)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 inline-block">
                            ✓ Balanced (৳0)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prominent Balance Display */}
                    <div className={`p-4 rounded-2xl border ${
                      isReceivable
                        ? 'bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 border-emerald-500/40'
                        : isPayable
                        ? 'bg-gradient-to-r from-rose-950/40 via-slate-950 to-slate-950 border-rose-500/40'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span>Running Account Balance</span>
                        <span className="font-mono font-bold text-slate-500">
                          {civAcc.expensesCount} expenses • {civAcc.advancesCount} advances
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline space-x-1">
                        <h3 className={`text-3xl font-black font-mono tracking-tight ${
                          isReceivable
                            ? 'text-emerald-400'
                            : isPayable
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}>
                          {isReceivable
                            ? `+ ৳${civAcc.netBalance.toLocaleString()}`
                            : isPayable
                            ? `- ৳${Math.abs(civAcc.netBalance).toLocaleString()}`
                            : '৳0'}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold mt-1 leading-snug">
                        {isReceivable
                          ? `💡 Cash held in hand for bazar / Receivable from ${civ.name}`
                          : isPayable
                          ? `⚠️ Spent out of pocket / Payable to ${civ.name}: ৳${Math.abs(civAcc.netBalance).toLocaleString()}`
                          : `✓ All transactions settled and balanced`}
                      </p>
                    </div>

                    {/* Mini Breakdown Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Total Disbursed (+)</span>
                        <span className="font-black text-white text-xs">৳{civAcc.totalGiven.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Total Spent (-)</span>
                        <span className="font-black text-rose-300 text-xs">৳{civAcc.totalSpent.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Settled / Refund</span>
                        <span className="font-black text-teal-300 text-xs">৳{civAcc.totalReturned.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenGiveMoneyToCiv(civ.name)}
                        className="py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-amber-950/30 cursor-pointer active:scale-95"
                        title="Disburse cash for market (will credit account)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Give Cash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenBazarForCiv(civ.name)}
                        className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-indigo-950/30 cursor-pointer active:scale-95"
                        title="Record itemized bazar voucher (will debit account)"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>🛒 Bazar Voucher</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedCivForLedger(civ.name)}
                        className="text-slate-400 hover:text-indigo-400 font-bold text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ledger Statement</span>
                      </button>

                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => handleOpenSettleCiv(civ.name, civAcc.netBalance)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer flex items-center space-x-1 ${
                            isReceivable
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40'
                          }`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{isReceivable ? 'Receive Refund' : 'Reimburse Payout'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. RECENT ADVANCES & VOUCHERS LIST */}
          <div className="space-y-4 pt-6 border-t border-slate-800">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Recent Advance & Voucher History</span>
            </h4>
            {advances.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
                <ShoppingCart className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 font-bold text-sm">
                  No bazar advance records found.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewAdvanceModal(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center space-x-2 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Disburse First Bazar Advance</span>
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
                                ? `৳${adv.remainingAmount} Pending Return`
                                : isPendingBazar
                                ? 'Procurement in Progress'
                                : 'Fully Settled ✓'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Date: {adv.date} • Channel: <strong className="text-white">{adv.paymentMethod}</strong> • {adv.purpose || 'Bazar'}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Math Breakdown */}
                      <div className="flex items-center space-x-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Disbursed Advance:</span>
                          <span className="font-black text-white text-sm">৳{adv.advanceAmount.toLocaleString()}</span>
                        </div>
                        <div className="text-slate-600 font-black">−</div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Total Bazar Spent:</span>
                          <span className="font-black text-rose-300 text-sm">৳{adv.bazarTotalAmount.toLocaleString()}</span>
                        </div>
                        <div className="text-slate-600 font-black">=</div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Remaining Refundable:</span>
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
                            title="Receive surplus refund to cash/UCB"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Receive Refund (৳{adv.remainingAmount})</span>
                          </button>
                        )}

                        {isPendingBazar && (
                          <button
                            type="button"
                            onClick={() => handleOpenAddPage(adv)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1.5 cursor-pointer active:scale-95"
                            title="Enter market expenditure voucher"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Enter Bazar Expenses</span>
                          </button>
                        )}

                        {isSettled && (
                          <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                            <Check className="w-3.5 h-3.5" />
                            <span>Account Settled ({adv.returnMethod || 'Cash'})</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteAdvance(adv.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="Delete advance record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                    {/* Summary items note if present */}
                    {adv.bazarItemsSummary && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-2">
                        <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="truncate">Bazar Items: {adv.bazarItemsSummary}</span>
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
              <span>Detailer-wise Procurement Breakdown</span>
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
                      <span className="text-[10px] text-slate-500 font-mono">{civExpenses.length} vouchers</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Total Bazar:</span>
                      <span className="font-mono font-black text-emerald-400">৳{civTotal.toLocaleString()}</span>
                    </div>
                    {civPending > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-amber-400 font-bold">Pending Refund:</span>
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

      {/* MODAL 1: NEW BAZAR ADVANCE MODAL */}
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
                    Disburse Bazar Advance
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Disburse advance cash to staff for market procurement
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
                  Staff Member / Detailer
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
                  Advance Amount (৳)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  value={newAdvanceAmount}
                  onChange={(e) => setNewAdvanceAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base font-black text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Payment Channel
                  </label>
                  <select
                    value={newAdvanceMethod}
                    onChange={(e) => setNewAdvanceMethod(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Cash">Cash (Counter)</option>
                    <option value="UCB">UCB (Bank)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Disbursement Date
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
                  Purpose / Notes
                </label>
                <input
                  type="text"
                  value={newAdvancePurpose}
                  onChange={(e) => setNewAdvancePurpose(e.target.value)}
                  placeholder="e.g. Lunch Procurement Bazar"
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewAdvance}
                className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-950/40 cursor-pointer"
              >
                Confirm Advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVE RETURN MODAL */}
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
                    Receive Bazar Surplus Refund
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Receive remaining surplus cash from {selectedAdvanceForReturn.person}
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
                <span className="text-slate-400 font-sans">Disbursed Advance:</span>
                <span className="font-black text-white">৳{selectedAdvanceForReturn.advanceAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Total Bazar Spent:</span>
                <span className="font-black text-rose-300">৳{selectedAdvanceForReturn.bazarTotalAmount}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800 text-sm">
                <span className="text-amber-300 font-sans font-bold">Refundable Balance:</span>
                <span className="font-black text-amber-400">৳{selectedAdvanceForReturn.remainingAmount}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Refund Amount (৳)
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
                    Deposit Channel
                  </label>
                  <select
                    value={returnMethod}
                    onChange={(e) => setReturnMethod(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Cash">Cash (Counter Fund)</option>
                    <option value="UCB">UCB (Bank Account)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Return Date
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
                  Notes / Remarks
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
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReturn}
                onClick={handleConfirmReturn}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Refund Deposit</span>
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

      {/* MODAL 4: CIVILIAN INDIVIDUAL LEDGER STATEMENT */}
      {selectedCivForLedger && (() => {
        const civAcc = getCivAccount(selectedCivForLedger);
        // Build chronological list of ledger items
        const ledgerItems: Array<{
          id: string;
          date: string;
          type: 'GIVEN' | 'EXPENSE' | 'RETURN';
          desc: string;
          method: string;
          amount: number;
        }> = [];

        // 1. Advances given (+)
        civAcc.civAdvances.forEach(adv => {
          ledgerItems.push({
            id: 'adv-' + adv.id,
            date: adv.date,
            type: 'GIVEN',
            desc: `Advance received for bazar (${adv.purpose || 'Daily Bazar'})`,
            method: adv.paymentMethod,
            amount: adv.advanceAmount
          });

          // If return was recorded on this advance
          if (adv.returnAmount && adv.returnAmount > 0) {
            ledgerItems.push({
              id: 'ret-' + adv.id,
              date: adv.returnDate || adv.date,
              type: 'RETURN',
              desc: `Surplus cash refunded (${adv.notes || 'Deposited to cash'})`,
              method: adv.returnMethod || 'Cash',
              amount: adv.returnAmount
            });
          }
        });

        // 2. Expenses detailed by this civ (-)
        civAcc.civExpenses.forEach(exp => {
          ledgerItems.push({
            id: 'exp-' + exp.id,
            date: exp.date,
            type: 'EXPENSE',
            desc: `${exp.desc} ${exp.qty ? `(${exp.qty} ${exp.unit || ''})` : ''}`,
            method: exp.paymentMethod || 'Cash',
            amount: exp.amount
          });
        });

        // Sort by date/timestamp
        ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate running balance at each row
        let runningBal = 0;
        const rowsWithBalance = ledgerItems.map(item => {
          if (item.type === 'GIVEN') runningBal += item.amount;
          else if (item.type === 'EXPENSE') runningBal -= item.amount;
          else if (item.type === 'RETURN') runningBal -= item.amount;
          return { ...item, runningBalance: runningBal };
        });

        return (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 space-y-5 max-h-[90vh] flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base border shrink-0 ${
                    civAcc.netBalance > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : civAcc.netBalance < 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {selectedCivForLedger.replace('Civ ', '').charAt(0) || 'C'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-black text-white">{selectedCivForLedger}</h3>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        Personal Ledger
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Complete statement of cash received (+), vouchers debited (-), and surplus refunds
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCivForLedger(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Top Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Received (+)</span>
                  <span className="text-base font-black text-white font-mono">৳{civAcc.totalGiven.toLocaleString()}</span>
                </div>
                <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Spent (-)</span>
                  <span className="text-base font-black text-rose-300 font-mono">৳{civAcc.totalSpent.toLocaleString()}</span>
                </div>
                <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Refunded</span>
                  <span className="text-base font-black text-teal-300 font-mono">৳{civAcc.totalReturned.toLocaleString()}</span>
                </div>
                <div className={`p-3 rounded-2xl border ${
                  civAcc.netBalance > 0
                    ? 'bg-emerald-950/40 border-emerald-500/40'
                    : civAcc.netBalance < 0
                    ? 'bg-rose-950/40 border-rose-500/40'
                    : 'bg-slate-950/70 border-slate-800'
                }`}>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Current Balance</span>
                  <span className={`text-base font-black font-mono ${
                    civAcc.netBalance > 0
                      ? 'text-emerald-400'
                      : civAcc.netBalance < 0
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}>
                    {civAcc.netBalance > 0
                      ? `+ ৳${civAcc.netBalance.toLocaleString()}`
                      : civAcc.netBalance < 0
                      ? `- ৳${Math.abs(civAcc.netBalance).toLocaleString()}`
                      : '৳0'}
                  </span>
                  <span className="text-[9px] font-bold block mt-0.5 text-slate-400">
                    {civAcc.netBalance > 0 ? 'Receivable from staff' : civAcc.netBalance < 0 ? 'Payable to staff' : 'Balanced'}
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60 scrollbar-none">
                {rowsWithBalance.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-bold">
                    No transaction records found.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-black uppercase text-[10px] sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="px-3.5 py-3">Date</th>
                        <th className="px-3.5 py-3">Description</th>
                        <th className="px-3.5 py-3">Channel</th>
                        <th className="px-3.5 py-3 text-right">Received (+)</th>
                        <th className="px-3.5 py-3 text-right">Spent (-)</th>
                        <th className="px-3.5 py-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {rowsWithBalance.map((r, i) => (
                        <tr key={r.id || i} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-3.5 py-2.5 text-slate-400 whitespace-nowrap">{r.date}</td>
                          <td className="px-3.5 py-2.5 font-sans font-bold text-slate-200">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                              r.type === 'GIVEN'
                                ? 'bg-amber-400'
                                : r.type === 'EXPENSE'
                                ? 'bg-rose-400'
                                : 'bg-teal-400'
                            }`} />
                            {r.desc}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-400">{r.method}</td>
                          <td className="px-3.5 py-2.5 text-right font-black text-amber-300">
                            {r.type === 'GIVEN' ? `৳${r.amount.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-black text-rose-300">
                            {r.type === 'EXPENSE' ? `৳${r.amount.toLocaleString()}` : r.type === 'RETURN' ? `(Refund ৳${r.amount})` : '-'}
                          </td>
                          <td className={`px-3.5 py-2.5 text-right font-black ${
                            r.runningBalance > 0
                              ? 'text-emerald-400'
                              : r.runningBalance < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}>
                            {r.runningBalance > 0 ? `+ ৳${r.runningBalance.toLocaleString()}` : r.runningBalance < 0 ? `- ৳${Math.abs(r.runningBalance).toLocaleString()}` : '৳0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const name = selectedCivForLedger;
                      setSelectedCivForLedger(null);
                      handleOpenGiveMoneyToCiv(name);
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Give Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const name = selectedCivForLedger;
                      setSelectedCivForLedger(null);
                      handleOpenBazarForCiv(name);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>🛒 Enter Bazar Expense</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCivForLedger(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL 5: CIVILIAN SETTLEMENT / BALANCE ADJUSTMENT MODAL */}
      {selectedCivForSettle && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[195] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                  selectedCivForSettle.balance > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}>
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    {selectedCivForSettle.balance > 0 ? 'Receive Surplus Refund' : 'Reimburse Out-of-Pocket Expense'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Complete account settlement for {selectedCivForSettle.name}
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedCivForSettle(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanation card */}
            <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
              selectedCivForSettle.balance > 0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
            }`}>
              <div className="flex justify-between items-center text-sm font-black font-mono">
                <span>Current Balance:</span>
                <span>
                  {selectedCivForSettle.balance > 0 
                    ? `+ ৳${selectedCivForSettle.balance.toLocaleString()}` 
                    : `- ৳${Math.abs(selectedCivForSettle.balance).toLocaleString()}`}
                </span>
              </div>
              <p className="text-[11px] opacity-90 mt-1">
                {selectedCivForSettle.balance > 0
                  ? `💡 Staff holds ৳${selectedCivForSettle.balance.toLocaleString()} surplus after bazar. Receiving this will increase Cash fund.`
                  : `⚠️ Staff spent extra ৳${Math.abs(selectedCivForSettle.balance).toLocaleString()} from personal funds. Reimbursing this will be deducted from fund.`}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Settlement Amount (৳)
                </label>
                <input
                  type="number"
                  value={settleAmountInput}
                  onChange={(e) => setSettleAmountInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-base font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Payment Channel
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash (Counter Fund)</option>
                    <option value="UCB">UCB (Bank Fund)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Date
                  </label>
                  <input
                    type="text"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="e.g. Account balance settlement & cash received"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedCivForSettle(null)}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingSettle}
                onClick={handleConfirmSettle}
                className={`px-6 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg cursor-pointer flex items-center space-x-2 ${
                  selectedCivForSettle.balance > 0
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/40'
                    : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 shadow-rose-950/40'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmittingSettle 
                    ? 'Processing...' 
                    : selectedCivForSettle.balance > 0 
                    ? 'Confirm Surplus Refund' 
                    : 'Confirm Reimbursement'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ADD NEW CIVILIAN MODAL */}
      {showAddCivModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[195] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    Add Civilian Staff Member
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Create dedicated procurement account box for staff
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowAddCivModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Civilian Staff Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Civ Rafiq or Rafiq"
                  value={newCivNameInput}
                  onChange={(e) => setNewCivNameInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  (A dedicated procurement account box will be created automatically)
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddCivModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewCivilian}
                disabled={!newCivNameInput.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-950/40 cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
