const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

// Insert logic functions right before "const openStatement = (member: any) => {"
const logic = `
  const handleSettleAccount = async () => {
      if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) return;
      const amount = Number(payAmount);
      const newDue = Math.max(0, (statementMember.baki || 0) - amount);
      
      await supabase.from('Canteen').update({ baki: newDue }).eq('airman_id', statementMember.airman_id);
      
      const tx = {
          id: Date.now() + Math.random(),
          date: new Date().toLocaleDateString('bn-BD'),
          airman_id: statementMember.airman_id,
          items: 'BILL PAYMENT',
          amount: amount,
          type: 'BILL PAYMENT',
          gateway: payMethod
      };
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      localStorage.setItem('canteen_txs', JSON.stringify([tx, ...txs]));
      
      setStatementMember({...statementMember, baki: newDue});
      
      try {
          const memberTxs = [tx, ...txs].filter((t: any) => t.airman_id === statementMember.airman_id);
          setStatementTx(memberTxs);
      } catch(e) {}
      
      setShowPayBillModal(false);
      setPayAmount('');
      fetchMembers();
  };

  const handleRemoveTx = async (txToRemove: any) => {
      let amountToReverse = txToRemove.amount || 0;
      let newDue = statementMember.baki || 0;
      
      if (txToRemove.type === 'BILL PAYMENT') {
          newDue = newDue + amountToReverse;
      } else {
          newDue = Math.max(0, newDue - amountToReverse);
      }
      
      await supabase.from('Canteen').update({ baki: newDue }).eq('airman_id', statementMember.airman_id);
      
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const newTxs = txs.filter((t: any) => t.id !== txToRemove.id);
      localStorage.setItem('canteen_txs', JSON.stringify(newTxs));
      
      setStatementMember({...statementMember, baki: newDue});
      setStatementTx(statementTx.filter((t: any) => t.id !== txToRemove.id));
      setTxDeleteConfirmId(null);
      fetchMembers();
  };

`;

code = code.replace(
    /const openStatement = \(member: any\) => \{/,
    logic + '  const openStatement = (member: any) => {'
);


// Modals: Pay Bill Modal and Remove Tx Modal
// Append before final closing div
const finalDivIdx = code.lastIndexOf('</div>');

const modals = `
      {/* Pay Bill Modal */}
      {showPayBillModal && statementMember && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                      <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">RECORD PAYMENT</h2>
                      <button onClick={() => setShowPayBillModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                          <X className="w-4 h-4" />
                      </button>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center mb-6 relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">OUTSTANDING BALANCE</p>
                      <p className="text-4xl font-black text-rose-500 tracking-tighter">৳{statementMember.baki || 0}</p>
                  </div>
                  
                  <div className="mb-6 relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">RECEIVED AMOUNT</p>
                      <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">৳</span>
                          <input 
                              type="number" 
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="w-full bg-[#111827] text-white text-3xl font-black tracking-tighter py-5 pl-14 pr-6 rounded-3xl outline-none placeholder:text-slate-700 shadow-inner"
                              placeholder="0.00"
                          />
                      </div>
                  </div>
                  
                  <div className="flex space-x-2 p-1 bg-slate-50 rounded-2xl mb-8 border border-slate-100 relative z-10">
                      <button 
                          onClick={() => setPayMethod('CASH')}
                          className={\`flex-1 py-3 text-xs font-black tracking-widest rounded-xl transition-all \${payMethod === 'CASH' ? 'bg-[#5b51ef] text-white shadow-md shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-600'}\`}
                      >
                          CASH
                      </button>
                      <button 
                          onClick={() => setPayMethod('UCB')}
                          className={\`flex-1 py-3 text-xs font-black tracking-widest rounded-xl transition-all \${payMethod === 'UCB' ? 'bg-[#5b51ef] text-white shadow-md shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-600'}\`}
                      >
                          UCB
                      </button>
                  </div>
                  
                  <button onClick={handleSettleAccount} className="w-full py-5 bg-[#75cda6] hover:bg-[#63b993] text-white rounded-3xl text-sm font-black tracking-widest uppercase transition-colors shadow-lg shadow-emerald-500/20 relative z-10">
                      SETTLE ACCOUNT
                  </button>
              </div>
          </div>
      )}

      {/* Remove TX Confirm Modal */}
      {txDeleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-800 animate-in zoom-in-95">
                  <div className="text-center">
                      <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Remove Record?</h3>
                      <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to remove this history record? Member Due will be reversed.</p>
                      
                      <div className="flex space-x-3">
                          <button onClick={() => setTxDeleteConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-200 transition-colors">
                              CANCEL
                          </button>
                          <button onClick={() => handleRemoveTx(txDeleteConfirmId)} className="flex-1 py-3 bg-rose-900/30 text-white rounded-xl text-xs font-black tracking-widest hover:bg-rose-600 transition-colors shadow-md shadow-rose-500/30">
                              REMOVE
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
`;

code = code.substring(0, finalDivIdx) + modals + code.substring(finalDivIdx);

fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);
