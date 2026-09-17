const fs = require('fs');

const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

// 1. Update handleManualPreOrder for multiple BDs
const oldManualHandler = `  const handleManualPreOrder = () => {
      if (!manualBd || !manualItemId) return;
      const item = catalog.find(i => i.id === manualItemId);
      if (!item) return;

      const newOrder = {
          orderId: 'PO-' + Date.now(),
          timestamp: new Date().toISOString(),
          memberId: manualBd,
          memberName: manualName || 'Guest',
          items: [{ id: item.id, name: item.name, qty: 1, price: item.price }],
          total: item.price,
          status: 'pending'
      };

      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      existing.push(newOrder);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
      
      const parsed = existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);

      setManualBd('');
      setManualName('');
      setManualItemId('');
  };`;
const newManualHandler = `  const handleManualPreOrder = () => {
      if (!manualBd || !manualItemId) return;
      const item = catalog.find(i => i.id === manualItemId);
      if (!item) return;

      const bdList = manualBd.split(',').map(s => s.trim()).filter(s => s);
      if (bdList.length === 0) return;

      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}

      bdList.forEach((bd, idx) => {
          const newOrder = {
              orderId: 'PO-' + Date.now() + '-' + idx,
              timestamp: new Date().toISOString(),
              memberId: bd,
              memberName: manualName || 'Guest',
              items: [{ id: item.id, name: item.name, qty: 1, price: item.price }],
              total: item.price,
              status: 'pending'
          };
          existing.push(newOrder);
      });

      localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
      
      const parsed = existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);

      setManualBd('');
      setManualName('');
      setManualItemId('');
  };`;
code = code.replace(oldManualHandler, newManualHandler);

// 2. Change modal to show selected items at top
const oldCatalogMap = `                          catalog.filter(i => (i.name || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => {
                              const isSelected = Array.isArray(selectedItems) && selectedItems.includes(item.id);
                          return (`;
const newCatalogMap = `                          [...catalog].sort((a, b) => {
                              const aSel = Array.isArray(selectedItems) && selectedItems.includes(a.id);
                              const bSel = Array.isArray(selectedItems) && selectedItems.includes(b.id);
                              if (aSel && !bSel) return -1;
                              if (!aSel && bSel) return 1;
                              return (a.name || '').localeCompare(b.name || '');
                          }).filter(i => (i.name || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => {
                              const isSelected = Array.isArray(selectedItems) && selectedItems.includes(item.id);
                          return (`;
code = code.replace(oldCatalogMap, newCatalogMap);

// 3. Update TODAY'S MENU & PRE-ORDERS layout
const oldTodaysMenu = `            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
               {todaysPreOrders.length === 0 ? (
                   <p className="text-slate-400 text-sm font-bold mt-4">No pre-orders yet for today.</p>
               ) : (
                   todaysPreOrders.map(po => (
                       <div key={po.orderId} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                           <div>
                               <p className="text-white font-bold text-sm">{po.memberName} <span className="text-slate-400 text-xs ml-2">({po.memberId})</span></p>
                               <p className="text-emerald-400 text-xs font-bold mt-1">{po.items.map((i:any) => i.name).join(', ')}</p>
                           </div>
                           <span className="text-white font-black">৳{po.total}</span>
                       </div>
                   ))
               )}
            </div>`;
const newTodaysMenu = `            {/* Curated Menu Items */}
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

            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pre-Orders</h4>
            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
               {todaysPreOrders.length === 0 ? (
                   <p className="text-slate-400 text-sm font-bold mt-4">No pre-orders yet for today.</p>
               ) : (
                   todaysPreOrders.map(po => (
                       <div key={po.orderId} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                           <div>
                               <p className="text-white font-bold text-sm">{po.memberName} <span className="text-slate-400 text-xs ml-2">({po.memberId})</span></p>
                               <p className="text-emerald-400 text-xs font-bold mt-1">{po.items.map((i:any) => i.name).join(', ')}</p>
                           </div>
                           <span className="text-white font-black">৳{po.total}</span>
                       </div>
                   ))
               )}
            </div>`;
code = code.replace(oldTodaysMenu, newTodaysMenu);

// Add descriptive placeholder to manualBd
code = code.replace('placeholder="BD No"', 'placeholder="BD No (comma separated)"');

fs.writeFileSync(mgrFile, code);
