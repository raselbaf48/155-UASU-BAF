const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

// Add states for members and member selection
const statesTarget = `  const [catalog, setCatalog] = useState<any[]>([]);`;
const statesReplace = `  const [catalog, setCatalog] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);`;

code = code.replace(statesTarget, statesReplace);

// Add fetchMembers in useEffect
const effectTarget = `  useEffect(() => {
    fetchCatalog();
    loadDailyMenu();`;
const effectReplace = `  useEffect(() => {
    fetchMembers();
    fetchCatalog();
    loadDailyMenu();`;
code = code.replace(effectTarget, effectReplace);

// Add fetchMembers definition
const fetchCatalogTarget = `  const fetchCatalog = async () => {`;
const fetchCatalogReplace = `  const fetchMembers = async () => {
    const { data, error } = await supabase.from('Canteen').select('*');
    if (!error && data) {
        setMembers(data);
    }
  };

  const fetchCatalog = async () => {`;
code = code.replace(fetchCatalogTarget, fetchCatalogReplace);


// Update handleManualPreOrder
const handleManualTarget = `  const handleManualPreOrder = () => {
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

const handleManualReplace = `  const handleManualPreOrder = () => {
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
              items: [{ id: item.id, name: item.name, qty: 1, price: item.price }],
              total: item.price,
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
  };`;
code = code.replace(handleManualTarget, handleManualReplace);

// Update Manual Pre-Order form layout in JSX
const formTarget = `                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input 
                        type="text" 
                        placeholder="BD No (comma separated)" 
                        value={manualBd} 
                        onChange={e => setManualBd(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500" 
                    />
                    <input 
                        type="text" 
                        placeholder="Name" 
                        value={manualName} 
                        onChange={e => setManualName(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500" 
                    />
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
                    <button 
                        onClick={handleManualPreOrder} 
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-widest uppercase py-2 transition-all shadow-lg"
                    >
                        Add Pre-Order
                    </button>
                </div>`;

const formReplace = `                <div className="flex flex-col gap-3">
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
                           <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                               {members.filter(m => {
                                   const name = m['Surname'] || '';
                                   const bd = m['BD No'] || '';
                                   return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || bd.includes(memberSearchTerm);
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
                                       className="px-4 py-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700/50 last:border-0 transition-colors"
                                   >
                                       <div>
                                           <p className="text-xs font-bold text-white">{m['Rank']} {m['Surname']}</p>
                                           <p className="text-[10px] text-slate-400">BD: {m['BD No']}</p>
                                       </div>
                                       <Plus className="w-3 h-3 text-slate-400" />
                                   </div>
                               ))}
                           </div>
                       )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select 
                            value={manualItemId} 
                            onChange={e => setManualItemId(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500"
                        >
                            <option value="">Select Curated Item</option>
                            {catalog.filter(i => selectedItems.includes(i.id)).map(i => (
                                <option key={i.id} value={i.id}>{i.name} - ৳{i.price}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleManualPreOrder} 
                            disabled={selectedMembers.length === 0 || !manualItemId}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-widest uppercase py-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Pre-Order
                        </button>
                    </div>
                </div>`;
code = code.replace(formTarget, formReplace);

fs.writeFileSync(mgrFile, code);
