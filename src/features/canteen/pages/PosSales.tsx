import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, ShoppingCart, Minus, Trash2, CheckCircle2, X, History, Calendar, 
  Package as PackageIcon, AlertTriangle, ChefHat, Filter, User, Users, Utensils, 
  CheckSquare, Square, Check, ArrowRight, ChevronRight, Layers, Sparkles, Coffee, 
  ShieldCheck, RefreshCw, ChevronDown, ChevronUp, CheckCheck
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, getItemDisplayName, getCanteenConfig, CanteenConfig } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';
import { deductRawStockForSales, restoreRawStockForSaleCancellation, getRecipeForMenuItem, getRawInventoryItems, calculateMenuItemStockInfo, getMenuRecipes } from '../utils/recipeManager';
import { pushKeyToCloud, recordDeletedTxId } from '../utils/canteenCloudSync';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';
import { 
  getCanteenMenuCache, 
  fetchCanteenMenuOnce, 
  getCanteenMembersCache, 
  fetchCanteenMembersOnce 
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

export const PosSales: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<any[]>(() => getCanteenMenuCache());
  const [basket, setBasket] = useState<any[]>([]);
  
  // 3 POS Sales Modes:
  // 1. MENU_FIXED: মেনু ও ডেট Fixed -> Multiple Members Batch Sale
  // 2. MEMBER_FIXED: মেম্বার ও ডেট Fixed -> Multiple Menu Items Order
  // 3. NORMAL: Standard POS
  const [posMode, setPosMode] = useState<'MENU_FIXED' | 'MEMBER_FIXED' | 'NORMAL'>('NORMAL');

  // Mode 1: MENU_FIXED State
  const [batchSelectedMemberIds, setBatchSelectedMemberIds] = useState<Set<string>>(new Set());
  const [batchRankFilter, setBatchRankFilter] = useState<'ALL' | 'OFFICER' | 'AIRMEN' | 'CIVILIAN'>('ALL');
  const [batchSearchTerm, setBatchSearchTerm] = useState('');

  // Mode 2: MEMBER_FIXED State
  const [fixedMember, setFixedMember] = useState<any | null>(null);
  const [fixedMemberSearch, setFixedMemberSearch] = useState('');
  const [showFixedMemberDropdown, setShowFixedMemberDropdown] = useState(false);

  // Mobile Bottom Drawer / Cart Modal State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [showBatchMenuModal, setShowBatchMenuModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());

  // Live Raw Inventory & Recipe states for realtime available stock calculation
  const [rawInventory, setRawInventory] = useState<any[]>(() => getRawInventoryItems());
  const [recipesMap, setRecipesMap] = useState<any>(() => getMenuRecipes());

  useEffect(() => {
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
    window.addEventListener('storage', handleSyncStock);
    window.addEventListener('storage', handleCfgUpdate);
    return () => {
      window.removeEventListener('canteen_settings_updated', handleCfgUpdate);
      window.removeEventListener('canteen_raw_inventory_updated', handleSyncStock);
      window.removeEventListener('canteen_menu_recipes_updated', handleSyncStock);
      window.removeEventListener('storage', handleSyncStock);
      window.removeEventListener('storage', handleCfgUpdate);
    };
  }, []);

  // Member Search State
  const [members, setMembers] = useState<any[]>(() => {
    const cached = getCanteenMembersCache();
    return cached
      .filter((m: any) => {
        const bd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
        return bd !== '48456';
      })
      .map((m: any) => ({
        ...m,
        Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
        baki: Number(m.Due ?? m.due ?? m.baki ?? 0)
      }));
  });
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);

  // Sale Options
  const [saleDate, setSaleDate] = useState(() => {
      // Format YYYY-MM-DD for input default
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState<'ALL' | 'TODAY'>('ALL');
  const [toastMessage, setToastMessage] = useState('');
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
    fetchMembers();
    const stored = localStorage.getItem('canteen_recent_members');
    if (stored) {
        try { setRecentMembers(JSON.parse(stored)); } catch(e){}
    }

    const handleInventoryUpdated = () => {
      fetchCatalog();
    };
    window.addEventListener('canteen_inventory_updated', handleInventoryUpdated);
    return () => {
      window.removeEventListener('canteen_inventory_updated', handleInventoryUpdated);
    };
  }, []);

  const loadHistory = () => {
      const history = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      setSalesHistory(history);
      setShowHistoryModal(true);
  };

  const filteredSalesHistory = useMemo(() => {
    let list = salesHistory;
    if (historyFilterType === 'TODAY') {
      const todayStr = formatCanteenDate(new Date());
      list = list.filter(tx => {
        const txDate = formatCanteenDate(tx.date);
        return txDate === todayStr;
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
  }, [salesHistory, historyFilterType, historySearchTerm, members]);

  const removeHistoryItem = async (txId: string) => {
      const txToRemove = salesHistory.find(tx => tx.id === txId);
      if (!txToRemove) return;

      // Reverse Due
      const m = members.find(m => m.airman_id === txToRemove.airman_id);
      if (m) {
          const currentDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
          const newDue = Math.max(0, currentDue - txToRemove.amount);
          await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', txToRemove.airman_id);
          setMembers(members.map(member => member.airman_id === txToRemove.airman_id ? {...member, Due: newDue, baki: newDue} : member));
      }

      // Robust item parsing for raw inventory restoration
      const itemsToRestore: Array<{ menuItemId?: string; menuItemName: string; qty: number }> = [];

      if (txToRemove.soldItems && Array.isArray(txToRemove.soldItems) && txToRemove.soldItems.length > 0) {
          for (const item of txToRemove.soldItems) {
              const qty = Number(item.qty || item.quantity) || 0;
              if (qty > 0) {
                  itemsToRestore.push({
                      menuItemId: item.menuItemId || item.id,
                      menuItemName: item.menuItemName || item.name || '',
                      qty
                  });
              }
          }
      } else if (txToRemove.items) {
          const itemsArray = String(txToRemove.items).split(/[,+;|\n]+/).map((s: string) => s.trim()).filter(Boolean);
          for (const itemStr of itemsArray) {
              const parenMatch = itemStr.match(/^(.+?)\s*\(\s*(\d+)\s*\)$/);
              const xMatchEnd = itemStr.match(/^(.+?)\s*[xX*]\s*(\d+)$/);
              const xMatchStart = itemStr.match(/^(\d+)\s*[xX*]\s*(.+)$/);
              const colonMatch = itemStr.match(/^(.+?)\s*[:\-]\s*(\d+)$/);

              if (parenMatch) {
                  itemsToRestore.push({ menuItemName: parenMatch[1].trim(), qty: parseInt(parenMatch[2], 10) });
              } else if (xMatchEnd) {
                  itemsToRestore.push({ menuItemName: xMatchEnd[1].trim(), qty: parseInt(xMatchEnd[2], 10) });
              } else if (xMatchStart) {
                  itemsToRestore.push({ menuItemName: xMatchStart[2].trim(), qty: parseInt(xMatchStart[1], 10) });
              } else if (colonMatch) {
                  itemsToRestore.push({ menuItemName: colonMatch[1].trim(), qty: parseInt(colonMatch[2], 10) });
              } else {
                  itemsToRestore.push({ menuItemName: itemStr.trim(), qty: 1 });
              }
          }
      }

      // Restore Raw Materials Stock (কাঁচামালের স্টক ফেরত আনা)
      let restoredCount = 0;
      let restoredDetails: string[] = [];
      if (itemsToRestore.length > 0) {
          const rawRestoreResult = restoreRawStockForSaleCancellation(itemsToRestore, {
              id: txToRemove.id,
              memberName: txToRemove.memberName,
              date: txToRemove.date
          });
          restoredCount = rawRestoreResult.restored.length;
          restoredDetails = rawRestoreResult.restored.map(r => `${r.rawItemName} (+${r.qtyRestored} ${r.unit})`);
      }

      fetchCatalog(); // Refresh catalog after stock restoration

      recordDeletedTxId(txId);
      const updatedHistory = salesHistory.filter(tx => tx.id !== txId);
      setSalesHistory(updatedHistory);
      localStorage.setItem('canteen_txs', JSON.stringify(updatedHistory));
      try {
        await pushKeyToCloud('canteen_txs', updatedHistory);
      } catch (e) {
        console.warn('Cloud sync error for canteen_txs:', e);
      }

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('storage'));
      setTxDeleteConfirmId(null);

      const rawMsg = restoredCount > 0 
          ? ` এবং ${restoredCount}টি কাঁচামালের স্টক ইনভেন্টরিতে ফেরত যোগ করা হয়েছে (${restoredDetails.slice(0, 3).join(', ')}${restoredDetails.length > 3 ? '...' : ''})!` 
          : '!';
      setToastMessage(`✅ সেল রেকর্ড ডিলিট করা হয়েছে, বকেয়া সমন্বয় করা হয়েছে${rawMsg}`);
      setTimeout(() => setToastMessage(''), 5000);
  };

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
      const data = await fetchCanteenMenuOnce();
      if (data && data.length > 0) {
        setCatalog(data);
      }
    } catch(e) {
      console.warn("Error in POS fetchCatalog:", e);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const addToBasket = (item: any) => {
      const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);
      const available = stockInfo.availableStock;
      if (available <= 0) {
          return;
      }
      const existing = basket.find(b => b.id === item.id);
      if (existing) {
          if (existing.qty >= available) {
              return;
          }
          setBasket(basket.map(b => b.id === item.id ? { ...b, qty: b.qty + 1 } : b));
      } else {
          setBasket([...basket, { ...item, qty: 1 }]);
      }
  };

  const updateQty = (id: string, delta: number) => {
      setBasket(basket.map(b => {
          if (b.id === id) {
              const stockInfo = calculateMenuItemStockInfo(b.id, b.name, rawInventory, recipesMap);
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

  const filteredBatchMembers = useMemo(() => {
    return sortedMembers.filter((m) => {
      if (batchRankFilter === 'OFFICER' && !isOfficerMember(m)) return false;
      if (batchRankFilter === 'AIRMEN' && !isAirmanMember(m)) return false;
      if (batchRankFilter === 'CIVILIAN' && !isCivilianMember(m)) return false;

      if (!batchSearchTerm.trim()) return true;
      const term = batchSearchTerm.toLowerCase().trim();
      const surname = String(m['Surname'] || m.surname || '').toLowerCase();
      const rank = String(m['Rank'] || m.rank || '').toLowerCase();
      const bd = String(m['BD No'] || m.bdNo || m.airman_id || '').toLowerCase();
      return surname.includes(term) || rank.includes(term) || bd.includes(term);
    });
  }, [sortedMembers, batchRankFilter, batchSearchTerm]);

  const toggleBatchMember = (airmanId: string) => {
    setBatchSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(airmanId)) {
        next.delete(airmanId);
      } else {
        next.add(airmanId);
      }
      return next;
    });
  };

  const handleSelectAllFilteredBatch = () => {
    setBatchSelectedMemberIds((prev) => {
      const next = new Set(prev);
      filteredBatchMembers.forEach((m) => {
        if (m.airman_id) next.add(m.airman_id);
      });
      return next;
    });
  };

  const handleClearBatchMembers = () => {
    setBatchSelectedMemberIds(new Set());
  };

  // Fixed Member search filter (Mode 2)
  const filteredFixedMemberCandidates = useMemo(() => {
    if (!fixedMemberSearch.trim()) return recentMembers.length > 0 ? recentMembers : sortedMembers.slice(0, 8);
    const term = fixedMemberSearch.toLowerCase().trim();
    return sortedMembers.filter((m) => {
      const surname = String(m['Surname'] || m.surname || '').toLowerCase();
      const rank = String(m['Rank'] || m.rank || '').toLowerCase();
      const bd = String(m['BD No'] || m.bdNo || m.airman_id || '').toLowerCase();
      return surname.includes(term) || rank.includes(term) || bd.includes(term);
    }).slice(0, 10);
  }, [sortedMembers, fixedMemberSearch, recentMembers]);

  const handleCheckout = async () => {
    if (isCheckingOut) return;

    let targetMembersList: any[] = [];
    const perMemberAmount = basketTotal;

    if (posMode === 'MENU_FIXED') {
      if (basket.length === 0) {
        setToastMessage('⚠️ মেনু আইটেম খালি! অনুগ্রহ করে অন্তত ১টি মেনু আইটেম যোগ করুন।');
        setTimeout(() => setToastMessage(''), 3500);
        return;
      }
      targetMembersList = members.filter((m) => batchSelectedMemberIds.has(m.airman_id));
      if (targetMembersList.length === 0) {
        setToastMessage('⚠️ কোনো সদস্য সিলেক্ট করা হয়নি! অনুগ্রহ করে সদস্য নির্বাচন করুন।');
        setTimeout(() => setToastMessage(''), 3500);
        return;
      }
    } else if (posMode === 'MEMBER_FIXED') {
      if (!fixedMember) {
        setToastMessage('⚠️ কোনো সদস্য সিলেক্ট করা হয়নি! অনুগ্রহ করে প্রথমে সদস্য নির্বাচন করুন।');
        setTimeout(() => setToastMessage(''), 3500);
        return;
      }
      if (basket.length === 0) {
        setToastMessage('⚠️ কার্ট খালি! অনুগ্রহ করে মেনু আইটেম যোগ করুন।');
        setTimeout(() => setToastMessage(''), 3500);
        return;
      }
      targetMembersList = [fixedMember];
    } else {
      // NORMAL Mode
      if (basket.length === 0 || selectedMembers.length === 0) {
        setToastMessage('⚠️ কার্ট খালি অথবা কোনো সদস্য সিলেক্ট করা হয়নি!');
        setTimeout(() => setToastMessage(''), 3500);
        return;
      }
      targetMembersList = selectedMembers;
    }

    setIsCheckingOut(true);
    const multiplier = targetMembersList.length;
    const totalSalesAmount = perMemberAmount * multiplier;

    try {
      const txDateStr = formatCanteenDate(saleDate);
      const newTransactions: any[] = [];

      for (const m of targetMembersList) {
        const currentDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
        const newDue = currentDue + perMemberAmount;

        await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', m.airman_id);

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
          amount: perMemberAmount,
          type: 'SALE',
          gateway: 'DUE'
        };
        newTransactions.push(tx);
      }

      // Update members in memory
      setMembers((prev) =>
        prev.map((member) => {
          const matched = targetMembersList.find((tm) => tm.airman_id === member.airman_id);
          if (matched) {
            const currentDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
            return {
              ...member,
              Due: currentDue + perMemberAmount,
              due: currentDue + perMemberAmount,
              baki: currentDue + perMemberAmount
            };
          }
          return member;
        })
      );

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
      const deductionResult = deductRawStockForSales(itemsForDeduction);

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('storage'));

      const deductionSummary = deductionResult.deducted.length > 0 
        ? ` (${deductionResult.deducted.length}টি কাঁচামালের স্টক বিয়োগ হয়েছে)`
        : '';

      const successMsg = posMode === 'MENU_FIXED'
        ? `✅ সফলভাবে ${multiplier} জন সদস্যের সেল সম্পন্ন হয়েছে (মোট ৳${totalSalesAmount})!${deductionSummary}`
        : posMode === 'MEMBER_FIXED'
        ? `✅ সফলভাবে ${targetMembersList[0]['Rank']} ${targetMembersList[0]['Surname']} এর সেল সম্পন্ন হয়েছে (৳${totalSalesAmount})!${deductionSummary}`
        : `✅ Sale completed successfully for ৳${totalSalesAmount}!${deductionSummary}`;

      setToastMessage(successMsg);
      setTimeout(() => setToastMessage(''), 4000);

      // Clean up for next order
      if (posMode === 'MENU_FIXED') {
        setBatchSelectedMemberIds(new Set());
      } else if (posMode === 'MEMBER_FIXED') {
        setBasket([]);
        setFixedMember((prev: any) => prev ? { ...prev, Due: (Number(prev.Due ?? prev.due ?? prev.baki ?? 0) + perMemberAmount), due: (Number(prev.Due ?? prev.due ?? prev.baki ?? 0) + perMemberAmount), baki: (Number(prev.Due ?? prev.due ?? prev.baki ?? 0) + perMemberAmount) } : null);
      } else {
        setBasket([]);
        setSelectedMembers([]);
        setMemberSearchTerm('');
      }

      setIsMobileCartOpen(false);
      fetchCatalog();
    } catch (err: any) {
      setToastMessage(`❌ সমস্যা হয়েছে: ${err?.message || 'Error completing sale'}`);
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
        const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());
        const itemCat = (item.category || 'SNACKS').toUpperCase();
        const matchesCat = selectedCategory === 'ALL' || itemCat === selectedCategory;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [catalog, searchTerm, selectedCategory]);

  const basketTotal = basket.reduce((sum, item) => sum + (item.price * item.qty), 0);

  
  return (
    <>
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-28 md:pb-12 px-2 sm:px-4">
      
      {/* Top Header & History Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-3xl border border-slate-800/80 shadow-md">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">CANTEEN POS</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-black border border-indigo-500/30">
              {posMode === 'MENU_FIXED' ? '১. মেনু ও ডেট ফিক্সড' : posMode === 'MEMBER_FIXED' ? '২. মেম্বার ও ডেট ফিক্সড' : '৩. নরমাল POS'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">ক্যান্টিন সেলস ম্যানেজমেন্ট ও অটোমেটিক বকেয়া হিসাব</p>
        </div>

        <button 
          onClick={loadHistory}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold tracking-wider transition-colors shadow-sm cursor-pointer self-start sm:self-auto border border-slate-700 active:scale-95"
        >
          <History className="w-4 h-4 text-indigo-400" />
          <span>SALES HISTORY</span>
        </button>
      </div>

      {/* 3 POS Modes Switcher Tab Bar */}
      <div className="bg-slate-900 p-1.5 sm:p-2 rounded-2xl border border-slate-800 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
          
          {/* Mode 1: MENU_FIXED */}
          <button
            type="button"
            onClick={() => setPosMode('MENU_FIXED')}
            className={`p-3 rounded-xl transition-all cursor-pointer text-left flex items-center sm:flex-col sm:items-start gap-2.5 sm:gap-1 border ${
              posMode === 'MENU_FIXED'
                ? 'bg-gradient-to-r sm:bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/50'
                : 'bg-slate-950/60 text-slate-300 hover:bg-slate-800/80 hover:text-white border-slate-800/80'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${posMode === 'MENU_FIXED' ? 'bg-white/20 text-white' : 'bg-slate-900 text-indigo-400 border border-slate-800'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs sm:text-sm font-black truncate">১. মেনু ও ডেট Fixed</span>
              </div>
              <p className={`text-[10px] truncate ${posMode === 'MENU_FIXED' ? 'text-indigo-100' : 'text-slate-400'}`}>
                Multiple Member নির্বাচন করে ব্যাচ সেল
              </p>
            </div>
          </button>

          {/* Mode 2: MEMBER_FIXED */}
          <button
            type="button"
            onClick={() => setPosMode('MEMBER_FIXED')}
            className={`p-3 rounded-xl transition-all cursor-pointer text-left flex items-center sm:flex-col sm:items-start gap-2.5 sm:gap-1 border ${
              posMode === 'MEMBER_FIXED'
                ? 'bg-gradient-to-r sm:bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/50'
                : 'bg-slate-950/60 text-slate-300 hover:bg-slate-800/80 hover:text-white border-slate-800/80'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${posMode === 'MEMBER_FIXED' ? 'bg-white/20 text-white' : 'bg-slate-900 text-indigo-400 border border-slate-800'}`}>
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs sm:text-sm font-black truncate">২. Member & ডেট Fixed</span>
              </div>
              <p className={`text-[10px] truncate ${posMode === 'MEMBER_FIXED' ? 'text-indigo-100' : 'text-slate-400'}`}>
                Multiple Menu সেট করে দ্রুত অর্ডার
              </p>
            </div>
          </button>

          {/* Mode 3: NORMAL */}
          <button
            type="button"
            onClick={() => setPosMode('NORMAL')}
            className={`p-3 rounded-xl transition-all cursor-pointer text-left flex items-center sm:flex-col sm:items-start gap-2.5 sm:gap-1 border ${
              posMode === 'NORMAL'
                ? 'bg-gradient-to-r sm:bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/50'
                : 'bg-slate-950/60 text-slate-300 hover:bg-slate-800/80 hover:text-white border-slate-800/80'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${posMode === 'NORMAL' ? 'bg-white/20 text-white' : 'bg-slate-900 text-indigo-400 border border-slate-800'}`}>
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs sm:text-sm font-black truncate">৩. Normal POS</span>
              </div>
              <p className={`text-[10px] truncate ${posMode === 'NORMAL' ? 'text-indigo-100' : 'text-slate-400'}`}>
                স্ট্যান্ডার্ড ক্যাটারিং ও পয়েন্ট অফ সেল
              </p>
            </div>
          </button>

        </div>
      </div>

      {/* ======================================================== */}
      {/* MODE 1: MENU_FIXED (মেনু ও ডেট Fixed - Multiple Member) */}
      {/* ======================================================== */}
      {posMode === 'MENU_FIXED' && (
        <div className="space-y-6">
          {/* Fixed Settings Card: Date + Fixed Menu Items */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-500/30 inline-flex items-center space-x-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span>অপশন ১: মেনু ও তারিখ ফিক্সড (ব্যাচ সেলস)</span>
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white">ফিক্সড মেনু ও তারিখ নির্ধারণ</h3>
                <p className="text-xs text-slate-400 mt-0.5">এখানে নির্ধারিত মেনু আইটেম ও তারিখ ফিক্সড থাকবে, একসাথে একাধিক সদস্যের বিল এন্ট্রি হবে</p>
              </div>

              {/* Date Selector */}
              <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800 shrink-0">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0 ml-1.5" />
                <div className="flex flex-col pr-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">ফিক্সড তারিখ (Date)</span>
                  <input 
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Menu Items List & Price */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Utensils className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">ফিক্সড মেনু আইটেম সমূহ:</h4>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    জনপ্রতি বিল: ৳{basketTotal}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchMenuModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black tracking-wide flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{basket.length === 0 ? 'মেনু আইটেম যোগ করুন' : 'মেনু পরিবর্তন / আইটেম যোগ'}</span>
                </button>
              </div>

              {basket.length === 0 ? (
                <div 
                  onClick={() => setShowBatchMenuModal(true)}
                  className="p-6 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/40 text-center cursor-pointer transition-all group"
                >
                  <PackageIcon className="w-8 h-8 mx-auto text-slate-500 group-hover:text-indigo-400 group-hover:scale-110 transition-all mb-2" />
                  <p className="text-xs font-bold text-slate-300">কোনো ফিক্সড মেনু আইটেম নির্বাচন করা হয়নি</p>
                  <p className="text-[11px] text-slate-500 mt-1">এখানে ক্লিক করে ক্যাটালগ থেকে আইটেম যোগ করুন (যেমন: চা, পরোটা, ডিম বা খিচুড়ি)</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {basket.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3 shadow-inner"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.DP ? (
                            <img src={resolveImageUrl(item.DP)} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <PackageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">{item.name}</p>
                          <p className="text-[11px] font-mono text-indigo-400 font-bold">
                            ৳{item.price} x {item.qty} = ৳{item.price * item.qty}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <div className="flex items-center space-x-1 bg-slate-900 rounded-lg border border-slate-800 p-0.5">
                          <button 
                            onClick={() => updateQty(item.id, -1)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono font-black text-white w-4 text-center">{item.qty}</span>
                          <button 
                            onClick={() => updateQty(item.id, 1)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromBasket(item.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Multiple Member Selection Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>সদস্য নির্বাচন (Select Members)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">যেসব সদস্যদের এই ফিক্সড বিল দেওয়া হবে তাদের টিক দিন</p>
              </div>

              {/* Quick Bulk Action Buttons */}
              <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-y-1">
                <button
                  type="button"
                  onClick={handleSelectAllFilteredBatch}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black tracking-wider flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>সবাইকে সিলেক্ট ({filteredBatchMembers.length})</span>
                </button>
                {batchSelectedMemberIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBatchMembers}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-300 text-xs font-black tracking-wider flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>রিসেট ({batchSelectedMemberIds.size})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search & Rank Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  value={batchSearchTerm}
                  onChange={(e) => setBatchSearchTerm(e.target.value)}
                  placeholder="নাম, পদবি বা BD No লিখে খুঁজুন..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {batchSearchTerm && (
                  <button 
                    onClick={() => setBatchSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Rank Filter Pills */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none shrink-0">
                {(['ALL', 'OFFICER', 'AIRMEN', 'CIVILIAN'] as const).map((r) => {
                  const count = r === 'ALL' ? members.length : r === 'OFFICER' ? officerCount : r === 'AIRMEN' ? airmenCount : civilianCount;
                  const label = r === 'ALL' ? 'সকল' : r === 'OFFICER' ? 'অফিসার' : r === 'AIRMEN' ? 'এয়ারম্যান' : 'সিভিলিয়ান';
                  const isSel = batchRankFilter === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBatchRankFilter(r)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                        isSel ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI Stats Strip */}
            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-4 flex-wrap gap-y-1 text-xs font-mono">
                <span className="text-slate-400">
                  নির্বাচিত সদস্য: <strong className="text-indigo-400 text-sm">{batchSelectedMemberIds.size} জন</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  জনপ্রতি বিল: <strong className="text-white text-sm">৳{basketTotal}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  সর্বমোট বিক্রয়: <strong className="text-emerald-400 text-sm sm:text-base font-black">৳{basketTotal * batchSelectedMemberIds.size}</strong>
                </span>
              </div>

              {/* Desktop Confirm Button in strip */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut || basket.length === 0 || batchSelectedMemberIds.size === 0}
                className={`hidden md:flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-xs tracking-wider uppercase transition-all shadow-md ${
                  (!isCheckingOut && basket.length > 0 && batchSelectedMemberIds.size > 0)
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>কনফার্ম সেলস ({batchSelectedMemberIds.size} জন • ৳{basketTotal * batchSelectedMemberIds.size})</span>
              </button>
            </div>

            {/* Members Grid */}
            <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2">
              {filteredBatchMembers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800 p-6">
                  <Users className="w-10 h-10 mx-auto opacity-20 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">কোনো সদস্য পাওয়া যায়নি</p>
                  <p className="text-[11px] text-slate-500 mt-1">সার্চ ফিল্টার চেক করুন বা অন্য ফিল্টার ব্যবহার করুন।</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {filteredBatchMembers.map((m) => {
                    const isSelected = batchSelectedMemberIds.has(m.airman_id);
                    return (
                      <div
                        key={m.airman_id}
                        onClick={() => toggleBatchMember(m.airman_id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.98] ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/40'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                            isSelected 
                              ? 'bg-indigo-600 border-indigo-500 text-white' 
                              : 'border-slate-700 bg-slate-900 text-transparent'
                          }`}>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 truncate">
                              <span className="text-xs font-black text-white truncate">
                                {m['Rank']} {m['Surname']}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-400">BD: {m['BD No']}</span>
                              <span className="text-[10px] font-mono font-bold text-amber-400">বকেয়া: ৳{m.Due || 0}</span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            +৳{basketTotal}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: MEMBER_FIXED (Member & ডেট Fixed - Multiple Menu) */}
      {/* ======================================================== */}
      {posMode === 'MEMBER_FIXED' && (
        <div className="space-y-6">
          {/* Pinned Fixed Member & Date Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-500/30 inline-flex items-center space-x-1.5 mb-2">
                  <User className="w-3.5 h-3.5" />
                  <span>অপশন ২: সদস্য ও তারিখ ফিক্সড (মাল্টি-মেনু অর্ডার)</span>
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white">ফিক্সড সদস্য ও তারিখ নির্ধারণ</h3>
                <p className="text-xs text-slate-400 mt-0.5">সদস্য ও তারিখ ফিক্সড থাকবে, নিচের ক্যাটালগ থেকে দ্রুত একাধিক মেনু আইটেম যোগ করুন</p>
              </div>

              {/* Date Selector */}
              <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800 shrink-0">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0 ml-1.5" />
                <div className="flex flex-col pr-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">ফিক্সড তারিখ (Date)</span>
                  <input 
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Member Selector / Pinned Card */}
            {!fixedMember ? (
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>প্রথমে ফিক্সড সদস্য নির্বাচন করুন (Search & Select Member):</span>
                </label>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    value={fixedMemberSearch}
                    onChange={(e) => {
                      setFixedMemberSearch(e.target.value);
                      setShowFixedMemberDropdown(true);
                    }}
                    onFocus={() => setShowFixedMemberDropdown(true)}
                    placeholder="সদস্যের নাম বা BD No লিখে খুঁজুন..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />

                  {showFixedMemberDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-64 z-50 overflow-y-auto">
                      {fixedMemberSearch === '' && recentMembers.length > 0 && (
                        <div className="px-4 py-2 bg-slate-950 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          সাম্প্রতিক সদস্যবৃন্দ (Recent Members)
                        </div>
                      )}
                      {filteredFixedMemberCandidates.map((m) => (
                        <div
                          key={m.airman_id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFixedMember(m);
                            setShowFixedMemberDropdown(false);
                            setFixedMemberSearch('');
                          }}
                          className="px-4 py-3 hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-800 last:border-0 transition-colors"
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{m['Rank']} {m['Surname']}</p>
                            <p className="text-[10px] text-slate-400 font-mono">BD: {m['BD No']} | বকেয়া: ৳{m.Due || 0}</p>
                          </div>
                          <Plus className="w-4 h-4 text-indigo-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Recent Member Chips */}
                {recentMembers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">দ্রুত সিলেক্ট:</span>
                    {recentMembers.slice(0, 5).map((m) => (
                      <button
                        key={m.airman_id}
                        type="button"
                        onClick={() => setFixedMember(m)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-900/40 text-slate-200 text-xs font-bold border border-slate-700 hover:border-indigo-500/50 transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <span>{m['Rank']} {m['Surname']}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({m['BD No']})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Pinned Member Card */
              <div className="p-4 bg-indigo-950/30 border border-indigo-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4 className="text-base font-black text-white">{fixedMember['Rank']} {fixedMember['Surname']}</h4>
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-indigo-300 font-mono text-xs font-bold">
                        BD: {fixedMember['BD No']}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                        বর্তমান বকেয়া: ৳{fixedMember.Due || 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-300/80 mt-1">
                      📌 এই সদস্য ফিক্সড রয়েছে। নিচের ক্যাটালগ থেকে একের পর এক মেনু আইটেম নির্বাচন করুন।
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setFixedMember(null);
                      setBasket([]);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                  >
                    সদস্য পরিবর্তন করুন
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Two Columns: Catalog on Left, Member Cart on Right */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column: Catalog */}
            <div className="lg:w-2/3 space-y-4">
              {/* Search & Categories */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="মেনু আইটেম খুঁজুন..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 border ${
                        isSelected
                          ? 'bg-[#4f46e5] text-white border-[#4f46e5] shadow-sm shadow-indigo-500/25'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                      }`}
                    >
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>

              {/* Catalog Items Grid */}
              <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                {filteredCatalog.map((item) => {
                  const inBasket = basket.find(b => b.id === item.id);
                  const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);
                  const isOutOfStock = stockInfo.availableStock <= 0;
                  const isLowStock = stockInfo.availableStock < 5;

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => {
                        if (!isOutOfStock) addToBasket(item);
                      }}
                      className={`rounded-2xl p-3.5 flex items-center justify-between border transition-all duration-300 relative select-none group ${
                        isOutOfStock
                          ? 'border-rose-600/80 bg-gradient-to-r from-rose-950/30 via-slate-900 to-slate-950 shadow-[0_0_18px_rgba(239,68,68,0.35),inset_0_0_12px_rgba(239,68,68,0.15)] ring-1 ring-rose-500/40 opacity-70 cursor-not-allowed'
                          : isLowStock
                          ? 'border-rose-500 shadow-[0_0_22px_rgba(239,68,68,0.5),inset_0_0_12px_rgba(239,68,68,0.18)] ring-2 ring-rose-500/50 bg-slate-900 cursor-pointer hover:-translate-y-0.5'
                          : inBasket
                          ? 'border-indigo-500 shadow-sm shadow-indigo-900/30 bg-slate-900 cursor-pointer hover:-translate-y-0.5'
                          : 'border-slate-800 hover:border-indigo-500/50 bg-slate-900 cursor-pointer hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 mr-2 flex-1">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden ${
                          isOutOfStock ? 'border-rose-500/40 bg-rose-950/40 text-rose-400' : 'bg-slate-950 border-slate-800'
                        }`}>
                          {item.DP ? (
                            <img src={resolveImageUrl(item.DP)} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <PackageIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{item.category}</span>

                            {/* 3D Box Shape Stock Badge */}
                            <div className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black font-mono tracking-wider flex items-center gap-1 transition-all select-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_3px_5px_-1px_rgba(0,0,0,0.6)] border-b-2 ${
                              isLowStock 
                                ? 'bg-gradient-to-b from-rose-500 to-rose-800 text-white border-rose-400 border-b-rose-950 shadow-[0_3px_10px_rgba(244,63,94,0.45)]' 
                                : 'bg-gradient-to-b from-emerald-600 to-emerald-900 text-white border-emerald-400 border-b-emerald-950 shadow-[0_3px_8px_rgba(16,185,129,0.35)]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLowStock ? 'bg-white animate-ping' : 'bg-emerald-300'}`} />
                              <span>Stock: {stockInfo.availableStock}</span>
                              {isOutOfStock && (
                                <span className="text-[9px] px-1 rounded bg-black/50 text-rose-200 font-bold ml-0.5">
                                  শেষ
                                </span>
                              )}
                            </div>
                          </div>
                          <h4 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-indigo-300 transition-colors">
                            {item.name}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="text-base font-black text-white font-mono">৳{item.price}</span>
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOutOfStock) addToBasket(item);
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black transition-all ${
                            isOutOfStock
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-rose-500/30 opacity-70'
                              : inBasket 
                              ? 'bg-indigo-600 text-white cursor-pointer shadow-sm shadow-indigo-600/30' 
                              : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white cursor-pointer'
                          }`}
                          title={isOutOfStock ? 'স্টক নেই - বিক্রি বন্ধ' : 'Add to cart'}
                        >
                          {isOutOfStock ? (
                            <X className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Order Basket (Desktop) */}
            <div className="lg:w-1/3">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col min-h-[500px] sticky top-24">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center space-x-2">
                    <ShoppingCart className="w-4 h-4 text-indigo-400" />
                    <span>ফিক্সড মেম্বার কার্ট</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold">
                    {basket.length} আইটেম
                  </span>
                </div>

                {fixedMember ? (
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 mb-3">
                    <p className="text-xs font-black text-white">{fixedMember['Rank']} {fixedMember['Surname']}</p>
                    <p className="text-[10px] text-slate-400 font-mono">BD: {fixedMember['BD No']} | পূর্ব বকেয়া: ৳{fixedMember.Due || 0}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-amber-300 text-xs mb-3 text-center">
                    ⚠️ কোনো সদস্য সিলেক্ট করা হয়নি!
                  </div>
                )}

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-[300px] pr-1">
                  {basket.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <ShoppingCart className="w-8 h-8 mx-auto opacity-20 mb-2" />
                      <p className="text-xs font-bold uppercase tracking-wider">কার্ট খালি</p>
                      <p className="text-[11px] text-slate-500 mt-1">বামপাশের ক্যাটালগ থেকে আইটেম যোগ করুন</p>
                    </div>
                  ) : (
                    basket.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">৳{item.price} x {item.qty} = ৳{item.price * item.qty}</p>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-mono font-bold text-white w-4 text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><Plus className="w-3 h-3" /></button>
                          <button onClick={() => removeFromBasket(item.id)} className="p-1 text-rose-400 hover:text-rose-300 ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Summary & Confirm */}
                <div className="border-t border-slate-800 pt-3 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">মোট বিক্রয় মূল্য:</span>
                    <span className="text-lg font-black text-white">৳{basketTotal}</span>
                  </div>
                  {fixedMember && (
                    <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                      <span>নতুন মোট বকেয়া হবে:</span>
                      <span className="font-bold">৳{(Number(fixedMember.Due || 0) + basketTotal)}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isCheckingOut || !fixedMember || basket.length === 0}
                    className={`w-full py-3.5 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-md ${
                      (!isCheckingOut && fixedMember && basket.length > 0)
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>কনফার্ম সেলস (৳{basketTotal})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 3: NORMAL (নরমাল POS যেমন এখন আছে)                   */}
      {/* ======================================================== */}
      {posMode === 'NORMAL' && (
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Column: Catalog */}
          <div className="md:w-2/3 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {availableCategories.map((cat) => {
                const count = cat === 'ALL' 
                  ? catalog.length 
                  : catalog.filter(i => (i.category || 'SNACKS').toUpperCase() === cat).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 border ${
                      isSelected
                        ? 'bg-[#4f46e5] text-white border-[#4f46e5] shadow-sm shadow-indigo-500/25'
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

            {/* Items List */}
            <div className="space-y-3 h-[600px] overflow-y-auto pr-2">
              {filteredCatalog.map((item, i) => {
                const inBasket = basket.find(b => b.id === item.id);
                const itemRecipe = getRecipeForMenuItem(item.id, item.name, recipesMap);
                const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);

                const isOutOfStock = stockInfo.availableStock <= 0;
                const isLowStock = stockInfo.availableStock < 5;

                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      if (!isOutOfStock) addToBasket(item);
                    }} 
                    className={`rounded-2xl p-4 flex items-center justify-between border transition-all duration-300 relative select-none group ${
                      isOutOfStock
                        ? 'border-rose-600/80 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 shadow-[0_0_22px_rgba(239,68,68,0.4),inset_0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-rose-500/40 opacity-70 cursor-not-allowed'
                        : isLowStock 
                        ? 'border-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.5),inset_0_0_15px_rgba(239,68,68,0.18)] ring-2 ring-rose-500/50 bg-slate-900 cursor-pointer hover:-translate-y-1' 
                        : inBasket 
                        ? 'border-[#4f46e5] shadow-[0_10px_20px_-10px_rgba(79,70,229,0.2)] bg-slate-900 cursor-pointer hover:-translate-y-1' 
                        : 'border-slate-800 hover:border-indigo-500/50 bg-slate-900 cursor-pointer hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.3)]'
                    }`}
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-1 mr-2">
                      <div className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 overflow-hidden shrink-0 border ${
                        isOutOfStock 
                          ? 'border-rose-500/40 bg-rose-950/40 text-rose-400' 
                          : inBasket 
                          ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-400' 
                          : 'border-slate-800/80 bg-[#0f172a] text-slate-400 group-hover:bg-slate-800 group-hover:text-indigo-300'
                      }`}>
                        {item.DP ? (
                          <img 
                            src={resolveImageUrl(item.DP)} 
                            alt={item.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <PackageIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">{item.category}</span>
                          
                          {/* 3D Box Shape Stock Badge */}
                          <div className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-black font-mono tracking-wider flex items-center gap-1.5 transition-all duration-200 select-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_6px_-1px_rgba(0,0,0,0.6),0_2px_4px_-1px_rgba(0,0,0,0.4)] border-b-[3px] ${
                            isLowStock 
                              ? 'bg-gradient-to-b from-rose-500 via-rose-600 to-rose-800 text-white border-rose-400 border-b-rose-950 shadow-[0_4px_12px_rgba(244,63,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)]' 
                              : 'bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 text-white border-emerald-400 border-b-emerald-950 shadow-[0_4px_10px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                          }`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 shadow-xs ${isLowStock ? 'bg-white animate-ping' : 'bg-emerald-300'}`} />
                            <span>Stock: {stockInfo.availableStock}</span>
                            {isOutOfStock && (
                              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-black/50 text-rose-200 font-black tracking-normal">
                                স্টক শেষ
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="font-black text-base text-white group-hover:text-indigo-400 transition-colors truncate">
                          {item.name}
                        </h3>
                        
                        {/* Raw Items / Recipe Badge */}
                        {itemRecipe.length > 0 ? (
                          <div className="flex items-center space-x-1 mt-1 overflow-x-auto scrollbar-none">
                            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-[9px] font-bold text-indigo-300 tracking-wide truncate">
                              <ChefHat className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className="truncate">
                                {itemRecipe.map(r => `${r.rawItemName} ${r.quantity}${r.unit}`).join(', ')}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">READY TO SERVE</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 shrink-0">
                      <p className="text-xl font-black tracking-tighter text-white font-mono">৳{item.price}</p>
                      
                      <button 
                        type="button"
                        disabled={isOutOfStock}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!isOutOfStock) addToBasket(item); 
                        }} 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-sm transition-all duration-300 ${
                          isOutOfStock
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-rose-500/30 opacity-70'
                            : inBasket 
                            ? 'bg-[#4f46e5] text-white hover:bg-[#4338ca] hover:scale-110 cursor-pointer shadow-indigo-600/30' 
                            : 'bg-[#0f172a] text-white group-hover:bg-[#4f46e5] group-hover:scale-110 cursor-pointer'
                        }`}
                        title={isOutOfStock ? 'স্টক নেই - বিক্রি করা যাবে না' : 'Add to basket'}
                      >
                        {isOutOfStock ? (
                          <X className="w-5 h-5 text-rose-400" />
                        ) : (
                          <Plus className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Member Basket (Desktop) */}
          <div className="md:w-1/3">
            <div className="bg-slate-900 rounded-[2rem] border-t-4 border-t-[#4f46e5] shadow-sm border border-slate-800 min-h-[600px] flex flex-col sticky top-24">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800 rounded-t-[2rem]">
                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
                  <ShoppingCart className="w-4 h-4 text-indigo-500" />
                  <span>MEMBER BASKET</span>
                </h3>
                <span className="px-3 py-1 bg-[#4f46e5] text-white rounded-full text-[8px] font-black tracking-widest uppercase shadow-sm">
                  {basket.length} ITEMS
                </span>
              </div>
              
              <div className="p-6 border-b border-slate-800 relative z-10 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Sale Date</span>
                  </label>
                  <input 
                    type="date" 
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2 block">Billed To (Search Member)</label>
                  
                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedMembers.map(m => (
                        <span key={m.airman_id} className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-900/30 text-indigo-400 rounded-lg text-[10px] font-bold border border-indigo-500/20">
                          <span>{m['Rank']} {m['Surname']}</span>
                          <button onClick={() => setSelectedMembers(selectedMembers.filter(sm => sm.airman_id !== m.airman_id))} className="text-indigo-400 hover:text-indigo-300 ml-1">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input 
                      type="text" 
                      value={memberSearchTerm}
                      onChange={(e) => {
                        setMemberSearchTerm(e.target.value);
                        setShowMemberDropdown(true);
                      }}
                      onFocus={() => setShowMemberDropdown(true)}
                      onBlur={() => setTimeout(() => setShowMemberDropdown(false), 200)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Search Name or BD No..."
                    />
                    
                    {showMemberDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 z-50">
                        {memberSearchTerm === '' && recentMembers.length > 0 && (
                          <div className="px-4 py-2 bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Members</div>
                        )}
                        {(memberSearchTerm === '' ? recentMembers : members.filter(m => {
                          const name = m['Surname'] || '';
                          const bd = m['BD No'] || '';
                          return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || bd.includes(memberSearchTerm);
                        }).slice(0, 5)).map(m => (
                          <div 
                            key={m.airman_id} 
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (!selectedMembers.find(sm => sm.airman_id === m.airman_id)) {
                                setSelectedMembers([...selectedMembers, m]);
                              }
                              setMemberSearchTerm('');
                              setShowMemberDropdown(false);
                            }}
                            className="px-4 py-3 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700/50 last:border-0 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-bold text-white">{m['Rank']} {m['Surname']}</p>
                              <p className="text-[10px] text-slate-400">BD: {m['BD No']}</p>
                            </div>
                            <Plus className="w-4 h-4 text-slate-400" />
                          </div>
                        ))}
                        {memberSearchTerm !== '' && members.filter(m => {
                          const name = m['Surname'] || '';
                          const bd = m['BD No'] || '';
                          return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || bd.includes(memberSearchTerm);
                        }).length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center">No members found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                {basket.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <ShoppingCart className="w-10 h-10 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-50">Basket is empty</p>
                  </div>
                ) : (
                  basket.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-800">
                      <div className="flex-1 pr-4 flex items-center space-x-3 min-w-0">
                        {item.DP && (
                          <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden shrink-0 shadow-sm">
                            <img 
                              src={resolveImageUrl(item.DP)} 
                              alt={item.name} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-white leading-tight truncate">{getItemDisplayName(item, 'menu', canteenConfig).primary}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">৳{item.price} x {item.qty}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2 bg-slate-900 rounded-lg border border-slate-700 p-1">
                          <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button onClick={() => removeFromBasket(item.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-900/30 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-slate-800 rounded-b-[2rem] border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Amount</span>
                  <span className="text-2xl font-black text-white tracking-tighter">৳{basketTotal}</span>
                </div>
                <button 
                  onClick={handleCheckout}
                  disabled={basket.length === 0 || selectedMembers.length === 0}
                  className={`w-full py-4 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-md ${(basket.length > 0 && selectedMembers.length > 0) ? 'bg-emerald-900/30 hover:bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>COMPLETE SALE</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* MOBILE STICKY FLOATING BOTTOM BAR (md:hidden)            */}
      {/* ======================================================== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 shadow-2xl safe-area-bottom">
        {posMode === 'MENU_FIXED' ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">
                {batchSelectedMemberIds.size} জন নির্বাচিত • জনপ্রতি ৳{basketTotal}
              </p>
              <p className="text-base font-black text-emerald-400 font-mono">
                মোট: ৳{basketTotal * batchSelectedMemberIds.size}
              </p>
            </div>
            {basket.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowBatchMenuModal(true)}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 shadow-md active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>মেনু যোগ করুন</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut || batchSelectedMemberIds.size === 0}
                className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 shadow-md transition-all ${
                  (!isCheckingOut && batchSelectedMemberIds.size > 0)
                    ? 'bg-emerald-600 text-white active:scale-95 shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>কনফার্ম সেলস</span>
              </button>
            )}
          </div>
        ) : posMode === 'MEMBER_FIXED' ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 truncate">
                {fixedMember ? `${fixedMember['Surname']} • ` : 'সদস্য বাকি • '}{basket.length} আইটেম
              </p>
              <p className="text-base font-black text-emerald-400 font-mono">
                ৳{basketTotal}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>কার্ট ও চেকআউট ({basket.length})</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">
                {selectedMembers.length} সদস্য • {basket.length} আইটেম
              </p>
              <p className="text-base font-black text-emerald-400 font-mono">
                ৳{basketTotal}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>কার্ট দেখুন ({basket.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODE 1: BATCH MENU CATALOG PICKER MODAL                   */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showBatchMenuModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">ফিক্সড মেনু নির্বাচন করুন</h3>
                    <p className="text-[11px] text-slate-400">এই আইটেমগুলো সবার একাউন্টে বিল হিসেবে যোগ হবে</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchMenuModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Categories */}
              <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/60 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="মেনু আইটেম সার্চ করুন..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 max-h-[420px]">
                {filteredCatalog.map((item) => {
                  const inBasket = basket.find(b => b.id === item.id);
                  const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);
                  const isOutOfStock = stockInfo.availableStock <= 0;
                  const isLowStock = stockInfo.availableStock < 5;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all select-none ${
                        isOutOfStock
                          ? 'border-rose-600/80 bg-rose-950/20 shadow-[0_0_15px_rgba(239,68,68,0.3)] ring-1 ring-rose-500/40 opacity-70'
                          : isLowStock
                          ? 'border-rose-500 shadow-[0_0_18px_rgba(239,68,68,0.45)] ring-1 ring-rose-500/50 bg-slate-950/80'
                          : inBasket 
                          ? 'bg-indigo-950/30 border-indigo-500/60' 
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-black text-white truncate">{getItemDisplayName(item, 'menu', canteenConfig).primary}</p>

                          {/* 3D Box Shape Stock Badge */}
                          <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black font-mono tracking-wider flex items-center gap-1 transition-all select-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_-1px_rgba(0,0,0,0.6)] border-b-2 ${
                            isLowStock 
                              ? 'bg-gradient-to-b from-rose-500 to-rose-800 text-white border-rose-400 border-b-rose-950 shadow-[0_2px_8px_rgba(244,63,94,0.45)]' 
                              : 'bg-gradient-to-b from-emerald-600 to-emerald-900 text-white border-emerald-400 border-b-emerald-950 shadow-[0_2px_6px_rgba(16,185,129,0.35)]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLowStock ? 'bg-white animate-ping' : 'bg-emerald-300'}`} />
                            <span>Stock: {stockInfo.availableStock}</span>
                          </div>
                        </div>
                        <p className="text-[11px] font-mono text-indigo-400 font-bold">৳{item.price}</p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {inBasket ? (
                          <div className="flex items-center space-x-1.5 bg-slate-900 rounded-lg border border-slate-700 p-0.5">
                            <button onClick={() => updateQty(item.id, -1)} className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"><Minus className="w-3.5 h-3.5" /></button>
                            <span className="text-xs font-mono font-black text-white w-5 text-center">{inBasket.qty}</span>
                            <button 
                              disabled={inBasket.qty >= stockInfo.availableStock}
                              onClick={() => updateQty(item.id, 1)} 
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => {
                              if (!isOutOfStock) addToBasket(item);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 ${
                              isOutOfStock
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-rose-500/30'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-sm'
                            }`}
                          >
                            {isOutOfStock ? (
                              <span>স্টক নেই</span>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>যোগ</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs font-mono">
                  <span className="text-slate-400">জনপ্রতি ফিক্সড মূল্য: </span>
                  <strong className="text-emerald-400 text-sm font-black">৳{basketTotal}</strong>
                  <span className="text-slate-500 text-[10px] ml-1">({basket.length}টি আইটেম)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchMenuModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black tracking-wider uppercase transition-all shadow-md active:scale-95"
                >
                  সম্পন্ন করুন (Done)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MOBILE BOTTOM CART DRAWER SHEET (isMobileCartOpen)       */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isMobileCartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end justify-center md:hidden"
            onClick={() => setIsMobileCartOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border-t border-slate-800 rounded-t-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Drawer Grabber & Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {posMode === 'MEMBER_FIXED' ? 'মেম্বার অর্ডার কার্ট' : 'সেলস কার্ট ও চেকআউট'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode-Specific Member Context */}
              <div className="p-3 bg-slate-950 border-b border-slate-800/80 shrink-0 space-y-2">
                {posMode === 'MEMBER_FIXED' ? (
                  fixedMember ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{fixedMember['Rank']} {fixedMember['Surname']}</p>
                        <p className="text-[10px] text-slate-400 font-mono">BD: {fixedMember['BD No']} | পূর্ব বকেয়া: ৳{fixedMember.Due || 0}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded">
                        ফিক্সড মেম্বার
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400">⚠️ অনুগ্রহ করে প্রথমে সদস্য নির্বাচন করুন</p>
                  )
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">বিল প্রাপক সদস্য:</label>
                    {selectedMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMembers.map(m => (
                          <span key={m.airman_id} className="inline-flex items-center px-2 py-1 bg-indigo-950 border border-indigo-500/30 text-indigo-300 rounded text-[11px] font-bold">
                            <span>{m['Rank']} {m['Surname']}</span>
                            <button onClick={() => setSelectedMembers(selectedMembers.filter(sm => sm.airman_id !== m.airman_id))} className="ml-1 text-slate-400 hover:text-white">
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-400">⚠️ কোনো সদস্য নির্বাচিত নেই</p>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="p-3 overflow-y-auto space-y-2 flex-1">
                {basket.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">
                    <ShoppingCart className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider">কার্ট খালি</p>
                  </div>
                ) : (
                  basket.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{getItemDisplayName(item, 'menu', canteenConfig).primary}</p>
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
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">মোট বিক্রয় মূল্য:</span>
                  <span className="text-xl font-black text-white">৳{basketTotal}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={
                    isCheckingOut || 
                    basket.length === 0 || 
                    (posMode === 'MEMBER_FIXED' ? !fixedMember : selectedMembers.length === 0)
                  }
                  className={`w-full py-3.5 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-md ${
                    (!isCheckingOut && basket.length > 0 && (posMode === 'MEMBER_FIXED' ? !!fixedMember : selectedMembers.length > 0))
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>কনফার্ম সেলস (৳{basketTotal})</span>
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
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
              <div className="text-center">
                <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/30 shadow-inner">
                  <Trash2 className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Remove Record?</h3>
                <p className="text-sm font-bold text-slate-400 mb-6">
                  Are you sure you want to remove this history record? Member Due will be reversed, and both Catalog and RAW Material stocks (issue back) will be restored to store.
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    {/* History Modal - Mobile-First & High Visibility */}
    {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[2rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95">
                
                {/* Header (Sticky) */}
                <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                            <div className="p-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-xl">
                                <History className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">SALES HISTORY</h3>
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black">
                                        {filteredSalesHistory.length}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400">সর্বশেষ বিক্রয় বিবরণী ও কাঁচামাল সমন্বয়</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowHistoryModal(false)} 
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Filter & Search Bar for Mobile & Desktop */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text"
                                value={historySearchTerm}
                                onChange={(e) => setHistorySearchTerm(e.target.value)}
                                placeholder="সদস্য, BD No, আইটেম বা তারিখ খুঁজুন..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 outline-none"
                            />
                            {historySearchTerm && (
                                <button 
                                    onClick={() => setHistorySearchTerm('')} 
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Filter Tabs: ALL / TODAY */}
                        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 self-end sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setHistoryFilterType('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    historyFilterType === 'ALL'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                ALL ({salesHistory.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setHistoryFilterType('TODAY')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    historyFilterType === 'TODAY'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                TODAY
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Scrollable List Body */}
                <div className="p-3 sm:p-5 overflow-y-auto space-y-3 flex-1">
                    {filteredSalesHistory.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-6">
                            <History className="w-12 h-12 mx-auto opacity-20 mb-3" />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-300">কোনো হিস্টোরি রেকর্ড পাওয়া যায়নি</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                {historySearchTerm ? 'সার্চ ফিল্টারে কোনো ম্যাচ মেলেনি।' : 'নতুন কোনো সেল সম্পন্ন হলে এখানে তালিকা দেখা যাবে।'}
                            </p>
                        </div>
                    ) : (
                        filteredSalesHistory.map(tx => {
                            const m = members.find(mem => mem.airman_id === tx.airman_id);
                            const memberRank = tx.rank || (m ? m['Rank'] : '') || '';
                            const memberSurname = (m ? m['Surname'] : '') || tx.memberName || tx.airman_id;
                            const memberBdNo = tx.bdNo || (m ? m['BD No'] : '') || '';
                            
                            // Parse items for beautiful tag presentation
                            let parsedItemsList: Array<{ name: string; qty: number; price?: number }> = [];
                            if (tx.soldItems && Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
                                parsedItemsList = tx.soldItems.map((si: any) => ({
                                    name: si.menuItemName || si.name || 'Item',
                                    qty: Number(si.qty || si.quantity || 1),
                                    price: si.price
                                }));
                            } else if (tx.items) {
                                const parts = String(tx.items).split(/[,+;|\n]+/).map(s => s.trim()).filter(Boolean);
                                parsedItemsList = parts.map(part => {
                                    const parenMatch = part.match(/^(.+?)\s*\(\s*(\d+)\s*\)$/);
                                    if (parenMatch) {
                                        return { name: parenMatch[1].trim(), qty: parseInt(parenMatch[2], 10) };
                                    }
                                    const xMatch = part.match(/^(.+?)\s*[xX]\s*(\d+)$/);
                                    if (xMatch) {
                                        return { name: xMatch[1].trim(), qty: parseInt(xMatch[2], 10) };
                                    }
                                    return { name: part, qty: 1 };
                                });
                            }

                            return (
                                <div 
                                    key={tx.id} 
                                    className="bg-slate-800/85 hover:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-700/80 hover:border-slate-600 transition-all shadow-sm flex flex-col gap-2.5"
                                >
                                    {/* Top Line: Member Info & Date */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                                <span className="text-xs sm:text-sm font-black text-white">
                                                    {memberRank ? `${memberRank} ` : ''}{memberSurname}
                                                </span>
                                                {memberBdNo && (
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-indigo-300 font-mono text-[10px] font-bold">
                                                        BD: {memberBdNo}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                                                    tx.type === 'BILL PAYMENT'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                                }`}>
                                                    {tx.type || 'SALE'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Date & Time Badge */}
                                        <div className="text-right shrink-0">
                                            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
                                                {formatCanteenDate(tx.date)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Middle: Items List (Fully responsive chips, no overflow!) */}
                                    <div className="flex flex-wrap gap-1.5 py-1">
                                        {parsedItemsList.length > 0 ? (
                                            parsedItemsList.map((item, i) => (
                                                <span 
                                                    key={i} 
                                                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/70 text-slate-200 text-[11px] font-semibold"
                                                >
                                                    <span className="truncate max-w-[200px] sm:max-w-xs">{item.name}</span>
                                                    <span className="ml-1.5 px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono font-black text-[10px]">
                                                        x{item.qty}
                                                    </span>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-slate-400 text-xs font-semibold">
                                                {tx.items || 'No item details'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Bottom Line: Total Amount & Remove / Cancel Action */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                                        <div className="flex items-baseline space-x-1.5">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">মোট:</span>
                                            <span className="text-base sm:text-lg font-black text-rose-400 font-mono tracking-tight">
                                                ৳{tx.amount}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                ({tx.gateway || 'DUE'})
                                            </span>
                                        </div>

                                        {/* Delete Button - Touch Friendly & Clear */}
                                        <button 
                                            type="button"
                                            onClick={() => setTxDeleteConfirmId(tx.id)}
                                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 transition-all shadow-sm active:translate-y-0.5 cursor-pointer"
                                            title="রেকর্ড ডিলিট করুন এবং কাঁচামাল স্টকে ফেরত দিন"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>ডিলিট (Delete)</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Summary Bar */}
                {filteredSalesHistory.length > 0 && (
                    <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-slate-400 shrink-0">
                        <span>মোট রেকর্ড: <strong className="text-white">{filteredSalesHistory.length}টি</strong></span>
                        <span>সর্বমোট মূল্য: <strong className="text-emerald-400 text-sm">৳{filteredSalesHistory.reduce((sum, t) => sum + Number(t.amount || 0), 0).toLocaleString()}</strong></span>
                    </div>
                )}
            </div>
        
      
      {/* Toast Notification */}
      {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center space-x-3 animate-in slide-in-from-top-10 fade-in duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
      )}

    </div>
    )}
    </>
  );
};
