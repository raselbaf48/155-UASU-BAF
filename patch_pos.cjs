const fs = require('fs');

let code = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

// 1. Add txDeleteConfirmId state
code = code.replace(
    /const \[salesHistory, setSalesHistory\] = useState<any\[\]>\(\[\]\);/,
    "const [salesHistory, setSalesHistory] = useState<any[]>([]);\n  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<string | null>(null);"
);

// 2. Change removeHistoryItem to handleRemoveTx (the actual deletion logic)
code = code.replace(
    /const removeHistoryItem = async \(txId: string\) => {[\s\S]*?alert\("Entry removed and member DUE reversed successfully."\);\n  };/,
    `const removeHistoryItem = async (txId: string) => {
      const txToRemove = salesHistory.find(tx => tx.id === txId);
      if (!txToRemove) return;

      // Reverse Due
      const m = members.find(m => m.airman_id === txToRemove.airman_id);
      if (m) {
          const newBaki = Math.max(0, (m.baki || 0) - txToRemove.amount);
          await supabase.from('Canteen').update({ baki: newBaki }).eq('airman_id', txToRemove.airman_id);
          setMembers(members.map(member => member.airman_id === txToRemove.airman_id ? {...member, baki: newBaki} : member));
      }

      // Restore Stock
      if (txToRemove.items) {
          const itemsArray = txToRemove.items.split(',').map((s: string) => s.trim());
          for (const itemStr of itemsArray) {
              const match = itemStr.match(/(.+?)\\s+\\((\\d+)\\)/);
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
  };`
);

// 3. Rename "HISTORY & EDIT ENTRY" to "HISTORY"
code = code.replace(/HISTORY & EDIT ENTRY/g, "HISTORY");

// 4. Change delete button onClick in PosSales
code = code.replace(
    /onClick=\{\(\) => removeHistoryItem\(tx.id\)\}/g,
    "onClick={() => setTxDeleteConfirmId(tx.id)}"
);

// 5. Add Delete Confirmation Modal to PosSales
const deleteModal = `
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
`;
code = code.replace(/\{\/\* History Modal \*\/\}/, deleteModal + "\n    {/* History Modal */}");

fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', code);
