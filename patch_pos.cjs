const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

// 1. Add state variables for success modal
code = code.replace(
    /const \[showHistoryModal, setShowHistoryModal\] = useState\(false\);/,
    `const [showHistoryModal, setShowHistoryModal] = useState(false);\n  const [showSuccessModal, setShowSuccessModal] = useState(false);\n  const [successMessage, setSuccessMessage] = useState('');`
);

// 2. Modify handleCheckout to early return if no member selected
// Also replace alert with modal state update
const oldHandleCheckout = /const handleCheckout = async \(\) => \{[\s\S]*?fetchCatalog\(\);\s*\};/;
const newHandleCheckout = `const handleCheckout = async () => {
      if (basket.length === 0 || selectedMembers.length === 0) return;
      
      const memberChargeAmount = basketTotal;
      const multiplier = selectedMembers.length > 0 ? selectedMembers.length : 1;

      if (selectedMembers.length > 0) {
          for (const m of selectedMembers) {
              const newBaki = (m.baki || 0) + memberChargeAmount;
              await supabase.from('Canteen').update({ baki: newBaki }).eq('airman_id', m.airman_id);
              
              // save tx to localstorage for statement
              const txDateStr = new Date(saleDate).toLocaleDateString('bn-BD');
              const tx = {
                  id: Date.now() + Math.random(),
                  date: txDateStr,
                  airman_id: m.airman_id,
                  items: basket.map(b => \`\${b.name} (\${b.qty})\`).join(', '),
                  amount: memberChargeAmount
              };
              const existingTx = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
              localStorage.setItem('canteen_txs', JSON.stringify([tx, ...existingTx]));
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

      setSuccessMessage(\`Sale completed successfully for ৳\${memberChargeAmount * multiplier}!\`);
      setShowSuccessModal(true);
      
      setBasket([]);
      setSelectedMembers([]);
      setMemberSearchTerm('');
      fetchCatalog();
  };`;
code = code.replace(oldHandleCheckout, newHandleCheckout);

// 3. Update the COMPLETE SALE button disabled condition and style
const oldButton = /<button\s*onClick=\{handleCheckout\}\s*disabled=\{basket\.length === 0\}\s*className=\{\`w-full py-4 rounded-xl text-\[10px\] font-black tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-md \$\{basket\.length > 0 \? 'bg-emerald-900\/30 hover:bg-emerald-600 text-white shadow-emerald-500\/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'\}\`\}\s*>\s*<CheckCircle2 className="w-4 h-4" \/>\s*<span>COMPLETE SALE<\/span>\s*<\/button>/;

const newButton = `<button 
                    onClick={handleCheckout}
                    disabled={basket.length === 0 || selectedMembers.length === 0}
                    className={\`w-full py-4 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-md \${(basket.length > 0 && selectedMembers.length > 0) ? 'bg-emerald-900/30 hover:bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}\`}
                >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>COMPLETE SALE</span>
                </button>`;
code = code.replace(oldButton, newButton);


// 4. Append Success Modal to the bottom
const finalDivIdx = code.lastIndexOf('</div>');
const successModal = `
      {/* Success Modal */}
      {showSuccessModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-slate-800 animate-in zoom-in-95 text-center">
                  <div className="w-20 h-20 bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Success!</h2>
                  <p className="text-sm font-bold text-slate-400 mb-8">{successMessage}</p>
                  
                  <button 
                      onClick={() => setShowSuccessModal(false)}
                      className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black tracking-widest transition-colors shadow-md shadow-indigo-500/20"
                  >
                      CONTINUE
                  </button>
              </div>
          </div>
      )}
`;
code = code.substring(0, finalDivIdx) + successModal + code.substring(finalDivIdx);

fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', code);
