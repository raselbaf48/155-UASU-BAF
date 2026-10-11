import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, ShoppingCart, Minus, Trash2, CheckCircle2, X, History, Calendar, 
  Package as PackageIcon, Users, Utensils, CheckSquare, Check, Banknote, Edit2, Edit3,
  Upload
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, getItemDisplayName, getCanteenConfig, CanteenConfig } from '../utils/canteenSettings';
import { formatCanteenDate, toYMDDate } from '../utils/dateUtils';
import { getMenuItemBanglaName } from '../utils/menuBanglaNames';
import { DateNavigator, getTodayYMD } from '../components/DateNavigator';
import { 
  deductRawStockForSales, 
  getRawInventoryItems, 
  calculateMenuItemStockInfo, 
  getMenuRecipes,
  RawInventoryItem,
  decodeNotesMeta,
  deduplicateRawItems,
  cleanPureBanglaName,
  RAW_ITEMS_STORAGE_KEY,
  INITIAL_RAW_ITEMS,
  isReadymadeItem,
  InventoryItemType
} from '../utils/recipeManager';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';
import { playSuccessChime, playTrashPopSound } from '../utils/audioFeedback';
import { ImportPosSalesModal } from '../components/ImportPosSalesModal';
import { 
  getCanteenMenuCache, 
  setCanteenMenuCache,
  fetchCanteenMenuOnce, 
  getCanteenMembersCache, 
  fetchCanteenMembersOnce,
  isOneTimeBoxItem,
  normalizeCatalogKey
} from '../utils/canteenMenuData';

const isOfficerMember = (m: any): boolean => {
  const r = String(m?.Rank || m?.rank || '').toUpperCase().trim();
  const officerRanks = ['ACM', 'AM', 'AVM', 'AIR CDRE', 'GP CAPT', 'WG CDR', 'SQN LDR', 'FLT LT', 'FG OFFR', 'FLG OFFR', 'PLT OFFR'];
  return officerRanks.some((or) => r.includes(or));
};

const isCivilianMember = (m: any): boolean => {
  const r = String(m?.Rank || m?.rank || '').toUpperCase().trim();
  return r.includes('CIV') || r.includes('NC(E)') || r.includes('NCE');
};

const isAirmanMember = (m: any): boolean => {
  return !isOfficerMember(m) && !isCivilianMember(m);
};

const isSaleTransaction = (tx: any): boolean => {
  if (!tx) return false;
  const t = String(tx?.type || '').toUpperCase().trim();
  const items = String(tx?.items || '').trim();
  const itemsUpper = items.toUpperCase();
  const id = String(tx?.id || '');

  // Explicit non-sale / payment / adjustment types
  if (
    t === 'BILL PAYMENT' ||
    t === 'PAYMENT' ||
    t === 'BILL_PAYMENT' ||
    t === 'INITIAL_BILL' ||
    t === 'AMOUNT_CHANGE' ||
    t === 'BAZAR_RETURN' ||
    t === 'ADVANCE_RETURN' ||
    t === 'ADVANCE_PAYMENT' ||
    t === 'ADVANCE' ||
    t === 'REVERTED' ||
    t === 'WASTAGE' ||
    t === 'RESTOCK' ||
    tx?.isReverted === true ||
    tx?.isPayment === true
  ) {
    return false;
  }

  // ID prefixes used exclusively for payments, initial dues and batch imports
  if (
    id.startsWith('tx-pay-') ||
    id.startsWith('pay-') ||
    id.startsWith('init-') ||
    id.startsWith('tx-import-')
  ) {
    return false;
  }

  // Transactions with billType are payment entries from MemberDB
  if (tx?.billType) {
    return false;
  }

  // Descriptions containing payment, advance or due settlement keywords
  if (
    itemsUpper.includes('BILL PAYMENT') ||
    itemsUpper.includes('PAYMENT') ||
    itemsUpper.includes('INITIAL') ||
    items.includes('বিল পরিশোধ') ||
    items.includes('পরিশোধ') ||
    items.includes('জমা') ||
    items.includes('বকেয়া') ||
    items.includes('প্রারম্ভিক') ||
    items.includes('Changed amount from')
  ) {
    return false;
  }

  // Explicit SALE or PURCHASE or PRE-ORDER
  if (t === 'SALE' || t === 'PURCHASE' || t === 'PRE-ORDER') {
    return true;
  }

  // Transactions with actual sold menu items
  if (Array.isArray(tx?.soldItems) && tx.soldItems.length > 0) {
    return true;
  }

  // Legacy fallback: type is empty or standard DUE sale and no payment words
  if (!t || t === 'CREDIT SALE' || t === 'CASH SALE') {
    return true;
  }

  return false;
};

