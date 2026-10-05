import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Utensils, Search, X, Check, ChefHat, Clock, Plus, XCircle, AlertTriangle, CheckCircle2,
  Layers, Filter, Sparkles, ChevronDown, ChevronUp, RefreshCw, Users, ArrowRight, Eye, Calendar, RotateCcw
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { 
  getCanteenConfig, resolveImageUrl, checkPreOrderWindow, CanteenConfig,
  getCuratedDailyMenu, saveCuratedDailyMenu, isDailyMenuExpired,
  CANTEEN_DAILY_MENU_KEY, CANTEEN_DAILY_MENU_TIMESTAMP_KEY 
} from '../utils/canteenSettings';
import { queuePushKeyToCloud } from '../utils/canteenCloudSync';
import { getCanteenMenuCache, fetchCanteenMenuOnce, getCanteenMembersCache, fetchCanteenMembersOnce } from '../utils/canteenMenuData';
import { formatCanteenDate } from '../utils/dateUtils';
import { deductRawStockForSales, restoreRawStockForSaleCancellation } from '../utils/recipeManager';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const data = [
  { name: 'Thu', total: 5001 },
  { name: 'Fri', total: 0 },
  { name: 'Sat', total: 0 },
  { name: 'Sun', total: 1500 },
  { name: 'Mon', total: 0 },
  { name: 'Tue', total: 0 },
  { name: 'Wed', total: 0 },
];

