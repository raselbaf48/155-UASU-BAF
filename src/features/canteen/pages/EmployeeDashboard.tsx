import React, { useState, useEffect } from 'react';
import { Utensils, Search, Clock, Plus, Check } from 'lucide-react';
import { supabase } from '../../../supabase';
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

interface EmployeeDashboardProps { onManagerPortalClick?: () => void; currentUser?: any; }

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick, currentUser }) => {
  const [dailyMenu, setDailyMenu] = useState<any[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  
  useEffect(() => {
      fetchMenu();
      
      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'canteen_daily_menu') {
              fetchMenu();
          }
      };
      
      const handleCustomEvent = () => {
          fetchMenu();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('canteen_menu_updated', handleCustomEvent);
      
      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('canteen_menu_updated', handleCustomEvent);
      };
  }, []);

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
                      const { data, error } = await supabase.from('Canteen_Inventory').select('*').in('id', ids);
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

  const handlePreOrder = (item: any) => {
      setIsOrdering(true);
      setTimeout(() => {
          try {
              const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
              const existing = JSON.parse(existingStr);
              
              const newOrder = {
                  orderId: 'PO-' + Date.now(),
                  timestamp: new Date().toISOString(),
                  memberId: currentUser?.bdNo || 'Unknown ID',
                  memberName: currentUser?.name || 'Guest',
                  items: [{ id: item.id, name: item.name, qty: 1, price: item.price }],
                  total: item.price,
                  status: 'pending'
              };
              
              existing.push(newOrder);
              localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
              alert('Pre-order placed successfully!');
          } catch(e) {
              console.error(e);
          }
          setIsOrdering(false);
      }, 500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden h-auto md:h-40">
         {/* Left Side */}
         <div className="md:w-1/2 bg-[#0f172a] text-white p-8 flex flex-col justify-center items-center relative overflow-hidden">
            <Utensils className="absolute w-64 h-64 text-white opacity-20 -right-10 -bottom-10" />
            
            <div className="flex flex-col items-center space-y-2 z-10">
               <div className="bg-[#4f46e5]/20 p-2 rounded-2xl mb-1">
                 <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
                    <span className="text-[8px] text-[#4f46e5] text-center leading-tight font-bold">postimg<br/>free hosting</span>
                 </div>
               </div>
               <h2 className="text-4xl font-black tracking-widest flex items-center space-x-2">
                 <span>🍽️</span> <span>CAFEUAV</span> <span>🍽️</span>
               </h2>
               <p className="text-[10px] tracking-widest text-slate-400 font-bold uppercase">Eat Good Food, Serve Good!</p>
            </div>
         </div>
         {/* Right Side */}
         <div className="md:w-1/2 p-8 flex items-center justify-between">
            <div className="flex items-center space-x-4">
               <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-white shadow-md overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.name || 'Guest'}&backgroundColor=f1f5f9`} alt="User" className="w-full h-full object-cover" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">{currentUser?.role === 'manager' ? 'MANAGER' : 'MEMBER'}</p>
                  <p className="text-xl font-bold text-white dark:text-white leading-tight">{currentUser?.name || 'Guest'}</p>
                  <p className="text-xs font-bold text-slate-400">+880 1601-676760</p>
               </div>
            </div>
         </div>
      </div>
      
      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col - Cafe Performance */}
         <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex flex-col min-h-[400px]">
            <h3 className="text-sm font-black text-white tracking-widest uppercase mb-8 flex items-center space-x-2">
               <span className="text-[#4f46e5]">📈</span>
               <span>CAFE PERFORMANCE</span>
            </h3>
            <div className="flex-1 w-full h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                     <Tooltip
                        cursor={{ fill: '#1e293b' }}
                       contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: '#0f172a', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                       itemStyle={{ fontWeight: 'bold', color: '#818cf8' }}
                     />
                     <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={60}>
                       {data.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.total > 0 ? '#4f46e5' : '#334155'} />
                       ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
         {/* Right Col */}
         <div className="space-y-6 flex flex-col">
            {/* Account Check Card */}
            <div className="bg-[#0f172a] rounded-[2rem] p-8 shadow-xl shadow-slate-900/10 border border-slate-800">
               <h3 className="text-sm font-black text-white tracking-widest uppercase mb-6 flex items-center space-x-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <span>ACCOUNT CHECK</span>
               </h3>
               <div className="space-y-4">
                  <input 
                     type="text"
                     placeholder="ENTER MEMBER SID..."
                     className="w-full bg-[#1e293b] text-white px-5 py-4 rounded-2xl text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-400 border border-slate-800 text-center"
                  />
                  <button className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-4 rounded-2xl text-xs font-bold tracking-widest transition-all">
                     VALIDATE IDENTITY
                  </button>
               </div>
            </div>
            {/* Cycle Sales Card */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">CYCLE SALES</p>
               <h2 className="text-4xl font-black text-white tracking-tighter">৳14,069</h2>
            </div>
            {/* Global Debt Card */}
            <div className="bg-rose-900/10 rounded-[2rem] p-8 shadow-sm border border-rose-900/30 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-1">GLOBAL DEBT</p>
               <h2 className="text-4xl font-black text-rose-500 tracking-tighter">৳-1,816,144</h2>
            </div>
         </div>
      </div>
    </div>
  );
};