export const PosSales: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<any[]>(() => getCanteenMenuCache());
  const [basket, setBasket] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Member Selection States (Mode 1 style for Normal POS)
  const [memberRankFilter, setMemberRankFilter] = useState<'ALL' | 'OFFICER' | 'AIRMEN' | 'CIVILIAN'>('ALL');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);

  // Mobile Drawer State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Canteen Settings & Inventory configuration
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());
  const [rawInventory, setRawInventory] = useState<any[]>(() => getRawInventoryItems());
  const [recipesMap, setRecipesMap] = useState<any>(() => getMenuRecipes());

  // Sale Date (Default: Today)
  const [saleDate, setSaleDate] = useState(() => getTodayYMD());

  // Payment Mode (Default: DUE)
  const [paymentMode, setPaymentMode] = useState<'DUE' | 'PAID'>('DUE');
  // Discount Amount
  const [discountAmount, setDiscountAmount] = useState<string>('');

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showImportSalesModal, setShowImportSalesModal] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState<'ALL' | 'TODAY'>('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState(() => getTodayYMD());
  const [toastMessage, setToastMessage] = useState('');
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<string | null>(null);
  const [deleteSuccessData, setDeleteSuccessData] = useState<{ desc: string; amount: number } | null>(null);
  
  // History Record Detail/Edit State
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDiscount, setEditDiscount] = useState<string>('0');
  const [editBaseAmount, setEditBaseAmount] = useState<number>(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'DUE' | 'PAID'>('DUE');
  const [editDate, setEditDate] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchRawInventoryFromDb = async () => {
    try {
      const { data, error } = await supabase.from('Canteen_Inventory').select('*');
      if (!error && data && data.length > 0) {
        const mapped: RawInventoryItem[] = data.map((r: any) => {
          const meta = decodeNotesMeta(r.notes);
          const cleanNotes = (r.notes || '').replace(/<!--META:[\s\S]*?-->/g, '').trim();
          const unit = r.unit || 'kg';
          const isKg = unit.toLowerCase().trim() === 'kg';
          const isLtr = unit.toLowerCase().trim() === 'liter';
          const isCyl = ['cylinder', 'সিলিন্ডার'].includes(unit.toLowerCase().trim());
          const rawSubUnit = r['Sub Unit'] ?? r.subUnit ?? r.sub_unit ?? meta.subUnit;
          const itemDp = r.DP || r.dp || meta.dp || r.image || r.image_url || undefined;
          const rawType = meta.itemType || r.itemType || r.item_type;
          const itemType: InventoryItemType = (rawType === 'READY_MADE' || rawType === 'RAW')
            ? rawType
            : (isReadymadeItem({ ...r, notes: cleanNotes }) ? 'READY_MADE' : 'RAW');

          return {
            id: String(r.id),
            name: r.name || '',
            nameBn: cleanPureBanglaName(r.nameBn || r.name_bn || '') || r.name || '',
            category: meta.category || r.category || 'Packaging & Disposables',
            subCategory: meta.subCategory || r.subCategory || r.sub_category || '',
            itemType,
            unit: unit,
            currentStock: Number(r.currentStock ?? r.current_stock ?? 0),
            minStockAlert: Number(r.minStockAlert ?? r.min_stock_alert ?? 5),
            unitCost: Number(r.unitCost ?? r.unit_cost ?? 0),
            wastagePercentage: Number(r.wastagePercentage ?? r.wastage_percentage ?? 0),
            lastRestockedDate: r.lastRestockedDate || r.last_restocked_date || '',
            supplier: r.supplier || '',
            notes: cleanNotes,
            hasSubUnits: (isKg || isCyl) ? true : Boolean(meta.hasSubUnits ?? r.hasSubUnits ?? r.has_sub_units ?? Boolean(rawSubUnit) ?? (Number(r.packSize ?? r.pack_size) > 1)),
            packSize: isKg ? (Number(meta.packSize ?? r.packSize ?? r.pack_size) > 1 ? Number(meta.packSize ?? r.packSize ?? r.pack_size) : 1000) : (isCyl ? (Number(meta.packSize ?? r.packSize ?? r.pack_size) > 1 ? Number(meta.packSize ?? r.packSize ?? r.pack_size) : 12) : Number(meta.packSize ?? r.packSize ?? r.pack_size ?? 1)),
            subUnit: rawSubUnit || (isKg ? 'gm' : (isLtr ? 'ml' : (isCyl ? 'kg' : (meta.subUnit || r.subUnit || r.sub_unit || 'pcs')))),
            dp: itemDp,
            DP: itemDp,
            image: itemDp
          };
        });
        const { deduplicated } = deduplicateRawItems([...INITIAL_RAW_ITEMS, ...mapped]);
        setRawInventory(deduplicated);
        setRecipesMap(getMenuRecipes());
        try {
          localStorage.setItem(RAW_ITEMS_STORAGE_KEY, JSON.stringify(deduplicated));
        } catch {}
      } else {
        setRawInventory(getRawInventoryItems());
        setRecipesMap(getMenuRecipes());
      }
    } catch (e) {
      console.warn('POS fetchRawInventoryFromDb note:', e);
      setRawInventory(getRawInventoryItems());
      setRecipesMap(getMenuRecipes());
    }
  };

  useEffect(() => {
    fetchRawInventoryFromDb();
    fetchCatalog();
    fetchMembers();

    const stored = localStorage.getItem('canteen_recent_members');
    if (stored) {
      try { setRecentMembers(JSON.parse(stored)); } catch(e){}
    }

    const handleInventoryUpdated = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setCatalog(e.detail.filter((it: any) => !isOneTimeBoxItem(it)));
      } else {
        const cached = getCanteenMenuCache();
        if (cached && cached.length > 0) {
          setCatalog(cached.filter((it: any) => !isOneTimeBoxItem(it)));
        }
        fetchCatalog();
      }
      const history = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      setSalesHistory(history.filter((tx: any) => isSaleTransaction(tx)));
    };

    const handleSyncStock = () => {
      setRawInventory(getRawInventoryItems());
      setRecipesMap(getMenuRecipes());
    };
    const handleCfgUpdate = (e: any) => {
      setCanteenConfig(e.detail || getCanteenConfig());
    };

    window.addEventListener('canteen_settings_updated', handleCfgUpdate);
    window.addEventListener('canteen_raw_inventory_updated', handleSyncStock);
    window.addEventListener('canteen_menu_recipes_updated', handleSyncStock);
    window.addEventListener('canteen_inventory_updated', handleInventoryUpdated);
    window.addEventListener('canteen_menu_updated', handleInventoryUpdated);
    window.addEventListener('canteen_daily_menu_updated', handleInventoryUpdated);
    window.addEventListener('canteen_txs_updated', handleInventoryUpdated);
    window.addEventListener('canteen_state_updated', handleInventoryUpdated);
    window.addEventListener('storage', handleInventoryUpdated);
    window.addEventListener('storage', handleSyncStock);
    window.addEventListener('storage', handleCfgUpdate);

    // Supabase Realtime Channels for 100% live synchronization with database
    const channelName = `pos_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Inventory' }, () => {
        fetchRawInventoryFromDb();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Menu' }, () => {
        fetchCatalog();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Member' }, () => {
        fetchMembers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'setting_key=eq.canteen_raw_inventory_items_v2' }, () => {
        fetchRawInventoryFromDb();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'setting_key=eq.canteen_menu_recipes_v3' }, () => {
        setRecipesMap(getMenuRecipes());
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('canteen_settings_updated', handleCfgUpdate);
      window.removeEventListener('canteen_raw_inventory_updated', handleSyncStock);
      window.removeEventListener('canteen_menu_recipes_updated', handleSyncStock);
      window.removeEventListener('canteen_inventory_updated', handleInventoryUpdated);
      window.removeEventListener('canteen_menu_updated', handleInventoryUpdated);
      window.removeEventListener('canteen_daily_menu_updated', handleInventoryUpdated);
      window.removeEventListener('canteen_txs_updated', handleInventoryUpdated);
      window.removeEventListener('canteen_state_updated', handleInventoryUpdated);
      window.removeEventListener('storage', handleInventoryUpdated);
      window.removeEventListener('storage', handleSyncStock);
      window.removeEventListener('storage', handleCfgUpdate);
    };
  }, []);

  const fetchMembers = async () => {
    try {
      const data = await fetchCanteenMembersOnce();
      if (data && data.length > 0) {
        setMembers(
          data
            .filter((m: any) => {
              const bd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
              return bd !== '48456';
            })
            .map((m: any) => ({
              ...m,
              Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
              baki: Number(m.Due ?? m.due ?? m.baki ?? 0)
            }))
        );
      }
    } catch (err) {
      console.warn('Error in POS fetchMembers:', err);
    }
  };

  const fetchCatalog = async () => {
    try {
      const data = await fetchCanteenMenuOnce(true);
      if (data && data.length > 0) {
        setCatalog(data.filter((it: any) => !isOneTimeBoxItem(it)));
      }
    } catch(e) {
      console.warn("Error in POS fetchCatalog:", e);
    }
  };

  // Helper to dynamically resolve live name and updated unit price from catalog for any transaction item
  const resolveLiveItem = (item: { menuItemId?: string; id?: string; menuItemName?: string; name?: string; price?: number; unitPrice?: number; qty?: number }) => {
    const itemId = item.menuItemId || item.id;
    const rawName = String(item.menuItemName || item.name || '').trim();
    const qty = Number(item.qty || 1);

    // 1. One Time Box check
    if (isOneTimeBoxItem(item) || itemId === 'parcel-one-time-box') {
      return {
        name: 'ওয়ান টাইম বক্স',
        unitPrice: 5,
        qty,
        itemTotal: 5 * qty
      };
    }

    // 2. Look up in current catalog by ID
    let matched = catalog.find(c => String(c.id) === String(itemId));

    // 3. If not found by ID, match by English or Bangla name with normalization
    if (!matched && rawName) {
      const rawLower = rawName.toLowerCase();
      const bnLower = getMenuItemBanglaName(rawName).toLowerCase();
      const normRaw = normalizeCatalogKey(rawName);
      const normBn = normalizeCatalogKey(bnLower);

      matched = catalog.find(c => {
        const cEn = String(c.name || c.name_en || '').toLowerCase().trim();
        const cBn = String(c.name_bn || c['Name (BN)'] || getMenuItemBanglaName(c) || '').toLowerCase().trim();
        const normCEn = normalizeCatalogKey(cEn);
        const normCBn = normalizeCatalogKey(cBn);

        return cEn === rawLower || cBn === rawLower || cBn === bnLower || cEn === bnLower ||
               (normRaw && (normCEn === normRaw || normCBn === normRaw || normCBn === normBn)) ||
               (normRaw && ((normCEn && (normCEn.includes(normRaw) || normRaw.includes(normCEn))) ||
                            (normCBn && (normCBn.includes(normRaw) || normRaw.includes(normCBn)))));
      });
    }

    const livePrice = matched ? Number(matched.price) : Number(item.price ?? item.unitPrice ?? 0);
    const liveName = matched
      ? (getMenuItemBanglaName(matched) || matched.name_bn || matched['Name (BN)'] || matched.name)
      : (getMenuItemBanglaName(rawName) || rawName);

    return {
      name: liveName,
      unitPrice: livePrice,
      qty,
      itemTotal: livePrice * qty
    };
  };

  // Parcel status: active if basket has One Time Box
  const isParcelActive = useMemo(() => {
    return basket.some(b => isOneTimeBoxItem(b) || b.id === 'parcel-one-time-box');
  }, [basket]);

  const toggleParcel = () => {
    if (isParcelActive) {
      // Remove Parcel Box
      setBasket(prev => prev.filter(b => !isOneTimeBoxItem(b) && b.id !== 'parcel-one-time-box'));
    } else {
      // Add One Time Box
      setBasket(prev => [
        ...prev,
        {
          id: 'parcel-one-time-box',
          name: 'ওয়ান টাইম বক্স',
          name_en: 'ONE TIME BOX',
          name_bn: 'ওয়ান টাইম বক্স',
          price: 5,
          qty: 1
        }
      ]);
    }
  };

  const loadHistory = () => {
    const history = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    const onlySales = history.filter((tx: any) => isSaleTransaction(tx));
    setSalesHistory(onlySales);
    setHistoryDateFilter(saleDate || getTodayYMD());
    setShowHistoryModal(true);
  };

  const filteredSalesHistory = useMemo(() => {
    let list = salesHistory.filter((tx: any) => isSaleTransaction(tx));
    if (historyDateFilter) {
      list = list.filter(tx => {
        const rawDate = tx.date || tx.paymentDate || tx.timestamp || tx.created_at || (typeof tx.id === 'number' ? tx.id : undefined);
        const ymd = toYMDDate(rawDate);
        return ymd === historyDateFilter;
      });
    }
    if (!historySearchTerm.trim()) return list;
    const term = historySearchTerm.toLowerCase().trim();
    return list.filter(tx => {
      const m = members.find(mem => mem.airman_id === tx.airman_id);
      const memberName = m ? `${m['Rank'] || ''} ${m['Surname'] || ''} ${m['BD No'] || ''}` : String(tx.memberName || tx.airman_id || '');
      const itemsStr = String(tx.items || '');
      const dateStr = String(tx.date || '');
      const bdStr = String(tx.bdNo || (m ? m['BD No'] : '') || '');
      return memberName.toLowerCase().includes(term) ||
             itemsStr.toLowerCase().includes(term) ||
             dateStr.toLowerCase().includes(term) ||
             bdStr.toLowerCase().includes(term);
    });
  }, [salesHistory, historyDateFilter, historySearchTerm, members]);

  const removeHistoryItem = async (txId: string) => {
    const txToRemove = salesHistory.find(tx => tx.id === txId);
    if (!txToRemove) return;

    // 0ms instant feedback: play sound and display success card in modal immediately
    playTrashPopSound();
    playSuccessChime();
    setDeleteSuccessData({
      desc: txToRemove.items || txToRemove.name || 'বিক্রয় রেকর্ড',
      amount: Number(txToRemove.amount || 0)
    });
    setTimeout(() => {
      setDeleteSuccessData(null);
      setTxDeleteConfirmId(null);
    }, 2200);

    // Reverse Due ONLY if transaction was DUE
    const isPaid = txToRemove.status === 'PAID' || txToRemove.paymentStatus === 'PAID' || String(txToRemove.gateway || txToRemove.paymentMethod || '').toUpperCase() === 'CASH';
    if (!isPaid) {
      const m = members.find(m => m.airman_id === txToRemove.airman_id);
      if (m) {
        const currentDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
        const newDue = Math.max(0, currentDue - Number(txToRemove.amount || 0));
        await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', txToRemove.airman_id);
        setMembers(members.map(member => member.airman_id === txToRemove.airman_id ? {...member, Due: newDue, baki: newDue} : member));
      }
    }

    const currentHistory = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    const updatedHistory = currentHistory.filter((tx: any) => String(tx.id) !== String(txId));
    setSalesHistory(prev => prev.filter(tx => String(tx.id) !== String(txId)));
    localStorage.setItem('canteen_txs', JSON.stringify(updatedHistory));
    try {
      await pushKeyToCloud('canteen_txs', updatedHistory);
    } catch (e) {
      console.warn('Cloud sync error for canteen_txs:', e);
    }

    window.dispatchEvent(new Event('canteen_txs_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('canteen_fund_updated'));
    window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    window.dispatchEvent(new Event('canteen_inventory_updated'));
    window.dispatchEvent(new Event('storage'));

    setToastMessage(isPaid ? '✅ Cash sale record removed from history!' : '✅ Sale record removed and member due adjusted!');
    setTimeout(() => setToastMessage(''), 4000);
  };

  const openEditTxModal = (tx: any) => {
    setEditingTx(tx);
    let base = Number(tx.originalAmount || 0);
    if (tx.soldItems && Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
      base = tx.soldItems.reduce((s: number, it: any) => {
        const resolved = resolveLiveItem(it);
        return s + resolved.itemTotal;
      }, 0);
    } else if (!base) {
      const existingAmount = Number(tx.amount || 0);
      const existingDiscount = Number(tx.discount || 0);
      base = existingAmount + existingDiscount;
    }
    const existingDiscount = Number(tx.discount || 0);
    const existingAmount = Math.max(0, base - existingDiscount);
    setEditBaseAmount(base);
    setEditDiscount(String(existingDiscount));
    setEditAmount(String(existingAmount));

    const isPaid = tx.status === 'PAID' || tx.paymentStatus === 'PAID' || String(tx.gateway || tx.paymentMethod || '').toUpperCase() === 'CASH';
    setEditPaymentStatus(isPaid ? 'PAID' : 'DUE');

    // Date formatting: ensure YYYY-MM-DD so HTML5 input[type="date"] displays it!
    const rawDate = tx.date || tx.paymentDate || tx.timestamp || tx.created_at || (typeof tx.id === 'number' ? tx.id : undefined);
    setEditDate(toYMDDate(rawDate) || getTodayYMD());
  };

  const handleEditDiscountChange = (val: string) => {
    setEditDiscount(val);
    const disc = Math.max(0, parseFloat(val) || 0);
    const computedAmt = Math.max(0, editBaseAmount - disc);
    setEditAmount(String(computedAmt));
  };

  const saveEditedHistoryItem = async () => {
    if (!editingTx) return;
    const newAmt = parseFloat(editAmount);
    if (isNaN(newAmt) || newAmt < 0) {
      alert('অনুগ্রহ করে সঠিক টাকার পরিমাণ নিশ্চিত করুন');
      return;
    }
    const newDiscount = Math.max(0, parseFloat(editDiscount) || 0);
    const savedDateFormatted = formatCanteenDate(editDate) || editDate;

    setIsSavingEdit(true);
    try {
      const oldAmount = Number(editingTx.amount || 0);
      const oldIsPaid = editingTx.status === 'PAID' || editingTx.paymentStatus === 'PAID' || String(editingTx.gateway || editingTx.paymentMethod || '').toUpperCase() === 'CASH';
      const newIsPaid = editPaymentStatus === 'PAID';

      // Update Member Due if member exists
      if (editingTx.airman_id) {
        const m = members.find(mem => mem.airman_id === editingTx.airman_id);
        if (m) {
          const currentDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
          let newDue = currentDue;

          if (!oldIsPaid && newIsPaid) {
            // Was Due, now Paid -> reduce due by old amount
            newDue = Math.max(0, currentDue - oldAmount);
          } else if (oldIsPaid && !newIsPaid) {
            // Was Paid, now Due -> add new amount to due
            newDue = currentDue + newAmt;
          } else if (!oldIsPaid && !newIsPaid) {
            // Was Due, still Due -> adjust difference
            const diff = newAmt - oldAmount;
            newDue = Math.max(0, currentDue + diff);
          }

          if (newDue !== currentDue) {
            await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', editingTx.airman_id);
            setMembers(prev => prev.map(mem => mem.airman_id === editingTx.airman_id ? { ...mem, Due: newDue, baki: newDue } : mem));
          }
        }
      }

      // Update transaction in storage
      const currentHistory = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const updatedHistory = currentHistory.map((tx: any) => {
        if (String(tx.id) === String(editingTx.id)) {
          return {
            ...tx,
            originalAmount: editBaseAmount,
            discount: newDiscount,
            amount: newAmt,
            date: savedDateFormatted,
            status: editPaymentStatus,
            paymentStatus: editPaymentStatus,
            gateway: editPaymentStatus === 'PAID' ? 'CASH' : 'DUE',
            paymentMethod: editPaymentStatus === 'PAID' ? 'CASH' : 'DUE',
          };
        }
        return tx;
      });

      setSalesHistory(prev => prev.map(tx => {
        if (String(tx.id) === String(editingTx.id)) {
          return {
            ...tx,
            originalAmount: editBaseAmount,
            discount: newDiscount,
            amount: newAmt,
            date: savedDateFormatted,
            status: editPaymentStatus,
            paymentStatus: editPaymentStatus,
            gateway: editPaymentStatus === 'PAID' ? 'CASH' : 'DUE',
            paymentMethod: editPaymentStatus === 'PAID' ? 'CASH' : 'DUE',
          };
        }
        return tx;
      }));

      localStorage.setItem('canteen_txs', JSON.stringify(updatedHistory));
      try {
        await pushKeyToCloud('canteen_txs', updatedHistory);
      } catch (e) {
        console.warn('Cloud sync error for canteen_txs:', e);
      }

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_fund_updated'));
      window.dispatchEvent(new Event('storage'));

      playSuccessChime();
      setToastMessage('✅ বিক্রয় রেকর্ড সফলভাবে আপডেট করা হয়েছে!');
      setTimeout(() => setToastMessage(''), 4000);
      setEditingTx(null);
    } catch (err) {
      console.error('Error saving edited history item:', err);
      alert('রেকর্ড আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const addToBasket = (item: any) => {
    const itemLimit = item.stock !== undefined ? Number(item.stock) : (item.max !== undefined ? Number(item.max) : undefined);
    const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap, itemLimit);
    const available = stockInfo.availableStock;
    if (available <= 0) {
      return;
    }
    const itemTitle = getItemDisplayName(item, 'menu', canteenConfig).primary || item.name;
    const existing = basket.find(b => b.id === item.id);
    if (existing) {
      if (existing.qty >= available) {
        return;
      }
      setBasket(basket.map(b => b.id === item.id ? { ...b, qty: b.qty + 1 } : b));
    } else {
      setBasket([...basket, { ...item, name: itemTitle, rawItem: item, qty: 1 }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setBasket(basket.map(b => {
      if (b.id === id) {
        const itemLimit = b.stock !== undefined ? Number(b.stock) : (b.max !== undefined ? Number(b.max) : undefined);
        const stockInfo = calculateMenuItemStockInfo(b.id, b.name, rawInventory, recipesMap, itemLimit);
        const available = stockInfo.availableStock;
        let newQty = b.qty + delta;
        if (newQty < 1) newQty = 1;
        if (delta > 0 && newQty > available) {
          newQty = Math.max(1, available);
        }
        return { ...b, qty: newQty };
      }
      return b;
    }));
  };

  const removeFromBasket = (id: string) => {
    setBasket(basket.filter(b => b.id !== id));
  };

  const sortedMembers = useMemo(() => {
    return sortCanteenMembersByOfficeSeniority(members);
  }, [members]);

  const officerCount = useMemo(() => members.filter(isOfficerMember).length, [members]);
  const airmenCount = useMemo(() => members.filter(isAirmanMember).length, [members]);
  const civilianCount = useMemo(() => members.filter(isCivilianMember).length, [members]);

  // Filtered members for selection
  const filteredMembers = useMemo(() => {
    return sortedMembers.filter((m) => {
      if (memberRankFilter === 'OFFICER' && !isOfficerMember(m)) return false;
      if (memberRankFilter === 'AIRMEN' && !isAirmanMember(m)) return false;
      if (memberRankFilter === 'CIVILIAN' && !isCivilianMember(m)) return false;

      if (!memberSearchTerm.trim()) return true;
      const term = memberSearchTerm.toLowerCase().trim();
      const surname = String(m['Surname'] || m.surname || '').toLowerCase();
      const rank = String(m['Rank'] || m.rank || '').toLowerCase();
      const bd = String(m['BD No'] || m.bdNo || m.airman_id || '').toLowerCase();
      return surname.includes(term) || rank.includes(term) || bd.includes(term);
    });
  }, [sortedMembers, memberRankFilter, memberSearchTerm]);

  const toggleMember = (member: any) => {
    setSelectedMembers((prev) => {
      const exists = prev.some((sm) => sm.airman_id === member.airman_id);
      if (exists) {
        return prev.filter((sm) => sm.airman_id !== member.airman_id);
      } else {
        return [...prev, member];
      }
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedMembers((prev) => {
      const prevIds = new Set(prev.map(sm => sm.airman_id));
      const newlyAdded = filteredMembers.filter(m => !prevIds.has(m.airman_id));
      return [...prev, ...newlyAdded];
    });
  };

  const handleClearMembers = () => {
    setSelectedMembers([]);
  };

  const basketTotal = basket.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const memberCount = selectedMembers.length;
  const numDiscount = Math.max(0, Number(discountAmount) || 0);

  // Each member gets the full discount amount (e.g. 20 tk discount applies to each member's bill)
  const perMemberDiscount = numDiscount;
  const perMemberFinalAmount = Math.max(0, basketTotal - perMemberDiscount);
  const totalDiscount = memberCount > 0 ? (perMemberDiscount * memberCount) : perMemberDiscount;
  const grandTotal = memberCount > 0 
    ? (perMemberFinalAmount * memberCount)
    : perMemberFinalAmount;

  const handleCheckout = async () => {
    if (isCheckingOut) return;

    if (basket.length === 0 || selectedMembers.length === 0) {
      setToastMessage('⚠️ Please select at least one menu item and one member!');
      setTimeout(() => setToastMessage(''), 3500);
      return;
    }

    const targetMembersList = selectedMembers;
    setIsCheckingOut(true);
    const multiplier = targetMembersList.length;
    const roundedPerMemberAmount = Math.round(perMemberFinalAmount * 100) / 100;
    const roundedPerMemberDiscount = Math.round(perMemberDiscount * 100) / 100;
    const totalSalesAmount = Math.round(grandTotal * 100) / 100;

    try {
      const txDateStr = formatCanteenDate(saleDate);
      const newTransactions: any[] = [];

      for (const m of targetMembersList) {
        if (paymentMode === 'DUE') {
          const currentDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
          const newDue = currentDue + roundedPerMemberAmount;
          await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', m.airman_id);
        }

        const txMemberName = [m.Rank || m.rank, m.Surname || m.surname || m.Name || m.name].filter(Boolean).join(' ') || m['BD No'] || m.airman_id;
        const tx = {
          id: Date.now() + Math.random(),
          date: txDateStr,
          airman_id: m.airman_id,
          bdNo: m['BD No'] || m.bdNo || m.airman_id,
          memberName: txMemberName,
          rank: m.Rank || m.rank || '',
          items: basket.map((b) => `${b.name} (${b.qty})`).join(', '),
          soldItems: basket.map((b) => ({
            menuItemId: b.id,
            menuItemName: b.name,
            price: Number(b.price || 0),
            qty: b.qty
          })),
          originalAmount: basketTotal,
          discount: roundedPerMemberDiscount,
          amount: roundedPerMemberAmount,
          type: 'SALE',
          status: paymentMode, // 'DUE' or 'PAID'
          paymentStatus: paymentMode,
          gateway: paymentMode === 'PAID' ? 'CASH' : 'DUE',
          paymentMethod: paymentMode === 'PAID' ? 'CASH' : 'DUE'
        };
        newTransactions.push(tx);
      }

      // Update members in memory if DUE
      if (paymentMode === 'DUE') {
        setMembers((prev) =>
          prev.map((member) => {
            const matched = targetMembersList.find((tm) => tm.airman_id === member.airman_id);
            if (matched) {
              const currentDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
              return {
                ...member,
                Due: currentDue + roundedPerMemberAmount,
                due: currentDue + roundedPerMemberAmount,
                baki: currentDue + roundedPerMemberAmount
              };
            }
            return member;
          })
        );
      }

      // Save transactions to local & cloud
      const existingTx = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const mergedTxs = [...newTransactions, ...existingTx];
      localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
      try {
        await pushKeyToCloud('canteen_txs', mergedTxs);
      } catch (e) {}

      // Update recent members
      const newRecents = [...targetMembersList, ...recentMembers].reduce((acc, curr) => {
        if (!acc.find((x: any) => x.airman_id === curr.airman_id)) acc.push(curr);
        return acc;
      }, []).slice(0, 5);
      setRecentMembers(newRecents);
      localStorage.setItem('canteen_recent_members', JSON.stringify(newRecents));

      // Deduct raw materials stock according to menu recipes
      const itemsForDeduction = basket.map((b) => ({
        menuItemId: b.id,
        menuItemName: b.name,
        qty: b.qty * multiplier
      }));
      deductRawStockForSales(itemsForDeduction);

      // Deduct menu item stock in cache & state so Menu and Inventory remain synchronized
      try {
        const currentCache = getCanteenMenuCache();
        if (currentCache && currentCache.length > 0) {
          const updatedCache = currentCache.map((menuItem: any) => {
            const soldMatch = itemsForDeduction.find(s => 
              String(s.menuItemId) === String(menuItem.id) ||
              normalizeCatalogKey(s.menuItemName) === normalizeCatalogKey(menuItem.name || menuItem.name_en || '')
            );
            if (soldMatch) {
              const currentItemStock = menuItem.stock !== undefined ? Number(menuItem.stock) : (menuItem.max !== undefined ? Number(menuItem.max) : 50);
              const newStock = Math.max(0, currentItemStock - soldMatch.qty);
              return { ...menuItem, stock: newStock, max: newStock };
            }
            return menuItem;
          });
          setCanteenMenuCache(updatedCache);
          setCatalog(updatedCache);
        }
      } catch (e) {
        console.warn('Error deducting menu stock in POS:', e);
      }

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_fund_updated'));
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('storage'));

      const successMsg = paymentMode === 'PAID'
        ? `✅ Cash sale recorded & added to Manager Cash! (Total ৳${totalSalesAmount.toLocaleString()})`
        : `✅ Due sale recorded for ${multiplier} member(s)! (Total ৳${totalSalesAmount.toLocaleString()})`;

      setToastMessage(successMsg);
      setTimeout(() => setToastMessage(''), 4000);

      // Clean up for next order
      setBasket([]);
      setSelectedMembers([]);
      setMemberSearchTerm('');
      setDiscountAmount('');
      setPaymentMode('DUE');
      setIsMobileCartOpen(false);
      fetchCatalog();
    } catch (err: any) {
      setToastMessage(`❌ Error: ${err?.message || 'Failed to complete sale'}`);
      setTimeout(() => setToastMessage(''), 4000);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('ALL');
    ['SNACKS', 'DRINK', 'LUNCH', 'BREAKFAST', 'DINNER'].forEach(c => {
      if (catalog.some(i => (i.category || '').toUpperCase() === c)) {
        cats.add(c);
      }
    });
    catalog.forEach(i => {
      if (i.category) {
        cats.add(i.category.trim().toUpperCase());
      }
    });
    return Array.from(cats);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog
      .filter(item => {
        if (isOneTimeBoxItem(item)) return false;
        const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.name_bn || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());
        const itemCat = (item.category || 'SNACKS').toUpperCase();
        const matchesCat = selectedCategory === 'ALL' || itemCat === selectedCategory;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [catalog, searchTerm, selectedCategory]);

  return (
    <>
      <div className="w-full space-y-3.5 animate-in fade-in duration-300 pb-24 lg:pb-6 px-1 sm:px-2">
        
        {/* Header Strip with Date Navigator, History button, and Per-Member Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  CANTEEN POS & CHECKOUT
                </h3>
                <p className="text-[11px] text-slate-400">Select order items and choose members to charge</p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
              {/* Sale Date Picker with Left/Right Arrows, '09 Oct 26' format, Today default */}
              <DateNavigator 
                value={saleDate} 
                onChange={setSaleDate} 
                label="Date"
                format="dd_mm_yy"
              />

              {/* POS Sales Import Button */}
              <button 
                type="button"
                onClick={() => setShowImportSalesModal(true)}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/60 active:bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-sm cursor-pointer shrink-0 ml-auto sm:ml-0"
                title="Bulk Import Sales via Excel / CSV"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Import Sales</span>
              </button>

              {/* History Button pushed to Right Corner */}
              <button 
                type="button"
                onClick={loadHistory}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700 rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-sm cursor-pointer shrink-0"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>History</span>
              </button>
            </div>
          </div>

          {/* Main Layout: 2-Column Grid on Laptop View (lg:grid-cols-2), 1-Column on Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            
            {/* ======================================================== */}
            {/* LEFT COLUMN: Menu Selection (Laptop Left Half Screen)    */}
            {/* ======================================================== */}
            <div className="bg-slate-950/80 rounded-3xl border border-slate-800/80 p-4 sm:p-5 space-y-3.5 shadow-lg flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Menu Selection</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {filteredCatalog.length} items
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Add food & beverage items to customer basket</p>
                  </div>
                </div>
              </div>

              {/* Search Bar - Full Width & Bigger */}
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-indigo-400" />
                <input 
                  type="text" 
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-2xl pl-11 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white placeholder:text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all"
                />
                {searchTerm && (
                  <button 
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Pills (Underneath Search Bar) */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none w-full">
                {availableCategories.map((cat) => {
                  const count = cat === 'ALL' 
                    ? catalog.length 
                    : catalog.filter(i => (i.category || 'SNACKS').toUpperCase() === cat).length;
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Items List Container */}
              <div className="max-h-[460px] lg:max-h-[700px] overflow-y-auto pr-1">
                {filteredCatalog.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
                    <PackageIcon className="w-6 h-6 mx-auto opacity-30 mb-1" />
                    <p className="text-xs font-bold text-slate-400">No menu items found</p>
                  </div>
                ) : (
                  <>
                    {/* MOBILE VIEW: Single single niche niche asbe (single-column vertical list) */}
                    <div className="flex flex-col space-y-2 lg:hidden">
                      {filteredCatalog.map((item, i) => {
                        const inBasket = basket.find(b => b.id === item.id);
                        const itemLimit = item.stock !== undefined ? Number(item.stock) : (item.max !== undefined ? Number(item.max) : undefined);
                        const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap, itemLimit);
                        const isOutOfStock = stockInfo.availableStock <= 0;
                        const isLowStock = stockInfo.availableStock > 0 && stockInfo.availableStock < 5;

                        const displayNameObj = getItemDisplayName(item, 'menu', canteenConfig);
                        const primaryName = displayNameObj.primary || item.name;
                        const secondaryName = displayNameObj.secondary;

                        return (
                          <div 
                            key={`mob_${item.id || i}`}
                            onClick={() => {
                              if (!isOutOfStock) addToBasket(item);
                            }}
                            className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 select-none ${
                              isOutOfStock
                                ? 'border-slate-800/60 bg-slate-950/30 opacity-40 cursor-not-allowed'
                                : inBasket
                                ? 'border-indigo-500/70 bg-indigo-950/30 hover:bg-indigo-950/40 cursor-pointer shadow-sm'
                                : 'border-slate-800/80 bg-slate-900/80 hover:bg-slate-900 hover:border-slate-700 cursor-pointer'
                            }`}
                          >
                            {/* Left: Thumbnail & Details */}
                            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border ${
                                isOutOfStock ? 'border-slate-800 bg-slate-950 text-slate-600' : 'border-slate-800 bg-slate-950 text-slate-400'
                              }`}>
                                {item.DP ? (
                                  <img 
                                    src={resolveImageUrl(item.DP)} 
                                    alt={primaryName} 
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <PackageIcon className="w-4 h-4" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                {/* Category above menu name (e.g. SNACKS) */}
                                <div className="mb-0.5">
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-block tracking-wider">
                                    {item.category || 'MENU'}
                                  </span>
                                </div>
                                <h5 className="text-xs font-black text-white truncate leading-tight" title={primaryName}>
                                  {primaryName}
                                </h5>
                                {secondaryName && (
                                  <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                                    {secondaryName}
                                  </p>
                                )}
                                {/* Stock Boro hbe */}
                                <div className="flex items-center space-x-1.5 mt-1 flex-wrap">
                                  {isOutOfStock ? (
                                    <span className="text-[10px] font-black font-mono text-rose-400 uppercase bg-rose-950/70 px-1.5 py-0.5 rounded border border-rose-500/40">
                                      OUT OF STOCK
                                    </span>
                                  ) : (
                                    <span className={`text-xs font-mono font-black ${isLowStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                                      Stock: {stockInfo.availableStock}
                                    </span>
                                  )}
                                  {inBasket && inBasket.qty > 0 && (
                                    <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.5 rounded">
                                      Cart: {inBasket.qty}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Price & Add Button */}
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-xs sm:text-sm font-black font-mono text-white">৳{item.price}</span>

                              <button
                                type="button"
                                disabled={isOutOfStock}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isOutOfStock) addToBasket(item);
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black tracking-wider uppercase transition-all flex items-center space-x-1 ${
                                  isOutOfStock
                                    ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 cursor-pointer active:scale-95'
                                }`}
                              >
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                                <span>ADD</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* LAPTOP VIEW: Single-column vertical list (single single niche niche asbe) */}
                    <div className="hidden lg:flex lg:flex-col lg:space-y-2">
                      {filteredCatalog.map((item, i) => {
                        const inBasket = basket.find(b => b.id === item.id);
                        const itemLimit = item.stock !== undefined ? Number(item.stock) : (item.max !== undefined ? Number(item.max) : undefined);
                        const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap, itemLimit);
                        const isOutOfStock = stockInfo.availableStock <= 0;
                        const isLowStock = stockInfo.availableStock > 0 && stockInfo.availableStock < 5;

                        const displayNameObj = getItemDisplayName(item, 'menu', canteenConfig);
                        const primaryName = displayNameObj.primary || item.name;
                        const secondaryName = displayNameObj.secondary;

                        return (
                          <div 
                            key={`desk_${item.id || i}`}
                            onClick={() => {
                              if (!isOutOfStock) addToBasket(item);
                            }}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                              isOutOfStock
                                ? 'border-slate-800/60 bg-slate-950/30 opacity-40 cursor-not-allowed'
                                : inBasket
                                ? 'border-indigo-500/70 bg-indigo-950/30 hover:bg-indigo-950/40 cursor-pointer shadow-sm'
                                : 'border-slate-800/80 bg-slate-900/80 hover:bg-slate-900 hover:border-slate-700 cursor-pointer'
                            }`}
                          >
                            {/* Left: Thumbnail & Details */}
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border ${
                                isOutOfStock ? 'border-slate-800 bg-slate-950 text-slate-600' : 'border-slate-800 bg-slate-950 text-slate-400'
                              }`}>
                                {item.DP ? (
                                  <img 
                                    src={resolveImageUrl(item.DP)} 
                                    alt={primaryName} 
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <PackageIcon className="w-5 h-5" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                {/* Category above menu name (e.g. SNACKS) */}
                                <div className="mb-0.5">
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-block tracking-wider">
                                    {item.category || 'MENU'}
                                  </span>
                                </div>
                                <h5 className="text-sm font-black text-white truncate leading-tight" title={primaryName}>
                                  {primaryName}
                                </h5>
                                {secondaryName && (
                                  <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                                    {secondaryName}
                                  </p>
                                )}
                                {/* Stock Boro hbe */}
                                <div className="flex items-center space-x-2 mt-1">
                                  {isOutOfStock ? (
                                    <span className="text-xs font-black font-mono text-rose-400 uppercase bg-rose-950/70 px-2 py-0.5 rounded-lg border border-rose-500/40">
                                      OUT OF STOCK
                                    </span>
                                  ) : (
                                    <span className={`text-xs sm:text-sm font-mono font-black ${isLowStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                                      Stock: {stockInfo.availableStock}
                                    </span>
                                  )}
                                  {inBasket && inBasket.qty > 0 && (
                                    <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-2 py-0.5 rounded-lg">
                                      Cart: {inBasket.qty}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Price & Add Button (+ icon) - No -1+ stepper; multiple clicks increment Cart */}
                            <div className="flex items-center space-x-3 shrink-0">
                              <span className="text-sm sm:text-base font-black font-mono text-white">৳{item.price}</span>

                              <button
                                type="button"
                                disabled={isOutOfStock}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isOutOfStock) addToBasket(item);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-1.5 ${
                                  isOutOfStock
                                    ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 cursor-pointer active:scale-95'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>ADD</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ======================================================== */}
            {/* RIGHT COLUMN: Order Cart & Member Basket                 */}
            {/* ======================================================== */}
            <div className="space-y-5 flex flex-col">

              {/* Section: Order Cart & Checkout (Cart option ta Member Basket er opore) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
                
                {/* Cart Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span>Order Cart</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                          {basket.length} {basket.length === 1 ? 'item' : 'items'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Items selected for this order</p>
                    </div>
                  </div>

                  {/* Parcel Toggle & Clear Button */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={toggleParcel}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black tracking-wide flex items-center space-x-1.5 border transition-all cursor-pointer ${
                        isParcelActive
                          ? 'bg-amber-500/25 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                      title={isParcelActive ? 'Parcel যোগ করা হয়েছে (ওয়ান টাইম বক্স)' : 'Parcel (ওয়ান টাইম বক্স যোগ করতে ক্লিক করুন)'}
                    >
                      <PackageIcon className="w-3.5 h-3.5" />
                      <span>Parcel</span>
                    </button>
                    {basket.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setBasket([])} 
                        className="text-[11px] font-bold text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="max-h-[190px] overflow-y-auto pr-1 space-y-2">
                  {basket.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                      <ShoppingCart className="w-7 h-7 mx-auto opacity-25 mb-1.5" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cart is empty</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Select menu items from the left to add</p>
                    </div>
                  ) : (
                    basket.map((item) => (
                      <div key={item.id} className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2 shadow-xs">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-white truncate">{item.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            ৳{item.price} x {item.qty} = <span className="text-emerald-400 font-bold">৳{item.price * item.qty}</span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <div className="flex items-center space-x-1 bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                            <button 
                              type="button"
                              onClick={() => updateQty(item.id, -1)} 
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-mono font-bold text-white w-5 text-center">{item.qty}</span>
                            <button 
                              type="button"
                              onClick={() => updateQty(item.id, 1)} 
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeFromBasket(item.id)} 
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg cursor-pointer transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

              {/* Section: Member Basket (Renamed from Select Members; Placed underneath Cart) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                      <Users className="w-5 h-5 text-indigo-400" />
                      <span>Member Basket</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Select members to record this sale</p>
                  </div>

                  {/* Bulk Action Buttons & Selected indicator on the left of Select All */}
                  <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-y-1">
                    {/* Selected option on the left side of Select all (hidden if no member selected) */}
                    {selectedMembers.length > 0 && (
                      <span className="px-3 py-1.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-xs font-mono font-bold text-indigo-300 flex items-center space-x-1">
                        <span>Selected:</span>
                        <strong className="text-white font-black">{selectedMembers.length}</strong>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black tracking-wider flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Select All ({filteredMembers.length})</span>
                    </button>
                    {selectedMembers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearMembers}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-300 text-xs font-black tracking-wider flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear ({selectedMembers.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Bar - Full Width & Bigger */}
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-indigo-400" />
                  <input 
                    type="text"
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    placeholder="Search by BD No, Rank, or Surname..."
                    className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-2xl pl-11 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white placeholder:text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all"
                  />
                  {memberSearchTerm && (
                    <button 
                      type="button"
                      onClick={() => setMemberSearchTerm('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1 rounded-full hover:bg-slate-800"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Rank Filter Pills (Underneath Search Bar) */}
                <div className="flex items-center space-x-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none w-full">
                  {(['ALL', 'OFFICER', 'AIRMEN', 'CIVILIAN'] as const).map((r) => {
                    const count = r === 'ALL' ? members.length : r === 'OFFICER' ? officerCount : r === 'AIRMEN' ? airmenCount : civilianCount;
                    const label = r === 'ALL' ? 'ALL' : r === 'OFFICER' ? 'OFFICER' : r === 'AIRMEN' ? 'AIRMEN' : 'CIVILIAN';
                    const isSel = memberRankFilter === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setMemberRankFilter(r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                          isSel ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Members List - Single Single Niche Niche (Vertical List) */}
                <div className="h-[260px] min-h-[200px] max-h-[360px] overflow-y-auto pr-1 flex flex-col">
                  {filteredMembers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-4 text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800 p-6">
                      <Users className="w-8 h-8 mx-auto opacity-20 mb-2" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-300">No Members Found</p>
                      <p className="text-[11px] text-slate-500 mt-1">Check search filters or try another rank category.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-2">
                      {filteredMembers.map((m, i) => {
                        const isSelected = selectedMembers.some((sm) => sm.airman_id === m.airman_id);
                        return (
                          <div
                            key={m.airman_id || `norm_${m['BD No'] || i}_${i}`}
                            onClick={() => toggleMember(m)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] ${
                              isSelected
                                ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                                : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              <div className={`w-4.5 h-4.5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-500 text-white' 
                                  : 'border-slate-700 bg-slate-950 text-transparent'
                              }`}>
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-sm font-black text-white truncate leading-tight">
                                  {m['Rank']} {m['Surname']}
                                </div>
                                <div className="flex items-center space-x-2 mt-0.5 text-[11px] font-mono leading-tight">
                                  <span className="text-slate-400">BD: {m['BD No']}</span>
                                  <span className="text-slate-600">•</span>
                                  <span className="text-amber-400 font-bold">Due: ৳{m.Due || 0}</span>
                                </div>
                              </div>
                            </div>

                            {isSelected && basketTotal > 0 && (
                              <span className="text-xs font-mono font-bold text-emerald-400 shrink-0 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                                +৳{Math.round(perMemberFinalAmount)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Payment & Checkout (Payment Status theke Confirm Checkout porjonto) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
                
                {/* Payment Status & Discount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  
                  {/* Payment Status (Default due label removed) */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
                      Payment Status
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('DUE')}
                        className={`py-2 px-3 rounded-lg text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          paymentMode === 'DUE'
                            ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>DUE</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('PAID')}
                        className={`py-2 px-3 rounded-lg text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          paymentMode === 'PAID'
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>PAID</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">
                      {paymentMode === 'PAID' 
                        ? '✓ Added directly to Manager Cash' 
                        : '✓ Added as due on member accounts'}
                    </p>
                  </div>

                  {/* Discount Input with Presets: 10, 15, 20, 25 */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
                      Discount (৳)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">
                        ৳
                      </span>
                      <input 
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                      />
                      {discountAmount && (
                        <button 
                          type="button"
                          onClick={() => setDiscountAmount('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Preset Discount Buttons: 10, 15, 20, 25 */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {['10', '15', '20', '25'].map((preset) => {
                        const isActive = discountAmount === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDiscountAmount(isActive ? '' : preset)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:text-white'
                            }`}
                          >
                            ৳{preset}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[10px] text-slate-500 mt-1 font-medium">
                      {selectedMembers.length > 1 && numDiscount > 0
                        ? `✓ ৳${numDiscount} per member (Total ৳${numDiscount * selectedMembers.length})`
                        : numDiscount > 0
                        ? `✓ ৳${numDiscount} discount applied per member`
                        : 'Discount in tk deducted from bill'}
                    </p>
                  </div>

                </div>

                {/* Cart Subtotal & Sale Summary Breakdown (বিক্রয় সারসংক্ষেপ) */}
                <div className="bg-slate-900/95 rounded-2xl p-3.5 border border-slate-800 space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-1.5 text-xs font-black text-indigo-300 uppercase tracking-wider">
                      <Utensils className="w-3.5 h-3.5 text-indigo-400" />
                      <span>বিক্রয় সারসংক্ষেপ (Sale Summary)</span>
                    </div>
                    {basket.length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 font-bold">
                        {basket.length}টি আইটেম • {basket.reduce((s, b) => s + b.qty, 0)} পিস
                      </span>
                    )}
                  </div>

                  {/* Member Name in Sale Summary */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>মেম্বার / Member ({selectedMembers.length} জন):</span>
                      </span>
                      {selectedMembers.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-mono">
                          {selectedMembers.length === 1 ? '১ জন নির্বাচিত' : `${selectedMembers.length} জন নির্বাচিত`}
                        </span>
                      )}
                    </div>
                    {selectedMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                        {selectedMembers.map((m, idx) => {
                          const rank = m['Rank'] || '';
                          const name = m['Surname'] || m['Name'] || m.name || '';
                          const fullName = [rank, name].filter(Boolean).join(' ') || 'Member';
                          const bdNo = m['BD No'] || m['BD_No'] || m.airman_id || m.id;
                          return (
                            <span 
                              key={m.airman_id || `summary_m_${bdNo || idx}`}
                              className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-950/90 border border-indigo-500/30 text-indigo-200 text-xs font-bold"
                            >
                              <span>{fullName}</span>
                              {bdNo && <span className="ml-1 text-[10px] text-slate-400 font-mono">({bdNo})</span>}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-400/90 italic flex items-center space-x-1">
                        <span>⚠️ কোনো মেম্বার নির্বাচন করা হয়নি (নিচ থেকে মেম্বার সিলেক্ট করুন)</span>
                      </p>
                    )}
                  </div>

                  {/* Itemized List of what is being sold */}
                  {basket.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {basket.map((b) => (
                        <div key={b.id} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-slate-200 font-semibold truncate max-w-[180px]">
                            {getMenuItemBanglaName(b.name) || b.name}
                          </span>
                          <div className="flex items-center space-x-2 shrink-0 font-mono">
                            <span className="text-slate-400 text-[11px]">৳{b.price} × {b.qty}</span>
                            <span className="text-emerald-400 font-bold w-12 text-right">৳{b.price * b.qty}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic py-1 text-center">কোনো আইটেম সিলেক্ট করা হয়নি</p>
                  )}

                  {/* Subtotal, Discount & Net Payable */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Cart Subtotal:</span>
                      <span className="text-white font-bold">৳{(basketTotal * (selectedMembers.length || 1)).toLocaleString()}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-[11px] text-rose-400">
                        <span>Total Discount:</span>
                        <span className="font-bold">
                          -৳{totalDiscount.toLocaleString()} {selectedMembers.length > 1 ? `(৳${numDiscount} x ${selectedMembers.length})` : ''}
                        </span>
                      </div>
                    )}
                    {selectedMembers.length > 1 && (
                      <div className="flex justify-between text-indigo-300 text-[10px]">
                        <span>মেম্বার সংখ্যা ({selectedMembers.length} জন):</span>
                        <span className="font-bold">জনপ্রতি ৳{Math.round(perMemberFinalAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs font-mono font-black pt-1.5 border-t border-slate-800">
                      <span className="text-slate-200">Net Payable:</span>
                      <span className="text-emerald-400 text-sm sm:text-base font-black">৳{Math.round(grandTotal).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Checkout Button */}
                <button 
                  type="button"
                  onClick={handleCheckout}
                  disabled={isCheckingOut || basket.length === 0 || selectedMembers.length === 0}
                  className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-lg ${
                    (!isCheckingOut && basket.length > 0 && selectedMembers.length > 0)
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isCheckingOut ? 'Confirming Checkout...' : 'Confirm Checkout'}</span>
                </button>

              </div>

            </div>

          </div>

        {/* ======================================================== */}
        {/* MOBILE STICKY FLOATING BOTTOM BAR (lg:hidden)            */}
        {/* ======================================================== */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 shadow-2xl safe-area-bottom">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">
                {selectedMembers.length} Members • {basket.length} Items
              </p>
              <p className="text-base font-black text-emerald-400 font-mono">
                ৳{Math.round(grandTotal).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart ({basket.length})</span>
            </button>
          </div>
        </div>

        {/* Mobile Cart Drawer */}
        <AnimatePresence>
          {isMobileCartOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileCartOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end justify-center lg:hidden"
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border-t border-slate-800 rounded-t-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Sales Cart & Checkout
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={toggleParcel}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black tracking-wide flex items-center space-x-1.5 border transition-all cursor-pointer ${
                        isParcelActive
                          ? 'bg-amber-500/25 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                      title={isParcelActive ? 'Parcel যোগ করা হয়েছে (ওয়ান টাইম বক্স)' : 'Parcel (ওয়ান টাইম বক্স যোগ করতে ক্লিক করুন)'}
                    >
                      <PackageIcon className="w-3.5 h-3.5" />
                      <span>Parcel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMobileCartOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Selected Members Header */}
                <div className="p-3 bg-slate-950 border-b border-slate-800/80 shrink-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Target Members ({selectedMembers.length} selected):
                    </label>
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>
                  {selectedMembers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {selectedMembers.map((m, i) => (
                        <span key={m.airman_id || `cart_mem_${m['BD No'] || i}_${i}`} className="inline-flex items-center px-2 py-0.5 bg-indigo-950 border border-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-bold">
                          <span>{m['Rank']} {m['Surname']}</span>
                          <button onClick={() => toggleMember(m)} className="ml-1 text-slate-400 hover:text-rose-400 cursor-pointer">
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400 font-bold">⚠️ No members selected. Please select members to charge.</p>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="p-3 overflow-y-auto space-y-2 flex-1">
                  {basket.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      <ShoppingCart className="w-8 h-8 mx-auto opacity-20 mb-2" />
                      <p className="text-xs font-bold uppercase tracking-wider">Cart is empty</p>
                    </div>
                  ) : (
                    basket.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{item.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">৳{item.price} x {item.qty} = ৳{item.price * item.qty}</p>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <div className="flex items-center space-x-1 bg-slate-900 rounded-lg border border-slate-700 p-0.5">
                            <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><Minus className="w-3 h-3" /></button>
                            <span className="text-xs font-mono font-bold text-white w-4 text-center">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><Plus className="w-3 h-3" /></button>
                          </div>
                          <button onClick={() => removeFromBasket(item.id)} className="p-1 text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Drawer Footer & Checkout */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3 shrink-0">
                  {/* Itemized Sale Summary Breakdown for Mobile */}
                  <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 text-xs font-bold text-indigo-300">
                      <span>বিক্রয় সারসংক্ষেপ (Sale Summary)</span>
                      <span className="font-mono text-[10px] text-slate-400">{basket.length} আইটেম • {basket.reduce((s, b) => s + b.qty, 0)} পিস</span>
                    </div>

                    {/* Member Name in Mobile Sale Summary */}
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                        <span className="flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>মেম্বার / Member ({selectedMembers.length} জন):</span>
                        </span>
                      </div>
                      {selectedMembers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                          {selectedMembers.map((m, idx) => {
                            const rank = m['Rank'] || '';
                            const name = m['Surname'] || m['Name'] || m.name || '';
                            const fullName = [rank, name].filter(Boolean).join(' ') || 'Member';
                            const bdNo = m['BD No'] || m['BD_No'] || m.airman_id || m.id;
                            return (
                              <span 
                                key={m.airman_id || `m_summary_${bdNo || idx}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-950/90 border border-indigo-500/30 text-indigo-200 text-[11px] font-bold"
                              >
                                <span>{fullName}</span>
                                {bdNo && <span className="ml-1 text-[9px] text-slate-400 font-mono">({bdNo})</span>}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-amber-400/90 italic">
                          ⚠️ কোনো মেম্বার সিলেক্ট করা হয়নি
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {basket.map((b) => (
                        <div key={b.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 truncate max-w-[170px]">{getMenuItemBanglaName(b.name) || b.name}</span>
                          <span className="font-mono text-emerald-400 font-bold">৳{b.price} × {b.qty} = ৳{b.price * b.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Total Net Payable:</span>
                      <span className="text-lg font-black text-emerald-400">৳{Math.round(grandTotal).toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={
                      isCheckingOut || 
                      basket.length === 0 || 
                      selectedMembers.length === 0
                    }
                    className={`w-full py-3.5 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-md ${
                      (!isCheckingOut && basket.length > 0 && selectedMembers.length > 0)
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Checkout</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {txDeleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.88, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800 relative overflow-hidden"
            >
              {deleteSuccessData ? (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="space-y-4 py-2 text-center"
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-9 h-9 animate-bounce text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight">
                      রেকর্ড সফলভাবে মুছে ফেলা হয়েছে!
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                      {deleteSuccessData.desc}
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs space-y-1.5 text-left">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">সমন্বয়কৃত পরিমাণ:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">৳{deleteSuccessData.amount.toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1">
                      <span>✓</span>
                      <span>সদস্যের বকেয়া ও ইনভেন্টরি সফলভাবে আপডেট করা হয়েছে</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteSuccessData(null);
                      setTxDeleteConfirmId(null);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md shadow-emerald-950/50 active:scale-95"
                  >
                    ঠিক আছে (DONE)
                  </button>
                </motion.div>
              ) : (
                <div className="text-center">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
                  <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/30 shadow-inner">
                    <Trash2 className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Remove Record?</h3>
                  <p className="text-sm font-bold text-slate-400 mb-6">
                    Are you sure you want to remove this sale record? Member due will be adjusted and inventory will be updated.
                  </p>
                  
                  <div className="flex space-x-3">
                    <button 
                      type="button"
                      onClick={() => setTxDeleteConfirmId(null)} 
                      className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-700 transition-colors cursor-pointer active:scale-95"
                    >
                      CANCEL
                    </button>
                    <button 
                      type="button"
                      onClick={() => removeHistoryItem(txDeleteConfirmId)} 
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black tracking-widest transition-all shadow-md shadow-rose-600/30 active:scale-95 cursor-pointer"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit / Remove Sale Record Modal */}
      <AnimatePresence>
        {editingTx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[70] flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">বিক্রয় রেকর্ড সম্পাদনা / মুছুন</h3>
                    <p className="text-[11px] text-slate-400">Edit transaction or delete record</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4">
                {/* Member / Customer info (Fixed / Read-only) */}
                <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer</span>
                    <span className="text-xs font-black text-white">
                      {editingTx.rank && !String(editingTx.memberName || '').startsWith(editingTx.rank) ? `${editingTx.rank} ` : ''}
                      {editingTx.memberName || editingTx.airman_id}
                    </span>
                  </div>
                  {editingTx.bdNo && (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30">
                      BD: {editingTx.bdNo}
                    </span>
                  )}
                </div>

                {/* Items info (Fixed / Read-only) */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    মেনু আইটেম (Items)
                  </span>
                  <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800/80 flex flex-wrap gap-1.5">
                    {(() => {
                      let itemsList: Array<{ name: string; qty: number }> = [];
                      if (editingTx.soldItems && Array.isArray(editingTx.soldItems) && editingTx.soldItems.length > 0) {
                        itemsList = editingTx.soldItems.map((si: any) => ({
                          name: getMenuItemBanglaName(si.menuItemName || si.name || '') || si.menuItemName || si.name || 'আইটেম',
                          qty: Number(si.qty || si.quantity || 1)
                        }));
                      } else if (editingTx.items) {
                        const parts = String(editingTx.items).split(/[,+;|\n]+/).map(s => s.trim()).filter(Boolean);
                        itemsList = parts.map(part => {
                          const clean = part.replace(/\s*\(\s*\d+\s*\)$/, '').replace(/\s*[xX]\s*\d+$/, '').trim();
                          const bn = getMenuItemBanglaName(clean) || clean;
                          return { name: bn, qty: 1 };
                        });
                      }
                      return itemsList.map((it, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                          <span>{it.name}</span>
                          {it.qty > 1 && (
                            <span className="text-indigo-400 font-mono text-[10px] font-black">x{it.qty}</span>
                          )}
                        </span>
                      ));
                    })()}
                  </div>
                </div>

                {/* Date Input - Editable */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    তারিখ (Date)
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs font-mono font-bold text-white outline-none cursor-pointer"
                  />
                </div>

                {/* Discount Input - Editable (Placed right below Date) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      ডিসকাউন্ট (Discount - ৳)
                    </label>
                    <span className="text-[10px] text-amber-400/90 font-mono font-bold">
                      মূল বিল: ৳{editBaseAmount}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={editBaseAmount}
                      step="1"
                      value={editDiscount}
                      onChange={(e) => handleEditDiscountChange(e.target.value)}
                      placeholder="0"
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-sm font-mono font-bold text-amber-400 outline-none"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                      ৳
                    </span>
                  </div>
                </div>

                {/* Total Amount Display - Auto calculated from Base Amount - Discount (Fixed/Protected) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      মোট টাকা (Total Amount - ৳)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Number(editDiscount) > 0 ? `৳${editBaseAmount} - ৳${Number(editDiscount)} = ৳${Number(editAmount || 0)}` : `বিল: ৳${editBaseAmount}`}
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between">
                    <span className="text-base font-mono font-black text-emerald-400">
                      ৳{Number(editAmount || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Auto Calculated
                    </span>
                  </div>
                </div>

                {/* Status DUE / PAID Toggle - Editable */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
                    পেমেন্ট স্ট্যাটাস (Payment Status)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditPaymentStatus('DUE')}
                      className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
                        editPaymentStatus === 'DUE'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-md shadow-amber-950/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      DUE (বকেয়া)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPaymentStatus('PAID')}
                      className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
                        editPaymentStatus === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-950/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      PAID (পরিশোধিত)
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Save & Remove */}
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = editingTx.id;
                    setEditingTx(null);
                    setTxDeleteConfirmId(idToDelete);
                  }}
                  className="px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Delete this record"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
                <div className="flex-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTx(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingEdit}
                    onClick={saveEditedHistoryItem}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-md shadow-indigo-900/40 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? 'সংরক্ষণ হচ্ছে...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal - Table Format (Ser No, Customer Name, Item Name, Qty, Total, Status) */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[2rem] w-full max-w-4xl shadow-2xl flex flex-col h-[85vh] min-h-[550px] max-h-[92vh] overflow-hidden animate-in zoom-in-95">
            
            {/* Header (Renamed to 'History' as requested) */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-xl">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">HISTORY</h3>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black">
                        {filteredSalesHistory.length}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">Sales records & transaction ledger</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowHistoryModal(false);
                      setShowImportSalesModal(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/60 active:bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-sm cursor-pointer"
                    title="Import Sales from Excel / CSV"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Import Sales</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowHistoryModal(false)} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    placeholder="Search by customer, BD No, item, or date..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 outline-none"
                  />
                  {historySearchTerm && (
                    <button 
                      type="button"
                      onClick={() => setHistorySearchTerm('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Date-wise filter with Left/Right arrows, '09 Oct 26' format, Today default */}
                <div className="shrink-0 flex items-center">
                  <DateNavigator 
                    value={historyDateFilter} 
                    onChange={setHistoryDateFilter} 
                    allowAll={true} 
                    format="dd_mm_yy"
                  />
                </div>
              </div>
            </div>
            
            {/* Scrollable Table Body */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 flex flex-col min-h-0">
              {filteredSalesHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-6 min-h-[250px]">
                  <History className="w-12 h-12 mx-auto opacity-20 mb-3" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-300">No Sales Records Found</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {historySearchTerm ? 'No transactions match your search.' : 'Completed sales will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                        <th className="py-3 px-3 font-black text-center w-14">Ser No</th>
                        <th className="py-3 px-3 font-black text-center w-24">Date</th>
                        <th className="py-3 px-3 font-black min-w-[150px]">Customer Name</th>
                        <th className="py-3 px-3 font-black min-w-[180px]">Item Name</th>
                        <th className="py-3 px-3 font-black text-center w-16">Qty</th>
                        <th className="py-3 px-3 font-black text-right w-24">Total</th>
                        <th className="py-3 px-3 font-black text-center w-28">Status (DUE/Paid)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {filteredSalesHistory.map((tx, idx) => {
                        const m = members.find(mem => mem.airman_id === tx.airman_id);
                        const memberRank = tx.rank || (m ? m['Rank'] : '') || '';
                        const memberSurname = (m ? m['Surname'] : '') || tx.memberName || tx.airman_id;
                        const memberBdNo = tx.bdNo || (m ? m['BD No'] : '') || '';
                        
                        let parsedItemsList: Array<{ name: string; qty: number; unitPrice: number; itemTotal: number }> = [];
                        let totalQty = 0;
                        if (tx.soldItems && Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
                          parsedItemsList = tx.soldItems.map((si: any) => {
                            const resolved = resolveLiveItem(si);
                            return {
                              name: resolved.name,
                              qty: resolved.qty,
                              unitPrice: resolved.unitPrice,
                              itemTotal: resolved.itemTotal
                            };
                          });
                          totalQty = parsedItemsList.reduce((sum, it) => sum + it.qty, 0);
                        } else if (tx.items) {
                          const parts = String(tx.items).split(/[,+;|\n]+/).map(s => s.trim()).filter(Boolean);
                          parsedItemsList = parts.map(part => {
                            let q = 1;
                            let raw = part;
                            const parenMatch = part.match(/^(.+?)\s*\(\s*(\d+)\s*\)$/);
                            if (parenMatch) {
                              raw = parenMatch[1].trim();
                              q = parseInt(parenMatch[2], 10) || 1;
                            } else {
                              const xMatch = part.match(/^(.+?)\s*[xX]\s*(\d+)$/);
                              if (xMatch) {
                                raw = xMatch[1].trim();
                                q = parseInt(xMatch[2], 10) || 1;
                              }
                            }
                            totalQty += q;
                            const resolved = resolveLiveItem({ name: raw, qty: q });
                            let unitPrice = resolved.unitPrice;
                            let itemTotal = resolved.itemTotal;
                            if (unitPrice === 0 && tx.amount) {
                              itemTotal = Math.round(Number(tx.amount || 0) / Math.max(1, parts.length));
                              unitPrice = Math.round(itemTotal / q);
                            }
                            return {
                              name: resolved.name,
                              qty: q,
                              unitPrice,
                              itemTotal
                            };
                          });
                        }
                        if (totalQty === 0) totalQty = 1;

                        const liveTxAmount = parsedItemsList.length > 0 
                          ? parsedItemsList.reduce((sum, it) => sum + it.itemTotal, 0)
                          : Number(tx.amount || 0);

                        const isPaid = tx.status === 'PAID' || tx.paymentStatus === 'PAID' || String(tx.gateway || tx.paymentMethod || '').toUpperCase() === 'CASH';

                        return (
                          <tr 
                            key={tx.id} 
                            onClick={() => openEditTxModal(tx)}
                            title="Click row to Edit or Remove record"
                            className="hover:bg-indigo-950/30 hover:border-indigo-500/30 transition-colors cursor-pointer group"
                          >
                            {/* Ser No */}
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 group-hover:text-indigo-300">
                              {idx + 1}
                            </td>

                            {/* Date (Added after Ser No) */}
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-300 text-xs whitespace-nowrap">
                              {formatCanteenDate(tx.date || tx.paymentDate || tx.timestamp || tx.created_at || (typeof tx.id === 'number' ? tx.id : undefined))}
                            </td>

                            {/* Customer Name */}
                            <td className="py-2.5 px-3">
                              <div className="font-black text-white text-xs group-hover:text-indigo-200">
                                {memberRank && !String(memberSurname).startsWith(memberRank) ? `${memberRank} ` : ''}{memberSurname}
                              </div>
                              {memberBdNo && (
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  BD: {memberBdNo}
                                </div>
                              )}
                            </td>

                            {/* Item Name (Each item on its own row) */}
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col gap-1.5 py-0.5">
                                {parsedItemsList.length > 0 ? (
                                  parsedItemsList.map((item, i) => (
                                    <div key={i} className="min-h-[24px] flex items-center">
                                      <span 
                                        className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700/80 text-emerald-300 text-[11px] font-medium"
                                      >
                                        <span className="truncate max-w-[170px]">{item.name}</span>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="min-h-[24px] flex items-center">
                                    <span className="text-slate-400 text-xs">
                                      {getMenuItemBanglaName(tx.items) || tx.items || 'মেনু আইটেম'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Qty (Vertically aligned row-by-row with each item) */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex flex-col gap-1.5 py-0.5 items-center justify-center">
                                {parsedItemsList.length > 0 ? (
                                  parsedItemsList.map((item, i) => (
                                    <div key={i} className="min-h-[24px] flex items-center justify-center">
                                      <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-mono font-black text-xs">
                                        {item.qty}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="min-h-[24px] flex items-center justify-center">
                                    <span className="font-mono font-bold text-indigo-300 text-xs">1</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Total (Item onujayi Total - 3 ta item er 3 ta total) */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex flex-col gap-1.5 py-0.5 items-end justify-center">
                                {parsedItemsList.length > 0 ? (
                                  parsedItemsList.map((item, i) => (
                                    <div key={i} className="min-h-[24px] flex items-center justify-end">
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-mono font-black text-xs">
                                        ৳{item.itemTotal.toLocaleString()}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="min-h-[24px] flex items-center justify-end">
                                    <span className="font-mono font-black text-emerald-400 text-sm">
                                      ৳{Number(tx.amount || 0).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {parsedItemsList.length > 1 && (
                                <div className="mt-1 pt-1 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-end gap-1">
                                  <span>মোট:</span>
                                  <span className="font-black text-emerald-400 text-xs">৳{liveTxAmount.toLocaleString()}</span>
                                </div>
                              )}
                            </td>

                            {/* Status (DUE/Paid) */}
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                isPaid 
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              }`}>
                                {isPaid ? 'PAID' : 'DUE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Summary Bar */}
            <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-slate-400 shrink-0">
              <span>Total Records: <strong className="text-white">{filteredSalesHistory.length}</strong></span>
              <span>Grand Total: <strong className="text-emerald-400 text-sm">৳{filteredSalesHistory.reduce((sum, t) => {
                let tAmount = Number(t.amount || 0);
                if (t.soldItems && Array.isArray(t.soldItems) && t.soldItems.length > 0) {
                  tAmount = t.soldItems.reduce((s: number, it: any) => {
                    const resolved = resolveLiveItem(it);
                    return s + resolved.itemTotal;
                  }, 0);
                }
                return sum + tAmount;
              }, 0).toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* POS Sales Bulk Import Modal */}
      {showImportSalesModal && (
        <ImportPosSalesModal
          isOpen={showImportSalesModal}
          onClose={() => setShowImportSalesModal(false)}
          members={members}
          catalog={catalog}
          onImportComplete={() => {
            const history = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
            setSalesHistory(history.filter((tx: any) => isSaleTransaction(tx)));
            setToastMessage('POS sales imported successfully!');
            setTimeout(() => setToastMessage(''), 3000);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center space-x-3 animate-in slide-in-from-top-10 fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
