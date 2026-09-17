const fs = require('fs');

let code = fs.readFileSync('src/features/canteen/pages/PersonalPortal.tsx', 'utf8');

// 1. Add state for activities and fetchActivities function
const newImportsAndState = `
  const [dailyMenu, setDailyMenu] = useState<any[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  const [searchMenu, setSearchMenu] = useState('');
  const [activities, setActivities] = useState<any[]>([]);

  const fetchActivities = () => {
      const preOrdersStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let preOrders = [];
      try { preOrders = JSON.parse(preOrdersStr); } catch(e) {}
      
      const txsStr = localStorage.getItem('canteen_txs') || '[]';
      let txs = [];
      try { txs = JSON.parse(txsStr); } catch(e) {}

      const userBdNo = currentUser?.bdNo || 'Unknown ID';
      
      const userPreOrders = preOrders.filter((po: any) => po.memberId === userBdNo).map((po: any) => ({
          type: 'PRE-ORDER',
          date: new Date(po.timestamp).toLocaleDateString('bn-BD'),
          items: po.items.map((i: any) => i.name).join(', '),
          amount: po.total,
          id: po.orderId
      }));
      
      const userTxs = txs.filter((tx: any) => tx.airman_id === userBdNo).map((tx: any) => ({
          type: 'PURCHASE',
          date: tx.date,
          items: tx.items,
          amount: tx.amount,
          id: tx.id
      }));

      // Sort recent first
      const allAct = [...userPreOrders.reverse(), ...userTxs];
      setActivities(allAct.slice(0, 15));
  };
`;
code = code.replace(
    /const \[dailyMenu, setDailyMenu\] = useState<any\[\]>\(\[\]\);\s*const \[isOrdering, setIsOrdering\] = useState\(false\);\s*const \[searchMenu, setSearchMenu\] = useState\(''\);/,
    newImportsAndState
);

// 2. Add fetchActivities to useEffect
code = code.replace(
    /useEffect\(\(\) => \{\s*fetchMenu\(\);\s*\}, \[\]\);/,
    `useEffect(() => {\n      fetchMenu();\n      fetchActivities();\n  }, [currentUser]);`
);

// 3. Update handlePreOrder to call fetchActivities
code = code.replace(
    /localStorage\.setItem\('canteen_pre_orders', JSON\.stringify\(existing\)\);\s*alert\('Pre-order placed successfully!'\);/,
    `localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));\n              fetchActivities();\n              alert('Pre-order placed successfully!');`
);

// 4. Replace the Mock Activity Log
const regexActivity = /<div className="space-y-4">[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);)/;
const newActivitySection = `<div className="space-y-4">
              {activities.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                      <History className="w-10 h-10 mx-auto opacity-20 mb-3" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No activities found</p>
                  </div>
              ) : (
                  activities.map((act, idx) => (
                      <React.Fragment key={act.id || idx}>
                          <div className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 rounded-2xl transition-colors border border-transparent hover:border-slate-700">
                              <div className="flex items-center space-x-4">
                                  <div className="w-10 h-10 rounded-full bg-indigo-900/20 flex items-center justify-center">
                                      {act.type === 'PRE-ORDER' ? <Zap className="w-4 h-4 text-emerald-400" /> : <ShoppingCart className="w-4 h-4 text-[#4f46e5]" />}
                                  </div>
                                  <div>
                                      <p className="text-xs font-black text-white uppercase tracking-tight">{act.items}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-1 mt-0.5">
                                          <span>{act.date}</span>
                                          <span className="w-1 h-1 rounded-full bg-slate-500" />
                                          <span className={act.type === 'PRE-ORDER' ? "text-emerald-400" : "text-indigo-400"}>{act.type}</span>
                                      </p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-sm font-black text-white">৳{act.amount}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
                              </div>
                          </div>
                          {idx < activities.length - 1 && <div className="w-full h-px bg-slate-800" />}
                      </React.Fragment>
                  ))
              )}
          </div>
      </div>
    </div>
  );
};
`;

// It's safer to use string index replacement for the activity section
const startIndex = code.indexOf('<div className="space-y-4">');
if (startIndex !== -1) {
    const EndText = '  );\n};\n';
    const endIndex = code.lastIndexOf(EndText);
    if (endIndex !== -1) {
        code = code.substring(0, startIndex) + newActivitySection;
    }
}

fs.writeFileSync('src/features/canteen/pages/PersonalPortal.tsx', code);
