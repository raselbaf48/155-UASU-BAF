const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

const oldRemove = /const removeHistoryItem = async \(\txId: string\) => \{[\s\S]*?alert\("Entry removed and member DUE reversed successfully\."\);\s*\};/;

const newRemove = `const removeHistoryItem = async (txId: string) => {
      const txToRemove = salesHistory.find(tx => tx.id === txId);
      if (!txToRemove) return;

      // Reverse Due
      const m = members.find(m => m.airman_id === txToRemove.airman_id);
      if (m) {
          let amountToReverse = txToRemove.amount || 0;
          let newBaki = (m.baki || 0);
          
          if (txToRemove.type === 'BILL PAYMENT') {
              newBaki = newBaki + amountToReverse;
          } else {
              newBaki = Math.max(0, newBaki - amountToReverse);
          }
          await supabase.from('Canteen').update({ baki: newBaki }).eq('airman_id', txToRemove.airman_id);
          
          // Update local member state to reflect immediate change
          setMembers(members.map(member => member.airman_id === txToRemove.airman_id ? {...member, baki: newBaki} : member));
      }

      if (txToRemove.type !== 'BILL PAYMENT') {
          // Restore stock
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
              // Refresh catalog to reflect new stock
              fetchCatalog();
          }
      }

      const updatedHistory = salesHistory.filter(tx => tx.id !== txId);
      setSalesHistory(updatedHistory);
      localStorage.setItem('canteen_txs', JSON.stringify(updatedHistory));
      alert("Entry removed, Due adjusted and stock restored successfully.");
  };`;

code = code.replace(oldRemove, newRemove);
fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', code);
