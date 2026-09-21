import React, { useState, useEffect, useCallback } from 'react';
import { 
  Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, 
  Clock, Trash2, CheckCircle2, XCircle, X, ShoppingBag, Banknote, 
  ArrowUpRight, ArrowDownLeft, Filter, Layers 
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';

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
  
  const [dailyMenu, setDailyMenu] = useState<any[]>([]);
  const [searchMenu, setSearchMenu] = useState('');
  
  const [activities, setActivities] = useState<any[]>([]);
  const [orderedItems, setOrderedItems] = useState<Record<string, boolean>>({});
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [duplicateConfirmItem, setDuplicateConfirmItem] = useState<{ item: any; currentQty: number } | null>(null);

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

      const preOrdersStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let preOrders: any[] = [];
      try { 
          const rawOrders = JSON.parse(preOrdersStr);
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
              desc = tx.items || `Bill Payment (${tx.gateway || 'CASH'})`;
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
      fetchMenu();
      fetchActivities();
      
      const handleSync = () => {
          fetchMenu();
          fetchActivities();
      };

      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'canteen_daily_menu' || e.key === 'canteen_txs' || e.key === 'canteen_pre_orders') {
              fetchMenu();
              fetchActivities();
          }
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('canteen_menu_updated', handleSync);
      window.addEventListener('canteen_state_updated', handleSync);
      window.addEventListener('canteen_txs_updated', handleSync);
      window.addEventListener('baf_state_updated', handleSync);
      
      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('canteen_menu_updated', handleSync);
          window.removeEventListener('canteen_state_updated', handleSync);
          window.removeEventListener('canteen_txs_updated', handleSync);
          window.removeEventListener('baf_state_updated', handleSync);
      };
  }, [fetchActivities]);

  const fetchMenu = async () => {
      const stored = localStorage.getItem('canteen_daily_menu');
      if (stored) {
          try {
              const ids = JSON.parse(stored);
              if (ids.length > 0) {
                  const allItems = [
  {
    "id": "28d0782c-1bdf-42f6-a616-683a9d5038f1",
    "name": "EGG MUMLET",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "bcb8b137-36b8-4fd0-9e11-0e9502859618",
    "name": "EGG NOODLES",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "da73d5ab-f0e9-4df1-b3bd-89ed86a1da4f",
    "name": "GREEN TEA",
    "category": "SNACKS",
    "price": 8,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c6ca22ca-0a4a-4a2b-8b48-0d839d240e7b",
    "name": "HALIM",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "3d86a07a-2c53-416a-abb6-52b0b448ca63",
    "name": "LEMON JUICE",
    "category": "DRINK",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "0e5511c2-9014-4aeb-8e57-624d6994986a",
    "name": "LIQUOR TEA",
    "category": "DRINK",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "02d2b676-3b4b-4e7d-9b58-477c53ede8ae",
    "name": "MILK COFFEE",
    "category": "DRINK",
    "price": 25,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "136e714f-1272-4723-a0a5-2048cb81e94f",
    "name": "MILK TEA",
    "category": "DRINK",
    "price": 12,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "5db26171-f6dc-4268-8d64-a5b53140e368",
    "name": "NOODLES",
    "category": "SNACKS",
    "price": 30,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "0a1f36fc-aad0-4d45-a0d8-9222ca1ca07e",
    "name": "NORMAL BISCUIT",
    "category": "SNACKS",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "38bc5293-57ed-4e5a-b817-cbdcb37bfebd",
    "name": "ONE TIME BOX",
    "category": "SNACKS",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "3dde1a4e-9b62-49a9-8b24-d758c2afc24a",
    "name": "PASTA",
    "category": "SNACKS",
    "price": 35,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "98b60d30-301c-49ea-9e99-7661e30fca39",
    "name": "PORATA",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "cebd3bcc-1802-4f63-90f3-0bb2fa27e121",
    "name": "PORATA (HOTEL)",
    "category": "SNACKS",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "b83a0120-d891-481a-a27f-9c7834bc48ee",
    "name": "PORATA (UNIT)",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "eb34adaf-7ae0-4a52-8a90-291cc88b1a1f",
    "name": "SOSA",
    "category": "SNACKS",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "dc82a6b4-6cea-4188-b6f1-7e176ec26cff",
    "name": "SWARMA",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "4b63bf8e-cedb-4d4b-b25c-fd9451df7a49",
    "name": "BOILED EGG",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "089a215f-20f3-47b2-983b-5a0a94cba18e",
    "name": "CHICKEN BIRIYANI",
    "category": "SNACKS",
    "price": 65,
    "stock": 10,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "5cc854fa-cdf0-43e9-a4cf-339f8a1dcbd3",
    "name": "CHICKEN CURRY",
    "category": "SNACKS",
    "price": 50,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c149451c-7fe4-4531-9984-0addc2742fdb",
    "name": "CHICKEN KHICHURI",
    "category": "SNACKS",
    "price": 65,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c5d4c577-81ab-43cf-88ca-d0e431661a2f",
    "name": "CHICKEN ONION",
    "category": "SNACKS",
    "price": 45,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "2a22e09c-cc55-4528-8a73-225de8456c1c",
    "name": "CHICKEN PASTA",
    "category": "SNACKS",
    "price": 55,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "b3785b27-f250-4000-85bf-3fbaf804cc63",
    "name": "CHICKEN PULAW",
    "category": "SNACKS",
    "price": 65,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "e37bb8e1-db3f-464a-8968-74bec924ac87",
    "name": "CHOTPOTI",
    "category": "SNACKS",
    "price": 30,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c06d9508-2367-404d-b7ca-b5c9670a4b6c",
    "name": "COLD COFFEE",
    "category": "DRINK",
    "price": 40,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "7bb1b308-130a-4ee5-b2c4-bff0a5e25c49",
    "name": "DRY CAKE",
    "category": "SNACKS",
    "price": 12,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "2cb63ae0-6f65-48c7-92f5-77add415f5ea",
    "name": "EGG FRY",
    "category": "SNACKS",
    "price": 18,
    "stock": 0,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "51d5db48-1160-468c-a55a-ef21b7e4b81d",
    "name": "EGG KHICURI",
    "category": "SNACKS",
    "price": 45,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  }
];
                  const filtered = allItems.filter(item => ids.includes(item.id));
                  
                  try {
                      const { data, error } = await supabase.from('Canteen_Menu').select('*').in('id', ids);
                      if (!error && data && data.length > 0) {
                          setDailyMenu(data);
                          return;
                      }
                  } catch(err) {
                      console.warn("Supabase fetchMenu failed, using local mock data.");
                  }
                  
                  setDailyMenu(filtered);
              } else {
                  setDailyMenu([]);
              }
          } catch(e){}
      } else {
          setDailyMenu([]);
      }
  };

  const handlePreOrder = (item: any, deltaQty: number = 1) => {
      try {
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

      {/* Active Service Section */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                  <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center space-x-2 mb-1">
                      <span className="text-[#4f46e5]"><Utensils className="w-4 h-4" /></span>
                      <span>Active Service</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                      <span className="bg-emerald-900/300/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-emerald-900/300 rounded-full animate-pulse" />
                          <span>Ordering Active</span>
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">20:00 PM - 12:00 PM</span>
                  </div>
              </div>
              
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyMenu.length === 0 ? (
                  <div className="col-span-1 md:col-span-2 py-10 flex flex-col items-center justify-center text-slate-400">
                      <Utensils className="w-8 h-8 mb-3 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No items curated for today</p>
                  </div>
              ) : (
                  dailyMenu.filter(item => (item.name || '').toLowerCase().includes(searchMenu.toLowerCase())).map((item, idx) => {
                      const pendingAct = activities.find(a => 
                          a.type === 'PRE-ORDER' && 
                          (
                              (a.description && item.name && a.description.toLowerCase().includes(item.name.toLowerCase())) ||
                              (a.items && item.name && a.items.toLowerCase().includes(item.name.toLowerCase()))
                          )
                      );
                      const pendingQty = pendingAct ? (Number(pendingAct.qty) || 1) : 0;
                      const isFlash = !!orderedItems[item.id];

                      return (
                          <div 
                              key={idx} 
                              className={`relative bg-slate-800 border ${
                                  pendingQty > 0 ? 'border-amber-500/60 bg-slate-800/90' : isFlash ? 'border-indigo-500/60' : 'border-slate-700 hover:bg-slate-700/80'
                              } rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all group overflow-hidden`}
                          >
                              <div className="min-w-0 pr-2">
                                  <div className="flex items-center space-x-2 mb-0.5">
                                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.category || 'SNACKS'}</p>
                                      {pendingQty > 0 && (
                                          <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-500/40 flex items-center space-x-1">
                                              <Zap className="w-2.5 h-2.5 fill-current mr-0.5" />
                                              <span>Qty: {pendingQty}</span>
                                          </span>
                                      )}
                                  </div>
                                  <p className="text-sm font-black text-white uppercase tracking-tight truncate">{item.name}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-1 mt-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>Rate: {item.price ? `৳${item.price}` : 'Rate Not Fixed'}</span>
                                  </p>
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