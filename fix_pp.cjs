const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/PersonalPortal.tsx', 'utf8');

// 1. CheckCircle2 is already imported because of the previous patch attempt, let's verify
if (!code.includes('CheckCircle2')) {
    code = code.replace(/import \{ (.*?) \} from 'lucide-react';/, "import { $1, CheckCircle2 } from 'lucide-react';");
}

// 2. Add orderedItems state
code = code.replace(
    /const \[activities, setActivities\] = useState<any\[\]>\(\[\]\);\n\s*const \[toastMessage, setToastMessage\] = useState\(''\);/,
    "const [activities, setActivities] = useState<any[]>([]);\n  const [orderedItems, setOrderedItems] = useState<Record<string, boolean>>({});"
);

// 3. Update handlePreOrder
const newHandlePreOrder = `
  const handlePreOrder = (item: any) => {
      setIsOrdering(true);
      setOrderedItems(prev => ({...prev, [item.id]: true}));
      
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
              fetchActivities();
          } catch(e) {
              console.error(e);
          }
          setIsOrdering(false);
          setTimeout(() => {
              setOrderedItems(prev => ({...prev, [item.id]: false}));
          }, 2000);
      }, 500);
  };
`;
code = code.replace(/const handlePreOrder = \(item: any\) => \{[\s\S]*?\}, 500\);\n  \};/, newHandlePreOrder.trim());

// 4. Update the item mapping
const oldMapping = `<div key={idx} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center justify-between hover:shadow-md hover:bg-slate-700 transition-all group">`;
const newMapping = `<div key={idx} className={\`relative bg-slate-800 border \${orderedItems[item.id] ? 'border-emerald-500/50' : 'border-slate-700 hover:bg-slate-700'} rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all group overflow-hidden\`}>
                          {orderedItems[item.id] && (
                              <div className="absolute inset-0 bg-emerald-900/95 backdrop-blur-sm z-10 flex items-center justify-center animate-in fade-in duration-300">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
                                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Ordered Successfully</span>
                              </div>
                          )}`;
code = code.replace(/<div key=\{idx\} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center justify-between hover:shadow-md hover:bg-slate-700 transition-all group">/g, newMapping);

fs.writeFileSync('src/features/canteen/pages/PersonalPortal.tsx', code);
