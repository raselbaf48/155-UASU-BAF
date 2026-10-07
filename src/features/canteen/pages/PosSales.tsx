import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, ShoppingCart, Minus, Trash2, CheckCircle2, X, History, Calendar, 
  Package as PackageIcon, Users, Utensils, CheckSquare, Check
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, getItemDisplayName, getCanteenConfig, CanteenConfig } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';
import { deductRawStockForSales, getRawInventoryItems, calculateMenuItemStockInfo, getMenuRecipes } from '../utils/recipeManager';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
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

  // Sale Date
  const [saleDate, setSaleDate] = useState(() => {
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

  // Members state
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

  const loadHistory = () => {
    const history = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    const onlySales = history.filter((tx: any) => isSaleTransaction(tx));
    setSalesHistory(onlySales);
    setShowHistoryModal(true);
  };

  const filteredSalesHistory = useMemo(() => {
    let list = salesHistory.filter((tx: any) => isSaleTransaction(tx));
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
    window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
    window.dispatchEvent(new Event('canteen_inventory_updated'));
    window.dispatchEvent(new Event('storage'));
    setTxDeleteConfirmId(null);

    setToastMessage('✅ Sale record removed and member due adjusted!');
    setTimeout(() => setToastMessage(''), 4000);
  };

  const addToBasket = (item: any) => {
    const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);
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

  const handleCheckout = async () => {
    if (isCheckingOut) return;

    if (basket.length === 0 || selectedMembers.length === 0) {
      setToastMessage('⚠️ Please select at least one menu item and one member!');
      setTimeout(() => setToastMessage(''), 3500);
      return;
    }

    const targetMembersList = selectedMembers;
    const perMemberAmount = basketTotal;
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
      deductRawStockForSales(itemsForDeduction);

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('storage'));

      const successMsg = `✅ Sale completed successfully for ${multiplier} member(s) (Total ৳${totalSalesAmount.toLocaleString()})!`;

      setToastMessage(successMsg);
      setTimeout(() => setToastMessage(''), 4000);

      // Clean up for next order
      setBasket([]);
      setSelectedMembers([]);
      setMemberSearchTerm('');
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
      <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-300 pb-28 md:pb-12 px-2 sm:px-4">
        
        {/* Top Header & History Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/70 p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-md">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">CANTEEN POS</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-black border border-indigo-500/30">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Point of Sale • Instant sales recording and due register</p>
          </div>

          <button 
            onClick={loadHistory}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700 rounded-2xl text-xs font-black tracking-wider uppercase transition-all shadow-sm cursor-pointer shrink-0"
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span>Sales History</span>
          </button>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          
          {/* Left Column: Menu Catalog (Narrow & Compact, No Raw Items Listed) */}
          <div className="w-full lg:w-[32%] xl:w-[28%] space-y-3.5 shrink-0">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {availableCategories.map((cat) => {
                const count = cat === 'ALL' 
                  ? catalog.length 
                  : catalog.filter(i => (i.category || 'SNACKS').toUpperCase() === cat).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Items List - Compact Cards with Disabled State for Out-Of-Stock */}
            <div className="space-y-2 max-h-[660px] overflow-y-auto pr-1">
              {filteredCatalog.map((item, i) => {
                const inBasket = basket.find(b => b.id === item.id);
                const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);
                const isOutOfStock = stockInfo.availableStock <= 0;
                const isLowStock = stockInfo.availableStock > 0 && stockInfo.availableStock < 5;

                // Name display according to Canteen Settings (Bengali if set in settings)
                const displayNameObj = getItemDisplayName(item, 'menu', canteenConfig);
                const primaryName = displayNameObj.primary || item.name;
                const secondaryName = displayNameObj.secondary;

                return (
                  <div 
                    key={item.id || i} 
                    onClick={() => {
                      if (!isOutOfStock) addToBasket(item);
                    }} 
                    className={`rounded-2xl p-2.5 flex items-center justify-between border transition-all duration-200 relative select-none group ${
                      isOutOfStock
                        ? 'border-slate-800 bg-slate-950/40 opacity-40 cursor-not-allowed'
                        : inBasket 
                        ? 'border-indigo-600 shadow-sm shadow-indigo-600/20 bg-slate-900 cursor-pointer hover:-translate-y-0.5' 
                        : 'border-slate-800 hover:border-indigo-500/50 bg-slate-900 cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-colors overflow-hidden shrink-0 border ${
                        isOutOfStock 
                          ? 'border-slate-800 bg-slate-950 text-slate-600' 
                          : inBasket 
                          ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-400' 
                          : 'border-slate-800/80 bg-slate-950 text-slate-400 group-hover:bg-slate-800 group-hover:text-indigo-300'
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
                          <PackageIcon className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1 mb-0.5">
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-wider">{item.category || 'MENU'}</span>
                          
                          {/* Stock Badge */}
                          {isOutOfStock ? (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black font-mono tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase">
                              OUT OF STOCK
                            </span>
                          ) : (
                            <div className={`px-1.5 py-0.2 rounded-md text-[9px] font-black font-mono tracking-wider flex items-center gap-1 select-none border-b ${
                              isLowStock 
                                ? 'bg-amber-700 text-white border-amber-900' 
                                : 'bg-emerald-700 text-white border-emerald-950'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLowStock ? 'bg-white animate-ping' : 'bg-emerald-300'}`} />
                              <span>Stock: {stockInfo.availableStock}</span>
                            </div>
                          )}
                        </div>

                        <h3 className={`font-black text-xs transition-colors truncate ${
                          isOutOfStock ? 'text-slate-500' : 'text-white group-hover:text-indigo-300'
                        }`}>
                          {primaryName}
                        </h3>
                        {secondaryName && (
                          <p className="text-[10px] text-slate-400 truncate">{secondaryName}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <p className={`text-sm font-black tracking-tight font-mono ${
                        isOutOfStock ? 'text-slate-500' : 'text-white'
                      }`}>
                        ৳{item.price}
                      </p>
                      
                      <button 
                        type="button"
                        disabled={isOutOfStock}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!isOutOfStock) addToBasket(item); 
                        }} 
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black shadow-sm transition-all ${
                          isOutOfStock
                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                            : inBasket 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 cursor-pointer shadow-indigo-600/30' 
                            : 'bg-slate-950 text-white group-hover:bg-indigo-600 group-hover:scale-105 cursor-pointer border border-slate-800'
                        }`}
                        title={isOutOfStock ? 'Out of stock' : 'Add to cart'}
                      >
                        {isOutOfStock ? (
                          <X className="w-3.5 h-3.5 text-slate-600" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Member Basket & Selection (Wide & Roomy) */}
          <div className="w-full lg:w-[68%] xl:w-[72%] space-y-4">
            <div className="bg-slate-900 rounded-[2rem] border-t-4 border-t-indigo-500 shadow-xl border border-slate-800 flex flex-col space-y-4 p-4 sm:p-6">
              
              {/* Basket Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                      MEMBER BASKET & CHECKOUT
                    </h3>
                    <p className="text-[11px] text-slate-400">Select order items and choose members to charge</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Sale Date Picker */}
                  <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <input 
                      type="date" 
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                    />
                  </div>

                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm">
                    {basket.length} ITEMS
                  </span>
                </div>
              </div>

              {/* Cart Items Strip / Preview */}
              <div className="bg-slate-950/70 rounded-2xl border border-slate-800/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Utensils className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Cart Items ({basket.length}) • Per Member: <strong className="text-emerald-400 text-sm font-mono font-black ml-1">৳{basketTotal}</strong></span>
                  </h4>
                  {basket.length > 0 && (
                    <button 
                      onClick={() => setBasket([])} 
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Clear Cart
                    </button>
                  )}
                </div>

                {basket.length === 0 ? (
                  <div className="py-4 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
                    <ShoppingCart className="w-6 h-6 mx-auto opacity-20 mb-1" />
                    <p className="text-xs font-bold text-slate-400">Cart is empty</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Select menu items from the catalog on the left</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                    {basket.map((item) => (
                      <div 
                        key={item.id} 
                        className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center space-x-2.5 shadow-xs"
                      >
                        <span className="text-xs font-bold text-white">{item.name}</span>
                        <span className="text-[11px] font-mono text-indigo-300 font-bold">৳{item.price}</span>
                        <div className="flex items-center space-x-1 bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                          <button onClick={() => updateQty(item.id, -1)} className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-mono font-black text-white w-4 text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button onClick={() => removeFromBasket(item.id)} className="text-slate-500 hover:text-rose-400 cursor-pointer p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Multiple Member Selection Section (Mode 1 style) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                      <Users className="w-5 h-5 text-indigo-400" />
                      <span>Select Members</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Select members to record this sale</p>
                  </div>

                  {/* Bulk Action Buttons */}
                  <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-y-1">
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

                {/* Search & Rank Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                      placeholder="Search by BD No, Rank, or Surname..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    {memberSearchTerm && (
                      <button 
                        onClick={() => setMemberSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Rank Filter Pills */}
                  <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none shrink-0">
                    {(['ALL', 'OFFICER', 'AIRMEN', 'CIVILIAN'] as const).map((r) => {
                      const count = r === 'ALL' ? members.length : r === 'OFFICER' ? officerCount : r === 'AIRMEN' ? airmenCount : civilianCount;
                      const label = r === 'ALL' ? 'ALL' : r === 'OFFICER' ? 'OFFICER' : r === 'AIRMEN' ? 'AIRMEN' : 'CIVILIAN';
                      const isSel = memberRankFilter === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setMemberRankFilter(r)}
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
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-4 flex-wrap gap-y-1 text-xs font-mono">
                    <span className="text-slate-400">
                      Selected: <strong className="text-indigo-400 text-sm">{selectedMembers.length} Members</strong>
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      Per Member: <strong className="text-white text-sm">৳{basketTotal}</strong>
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      Grand Total: <strong className="text-emerald-400 text-sm sm:text-base font-black">৳{(basketTotal * (selectedMembers.length || 0)).toLocaleString()}</strong>
                    </span>
                  </div>

                  {/* Quick Confirm button inside KPI strip */}
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isCheckingOut || basket.length === 0 || selectedMembers.length === 0}
                    className={`hidden md:flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-xs tracking-wider uppercase transition-all shadow-md ${
                      (!isCheckingOut && basket.length > 0 && selectedMembers.length > 0)
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Sale ({selectedMembers.length} Members • ৳{(basketTotal * selectedMembers.length).toLocaleString()})</span>
                  </button>
                </div>

                {/* Members Grid */}
                <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800 p-6">
                      <Users className="w-10 h-10 mx-auto opacity-20 mb-2" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-300">No Members Found</p>
                      <p className="text-[11px] text-slate-500 mt-1">Check search filters or try another rank category.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {filteredMembers.map((m, i) => {
                        const isSelected = selectedMembers.some((sm) => sm.airman_id === m.airman_id);
                        return (
                          <div
                            key={m.airman_id || `norm_${m['BD No'] || i}_${i}`}
                            onClick={() => toggleMember(m)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.98] ${
                              isSelected
                                ? 'bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/40'
                                : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-500 text-white' 
                                  : 'border-slate-700 bg-slate-950 text-transparent'
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
                                  <span className="text-[10px] font-mono font-bold text-amber-400">Due: ৳{m.Due || 0}</span>
                                </div>
                              </div>
                            </div>

                            {isSelected && basketTotal > 0 && (
                              <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
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

              {/* Total Calculation & Checkout Button (Bottom) */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <button 
                  onClick={handleCheckout}
                  disabled={isCheckingOut || basket.length === 0 || selectedMembers.length === 0}
                  className={`w-full py-4 rounded-2xl text-xs sm:text-sm font-black tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-lg ${
                    (!isCheckingOut && basket.length > 0 && selectedMembers.length > 0)
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer active:scale-95' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {isCheckingOut ? 'Processing Sale...' : `Confirm Sale (${selectedMembers.length} Members • Grand Total ৳${(basketTotal * (selectedMembers.length || 0)).toLocaleString()})`}
                  </span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MOBILE STICKY FLOATING BOTTOM BAR (md:hidden)            */}
        {/* ======================================================== */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 shadow-2xl safe-area-bottom">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">
                {selectedMembers.length} Members • {basket.length} Items
              </p>
              <p className="text-base font-black text-emerald-400 font-mono">
                ৳{(basketTotal * (selectedMembers.length || 0)).toLocaleString()}
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
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end justify-center md:hidden"
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
                  <button
                    type="button"
                    onClick={() => setIsMobileCartOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Total Sales Amount:</span>
                    <span className="text-xl font-black text-white">৳{(basketTotal * (selectedMembers.length || 0)).toLocaleString()}</span>
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
                    <span>Confirm Sale (৳{(basketTotal * (selectedMembers.length || 0)).toLocaleString()})</span>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal - Sales Records Only */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[2rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95">
            
            {/* Header */}
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
                    <p className="text-[10px] font-bold text-slate-400">Sales transactions only • Payment and settlement records excluded</p>
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

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    placeholder="Search by member, BD No, item, or date..."
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
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-300">No Sales Records Found</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {historySearchTerm ? 'No transactions match your search.' : 'Completed sales will appear here.'}
                  </p>
                </div>
              ) : (
                filteredSalesHistory.map(tx => {
                  const m = members.find(mem => mem.airman_id === tx.airman_id);
                  const memberRank = tx.rank || (m ? m['Rank'] : '') || '';
                  const memberSurname = (m ? m['Surname'] : '') || tx.memberName || tx.airman_id;
                  const memberBdNo = tx.bdNo || (m ? m['BD No'] : '') || '';
                  
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
                      {/* Top Line */}
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
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                              SALE
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
                            {formatCanteenDate(tx.date)}
                          </span>
                        </div>
                      </div>

                      {/* Middle Items Chips */}
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

                      {/* Bottom Line */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                        <div className="flex items-baseline space-x-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total:</span>
                          <span className="text-base sm:text-lg font-black text-rose-400 font-mono tracking-tight">
                            ৳{tx.amount}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({tx.gateway || 'DUE'})
                          </span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => setTxDeleteConfirmId(tx.id)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 transition-all shadow-sm active:translate-y-0.5 cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
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
                <span>Total Records: <strong className="text-white">{filteredSalesHistory.length}</strong></span>
                <span>Grand Total: <strong className="text-emerald-400 text-sm">৳{filteredSalesHistory.reduce((sum, t) => sum + Number(t.amount || 0), 0).toLocaleString()}</strong></span>
              </div>
            )}
          </div>
        </div>
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
