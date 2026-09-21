import React, { useState, useEffect } from 'react';
import { Search, Plus, ShoppingCart, Minus, Trash2, CheckCircle2, X, History, Calendar, Package as PackageIcon } from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';

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

  const removeHistoryItem = async (txId: string) => {
      const txToRemove = salesHistory.find(tx => tx.id === txId);
      if (!txToRemove) return;

      // Reverse Due
      const m = members.find(m => m.airman_id === txToRemove.airman_id);
      if (m) {
          const currentDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
          const newDue = Math.max(0, currentDue - txToRemove.amount);
          await supabase.from('Canteen').update({ Due: newDue }).eq('airman_id', txToRemove.airman_id);
          setMembers(members.map(member => member.airman_id === txToRemove.airman_id ? {...member, Due: newDue, baki: newDue} : member));
      }

      // Restore Stock
      if (txToRemove.items) {
          const itemsArray = txToRemove.items.split(',').map((s: string) => s.trim());
          for (const itemStr of itemsArray) {
              const match = itemStr.match(/(.+?)\s+\((\d+)\)/);
              if (match) {
                  const itemName = match[1];
                  const qty = parseInt(match[2]);
                  const itemObj = catalog.find((c: any) => c.name === itemName);
                  if (itemObj) {
                      const newStock = (itemObj.stock || 0) + qty;
                      await supabase.from('Canteen_Inventory').update({ stock: newStock }).eq('id', itemObj.id);
                  }
              }
          }
          fetchCatalog(); // Refresh catalog after stock restoration
      }

      const updatedHistory = salesHistory.filter(tx => tx.id !== txId);
      setSalesHistory(updatedHistory);
      localStorage.setItem('canteen_txs', JSON.stringify(updatedHistory));
      setTxDeleteConfirmId(null);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase.from('Canteen').select('*');
    if (!error && data) {
        setMembers(data.map((m: any) => ({
          ...m,
          Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
          baki: Number(m.Due ?? m.due ?? m.baki ?? 0)
        })));
    }
  };

  const fetchCatalog = async () => {
    try {
        const { data, error } = await supabase.from('Canteen_Inventory').select('*');
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
              const newQty = Math.max(1, b.qty + delta);
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
              await supabase.from('Canteen').update({ Due: newDue }).eq('airman_id', m.airman_id);
              
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
                  amount: memberChargeAmount,
                  type: 'SALE',
                  gateway: 'DUE'
              };
              const existingTx = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
              localStorage.setItem('canteen_txs', JSON.stringify([tx, ...existingTx]));
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

      for (const b of basket) {
          const totalQtySold = b.qty * multiplier;
          const newStock = Math.max(0, (b.stock || 0) - totalQtySold);
          await supabase.from('Canteen_Inventory').update({ stock: newStock }).eq('id', b.id);
      }

      setToastMessage(`✅ Sale completed successfully for ৳${memberChargeAmount * multiplier}!`); setTimeout(() => setToastMessage(''), 2500);
      
      setBasket([]);
      setSelectedMembers([]);
      setMemberSearchTerm('');
      fetchCatalog();
  };

  const filteredCatalog = catalog.filter(item => 
      (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ACTIVE NODE</p>
            </div>
            <button 
               onClick={loadHistory}
               className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold tracking-widest hover:bg-slate-700 transition-colors shadow-sm"
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
               placeholder="Search catalog..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
            />
         </div>

         {/* Items List */}
         <div className="space-y-3 h-[600px] overflow-y-auto pr-2">
            {filteredCatalog.map((item, i) => {
               const inBasket = basket.find(b => b.id === item.id);
               return (
               <div key={i} onClick={() => addToBasket(item)} className={`bg-slate-900 rounded-2xl p-4 flex items-center justify-between border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.3)] group ${inBasket ? 'border-[#4f46e5] shadow-[0_10px_20px_-10px_rgba(79,70,229,0.2)]' : 'border-slate-800 hover:border-indigo-500/50'}`}>
                  <div className="flex items-center space-x-4">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-colors duration-300 overflow-hidden shrink-0 border border-slate-800/80 ${inBasket ? 'bg-indigo-900/30 text-indigo-400' : 'bg-[#0f172a] text-slate-400 group-hover:bg-slate-800 group-hover:text-indigo-300'}`}>
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
                     <div>
                        <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest mb-0.5">{item.category}</p>
                        <h3 className="font-black text-white text-base group-hover:text-indigo-400 transition-colors">{item.name}</h3>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">STOCK: {item.stock}</p>
                     </div>
                  </div>
                  <div className="flex items-center space-x-6">
                     <p className="text-xl font-black tracking-tighter text-white">৳{item.price}</p>
                     <button onClick={(e) => { e.stopPropagation(); addToBasket(item); }} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-sm transition-all duration-300 ${inBasket ? 'bg-[#4f46e5] text-white hover:bg-[#4338ca] hover:scale-110' : 'bg-[#0f172a] text-white group-hover:bg-[#4f46e5] group-hover:scale-110'}`}>
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
                      <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to remove this history record? Member Due will be reversed and stock will be restored.</p>
                      
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

    {/* History Modal */}
    {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-[2rem] p-6 w-full max-w-2xl shadow-xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-2">
                        <div className="p-2 bg-indigo-900/30 text-indigo-500 rounded-lg">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">SALES HISTORY</h3>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">RECENT TRANSACTIONS</p>
                        </div>
                    </div>
                    <button onClick={() => setShowHistoryModal(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="space-y-3">
                    {salesHistory.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <History className="w-12 h-12 mx-auto opacity-20 mb-3" />
                            <p className="text-xs font-bold uppercase tracking-widest">No Sales History Found</p>
                        </div>
                    ) : (
                        salesHistory.map(tx => {
                            const m = members.find(m => m.airman_id === tx.airman_id);
                            const memberName = m ? `${m['Rank']} ${m['Surname']}` : tx.airman_id;
                            
                            return (
                                <div key={tx.id} className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700">
                                    <div>
                                        <p className="text-xs font-black text-white">{memberName}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">{formatCanteenDate(tx.date)} • {tx.items}</p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <p className="text-sm font-black text-white">৳{tx.amount}</p>
                                        <button 
                                            onClick={() => setTxDeleteConfirmId(tx.id)}
                                            className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-900/30 rounded-lg transition-colors"
                                            title="Remove Entry & Reverse Due"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
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
