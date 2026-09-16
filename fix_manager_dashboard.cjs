const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');

// Find the line with `<div` after `return (` and before `Curate Daily Menu Modal`
const toFix = `  return (
    <div
      {/* Curate Daily Menu Modal */}`;
      
const fixed = `  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Curate Daily Menu Modal */}`;
      
code = code.replace(toFix, fixed);

fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', code);
