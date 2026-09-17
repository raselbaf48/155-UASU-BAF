import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, Search, X, Check, ChefHat, Clock, Plus, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../supabase';
import { useEffect } from 'react';
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
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [preOrderTab, setPreOrderTab] = useState<'pending'|'completed'>('pending');
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
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [preOrders, setPreOrders] = useState<any[]>([]);
  const [searchCatalog, setSearchCatalog] = useState('');

  useEffect(() => {
    fetchMembers();
    fetchCatalog();
    loadDailyMenu();
    loadPreOrders();
    
    // Set up an interval to refresh pre-orders
    const interval = setInterval(loadPreOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchMembers = async () => {
    const { data, error } = await supabase.from('Canteen').select('*');
    if (!error && data) {
        setMembers(data);
    }
  };

  const fetchCatalog = async () => {
    try {
        const { data, error } = await supabase.from('Canteen_Inventory').select('*');
        if (!error && data && data.length > 0) {
            setCatalog(data);
        } else {
            // fallback mock data
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
    } catch (e) {
        setCatalog([]);
    }
  };

  const loadDailyMenu = () => {
    const stored = localStorage.getItem('canteen_daily_menu');
    if (stored) {
        try { 
            const parsed = JSON.parse(stored); 
            if (Array.isArray(parsed)) setSelectedItems(parsed);
            else setSelectedItems([]);
        } catch(e){
            setSelectedItems([]);
        }
    }
  };

  const loadPreOrders = () => {
      const stored = localStorage.getItem('canteen_pre_orders');
      if (stored) {
          try { 
              const parsed = JSON.parse(stored);
              // filter today's orders maybe? For now just load all
              setPreOrders(parsed.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); 
          } catch(e){}
      }
  };

  const toggleSelection = (id: string) => {
      setSelectedItems(prev => {
          const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
          localStorage.setItem('canteen_daily_menu', JSON.stringify(next));
          window.dispatchEvent(new Event('canteen_menu_updated'));
          return next;
      });
  };



  const { t, i18n } = useTranslation();
  const [memberSid, setMemberSid] = useState('');
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
      
      const parsed = existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);

      setSelectedMembers([]);
      setMemberSearchTerm('');
      setManualItemId('');
      setManualQty(1);
  };
  
  const handleRevertPreOrder = async (order: any) => {
      const member = members.find(m => String(m['BD No']) === String(order.memberId));
      if (member) {
          const newBaki = (member.baki || 0) - order.total;
          await supabase.from('Canteen').update({ baki: newBaki }).eq('airman_id', member.airman_id);
      }
      
      for (const item of order.items) {
          const dbItem = catalog.find(c => c.id === item.id);
          if (dbItem) {
              const newStock = (dbItem.stock || 0) + item.qty;
              await supabase.from('Canteen_Inventory').update({ stock: newStock }).eq('id', dbItem.id);
          }
      }
      
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const updatedTxs = txs.filter((t: any) => t.amount !== order.total || t.date !== new Date(order.timestamp).toLocaleDateString('bn-BD') || !t.items.includes(order.items[0].name));
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.map((p: any) => p.orderId === order.orderId ? {...p, status: 'pending'} : p);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
  };

  const handleCompletePreOrder = async (order: any) => {
      // Find member
      const member = members.find(m => String(m['BD No']) === String(order.memberId));
      if (!member) {
          alert('Member not found!');
          return;
      }
      
      // Update baki
      const newBaki = (member.baki || 0) + order.total;
      await supabase.from('Canteen').update({ baki: newBaki }).eq('airman_id', member.airman_id);
      
      // Update stock
      for (const item of order.items) {
          const dbItem = catalog.find(c => c.id === item.id);
          if (dbItem) {
              const newStock = Math.max(0, (dbItem.stock || 0) - item.qty);
              await supabase.from('Canteen_Inventory').update({ stock: newStock }).eq('id', dbItem.id);
          }
      }
      
      // Record transaction
      const tx = {
          id: Date.now() + Math.random(),
          date: new Date().toLocaleDateString('bn-BD'),
          airman_id: member.airman_id,
          items: order.items.map((i: any) => `${i.name} (${i.qty})`).join(', '),
          amount: order.total
      };
      const existingTx = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      localStorage.setItem('canteen_txs', JSON.stringify([tx, ...existingTx]));
      
      // Update order status
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.map((p: any) => p.orderId === order.orderId ? {...p, status: 'completed'} : p);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
      
      // Refresh local state to reflect baki and stock
      fetchMembers();
      fetchCatalog();
  };

  const handleCancelPreOrder = () => {
      if (!cancelConfirmId) return;
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.filter((o: any) => o.orderId !== cancelConfirmId);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
      setCancelConfirmId(null);
  };
  
  const todayStr = new Date().toDateString();
  const todaysPreOrders = preOrders.filter(po => new Date(po.timestamp).toDateString() === todayStr);


  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Curate Daily Menu Modal */}
      {showCurateMenu && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                  <button onClick={() => setShowCurateMenu(false)} className="absolute top-6 right-6 p-2 bg-slate-800 hover:bg-slate-200 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-400" />
                  </button>
                  
                  <div className="flex items-center space-x-3 mb-6">
                      <ChefHat className="w-6 h-6 text-[#4f46e5]" />
                      <h2 className="text-xl font-black text-white uppercase tracking-widest">Curate Daily Menu</h2>
                  </div>

                  <div className="relative mb-6">
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
                          return (
                              <div 
                                  key={item.id} 
                                  onClick={() => toggleSelection(item.id)}
                                  className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#4f46e5] bg-[#4f46e5]/5' : 'border-slate-800 hover:border-slate-800'}`}
                              >
                                  <div className="flex items-center space-x-4">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-[#4f46e5] text-white' : 'bg-slate-800 text-slate-400'}`}>
                                          <Utensils className="w-5 h-5" />
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category || 'Snacks'}</p>
                                          <p className="text-sm font-bold text-white">{item.name}</p>
                                      </div>
                                  </div>
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-[#4f46e5] text-white' : 'bg-slate-800 text-slate-400'}`}>
                                      {isSelected ? <Check className="w-4 h-4" /> : <span className="text-lg leading-none">+</span>}
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
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center p-2 border border-slate-700 shadow-inner">
               <img src="https://i.postimg.cc/gcqqCXCL/Logo-(1).png" alt="Logo" className="w-full h-full object-contain opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            
            <h2 className="text-4xl font-black text-white tracking-widest flex items-center space-x-3">
               <span className="text-slate-400">🍽️</span> 
               <span>CAFEUAV</span> 
               <span className="text-slate-400">🍽️</span>
            </h2>
            <p className="text-[10px] tracking-widest text-slate-400 font-bold uppercase pb-2">Eat Good Food, Serve Good!</p>
            
            <button onClick={() => setShowCurateMenu(true)} className="px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center space-x-2">
               <span className="text-indigo-200">🍳</span>
               <span>CURATE DAILY MENU</span>
            </button>
         </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col - Cafe Performance */}
         <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-black text-white tracking-widest uppercase flex items-center space-x-2">
                  <span className="text-[#4f46e5]">📋</span>
                  <span>TODAY'S MENU & PRE-ORDERS</span>
               </h3>
               <div className="bg-indigo-500/20 text-indigo-400 px-4 py-1.5 rounded-full text-xs font-bold">
                  Total Pre-Orders: {todaysPreOrders.length}
               </div>
            </div>

            {/* Curated Menu Items */}
            <div className="mb-6">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Today's Menu Items</h4>
               <div className="flex flex-wrap gap-2">
                   {(!selectedItems || selectedItems.length === 0) ? (
                       <span className="text-slate-500 text-xs font-bold">No items curated</span>
                   ) : (
                       catalog.filter(i => selectedItems.includes(i.id)).map(item => (
                           <div key={item.id} className="bg-[#4f46e5]/10 border border-[#4f46e5]/20 text-[#4f46e5] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2">
                               <span>{item.name}</span>
                               <span className="opacity-50">৳{item.price}</span>
                           </div>
                       ))
                   )}
               </div>
            </div>


            <div className="p-5 bg-slate-800/40 rounded-2xl border border-slate-700">
                <h3 className="text-xs font-black text-white tracking-widest uppercase mb-4">Manual Pre-Order</h3>
                <div className="flex flex-col gap-3">
                    {selectedMembers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
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
                            placeholder="Search Member by Name or BD No..." 
                            value={memberSearchTerm} 
                            onChange={e => {
                                setMemberSearchTerm(e.target.value);
                                setShowMemberDropdown(true);
                            }}
                            onFocus={() => setShowMemberDropdown(true)}
                            onBlur={() => setTimeout(() => setShowMemberDropdown(false), 200)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500" 
                        />
                        {showMemberDropdown && (
                       <div className="absolute left-0 right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50">
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
                               return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || String(bd).includes(memberSearchTerm);
                           }).length === 0 && (
                               <div className="px-4 py-3 text-xs text-slate-400 text-center">No members found</div>
                           )}
                       </div>
                   )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select 
                            value={manualItemId} 
                            onChange={e => setManualItemId(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500"
                        >
                            <option value="">Select Item</option>
                            {catalog.filter(i => selectedItems.includes(i.id)).map(i => (
                                <option key={i.id} value={i.id}>{i.name} - ৳{i.price}</option>
                            ))}
                        </select>
                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Qty:</span>
                            <input 
                                type="number" 
                                min="1" 
                                value={manualQty} 
                                onChange={e => setManualQty(Number(e.target.value) || 1)} 
                                className="w-full bg-transparent text-sm font-bold text-slate-200 outline-none focus:border-indigo-500"
                            />
                        </div>
                        <button 
                            onClick={handleManualPreOrder} 
                            disabled={selectedMembers.length === 0 || !manualItemId}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-widest uppercase py-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Pre-Order
                        </button>
                    </div>
                </div>
            </div>
         </div>

         <div className="lg:col-span-3 bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex flex-col mt-6">
            <h3 className="text-xs font-black text-white tracking-widest uppercase mb-6 flex items-center justify-between">
               <div className="flex items-center space-x-2">
                  <span className="text-[#4f46e5]">🛎️</span>
                  <span>LIVE PRE-ORDERS</span>
               </div>
               <div className="flex bg-slate-800 p-1 rounded-full">
                   <button onClick={() => setPreOrderTab('pending')} className={`px-4 py-1.5 rounded-full text-[10px] uppercase font-bold transition-colors ${preOrderTab === 'pending' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-white'}`}>Pending ({preOrders.filter(p => p.status === 'pending').length})</button>
                   <button onClick={() => setPreOrderTab('completed')} className={`px-4 py-1.5 rounded-full text-[10px] uppercase font-bold transition-colors ${preOrderTab === 'completed' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-white'}`}>Completed ({preOrders.filter(p => p.status === 'completed').length})</button>
               </div>
            </h3>
            
            {preOrders.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
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
                        <tbody className="divide-y divide-slate-50">
                            {preOrders.filter((order: any) => order.status === preOrderTab).map((order: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-950 transition-colors">
                                    <td className="py-4 px-4 text-xs font-bold text-slate-400">
                                        {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="text-xs font-bold text-white">{order.memberName}</div>
                                        <div className="text-[10px] font-bold text-slate-400">{order.memberId}</div>
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
                                                <span key={i} className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md text-[10px] font-bold w-fit text-center min-w-[24px]">
                                                    {it.qty}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-xs font-black text-[#4f46e5]">৳{order.total}</td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-400'}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        {order.status === 'pending' ? (
                                            <div className="flex items-center justify-end space-x-3">
                                                <button 
                                                    onClick={() => {
                                                        handleCompletePreOrder(order);
                                                        alert('Order completed successfully!');
                                                    }}
                                                    title="Mark Done"
                                                    className="p-1.5 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded-full transition-colors flex items-center justify-center border border-emerald-500/20"
                                                >
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => setCancelConfirmId(order.orderId)}
                                                    className="p-1 text-rose-400 hover:text-rose-300 transition-colors flex items-center justify-center"
                                                    title="Cancel Order"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end">
                                                <button 
                                                    onClick={() => handleRevertPreOrder(order)}
                                                    className="px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/60 text-amber-500 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Revert to Pending
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
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
                                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                            >
                                Keep
                            </button>
                            <button 
                                onClick={handleCancelPreOrder}
                                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-rose-900/20"
                            >
                                Cancel It
                            </button>
                        </div>
                    </div>
                </div>
            </div>
         )}
         
         {/* Right Col */}
         <div className="space-y-6 flex flex-col">
            {/* Account Check Card */}
            <div className="bg-[#0f172a] rounded-[2rem] p-8 shadow-xl shadow-slate-900/10">
               <h3 className="text-xs font-black text-white tracking-widest uppercase mb-6 flex items-center space-x-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <span>ACCOUNT CHECK</span>
               </h3>
               <div className="space-y-4">
                  <div className="relative">
                     <input 
                        type="text"
                        placeholder="ENTER MEMBER SID..."
                        value={memberSid}
                        onChange={(e) => setMemberSid(e.target.value)}
                        className="w-full bg-[#1e293b] text-white px-5 py-4 rounded-2xl text-[10px] font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-400 border border-slate-800 text-center"
                     />
                  </div>
                  <button className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all shadow-md shadow-indigo-500/20">
                     VALIDATE IDENTITY
                  </button>
               </div>
            </div>

            {/* Cycle Sales Card */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">CYCLE SALES</p>
               <h2 className="text-4xl font-black text-white tracking-tighter">৳14,069</h2>
            </div>

            {/* Global Debt Card */}
            <div className="bg-rose-900/30 rounded-[2rem] p-8 shadow-sm border border-rose-900/50 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-2">GLOBAL DEBT</p>
               <h2 className="text-4xl font-black text-rose-600 tracking-tighter">৳-1,816,144</h2>
            </div>
         </div>
      </div>
    </div>
  );
};