export const ManagerDashboard: React.FC = () => {
  const [showCurateMenu, setShowCurateMenu] = useState(false);
  const [members, setMembers] = useState<any[]>(() => {
    const cached = getCanteenMembersCache();
    return cached.map((m: any) => ({
      ...m,
      Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
      baki: Number(m.Due ?? m.due ?? m.baki ?? 0)
    }));
  });
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [preOrderTab, setPreOrderTab] = useState<'pending'|'completed'>('pending');
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'canteen_settings') {
        setCanteenConfig(getCanteenConfig());
      }
    };
    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setCanteenConfig(e.detail);
      } else {
        setCanteenConfig(getCanteenConfig());
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('canteen_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('canteen_settings_updated', handleSettingsUpdated);
    };
  }, []);
  const [catalog, setCatalog] = useState<any[]>(() => getCanteenMenuCache());
  const [selectedItems, setSelectedItems] = useState<string[]>(() => getCuratedDailyMenu());
  const [preOrders, setPreOrders] = useState<any[]>([]);
  const [searchCatalog, setSearchCatalog] = useState('');

  // Menu-wise Pre-Order Summary States
  const [summaryFilter, setSummaryFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [summaryTimeframe, setSummaryTimeframe] = useState<'today' | 'all'>('today');
  const [summarySearch, setSummarySearch] = useState('');
  const [expandedMenuKey, setExpandedMenuKey] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
    fetchCatalog();
    loadDailyMenu();
    loadPreOrders();
    
    // Set up an interval to refresh pre-orders and check curated menu 12:00 PM auto-reset
    const interval = setInterval(() => {
      loadDailyMenu();
      loadPreOrders();
    }, 10000);

    const handleSync = () => {
      loadDailyMenu();
      loadPreOrders();
    };

    window.addEventListener('canteen_daily_menu_updated', handleSync);
    window.addEventListener('canteen_pre_orders_updated', handleSync);
    window.addEventListener('canteen_menu_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('canteen_daily_menu_updated', handleSync);
      window.removeEventListener('canteen_pre_orders_updated', handleSync);
      window.removeEventListener('canteen_menu_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
    };
  }, []);

  const fetchMembers = async () => {
    try {
      const data = await fetchCanteenMembersOnce();
      if (data && data.length > 0) {
        setMembers(data.map((m: any) => ({
          ...m,
          Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
          baki: Number(m.Due ?? m.due ?? m.baki ?? 0)
        })));
      }
    } catch (err) {
      console.warn("Error in ManagerDashboard fetchMembers:", err);
    }
  };

  const fetchCatalog = async () => {
    try {
      const data = await fetchCanteenMenuOnce();
      if (data && data.length > 0) {
        setCatalog(data);
      }
    } catch (e) {
      console.warn("Error in ManagerDashboard fetchCatalog:", e);
    }
  };

  const loadDailyMenu = () => {
    // getCuratedDailyMenu automatically enforces 12:00 PM daily auto-reset
    const ids = getCuratedDailyMenu();
    setSelectedItems(ids);
  };

  const loadPreOrders = () => {
      const stored = localStorage.getItem('canteen_pre_orders');
      if (stored) {
          try { 
              const parsed = JSON.parse(stored);
              setPreOrders(parsed.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); 
          } catch(e){}
      }
  };

  const toggleSelection = (id: string) => {
      setSelectedItems(prev => {
          const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
          saveCuratedDailyMenu(next);
          queuePushKeyToCloud('canteen_daily_menu', next, 50);
          queuePushKeyToCloud('canteen_daily_menu_updated_at', new Date().toISOString(), 50);
          return next;
      });
  };

  const selectAllDailyItems = () => {
      const allIds = catalog.map(i => i.id);
      setSelectedItems(allIds);
      saveCuratedDailyMenu(allIds);
      queuePushKeyToCloud('canteen_daily_menu', allIds, 50);
      queuePushKeyToCloud('canteen_daily_menu_updated_at', new Date().toISOString(), 50);
  };

  const clearAllDailyItems = () => {
      setSelectedItems([]);
      saveCuratedDailyMenu([]);
      queuePushKeyToCloud('canteen_daily_menu', [], 50);
      queuePushKeyToCloud('canteen_daily_menu_updated_at', new Date().toISOString(), 50);
  };



  const { t, i18n } = useTranslation();
  const [manualBd, setManualBd] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualItemId, setManualItemId] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState('');

  const handleManualPreOrder = () => {
      if (selectedMembers.length === 0 || !manualItemId) return;
      const item = catalog.find(i => i.id === manualItemId);
      if (!item) return;

      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}

      selectedMembers.forEach((m, idx) => {
          const newOrder = {
              orderId: 'PO-' + Date.now() + '-' + idx,
              timestamp: new Date().toISOString(),
              memberId: m['BD No'],
              memberName: m['Rank'] + ' ' + m['Surname'],
              items: [{ id: item.id, name: item.name, qty: manualQty, price: item.price }],
              total: item.price * manualQty,
              status: 'pending'
          };
          existing.push(newOrder);
      });

      localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
      window.dispatchEvent(new Event('canteen_pre_orders_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      
      const parsed = existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);

      setSelectedMembers([]);
      setMemberSearchTerm('');
      setManualItemId('');
      setManualQty(1);
  };
  
  const handleRevertPreOrder = async (order: any) => {
      const cleanOrderBd = String(order.memberId || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      let member = members.find(m => {
          const mBd = String(m['BD No'] || '').replace(/^BD\/?/i, '').trim().toLowerCase();
          const mAid = String(m.airman_id || '').replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim().toLowerCase();
          return mBd === cleanOrderBd || mAid === cleanOrderBd || String(m['BD No']) === String(order.memberId);
      });
      if (member) {
          const currentDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
          const newDue = Math.max(0, currentDue - order.total);
          await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', member.airman_id);
      }
      
      // Restore raw stock for sales cancellation
      if (order.items && order.items.length > 0) {
        restoreRawStockForSaleCancellation(order.items.map((i: any) => ({
          name: i.name,
          quantity: i.qty || 1
        })));
      }
      
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const updatedTxs = txs.filter((t: any) => t.orderId !== order.orderId && t.id !== 'tx-po-' + order.orderId);
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.map((p: any) => p.orderId === order.orderId ? {...p, status: 'pending'} : p);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
      fetchMembers();
      fetchCatalog();

      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('baf_state_updated'));
      window.dispatchEvent(new Event('storage'));
  };

  const handleCompletePreOrder = async (order: any) => {
      // Find member
      const cleanOrderBd = String(order.memberId || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      let member = members.find(m => {
          const mBd = String(m['BD No'] || '').replace(/^BD\/?/i, '').trim().toLowerCase();
          const mAid = String(m.airman_id || '').replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim().toLowerCase();
          return mBd === cleanOrderBd || mAid === cleanOrderBd || String(m['BD No']) === String(order.memberId);
      });
      if (!member) {
          try {
              const { data } = await supabase.from('Canteen_Member').select('*').or(`"BD No".eq.${cleanOrderBd},airman_id.eq.${cleanOrderBd},airman_id.eq.airman-${cleanOrderBd}`).limit(1);
              if (data && data.length > 0) {
                  member = data[0];
              }
          } catch(e) {}
      }
      if (!member) {
          alert('Member not found!');
          return;
      }
      
      // Update Due
      const currentDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
      const newDue = currentDue + order.total;
      await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', member.airman_id);
      
      // Deduct raw material stock for sale
      if (order.items && order.items.length > 0) {
        deductRawStockForSales(order.items.map((i: any) => ({
          name: i.name,
          quantity: i.qty || 1
        })));
      }
      
      // Record transaction
      const memberName = [member.rank || member.Rank, member.name || member.surname || member.Surname].filter(Boolean).join(' ') || member['BD No'] || order.memberName || order.memberId;
      const tx = {
          id: 'tx-po-' + order.orderId,
          date: formatCanteenDate(new Date()),
          airman_id: member.airman_id,
          bdNo: member['BD No'] || order.memberId,
          memberName: memberName,
          rank: member.rank || member.Rank || '',
          items: order.items.map((i: any) => `${i.name} (${i.qty})`).join(', '),
          amount: Number(order.total || 0),
          type: 'SALE',
          gateway: 'DUE',
          orderId: order.orderId,
          isPreOrder: true,
          preOrderCompleted: true
      };
      const existingTx = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const filteredTxs = existingTx.filter((t: any) => t.orderId !== order.orderId && t.id !== tx.id);
      localStorage.setItem('canteen_txs', JSON.stringify([tx, ...filteredTxs]));
      
      // Update order status
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.map((p: any) => p.orderId === order.orderId ? {...p, status: 'completed', completedAt: new Date().toISOString()} : p);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
      
      // Refresh local state to reflect baki and stock
      fetchMembers();
      fetchCatalog();

      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('baf_state_updated'));
      window.dispatchEvent(new Event('storage'));
  };

  const handleCancelPreOrder = () => {
      if (!cancelConfirmId) return;
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.filter((o: any) => o.orderId !== cancelConfirmId);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      window.dispatchEvent(new Event('canteen_pre_orders_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
      setCancelConfirmId(null);
  };
  
  const todayStr = new Date().toDateString();
  const todaysPreOrders = preOrders.filter(po => new Date(po.timestamp).toDateString() === todayStr);

  const relevantOrders = summaryTimeframe === 'today' ? todaysPreOrders : preOrders;

  const menuWiseSummary = useMemo(() => {
    const map = new Map<string, {
      key: string;
      id: string;
      name: string;
      category: string;
      price: number;
      image?: string;
      totalQty: number;
      pendingQty: number;
      completedQty: number;
      totalAmount: number;
      ordersCount: number;
      orders: {
        orderId: string;
        memberId: string;
        memberName: string;
        qty: number;
        price: number;
        total: number;
        status: 'pending' | 'completed';
        timestamp: string;
        rawOrder: any;
      }[];
    }>();

    // 1. Pre-seed with currently curated menu items so each curated menu has its row
    if (Array.isArray(selectedItems)) {
      selectedItems.forEach((itemId) => {
        const catItem = catalog.find(c => c.id === itemId);
        if (catItem) {
          const key = catItem.id;
          map.set(key, {
            key,
            id: catItem.id,
            name: catItem.name,
            category: catItem.category || 'SNACKS',
            price: Number(catItem.price || 0),
            image: catItem.DP || catItem.img || catItem.image || catItem.photo,
            totalQty: 0,
            pendingQty: 0,
            completedQty: 0,
            totalAmount: 0,
            ordersCount: 0,
            orders: []
          });
        }
      });
    }

    relevantOrders.forEach((order: any) => {
      if (!Array.isArray(order.items)) return;
      order.items.forEach((item: any) => {
        const rawName = String(item.name || '').trim();
        const rawId = String(item.id || '').trim();
        const key = rawId || rawName.toLowerCase();
        if (!key) return;

        const catItem = catalog.find(c => c.id === item.id || (c.name && rawName && c.name.trim().toLowerCase() === rawName.toLowerCase()));
        const category = catItem?.category || 'SNACKS';
        const price = Number(item.price !== undefined ? item.price : (catItem?.price || 0));
        const image = catItem?.DP || catItem?.img || catItem?.image || catItem?.photo;
        const qty = Number(item.qty) || 1;
        const isPending = order.status === 'pending';

        if (!map.has(key)) {
          map.set(key, {
            key,
            id: catItem?.id || item.id || key,
            name: catItem?.name || item.name || 'Unknown Item',
            category,
            price,
            image,
            totalQty: 0,
            pendingQty: 0,
            completedQty: 0,
            totalAmount: 0,
            ordersCount: 0,
            orders: []
          });
        }

        const entry = map.get(key)!;
        entry.totalQty += qty;
        if (isPending) {
          entry.pendingQty += qty;
        } else {
          entry.completedQty += qty;
        }
        entry.totalAmount += (qty * price);
        entry.ordersCount += 1;
        entry.orders.push({
          orderId: order.orderId,
          memberId: order.memberId,
          memberName: order.memberName,
          qty,
          price,
          total: qty * price,
          status: order.status,
          timestamp: order.timestamp,
          rawOrder: order
        });
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [relevantOrders, catalog, selectedItems]);

  const filteredMenuSummary = useMemo(() => {
    return menuWiseSummary.filter(item => {
      if (summaryFilter === 'pending' && item.pendingQty <= 0) return false;
      if (summaryFilter === 'completed' && item.completedQty <= 0) return false;
      if (summarySearch && !item.name.toLowerCase().includes(summarySearch.toLowerCase())) return false;
      return true;
    });
  }, [menuWiseSummary, summaryFilter, summarySearch]);

  const totalSummaryUnits = menuWiseSummary.reduce((sum, item) => sum + item.totalQty, 0);
  const totalSummaryPendingUnits = menuWiseSummary.reduce((sum, item) => sum + item.pendingQty, 0);
  const totalSummaryCompletedUnits = menuWiseSummary.reduce((sum, item) => sum + item.completedQty, 0);
  const totalSummaryRevenue = menuWiseSummary.reduce((sum, item) => sum + item.totalAmount, 0);


  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Curate Daily Menu Modal */}
      {showCurateMenu && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                  <button onClick={() => setShowCurateMenu(false)} className="absolute top-6 right-6 p-2 bg-slate-800 hover:bg-slate-200 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-400" />
                  </button>
                  
                  <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-3">
                          <ChefHat className="w-6 h-6 text-[#4f46e5]" />
                          <div>
                              <h2 className="text-xl font-black text-white uppercase tracking-widest">Curate Daily Menu</h2>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selected: {selectedItems.length} items</p>
                          </div>
                      </div>
                      <div className="flex items-center space-x-2 mr-10">
                          <button
                              type="button"
                              onClick={selectAllDailyItems}
                              className="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                          >
                              Select All ({catalog.length})
                          </button>
                          <button
                              type="button"
                              onClick={clearAllDailyItems}
                              className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                          >
                              Clear All
                          </button>
                      </div>
                  </div>

                  <div className="relative mb-4">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                          type="text"
                          placeholder="Search catalog..."
                          value={searchCatalog}
                          onChange={(e) => setSearchCatalog(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-bold text-slate-200 outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                      />
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
                      {catalog.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                              <Utensils className="w-10 h-10 mb-3 opacity-20" />
                              <p className="text-xs font-bold uppercase tracking-widest">No items in catalog</p>
                          </div>
                      ) : (
                          [...catalog].sort((a, b) => {
                              const aSel = Array.isArray(selectedItems) && selectedItems.includes(a.id);
                              const bSel = Array.isArray(selectedItems) && selectedItems.includes(b.id);
                              if (aSel && !bSel) return -1;
                              if (!aSel && bSel) return 1;
                              return (a.name || '').localeCompare(b.name || '');
                          }).filter(i => (i.name || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => {
                              const isSelected = Array.isArray(selectedItems) && selectedItems.includes(item.id);
                              const itemDp = resolveImageUrl(item.DP || item.img || item.image || item.photo);
                          return (
                              <div 
                                  key={item.id} 
                                  onClick={() => toggleSelection(item.id)}
                                  className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#4f46e5] bg-[#4f46e5]/10 shadow-lg shadow-indigo-950/40' : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'}`}
                              >
                                  <div className="flex items-center space-x-3.5 min-w-0">
                                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all overflow-hidden shrink-0 border ${isSelected ? 'border-indigo-500/50 bg-indigo-950/50' : 'border-slate-800 bg-slate-900'}`}>
                                          {itemDp ? (
                                              <img 
                                                  src={itemDp} 
                                                  alt={item.name} 
                                                  referrerPolicy="no-referrer"
                                                  className="w-full h-full object-cover" 
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                              />
                                          ) : (
                                              <Utensils className={`w-5 h-5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                                          )}
                                      </div>
                                      <div className="min-w-0">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category || 'Snacks'}</p>
                                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                                          <p className="text-xs font-black text-emerald-400">৳{item.price}</p>
                                      </div>
                                  </div>
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-[#4f46e5] text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                                      {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-lg leading-none">+</span>}
                                  </div>
                              </div>
                          )
                      })
                  )}
                  </div>


              </div>
          </div>
      )}
      
      {/* Top Banner (Manager Style) */}
      <div className="bg-[#0f172a] rounded-[2rem] p-12 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
         {/* Faint background decoration */}
         <div className="absolute left-10 top-1/2 -translate-y-1/2 opacity-5 hidden md:block">
            <Utensils className="w-64 h-64 text-white" />
         </div>
         <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-5 hidden md:block transform scale-x-[-1]">
            <Utensils className="w-64 h-64 text-white" />
         </div>

         <div className="z-10 flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center p-2 border border-slate-700 shadow-inner overflow-hidden">
               {canteenConfig.logoUrl ? (
                  <img 
                    src={resolveImageUrl(canteenConfig.logoUrl)} 
                    alt="Logo" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain opacity-90" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                  />
               ) : (
                  <Utensils className="w-8 h-8 text-[#4f46e5]" />
               )}
            </div>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-wider sm:tracking-widest flex items-center justify-center whitespace-nowrap text-center px-2">
               <span>{canteenConfig.name || '🍽️ CAFE UAV 🍽️'}</span>
            </h2>
            <p className="text-[10px] sm:text-xs tracking-widest text-slate-400 font-bold uppercase pb-1">Eat Good Food, Serve Good!</p>
         </div>
      </div>

      {/* Centered Pre-Order Content & Separate Boxes */}
      <div className="max-w-4xl mx-auto w-full space-y-6">
         {/* 1. MENU BOX */}
         <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
               <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                     <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-white tracking-widest uppercase">
                        TODAY'S MENU
                     </h3>
                     <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-[11px] text-slate-400 font-medium">
                           Items curated and available for order today
                        </p>
                        {(() => {
                           const timeStatus = checkPreOrderWindow(canteenConfig);
                           return (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase inline-flex items-center space-x-1 ${
                                 timeStatus.isOpen 
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' 
                                    : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                              }`}>
                                 <span className={`w-1.5 h-1.5 rounded-full ${timeStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                                 <span>{timeStatus.isOpen ? `Active (${timeStatus.startTime} - ${timeStatus.endTime})` : `Closed (${timeStatus.startTime} - ${timeStatus.endTime})`}</span>
                              </span>
                           );
                        })()}
                     </div>
                  </div>
               </div>
               <div className="flex items-center space-x-2 self-start sm:self-auto">
                  {selectedItems.length > 0 && (
                     <button 
                        type="button"
                        onClick={clearAllDailyItems}
                        title="Clear Curated Menu"
                        className="px-3 py-2.5 bg-rose-950/70 hover:bg-rose-900/90 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer shadow-md shadow-rose-950/30"
                     >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                     </button>
                  )}
                  <button 
                     onClick={() => setShowCurateMenu(true)} 
                     className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center space-x-2 active:scale-95 cursor-pointer"
                  >
                     <ChefHat className="w-4 h-4" />
                     <span>CURATE MENU ({selectedItems.length})</span>
                  </button>
               </div>
            </div>

            {/* Curated Menu Items */}
            {(!selectedItems || selectedItems.length === 0) ? (
               <div className="py-8 px-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col items-center justify-center text-center">
                  <Utensils className="w-10 h-10 text-slate-600 mb-2" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">No menu items curated for today</p>
                  <button 
                     onClick={() => setShowCurateMenu(true)}
                     className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                  >
                     Click here to curate today's menu
                  </button>
               </div>
            ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 w-full py-2">
                  {catalog.filter(i => selectedItems.includes(i.id)).map(item => {
                     const itemDp = resolveImageUrl(item.DP || item.img || item.image || item.photo);
                     return (
                        <div 
                           key={item.id} 
                           className="bg-slate-950/90 border border-slate-800 hover:border-indigo-500/50 shadow-md p-3.5 rounded-2xl flex items-center space-x-3.5 transition-all hover:scale-[1.01]"
                        >
                           <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0">
                              {itemDp ? (
                                 <img 
                                    src={itemDp} 
                                    alt={item.name} 
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover" 
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                 />
                              ) : (
                                 <Utensils className="w-5 h-5 text-indigo-400" />
                              )}
                           </div>
                           <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest truncate">{item.category || 'SNACKS'}</p>
                              <span className="text-white font-black text-sm tracking-wide uppercase truncate block">
                                 {item.name}
                              </span>
                              <p className="text-xs font-black text-emerald-400">৳{item.price}</p>
                           </div>
                        </div>
                     );
                  })}
               </div>
            )}
         </div>

         {/* 2. TOTAL PRE-ORDERS BOX */}
         <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col space-y-5">
            <div className="flex items-center justify-between mb-2">
               <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                     <Clock className="w-5 h-5" />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-white tracking-widest uppercase">
                        TOTAL PRE-ORDERS
                     </h3>
                     <p className="text-[11px] text-slate-400 font-medium">
                        Live summary of today's and all active pre-orders
                     </p>
                  </div>
               </div>
               <div className="bg-indigo-500/20 text-indigo-400 px-3.5 py-1.5 rounded-full text-xs font-black">
                  Today: {todaysPreOrders.length}
               </div>
            </div>

            {/* Menu-wise Pre-Order Rows */}
            <div className="space-y-3.5">
               {menuWiseSummary.length === 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                     <div className="col-span-2 sm:col-span-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-center space-x-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                           <Utensils className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Menu</p>
                           <p className="text-xs font-bold text-slate-400">No Pre-Orders</p>
                        </div>
                     </div>
                     <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Today's Orders</p>
                        <h4 className="text-2xl sm:text-3xl font-black text-white">0</h4>
                     </div>
                     <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Pending</p>
                        <h4 className="text-2xl sm:text-3xl font-black text-amber-400">0</h4>
                     </div>
                     <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Completed</p>
                        <h4 className="text-2xl sm:text-3xl font-black text-emerald-400">0</h4>
                     </div>
                     <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Today's Value</p>
                        <h4 className="text-2xl sm:text-3xl font-black text-indigo-400">৳0</h4>
                     </div>
                  </div>
               ) : (
                  menuWiseSummary.map((menu) => {
                     const itemDp = resolveImageUrl(menu.image);
                     return (
                        <div key={menu.key} className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                           {/* 1. Menu Box (Before Today's Orders) */}
                           <div className="col-span-2 sm:col-span-1 bg-slate-950/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-3 sm:p-3.5 flex items-center space-x-3 text-left transition-all shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                 {itemDp ? (
                                    <img
                                       src={itemDp}
                                       alt={menu.name}
                                       referrerPolicy="no-referrer"
                                       className="w-full h-full object-cover"
                                       onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                 ) : (
                                    <Utensils className="w-6 h-6 text-indigo-400" />
                                 )}
                              </div>
                              <div className="min-w-0 flex-1">
                                 <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest truncate">{menu.category || 'SNACKS'}</p>
                                 <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate" title={menu.name}>
                                    {menu.name}
                                 </h4>
                                 <p className="text-[11px] font-bold text-emerald-400">৳{menu.price}</p>
                              </div>
                           </div>

                           {/* 2. Today's Orders */}
                           <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Today's Orders</p>
                              <h4 className="text-2xl sm:text-3xl font-black text-white">{menu.totalQty}</h4>
                           </div>

                           {/* 3. Pending */}
                           <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Pending</p>
                              <h4 className="text-2xl sm:text-3xl font-black text-amber-400">{menu.pendingQty}</h4>
                           </div>

                           {/* 4. Completed */}
                           <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Completed</p>
                              <h4 className="text-2xl sm:text-3xl font-black text-emerald-400">{menu.completedQty}</h4>
                           </div>

                           {/* 5. Today's Value */}
                           <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Today's Value</p>
                              <h4 className="text-2xl sm:text-3xl font-black text-indigo-400">৳{menu.totalAmount}</h4>
                           </div>
                        </div>
                     );
                  })
               )}

               {/* Multiple Menus Total Aggregate Row */}
               {menuWiseSummary.length > 1 && (
                  <div className="pt-2 border-t border-slate-800/80">
                     <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                        <div className="col-span-2 sm:col-span-1 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-3 flex items-center justify-center space-x-2 text-indigo-300 font-black text-xs uppercase tracking-wider">
                           <Layers className="w-4 h-4 text-indigo-400" />
                           <span>TOTAL ({menuWiseSummary.length} Menus)</span>
                        </div>
                        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Qty</p>
                           <h4 className="text-xl font-black text-white">{totalSummaryUnits}</h4>
                        </div>
                        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center">
                           <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Total Pending</p>
                           <h4 className="text-xl font-black text-amber-400">{totalSummaryPendingUnits}</h4>
                        </div>
                        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center">
                           <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Total Completed</p>
                           <h4 className="text-xl font-black text-emerald-400">{totalSummaryCompletedUnits}</h4>
                        </div>
                        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center">
                           <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Total Value</p>
                           <h4 className="text-xl font-black text-indigo-400">৳{totalSummaryRevenue}</h4>
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* 3. MANUAL PRE-ORDER BOX */}
         <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col">
            <div className="flex items-center space-x-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Plus className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white tracking-widest uppercase">
                     MANUAL PRE-ORDER
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                     Create pre-order on behalf of airmen or canteen members
                  </p>
               </div>
            </div>

            <div className="space-y-4">
               {/* Selected Members Chips */}
               {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider self-center mr-1">
                        Selected ({selectedMembers.length}):
                     </span>
                     {selectedMembers.map(m => (
                        <span key={m.airman_id} className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-950/60 text-indigo-300 rounded-lg text-xs font-bold border border-indigo-500/30">
                           <span>{m['Rank']} {m['Surname']} (BD: {m['BD No']})</span>
                           <button 
                              type="button"
                              onClick={() => setSelectedMembers(selectedMembers.filter(sm => sm.airman_id !== m.airman_id))} 
                              className="text-indigo-400 hover:text-white transition-colors ml-1 p-0.5"
                           >
                              <X className="w-3.5 h-3.5" />
                           </button>
                        </span>
                     ))}
                  </div>
               )}

               {/* Member Search with Autocomplete */}
               <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                     <Search className="w-4 h-4" />
                  </div>
                  <input 
                     type="text" 
                     placeholder="Search Member by Name or BD No..." 
                     value={memberSearchTerm} 
                     onChange={e => {
                        setMemberSearchTerm(e.target.value);
                        setShowMemberDropdown(true);
                     }}
                     onFocus={() => setShowMemberDropdown(true)}
                     onBlur={() => setTimeout(() => setShowMemberDropdown(false), 250)}
                     className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500" 
                  />
                  {showMemberDropdown && (
                     <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50 divide-y divide-slate-800">
                        {members.filter(m => {
                           const name = m['Surname'] || '';
                           const bd = m['BD No'] || '';
                           return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || String(bd).includes(memberSearchTerm);
                        }).slice(0, 10).map(m => (
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
                              className="px-4 py-3 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
                           >
                              <div>
                                 <p className="text-xs font-bold text-white">{m['Rank']} {m['Surname']}</p>
                                 <p className="text-[10px] text-slate-400">BD No: {m['BD No']}</p>
                              </div>
                              <span className="p-1 bg-indigo-500/10 text-indigo-400 rounded-lg">
                                 <Plus className="w-4 h-4" />
                              </span>
                           </div>
                        ))}
                        {memberSearchTerm !== '' && members.filter(m => {
                           const name = m['Surname'] || '';
                           const bd = m['BD No'] || '';
                           return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || String(bd).includes(memberSearchTerm);
                        }).length === 0 && (
                           <div className="px-4 py-3 text-xs text-slate-400 text-center">No members found</div>
                        )}
                     </div>
                  )}
               </div>

               {/* Item & Quantity Selector */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                     <select 
                        value={manualItemId} 
                        onChange={e => setManualItemId(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500 transition-all"
                     >
                        <option value="">Select Item</option>
                        {catalog.filter(i => selectedItems.includes(i.id)).map(i => (
                           <option key={i.id} value={i.id}>{i.name} - ৳{i.price}</option>
                        ))}
                     </select>
                  </div>

                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
                     <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">Qty:</span>
                     <input 
                        type="number" 
                        min="1" 
                        value={manualQty} 
                        onChange={e => setManualQty(Math.max(1, Number(e.target.value) || 1))} 
                        className="w-full bg-transparent text-sm font-bold text-slate-200 outline-none"
                     />
                  </div>

                  <button 
                     type="button"
                     onClick={handleManualPreOrder} 
                     disabled={selectedMembers.length === 0 || !manualItemId}
                     className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-widest uppercase py-3.5 transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
                  >
                     Add Pre-Order
                  </button>
               </div>
            </div>
         </div>

         {/* 5. LIVE PRE-ORDERS TABLE */}
         <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
               <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                     <Clock className="w-5 h-5" />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-white tracking-widest uppercase">
                        LIVE PRE-ORDERS
                     </h3>
                     <p className="text-[11px] text-slate-400 font-medium">
                        Real-time tracking of pending and completed orders
                     </p>
                  </div>
               </div>
               <div className="flex bg-slate-950 p-1 rounded-full border border-slate-800 self-start sm:self-auto">
                  <button 
                     type="button"
                     onClick={() => setPreOrderTab('pending')} 
                     className={`px-4 py-1.5 rounded-full text-xs uppercase font-bold transition-all cursor-pointer ${preOrderTab === 'pending' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                     Pending ({preOrders.filter(p => p.status === 'pending').length})
                  </button>
                  <button 
                     type="button"
                     onClick={() => setPreOrderTab('completed')} 
                     className={`px-4 py-1.5 rounded-full text-xs uppercase font-bold transition-all cursor-pointer ${preOrderTab === 'completed' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                     Completed ({preOrders.filter(p => p.status === 'completed').length})
                  </button>
               </div>
            </div>

            {preOrders.length === 0 ? (
               <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center">
                  <Clock className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">No Pre-Orders Yet</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b border-slate-800">
                           <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                           <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member</th>
                           <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                           <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                           <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                           <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                           <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800">
                        {preOrders.filter((order: any) => order.status === preOrderTab).map((order: any, idx: number) => (
                           <tr key={idx} className="hover:bg-slate-950/60 transition-colors">
                              <td className="py-4 px-4 text-xs font-bold text-slate-400">
                                 {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </td>
                              <td className="py-4 px-4">
                                 <div className="text-xs font-bold text-white">{order.memberName}</div>
                                 <div className="text-[10px] font-bold text-slate-400">BD: {order.memberId}</div>
                              </td>
                              <td className="py-4 px-4">
                                 <div className="flex flex-col gap-1">
                                    {order.items.map((it:any, i:number) => (
                                       <span key={i} className="text-slate-300 text-xs font-bold whitespace-nowrap">
                                          {it.name}
                                       </span>
                                    ))}
                                 </div>
                              </td>
                              <td className="py-4 px-4">
                                 <div className="flex flex-col gap-1">
                                    {order.items.map((it:any, i:number) => (
                                       <span key={i} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold w-fit text-center min-w-[24px]">
                                          {it.qty}
                                       </span>
                                    ))}
                                 </div>
                              </td>
                              <td className="py-4 px-4 text-xs font-black text-[#4f46e5]">৳{order.total}</td>
                              <td className="py-4 px-4">
                                 <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'pending' ? 'bg-amber-950/50 text-amber-400 border border-amber-500/20' : 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20'}`}>
                                    {order.status}
                                 </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                 {order.status === 'pending' ? (
                                    <div className="flex items-center justify-end space-x-2">
                                       <button 
                                          type="button"
                                          onClick={() => {
                                             handleCompletePreOrder(order);
                                             alert('Order completed successfully!');
                                          }}
                                          title="Mark Done"
                                          className="p-2 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded-xl transition-colors flex items-center justify-center border border-emerald-500/20 cursor-pointer"
                                       >
                                          <CheckCircle2 className="w-4 h-4" />
                                       </button>
                                       <button 
                                          type="button"
                                          onClick={() => setCancelConfirmId(order.orderId)}
                                          className="p-2 text-rose-400 hover:bg-rose-950/50 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                                          title="Cancel Order"
                                       >
                                          <XCircle className="w-4 h-4" />
                                       </button>
                                    </div>
                                 ) : (
                                    <div className="flex items-center justify-end">
                                       <button 
                                          type="button"
                                          onClick={() => handleRevertPreOrder(order)}
                                          className="px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/60 text-amber-500 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border border-amber-500/20 cursor-pointer"
                                       >
                                          Revert to Pending
                                       </button>
                                    </div>
                                 )}
                              </td>
                           </tr>
                        ))}
                        {preOrders.filter((order: any) => order.status === preOrderTab).length === 0 && (
                           <tr>
                              <td colSpan={7} className="py-8 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                 No {preOrderTab} pre-orders
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            )}
         </div>
      </div>

      {/* Cancel Confirm Modal */}
      {cancelConfirmId && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800 animate-in zoom-in-95">
                 <div className="text-center">
                     <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                         <AlertTriangle className="w-8 h-8" />
                     </div>
                     <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Cancel Pre-Order?</h3>
                     <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to cancel this order? This action cannot be undone.</p>
                     <div className="flex space-x-3">
                         <button 
                             onClick={() => setCancelConfirmId(null)}
                             className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
                         >
                             Keep
                         </button>
                         <button 
                             onClick={handleCancelPreOrder}
                             className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-rose-900/20 cursor-pointer"
                         >
                             Cancel It
                         </button>
                     </div>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};
