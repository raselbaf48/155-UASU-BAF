import React, { useState, useEffect, useCallback } from 'react';
import { 
  Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, 
  Clock, Trash2, CheckCircle2, XCircle, X, ShoppingBag, Banknote, 
  ArrowUpRight, ArrowDownLeft, Filter, Layers 
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, getCanteenConfig, checkPreOrderWindow, getCuratedDailyMenu, getCleanActivePreOrders, CanteenConfig, PreOrderTimeStatus, getItemDisplayName } from '../utils/canteenSettings';
import { getCanteenMenuCache, fetchCanteenMenuOnce } from '../utils/canteenMenuData';
import { formatCanteenDate } from '../utils/dateUtils';
import { calculateMenuItemStockInfo, getRawInventoryItems, getMenuRecipes } from '../utils/recipeManager';

interface EmployeeDashboardProps { 
  onManagerPortalClick?: () => void; 
  currentUser?: any; 
  customerDp?: string;
  onCustomerProfileClick?: () => void;
}

export const PersonalPortal: React.FC<EmployeeDashboardProps> = ({ 
  onManagerPortalClick, 
  currentUser, 
  customerDp, 
  onCustomerProfileClick 
}) => {
  
  const [dailyMenu, setDailyMenu] = useState<any[]>(() => {
    try {
      const ids = getCuratedDailyMenu();
      if (Array.isArray(ids) && ids.length > 0) {
        const allItems = getCanteenMenuCache();
        return allItems.filter(item => ids.includes(item.id));
      }
    } catch {}
    return [];
  });
  const [searchMenu, setSearchMenu] = useState('');
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());
  const [preOrderWindow, setPreOrderWindow] = useState<PreOrderTimeStatus>(() => checkPreOrderWindow());
  const [closedToast, setClosedToast] = useState<string | null>(null);
  
  const [activities, setActivities] = useState<any[]>([]);
  const [orderedItems, setOrderedItems] = useState<Record<string, boolean>>({});
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [duplicateConfirmItem, setDuplicateConfirmItem] = useState<{ item: any; currentQty: number } | null>(null);

  // Live Raw Inventory & Recipes for realtime available stock
  const [rawInventory, setRawInventory] = useState<any[]>(() => getRawInventoryItems());
  const [recipesMap, setRecipesMap] = useState<any>(() => getMenuRecipes());

  const toEnglishDate = formatCanteenDate;

  const cleanBd = currentUser?.bdNo ? String(currentUser.bdNo).replace(/^BD\/?/i, '').trim() : '';

  const [memberDetails, setMemberDetails] = useState<{
    dp?: string;
    due?: number;
    rank?: string;
    surname?: string;
    contact?: string;
  } | null>(() => {
    if (cleanBd) {
      try {
        const raw = localStorage.getItem(`canteen_member_${cleanBd.toLowerCase()}`);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    if (currentUser?.DP || customerDp || currentUser?.due !== undefined) {
      return {
        dp: currentUser?.DP || customerDp || '',
        due: currentUser?.due !== undefined ? currentUser.due : 0,
        rank: currentUser?.rank,
        surname: currentUser?.name
      };
    }
    return null;
  });
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadCanteenMember = async () => {
      try {
        if (cleanBd) {
          const { data, error } = await supabase
            .from('Canteen_Member')
            .select('DP, Due, Rank, Surname, Contact, "BD No", airman_id')
            .or(`"BD No".eq.${cleanBd},airman_id.eq.${cleanBd},airman_id.eq.airman-${cleanBd}`)
            .limit(1);

          if (!error && data && data.length > 0 && isMounted) {
            const memberObj = {
              dp: data[0].DP,
              due: Number(data[0].Due) || 0,
              rank: data[0].Rank,
              surname: data[0].Surname,
              contact: data[0].Contact
            };
            setMemberDetails(memberObj);
            setImgError(false);
            try {
              localStorage.setItem(`canteen_member_${cleanBd.toLowerCase()}`, JSON.stringify(memberObj));
            } catch {}
            return;
          }
        }

        if (currentUser?.name && currentUser?.name !== 'Guest') {
          const parts = currentUser.name.trim().split(/\s+/);
          const surname = parts[parts.length - 1];
          if (surname) {
            const { data } = await supabase
              .from('Canteen_Member')
              .select('DP, Due, Rank, Surname, Contact')
              .ilike('Surname', `%${surname}%`)
              .limit(1);

            if (data && data.length > 0 && isMounted) {
              const memberObj = {
                dp: data[0].DP,
                due: Number(data[0].Due) || 0,
                rank: data[0].Rank,
                surname: data[0].Surname,
                contact: data[0].Contact
              };
              setMemberDetails(memberObj);
              setImgError(false);
              if (cleanBd) {
                try {
                  localStorage.setItem(`canteen_member_${cleanBd.toLowerCase()}`, JSON.stringify(memberObj));
                } catch {}
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching member details in PersonalPortal:', err);
      }
    };

    loadCanteenMember();
    return () => { isMounted = false; };
  }, [cleanBd, currentUser?.bdNo, currentUser?.name]);

  const handleCancelPreOrder = (orderId: string) => {
      const preOrdersStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let preOrders = [];
      try { preOrders = JSON.parse(preOrdersStr); } catch(e) {}
      
      const updated = preOrders.filter((po: any) => po.orderId !== orderId);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      setCancelConfirmId(null);
      fetchActivities();
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
  };

  const fetchActivities = useCallback(() => {
      const cleanBdStr = currentUser?.bdNo ? String(currentUser.bdNo).replace(/^BD\/?/i, '').trim().toLowerCase() : '';
      const rawBdStr = String(currentUser?.bdNo || '').toLowerCase();
      const matchKeys = [
        rawBdStr,
        cleanBdStr,
        `airman-${cleanBdStr}`,
        `airman-${rawBdStr}`,
        `cust-${cleanBdStr}`,
        String(currentUser?.id || '').toLowerCase(),
        String(memberDetails?.airman_id || '').toLowerCase(),
        String(memberDetails?.['BD No'] || '').toLowerCase()
      ].filter(Boolean);

      const isMemberMatch = (targetId: any, targetBd?: any) => {
        const idStr = String(targetId || '').trim().toLowerCase();
        const bdStr = String(targetBd || '').trim().toLowerCase();
        const cleanTarget = idStr.replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim();
        const cleanTargetBd = bdStr.replace(/^BD\/?/i, '').trim();

        if (matchKeys.includes(idStr) || matchKeys.includes(bdStr)) return true;
        if (cleanBdStr) {
          if (cleanTarget === cleanBdStr || cleanTargetBd === cleanBdStr) return true;
          if (idStr.includes(cleanBdStr) || bdStr.includes(cleanBdStr)) return true;
        }
        return false;
      };

      let preOrders: any[] = [];
      try { 
          const rawOrders = getCleanActivePreOrders();
          // Auto-consolidate any duplicate pending pre-orders for the same member & item
          const nonPending: any[] = [];
          const pendingMap: Record<string, any> = {};
          let hasDuplicates = false;

          rawOrders.forEach((po: any) => {
              if (po.status !== 'pending' || !Array.isArray(po.items) || po.items.length === 0) {
                  nonPending.push(po);
                  return;
              }
              const firstItem = po.items[0];
              const itemKey = String(firstItem.id || firstItem.name || '').trim().toLowerCase();
              const memberKey = String(po.memberId || '').trim().toLowerCase();
              const key = `${memberKey}__${itemKey}`;

              if (!pendingMap[key]) {
                  pendingMap[key] = {
                      ...po,
                      items: po.items.map((it: any) => ({ ...it, qty: Number(it.qty) || 1 }))
                  };
              } else {
                  hasDuplicates = true;
                  const existingOrder = pendingMap[key];
                  po.items.forEach((itemToAdd: any) => {
                      const exItm = existingOrder.items.find((i: any) => (i.id && i.id === itemToAdd.id) || i.name === itemToAdd.name);
                      if (exItm) {
                          exItm.qty = (Number(exItm.qty) || 1) + (Number(itemToAdd.qty) || 1);
                      } else {
                          existingOrder.items.push({ ...itemToAdd, qty: Number(itemToAdd.qty) || 1 });
                      }
                  });
                  existingOrder.total = existingOrder.items.reduce((sum: number, it: any) => {
                      const p = Number(it.price || 0);
                      const q = Number(it.qty || 1);
                      return sum + (p * q);
                  }, 0);
              }
          });

          if (hasDuplicates) {
              preOrders = [...nonPending, ...Object.values(pendingMap)];
              try { localStorage.setItem('canteen_pre_orders', JSON.stringify(preOrders)); } catch(e) {}
          } else {
              preOrders = rawOrders;
          }
      } catch(e) {}
      
      const txsStr = localStorage.getItem('canteen_txs') || '[]';
      let txs: any[] = [];
      try { txs = JSON.parse(txsStr); } catch(e) {}

      // 1. Transactions (Purchases and Payments)
      const userTxs = txs.filter((tx: any) => isMemberMatch(tx.airman_id, tx.bdNo));
      
      const parsedTxs: any[] = userTxs.map((tx: any) => {
          const isPayment = tx.type === 'BILL PAYMENT' || tx.type === 'PAYMENT' || (typeof tx.items === 'string' && tx.items.toUpperCase().includes('BILL PAYMENT'));
          
          let qty: number | string = 1;
          let unitPrice: number | string = Number(tx.amount || 0);
          let desc = tx.items || 'Canteen Item';

          if (isPayment) {
              const isCash = String(tx.gateway || '').toUpperCase() === 'CASH' || String(tx.items || '').toUpperCase().includes('CASH');
              desc = `Bill Payment - ${isCash ? 'Cash' : 'UCB'}`;
              qty = '-';
              unitPrice = '-';
          } else {
              const qtyMatch = String(tx.items || '').match(/\((\d+)\)/);
              if (qtyMatch) {
                  qty = parseInt(qtyMatch[1], 10) || 1;
                  unitPrice = qty > 0 ? Math.round(Number(tx.amount || 0) / qty) : Number(tx.amount || 0);
                  desc = String(tx.items).replace(/\(\d+\)/g, '').trim();
              }
          }

          return {
              id: String(tx.id || `tx-${Math.random()}`),
              type: isPayment ? 'BILL PAYMENT' : 'PURCHASE',
              category: isPayment ? 'PAYMENTS' : 'PURCHASES',
              date: toEnglishDate(tx.date || new Date().toLocaleDateString('en-GB')),
              timestamp: tx.timestamp || (typeof tx.id === 'number' ? tx.id : 0),
              description: desc,
              items: tx.items,
              qty: qty,
              price: unitPrice,
              total: Number(tx.amount || 0),
              amount: Number(tx.amount || 0),
              gateway: tx.gateway || 'CASH',
              orderId: tx.orderId,
              isPreOrder: !!(tx.isPreOrder || tx.orderId),
              isCompletedPreOrder: !!(tx.isPreOrder || tx.orderId),
              status: isPayment ? 'PAID' : (tx.isPreOrder || tx.orderId ? 'COMPLETED' : 'PURCHASE')
          };
      });

      // 2. Pre-orders: If completed, convert to Purchase; if pending, keep in PRE-ORDERS
      const userPreOrders = preOrders.filter((po: any) => isMemberMatch(po.memberId, po.memberId));
      const parsedPendingPreOrders: any[] = [];

      userPreOrders.forEach((po: any) => {
          const rawItems = Array.isArray(po.items) ? po.items : [];
          const primaryItem = rawItems[0] || {};
          const poQty = rawItems.reduce((acc: number, cur: any) => acc + (Number(cur.qty) || 1), 0) || 1;
          const poPrice = primaryItem.price || (poQty > 0 ? Math.round(Number(po.total || 0) / poQty) : Number(po.total || 0));
          const poDesc = rawItems.map((i: any) => i.name).join(', ') || 'Pre-Order Item';

          if (po.status === 'completed') {
              // Converted to purchase history!
              const alreadyExists = parsedTxs.some(t => t.orderId === po.orderId || t.id === 'tx-po-' + po.orderId);
              if (!alreadyExists) {
                  parsedTxs.push({
                      id: 'tx-po-' + po.orderId,
                      type: 'PURCHASE',
                      category: 'PURCHASES',
                      date: toEnglishDate(po.completedAt || po.timestamp || new Date().toLocaleDateString('en-GB')),
                      timestamp: new Date(po.completedAt || po.timestamp).getTime(),
                      description: poDesc,
                      items: po.items ? po.items.map((i: any) => `${i.name}${i.qty > 1 ? ` (${i.qty})` : ''}`).join(', ') : 'Pre-Order Purchase',
                      qty: poQty,
                      price: poPrice,
                      total: Number(po.total || 0),
                      amount: Number(po.total || 0),
                      orderId: po.orderId,
                      isPreOrder: true,
                      isCompletedPreOrder: true,
                      status: 'COMPLETED'
                  });
              }
          } else {
              // Active / Pending Pre-order only
              parsedPendingPreOrders.push({
                  id: po.orderId,
                  type: 'PRE-ORDER',
                  category: 'PRE-ORDERS',
                  status: 'PENDING',
                  date: toEnglishDate(po.timestamp || new Date().toLocaleDateString('en-GB')),
                  timestamp: new Date(po.timestamp).getTime(),
                  description: poDesc,
                  items: po.items ? po.items.map((i: any) => `${i.name}${i.qty > 1 ? ` (${i.qty})` : ''}`).join(', ') : 'Pre-Order Items',
                  qty: poQty,
                  price: poPrice,
                  total: Number(po.total || 0),
                  amount: Number(po.total || 0),
                  orderId: po.orderId,
                  isPreOrder: true
              });
          }
      });

      // Combine and sort recent first
      const allAct = [...parsedPendingPreOrders, ...parsedTxs].sort((a, b) => {
          const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || 0).getTime();
          const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
      });

      setActivities(allAct);
  }, [currentUser, memberDetails]);

  useEffect(() => {
      const refreshStatus = () => {
          const cfg = getCanteenConfig();
          setCanteenConfig(cfg);
          setPreOrderWindow(checkPreOrderWindow(cfg));
      };
      refreshStatus();
      const timer = setInterval(refreshStatus, 10000);
      const handleConfigUpdate = (e: any) => {
          const cfg = e.detail || getCanteenConfig();
          setCanteenConfig(cfg);
          setPreOrderWindow(checkPreOrderWindow(cfg));
      };
      window.addEventListener('canteen_settings_updated', handleConfigUpdate);
      return () => {
          clearInterval(timer);
          window.removeEventListener('canteen_settings_updated', handleConfigUpdate);
      };
  }, []);

  useEffect(() => {
      fetchMenu();
      fetchActivities();
      
      const handleSync = () => {
          fetchMenu();
          fetchActivities();
          setRawInventory(getRawInventoryItems());
          setRecipesMap(getMenuRecipes());
      };

      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'canteen_daily_menu' || e.key === 'canteen_txs' || e.key === 'canteen_pre_orders' || e.key === 'canteen_daily_menu_updated_at' || e.key === 'canteen_raw_inventory_items_v2') {
              fetchMenu();
              fetchActivities();
              setRawInventory(getRawInventoryItems());
              setRecipesMap(getMenuRecipes());
          }
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('canteen_menu_updated', handleSync);
      window.addEventListener('canteen_daily_menu_updated', handleSync);
      window.addEventListener('canteen_state_updated', handleSync);
      window.addEventListener('canteen_txs_updated', handleSync);
      window.addEventListener('baf_state_updated', handleSync);
      window.addEventListener('canteen_raw_inventory_updated', handleSync);
      window.addEventListener('canteen_menu_recipes_updated', handleSync);
      
      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('canteen_menu_updated', handleSync);
          window.removeEventListener('canteen_daily_menu_updated', handleSync);
          window.removeEventListener('canteen_state_updated', handleSync);
          window.removeEventListener('canteen_txs_updated', handleSync);
          window.removeEventListener('baf_state_updated', handleSync);
          window.removeEventListener('canteen_raw_inventory_updated', handleSync);
          window.removeEventListener('canteen_menu_recipes_updated', handleSync);
      };
  }, [fetchActivities]);

  const fetchMenu = async () => {
    const ids = getCuratedDailyMenu();
    if (ids && ids.length > 0) {
      const cachedItems = getCanteenMenuCache();
      const filtered = cachedItems.filter(item => ids.includes(item.id));
      setDailyMenu(filtered);

      try {
        const liveItems = await fetchCanteenMenuOnce();
        if (liveItems && liveItems.length > 0) {
          setDailyMenu(liveItems.filter(item => ids.includes(item.id)));
        }
      } catch(err) {
        console.warn("fetchMenu background sync error:", err);
      }
    } else {
      setDailyMenu([]);
    }
  };

  const handlePreOrder = (item: any, deltaQty: number = 1) => {
      try {
          const windowStatus = checkPreOrderWindow(canteenConfig);
          if (!windowStatus.isOpen) {
              setClosedToast(`Pre-Order is currently closed (${windowStatus.startTime} - ${windowStatus.endTime}). Pre-orders can only be placed during active hours.`);
              setTimeout(() => setClosedToast(null), 4000);
              return;
          }

          const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);
          if (deltaQty > 0 && stockInfo.availableStock <= 0) {
              setClosedToast(`দুঃখিত, '${item.name}'-এর প্রয়োজনীয় কাঁচামালের ঘাটতি থাকায় স্টক নেই (Out of Stock)!`);
              setTimeout(() => setClosedToast(null), 4000);
              return;
          }

          const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
          let existing: any[] = [];
          try { existing = JSON.parse(existingStr); } catch(e) {}

          const memberId = currentUser?.bdNo || cleanBd || 'Unknown ID';
          const memberName = currentUser?.name || (memberDetails?.rank ? `${memberDetails.rank} ${memberDetails.surname}` : 'Guest');

          // Clean BD identifiers for matching
          const cleanBdStr = currentUser?.bdNo ? String(currentUser.bdNo).replace(/^BD\/?/i, '').trim().toLowerCase() : '';
          const rawBdStr = String(currentUser?.bdNo || '').toLowerCase();
          const matchKeys = [
            rawBdStr,
            cleanBdStr,
            `airman-${cleanBdStr}`,
            `airman-${rawBdStr}`,
            `cust-${cleanBdStr}`,
            String(currentUser?.id || '').toLowerCase(),
            String(memberDetails?.airman_id || '').toLowerCase(),
            String(memberDetails?.['BD No'] || '').toLowerCase()
          ].filter(Boolean);

          const isMemberMatch = (targetId: any) => {
            const idStr = String(targetId || '').trim().toLowerCase();
            const cleanTarget = idStr.replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim();
            if (matchKeys.includes(idStr)) return true;
            if (cleanBdStr) {
              if (cleanTarget === cleanBdStr) return true;
              if (idStr.includes(cleanBdStr)) return true;
            }
            return false;
          };

          // Find if there is already a pending pre-order for this user and item
          const pendingOrderIndex = existing.findIndex((po: any) => {
              if (po.status !== 'pending') return false;
              if (!isMemberMatch(po.memberId)) return false;
              return Array.isArray(po.items) && po.items.some((i: any) => i.id === item.id || (i.name && item.name && i.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
          });

          if (pendingOrderIndex !== -1) {
              const targetOrder = existing[pendingOrderIndex];
              const itmIdx = targetOrder.items.findIndex((i: any) => i.id === item.id || (i.name && item.name && i.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
              
              if (itmIdx !== -1) {
                  const currentQty = Number(targetOrder.items[itmIdx].qty) || 1;
                  const newQty = currentQty + deltaQty;
                  
                  if (newQty <= 0) {
                      targetOrder.items.splice(itmIdx, 1);
                      if (targetOrder.items.length === 0) {
                          existing.splice(pendingOrderIndex, 1);
                      } else {
                          targetOrder.total = targetOrder.items.reduce((sum: number, itm: any) => {
                              return sum + ((Number(itm.qty) || 1) * (Number(itm.price) || 0));
                          }, 0);
                      }
                  } else {
                      targetOrder.items[itmIdx].qty = newQty;
                      const unitPrice = Number(item.price !== undefined ? item.price : (targetOrder.items[itmIdx].price || 0));
                      targetOrder.items[itmIdx].price = unitPrice;
                      targetOrder.total = targetOrder.items.reduce((sum: number, itm: any) => {
                          return sum + ((Number(itm.qty) || 1) * (Number(itm.price) || 0));
                      }, 0);
                  }
              }
              if (targetOrder && targetOrder.items && targetOrder.items.length > 0) {
                  targetOrder.timestamp = new Date().toISOString();
              }
          } else {
              if (deltaQty > 0) {
                  const unitPrice = Number(item.price || 0);
                  const newOrder = {
                      orderId: 'PO-' + Date.now(),
                      timestamp: new Date().toISOString(),
                      memberId: memberId,
                      memberName: memberName,
                      items: [{ id: item.id, name: item.name, qty: deltaQty, price: unitPrice }],
                      total: unitPrice * deltaQty,
                      status: 'pending'
                  };
                  existing.push(newOrder);
              }
          }

          localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
          fetchActivities();
          window.dispatchEvent(new Event('canteen_state_updated'));
          window.dispatchEvent(new Event('storage'));

          setOrderedItems(prev => ({...prev, [item.id]: true}));
          setTimeout(() => {
              setOrderedItems(prev => ({...prev, [item.id]: false}));
          }, 1200);
      } catch(e) {
          console.error('Error handling pre-order:', e);
      }
  };

  const handlePreOrderClick = (item: any, currentPendingQty: number) => {
      if (currentPendingQty > 0) {
          setDuplicateConfirmItem({ item, currentQty: currentPendingQty });
      } else {
          handlePreOrder(item, 1);
      }
  };

  const activeDp = (!imgError && (memberDetails?.dp || customerDp || currentUser?.DP || currentUser?.photoUrl)) || null;
  const displayName = currentUser?.name || (memberDetails?.rank ? `${memberDetails.rank} ${memberDetails.surname}` : 'GUEST USER');

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300 pb-10 mt-4 md:mt-10">
      
      {/* Profile Section */}
      <div className="flex flex-col items-center justify-center space-y-4">
          <button
            type="button"
            onClick={onCustomerProfileClick}
            className="w-20 h-20 bg-[#0f172a] rounded-3xl flex items-center justify-center relative shadow-2xl border-2 border-indigo-500/40 text-indigo-400 overflow-hidden cursor-pointer hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all group"
            title="Click to view Customer Profile"
          >
            {activeDp ? (
              <img 
                src={resolveImageUrl(activeDp)} 
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                onError={() => setImgError(true)}
              />
            ) : (
              <User className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform" />
            )}
            <div className="absolute -bottom-1 -right-1 bg-[#4f46e5] rounded-full p-1 border-2 border-slate-900 shadow-md">
              <CreditCard className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
          
          <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                  <span className="bg-[#4f46e5] text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">Personal Portal</span>
                  <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">ID #{currentUser?.bdNo || cleanBd || ''}</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight uppercase">
                  {displayName}
              </h2>
          </div>

          <div className="bg-[#0f172a] rounded-[2rem] px-10 py-6 text-center shadow-xl relative overflow-hidden mt-2 border border-slate-800/80">
              <div className="absolute inset-0 bg-gradient-to-r from-[#4f46e5]/20 to-transparent pointer-events-none" />
              <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1 relative z-10">Liability Assessment</p>
              <h3 className="text-4xl font-black text-white tracking-tighter relative z-10">
                ৳{memberDetails?.due !== undefined ? memberDetails.due : (currentUser?.due !== undefined ? currentUser.due : 0)}
              </h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 relative z-10">Live Accounting Balance</p>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-[#4f46e5] rounded-t-full" />
          </div>
      </div>

      {/* Toast Feedback when closed */}
      {closedToast && (
        <div className="fixed top-6 right-6 z-[200] bg-rose-600 text-white font-bold px-5 py-3.5 rounded-2xl shadow-2xl border border-rose-400/40 flex items-center space-x-2.5 animate-in slide-in-from-top-4 max-w-md">
          <Clock className="w-5 h-5 text-white shrink-0" />
          <span className="text-xs leading-relaxed">{closedToast}</span>
        </div>
      )}

      {/* Active Service Section */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                  <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center space-x-2 mb-1">
                      <span className="text-[#4f46e5]"><Utensils className="w-4 h-4" /></span>
                      <span>Active Service (Daily Pre-Order)</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full flex items-center space-x-1.5 ${
                          preOrderWindow.isOpen 
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' 
                              : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                      }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${preOrderWindow.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                          <span>{preOrderWindow.isOpen ? 'Ordering Active' : 'Ordering Closed'}</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 tracking-wider">
                          {preOrderWindow.startTime} - {preOrderWindow.endTime}
                      </span>
                      {preOrderWindow.isOpen && preOrderWindow.timeRemainingText && (
                          <span className="text-[10px] font-medium text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              ⏱️ {preOrderWindow.timeRemainingText}
                          </span>
                      )}
                  </div>
              </div>
              
              {preOrderWindow.isOpen && (
                  <div className="relative w-full md:w-64">
                      <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                          type="text" 
                          placeholder="Filter daily menu..."
                          value={searchMenu}
                          onChange={(e) => setSearchMenu(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                      />
                  </div>
              )}
          </div>

          {/* Conditional Rendering: If Outside Active Timing Window, Menu Disappears with Closed Notification */}
          {!preOrderWindow.isOpen ? (
              <div className="py-12 px-6 rounded-3xl bg-slate-950/70 border border-slate-800 text-center flex flex-col items-center justify-center space-y-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
                      <Clock className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-black text-white uppercase tracking-wider">
                      {!preOrderWindow.isEnabled ? 'Pre-Order Service Disabled' : 'Pre-Order Currently Closed'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                      {!preOrderWindow.isEnabled 
                          ? 'ম্যানেজার কর্তৃক প্রি-অর্ডার সার্ভিস সাময়িকভাবে বন্ধ রাখা হয়েছে।' 
                          : <>Pre-orders are accepted daily during active hours: <strong className="text-indigo-400">{preOrderWindow.startTime} - {preOrderWindow.endTime}</strong>.</>
                      }
                  </p>
                  {preOrderWindow.isEnabled && (
                      <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-700/80 text-[11px] font-black text-indigo-300">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Active Window: {preOrderWindow.startTime} to {preOrderWindow.endTime}</span>
                      </div>
                  )}
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dailyMenu.length === 0 ? (
                      <div className="col-span-1 md:col-span-2 py-10 flex flex-col items-center justify-center text-slate-400">
                          <Utensils className="w-8 h-8 mb-3 opacity-20" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">No items curated for today</p>
                      </div>
                  ) : (
                      dailyMenu.filter(item => (item.name || '').toLowerCase().includes(searchMenu.toLowerCase())).map((item, idx) => {
                          const stockInfo = calculateMenuItemStockInfo(item.id, item.name, rawInventory, recipesMap);
                          const pendingAct = activities.find(a => 
                              a.type === 'PRE-ORDER' && 
                              (
                                  (a.description && item.name && a.description.toLowerCase().includes(item.name.toLowerCase())) ||
                                  (a.items && item.name && a.items.toLowerCase().includes(item.name.toLowerCase()))
                              )
                          );
                          const pendingQty = pendingAct ? (Number(pendingAct.qty) || 1) : 0;
                          const isFlash = !!orderedItems[item.id];
                          const itemDp = resolveImageUrl(item.DP || item.img || item.image || item.photo);

                          return (
                              <div 
                                  key={idx} 
                                  className={`relative bg-slate-800 border ${
                                      pendingQty > 0 ? 'border-amber-500/60 bg-slate-800/90' : isFlash ? 'border-indigo-500/60' : 'border-slate-700 hover:bg-slate-700/80'
                                  } rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all group overflow-hidden`}
                              >
                                  <div className="flex items-center space-x-3.5 min-w-0 pr-2 flex-1">
                                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                          {itemDp ? (
                                              <img 
                                                  src={itemDp} 
                                                  alt={item.name} 
                                                  referrerPolicy="no-referrer"
                                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                              />
                                          ) : (
                                              <Utensils className="w-6 h-6 text-indigo-400" />
                                          )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                          <div className="flex items-center space-x-2 mb-0.5">
                                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest truncate">{item.category || 'SNACKS'}</p>
                                              {pendingQty > 0 && (
                                                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-500/40 flex items-center space-x-1 shrink-0">
                                                      <Zap className="w-2.5 h-2.5 fill-current mr-0.5" />
                                                      <span>Qty: {pendingQty}</span>
                                                  </span>
                                              )}
                                          </div>
                                          <p className="text-sm font-black text-white uppercase tracking-tight truncate">{getItemDisplayName(item, 'menu', canteenConfig).primary}</p>
                                          <div className="flex items-center space-x-2 mt-0.5">
                                              <p className="text-xs font-black text-emerald-400">
                                                  ৳{item.price ? item.price : 0}
                                              </p>
                                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                                  stockInfo.availableStock > 0 
                                                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                                                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                              }`}>
                                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stockInfo.availableStock > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                  <span>স্টকঃ {stockInfo.availableStock}</span>
                                              </span>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="flex items-center space-x-2 shrink-0">
                                      <button 
                                          type="button"
                                          onClick={() => handlePreOrderClick(item, pendingQty)}
                                          title={pendingQty > 0 ? `Already pre-ordered (Qty: ${pendingQty}). Click to add more.` : "Pre-Order this item"}
                                          className={`w-10 h-10 rounded-xl ${
                                              pendingQty > 0 
                                                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30' 
                                                  : 'bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-md shadow-[#4f46e5]/20'
                                          } flex items-center justify-center transition-all shrink-0 group-hover:scale-105 active:scale-95 cursor-pointer`}
                                      >
                                          <Zap className="w-5 h-5 fill-current" />
                                      </button>
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>
          )}
      </div>

      {/* Activity Log */}
      <div className="bg-slate-900 rounded-[2rem] p-5 sm:p-6 md:p-8 shadow-sm border border-slate-800 space-y-4">
          <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center space-x-2">
                  <span className="text-[#4f46e5]"><History className="w-4 h-4" /></span>
                  <span>Activity Log</span>
              </h3>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Recent Entries ({activities.length})
              </span>
          </div>

          {activities.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                  <History className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">No activities found</p>
              </div>
          ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-950/60">
                  <table className="w-full text-left text-xs whitespace-nowrap min-w-[620px]">
                      <thead>
                          <tr className="border-b border-slate-800 bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              <th className="py-3 px-3.5 text-center w-14">Ser No</th>
                              <th className="py-3 px-3.5 text-center">Date</th>
                              <th className="py-3 px-4">Discription</th>
                              <th className="py-3 px-3 text-center">Qty</th>
                              <th className="py-3 px-3.5 text-right">Price</th>
                              <th className="py-3 px-4 text-right">Total</th>
                              <th className="py-3 px-4 text-center">Status</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                          {activities.map((act, idx) => (
                              <tr 
                                  key={act.id || idx}
                                  className="hover:bg-slate-800/50 transition-colors group"
                              >
                                  {/* Ser No */}
                                  <td className="py-3.5 px-3.5 text-center font-bold text-slate-400 text-[11px]">
                                      {String(idx + 1).padStart(2, '0')}
                                  </td>

                                  {/* Date */}
                                  <td className="py-3.5 px-3.5 text-center text-slate-300 font-medium text-[11px] whitespace-nowrap">
                                      {toEnglishDate(act.date)}
                                  </td>

                                  {/* Discription */}
                                  <td className="py-3.5 px-4 font-bold text-white uppercase tracking-tight text-[11px] max-w-[220px] truncate">
                                      {act.description || act.items}
                                  </td>

                                  {/* Qty */}
                                  <td className="py-3.5 px-3 text-center font-bold text-slate-300 text-[11px]">
                                      {act.qty ?? 1}
                                  </td>

                                  {/* Price */}
                                  <td className="py-3.5 px-3.5 text-right font-medium text-slate-300 text-[11px]">
                                      {typeof act.price === 'number' ? `৳${act.price}` : act.price}
                                  </td>

                                  {/* Total */}
                                  <td className="py-3.5 px-4 text-right font-black text-[12px]">
                                      {act.type === 'BILL PAYMENT' ? (
                                          <span className="text-emerald-400">-৳{act.total || act.amount}</span>
                                      ) : act.type === 'PRE-ORDER' ? (
                                          <span className="text-amber-400">৳{act.total || act.amount}</span>
                                      ) : (
                                          <span className="text-white">৳{act.total || act.amount}</span>
                                      )}
                                  </td>

                                  {/* Status */}
                                  <td className="py-3.5 px-4 text-center">
                                      {act.type === 'BILL PAYMENT' ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                                              PAID
                                          </span>
                                      ) : act.type === 'PRE-ORDER' ? (
                                          <div className="inline-flex items-center space-x-1.5 justify-center">
                                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-500/30">
                                                  PENDING
                                              </span>
                                              <button
                                                  type="button"
                                                  onClick={() => setCancelConfirmId(act.id)}
                                                  title="Cancel Pre-Order"
                                                  className="p-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg transition-colors border border-rose-500/30 cursor-pointer"
                                              >
                                                  <X className="w-3 h-3" />
                                              </button>
                                          </div>
                                      ) : act.isCompletedPreOrder ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-950 text-emerald-400 border border-emerald-500/30">
                                              <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                                              DONE
                                          </span>
                                      ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-500/30">
                                              PURCHASE
                                          </span>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

      {/* Duplicate Pre-Order Confirmation Modal */}
      {duplicateConfirmItem && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800 animate-in zoom-in-95 text-center">
                  <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                      <Zap className="w-7 h-7 fill-current" />
                  </div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight mb-1">
                      Already Pre-Ordered
                  </h3>
                  <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-3">
                      {duplicateConfirmItem.item.name}
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed mb-1">
                      This item is already in your pending pre-orders with quantity <span className="font-bold text-amber-400">({duplicateConfirmItem.currentQty})</span>.
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                      Do you want to add another one to this pre-order? (Total quantity will be <span className="font-bold text-white">{duplicateConfirmItem.currentQty + 1}</span>).
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                      <button
                          type="button"
                          onClick={() => setDuplicateConfirmItem(null)}
                          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                      >
                          Cancel
                      </button>
                      <button
                          type="button"
                          onClick={() => {
                              const itm = duplicateConfirmItem.item;
                              setDuplicateConfirmItem(null);
                              handlePreOrder(itm, 1);
                          }}
                          className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center space-x-1"
                      >
                          <span>Yes, Add (+1)</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800 animate-in zoom-in-95">
                  <div className="text-center">
                      <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                          <XCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Cancel Pre-Order?</h3>
                      <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to cancel this pre-order? This action cannot be undone.</p>
                      
                      <div className="flex space-x-3">
                          <button 
                              type="button"
                              onClick={() => setCancelConfirmId(null)} 
                              className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                              KEEP IT
                          </button>
                          <button 
                              type="button"
                              onClick={() => handleCancelPreOrder(cancelConfirmId)} 
                              className="flex-1 py-3 bg-rose-900/40 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-black tracking-widest transition-all shadow-md shadow-rose-900/30 border border-rose-500/30 cursor-pointer"
                          >
                              CANCEL ORDER
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};