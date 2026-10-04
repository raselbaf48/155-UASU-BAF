import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, ShoppingCart, Minus, Trash2, CheckCircle2, X, History, Calendar, Package as PackageIcon, AlertTriangle, ChefHat, Filter } from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';
import { deductRawStockForSales, restoreRawStockForSaleCancellation, getRecipeForMenuItem, getRawInventoryItems } from '../utils/recipeManager';
import { pushKeyToCloud, recordDeletedTxId } from '../utils/canteenCloudSync';

export const PosSales: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<any[]>([
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
]);
  const [basket, setBasket] = useState<any[]>([]);
  
  // Member Search State
  const [members, setMembers] = useState<any[]>([]);
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
    const { data, error } = await supabase.from('Canteen_Member').select('*');
    if (!error && data) {
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
  };

  const fetchCatalog = async () => {
    try {
        const { data, error } = await supabase.from('Canteen_Menu').select('*');
        if (!error && data && data.length > 0) {
            setCatalog(data);
        } else {
            setCatalog([
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
]);
        }
    } catch(e) {
        setCatalog([]);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const addToBasket = (item: any) => {
      const existing = basket.find(b => b.id === item.id);
      if (existing) {
          setBasket(basket.map(b => b.id === item.id ? { ...b, qty: b.qty + 1 } : b));
      } else {
          setBasket([...basket, { ...item, qty: 1 }]);
      }
  };

  const updateQty = (id: string, delta: number) => {
      setBasket(basket.map(b => {
          if (b.id === id) {
              let newQty = b.qty + delta;
              if (newQty < 1) newQty = 1;
              return { ...b, qty: newQty };
          }
          return b;
      }));
  };

  const removeFromBasket = (id: string) => {
      setBasket(basket.filter(b => b.id !== id));
  };

  const handleCheckout = async () => {
      if (basket.length === 0 || selectedMembers.length === 0) return;
      
      const memberChargeAmount = basketTotal;
      const multiplier = selectedMembers.length > 0 ? selectedMembers.length : 1;

      if (selectedMembers.length > 0) {
          for (const m of selectedMembers) {
              const currentDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
              const newDue = currentDue + memberChargeAmount;
              await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', m.airman_id);
              
              // save tx to localstorage for statement
              const txDateStr = formatCanteenDate(saleDate);
              const txMemberName = [m.Rank || m.rank, m.Surname || m.surname || m.Name || m.name].filter(Boolean).join(' ') || m['BD No'] || m.airman_id;
              const tx = {
                  id: Date.now() + Math.random(),
                  date: txDateStr,
                  airman_id: m.airman_id,
                  bdNo: m['BD No'] || m.bdNo || m.airman_id,
                  memberName: txMemberName,
                  rank: m.Rank || m.rank || '',
                  items: basket.map(b => `${b.name} (${b.qty})`).join(', '),
                  soldItems: basket.map(b => ({
                      menuItemId: b.id,
                      menuItemName: b.name,
                      price: Number(b.price || 0),
                      qty: b.qty
                  })),
                  amount: memberChargeAmount,
                  type: 'SALE',
                  gateway: 'DUE'
              };
              const existingTx = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
              const mergedTxs = [tx, ...existingTx];
              localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
              try {
                pushKeyToCloud('canteen_txs', mergedTxs);
              } catch (e) {}
              window.dispatchEvent(new Event('canteen_txs_updated'));
              window.dispatchEvent(new Event('canteen_state_updated'));
              window.dispatchEvent(new Event('storage'));
          }
          
          const newRecents = [...selectedMembers, ...recentMembers].reduce((acc, curr) => {
              if (!acc.find((x: any) => x.airman_id === curr.airman_id)) acc.push(curr);
              return acc;
          }, []).slice(0, 5);
          setRecentMembers(newRecents);
          localStorage.setItem('canteen_recent_members', JSON.stringify(newRecents));
      }

      // Deduct raw materials stock according to menu recipes
      const itemsForDeduction = basket.map(b => ({
          menuItemId: b.id,
          menuItemName: b.name,
          qty: b.qty * multiplier
      }));
      const deductionResult = deductRawStockForSales(itemsForDeduction);

      const deductionSummary = deductionResult.deducted.length > 0 
          ? ` (${deductionResult.deducted.length}টি কাঁচামালের স্টক বিয়োগ হয়েছে)`
          : '';
      setToastMessage(`✅ Sale completed successfully for ৳${memberChargeAmount * multiplier}!${deductionSummary}`); 
      setTimeout(() => setToastMessage(''), 3000);
      
      setBasket([]);
      setSelectedMembers([]);
      setMemberSearchTerm('');
      fetchCatalog();
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
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10 flex flex-col md:flex-row gap-8">
      
      {/* Left Column: Catalog */}
      <div className="md:w-2/3 space-y-6">
         {/* Header */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h2 className="text-2xl font-black text-white uppercase tracking-tighter">CANTEEN POS</h2>
               
            </div>
            <button 
               onClick={loadHistory}
               className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold tracking-widest hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
            >
               <History className="w-4 h-4" />
               <span>HISTORY</span>
            </button>
         </div>

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
               const itemRecipe = getRecipeForMenuItem(item.id, item.name);

               return (
               <div 
                  key={i} 
                  onClick={() => addToBasket(item)} 
                  className={`rounded-2xl p-4 flex items-center justify-between border transition-all duration-300 bg-slate-900 cursor-pointer hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.3)] group ${
                     inBasket 
                        ? 'border-[#4f46e5] shadow-[0_10px_20px_-10px_rgba(79,70,229,0.2)]' 
                        : 'border-slate-800 hover:border-indigo-500/50'
                  }`}
               >
                  <div className="flex items-center space-x-4 min-w-0 flex-1 mr-2">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-colors duration-300 overflow-hidden shrink-0 border border-slate-800/80 ${
                        inBasket ? 'bg-indigo-900/30 text-indigo-400' : 'bg-[#0f172a] text-slate-400 group-hover:bg-slate-800 group-hover:text-indigo-300'
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
                        <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest mb-0.5">{item.category}</p>
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
                        onClick={(e) => { 
                           e.stopPropagation(); 
                           addToBasket(item); 
                        }} 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-sm transition-all duration-300 ${
                           inBasket 
                              ? 'bg-[#4f46e5] text-white hover:bg-[#4338ca] hover:scale-110 cursor-pointer' 
                              : 'bg-[#0f172a] text-white group-hover:bg-[#4f46e5] group-hover:scale-110 cursor-pointer'
                        }`}
                        title="Add to basket"
                     >
                        <Plus className="w-5 h-5" />
                     </button>
                  </div>
               </div>
            )})}
          </div>
       </div>

      {/* Right Column: Member Basket */}
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
                                  <p className="text-xs font-black text-white leading-tight truncate">{item.name}</p>
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

    
      {/* Delete Confirmation Modal */}
      {txDeleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-800 animate-in zoom-in-95">
                  <div className="text-center">
                      <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Remove Record?</h3>
                      <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to remove this history record? Member Due will be reversed, and both Catalog and RAW Material stocks (issue back) will be restored to store.</p>
                      
                      <div className="flex space-x-3">
                          <button onClick={() => setTxDeleteConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-200 transition-colors">
                              CANCEL
                          </button>
                          <button onClick={() => removeHistoryItem(txDeleteConfirmId)} className="flex-1 py-3 bg-rose-900/30 text-rose-500 rounded-xl text-xs font-black tracking-widest hover:bg-rose-600 hover:text-white transition-colors shadow-md shadow-rose-500/30">
                              REMOVE
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

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
