const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

const oldLogic = /const handleRemoveTx = async \(txToRemove: any\) => \{[\s\S]*?fetchMembers\(\);\s*\};/;

const newLogic = `const handleRemoveTx = async (txToRemove: any) => {
      let amountToReverse = txToRemove.amount || 0;
      let newDue = statementMember.baki || 0;
      
      if (txToRemove.type === 'BILL PAYMENT') {
          newDue = newDue + amountToReverse;
      } else {
          newDue = Math.max(0, newDue - amountToReverse);
      }
      
      await supabase.from('Canteen').update({ baki: newDue }).eq('airman_id', statementMember.airman_id);
      
      if (txToRemove.type !== 'BILL PAYMENT') {
          if (txToRemove.items) {
              const parts = txToRemove.items.split(',');
              for (const part of parts) {
                  const match = part.trim().match(/(.+?)\\s*\\((\\d+)\\)$/);
                  if (match) {
                      const itemName = match[1].trim();
                      const qty = parseInt(match[2], 10);
                      const { data: invData } = await supabase.from('Canteen_Inventory').select('*').eq('name', itemName).single();
                      if (invData) {
                          await supabase.from('Canteen_Inventory').update({ stock: (invData.stock || 0) + qty }).eq('id', invData.id);
                      }
                  }
              }
          }
      }

      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const newTxs = txs.filter((t: any) => t.id !== txToRemove.id);
      localStorage.setItem('canteen_txs', JSON.stringify(newTxs));
      
      setStatementMember({...statementMember, baki: newDue});
      setStatementTx(statementTx.filter((t: any) => t.id !== txToRemove.id));
      setTxDeleteConfirmId(null);
      fetchMembers();
  };`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);
