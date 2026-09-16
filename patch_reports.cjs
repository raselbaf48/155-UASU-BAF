const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/CanteenReports.tsx', 'utf8');

code = code.replace(/const mockAudit = \[[\s\S]*?\];/, '');

code = code.replace(
    /export const CanteenReports: React\.FC = \(\) => \{/,
    `export const CanteenReports: React.FC = () => {
  const [reports, setReports] = React.useState<any[]>([]);
  
  React.useEffect(() => {
     try {
         const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
         setReports(txs);
     } catch(e) {}
  }, []);`
);

code = code.replace(/mockAudit\.map/g, 'reports.map');
code = code.replace(/tx\.type/g, "(tx.type || 'CREDIT SALE')");
code = code.replace(/tx\.gateway/g, "(tx.gateway || 'DUE')");

fs.writeFileSync('src/features/canteen/pages/CanteenReports.tsx', code);
