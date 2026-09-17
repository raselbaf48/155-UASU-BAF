const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const targetStr = `  const handleCancelPreOrder = (orderId: string) => {`;
const replaceStr = `  const handleCompletePreOrder = async (order: any) => {
      // Find member
      const member = members.find(m => m['BD No'] === order.memberId);
      if (!member) {
          alert('Member not found!');
          return;
      }
      
      // Update baki
      const newBaki = (member.baki || 0) + order.total;
      await supabase.from('Canteen').update({ baki: newBaki }).eq('airman_id', member.airman_id);
      
      // Update stock
      for (const item of order.items) {
          const dbItem = catalog.find(c => c.id === item.id);
          if (dbItem) {
              const newStock = Math.max(0, (dbItem.stock || 0) - item.qty);
              await supabase.from('Canteen_Inventory').update({ stock: newStock }).eq('id', dbItem.id);
          }
      }
      
      // Record transaction
      const tx = {
          id: Date.now() + Math.random(),
          date: new Date().toLocaleDateString('bn-BD'),
          airman_id: member.airman_id,
          items: order.items.map((i: any) => \`\${i.name} (\${i.qty})\`).join(', '),
          amount: order.total
      };
      const existingTx = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      localStorage.setItem('canteen_txs', JSON.stringify([tx, ...existingTx]));
      
      // Update order status
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.map((p: any) => p.orderId === order.orderId ? {...p, status: 'completed'} : p);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
      
      // Refresh local state to reflect baki and stock
      fetchMembers();
      fetchCatalog();
  };

  const handleCancelPreOrder = (orderId: string) => {`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync(mgrFile, code);
