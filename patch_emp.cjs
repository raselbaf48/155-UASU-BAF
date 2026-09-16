const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', 'utf8');

if (!code.includes("import { supabase }")) {
    code = code.replace("import { Utensils, Search } from 'lucide-react';", "import { Utensils, Search, Clock, Plus, Check } from 'lucide-react';\nimport { supabase } from '../../../supabase';\nimport { useEffect } from 'react';");
}

code = code.replace("interface EmployeeDashboardProps { onManagerPortalClick?: () => void; }", "interface EmployeeDashboardProps { onManagerPortalClick?: () => void; currentUser?: any; }");
code = code.replace("export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick }) => {", 
`export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick, currentUser }) => {
  const [dailyMenu, setDailyMenu] = useState<any[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  
  useEffect(() => {
      fetchMenu();
  }, []);

  const fetchMenu = async () => {
      const stored = localStorage.getItem('canteen_daily_menu');
      if (stored) {
          try {
              const ids = JSON.parse(stored);
              if (ids.length > 0) {
                  const { data, error } = await supabase.from('Canteen_Inventory').select('*').in('id', ids);
                  if (!error && data) {
                      setDailyMenu(data);
                  }
              }
          } catch(e){}
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
                  items: [{ id: item.id, name: item.Item_Name, qty: 1, price: item.Selling_Price }],
                  total: item.Selling_Price,
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
`);

// Now add the Daily Menu Section below the Top Banner.
const topBannerEnd = `            <button onClick={onManagerPortalClick} className="px-6 py-3 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold tracking-widest transition-all shadow-md shadow-indigo-500/30">
               PERSONAL PORTAL
            </button>
         </div>
      </div>`;

const dailyMenuSection = `
      {/* Daily Menu Section */}
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
         <h3 className="text-xs font-black text-slate-900 tracking-widest uppercase mb-6 flex items-center space-x-2">
            <span className="text-[#4f46e5]">🍽️</span>
            <span>TODAY'S SPECIAL MENU</span>
         </h3>
         
         {dailyMenu.length === 0 ? (
             <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                 <Utensils className="w-10 h-10 mb-3 opacity-20" />
                 <p className="text-[10px] font-bold uppercase tracking-widest">No items curated for today</p>
             </div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {dailyMenu.map((item, idx) => (
                     <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all">
                         <div className="flex items-center space-x-4">
                             <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                                 <Utensils className="w-6 h-6" />
                             </div>
                             <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.Category || 'Snacks'}</p>
                                 <p className="text-sm font-bold text-slate-900">{item.Item_Name}</p>
                                 <p className="text-xs font-black text-[#4f46e5]">৳{item.Selling_Price}</p>
                             </div>
                         </div>
                         <button 
                             onClick={() => handlePreOrder(item)}
                             disabled={isOrdering}
                             className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shrink-0 shadow-sm"
                         >
                             <Plus className="w-5 h-5" />
                         </button>
                     </div>
                 ))}
             </div>
         )}
      </div>
`;

code = code.replace(topBannerEnd, topBannerEnd + "\n" + dailyMenuSection);

// Fix the hardcoded names in EmployeeDashboard if possible.
const hardcodedName = `<p className="text-xl font-bold text-slate-900 leading-tight">LAC Nishad</p>`;
const dynName = `<p className="text-xl font-bold text-slate-900 leading-tight">{currentUser?.name || 'Guest'}</p>`;
code = code.replace(hardcodedName, dynName);

const hardcodedTitle = `<p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">RUNNING MANAGER</p>`;
const dynTitle = `<p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">{currentUser?.role === 'manager' ? 'MANAGER' : 'MEMBER'}</p>`;
code = code.replace(hardcodedTitle, dynTitle);

fs.writeFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', code);
