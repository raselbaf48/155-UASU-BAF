const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// Wrap the main content
const returnStart = `  return (
    <div className="space-y-6 relative">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">`;

const newReturnStart = `  return (
    <div className="relative">
      <div className={selectedDuty ? 'print:hidden space-y-6' : 'space-y-6'}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">`;

content = content.replace(returnStart, newReturnStart);

const modalStart = `      {/* Duty Details Modal */}
      {selectedDuty && (
        <DutyDetailsModal`;

const newModalStart = `      </div>
      {/* Duty Details Modal */}
      {selectedDuty && (
        <DutyDetailsModal`;

content = content.replace(modalStart, newModalStart);

// Now fix the modal classes
content = content.replace(
  'className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"',
  'className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:static print:inset-auto print:p-0 print:bg-transparent print:backdrop-blur-none print:z-auto print:block print:w-full"'
);

content = content.replace(
  'className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"',
  'className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:rounded-none print:max-w-full print:max-h-none print:h-auto print:bg-white print:text-black print:overflow-visible print:block"'
);

content = content.replace(
  'className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50"',
  'className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 print:bg-white print:border-none print:px-0 print:py-2 print:text-black"'
);

content = content.replace(
  'className="p-0 overflow-auto flex-1"',
  'className="p-0 overflow-auto flex-1 print:overflow-visible print:h-auto print:flex-none print:block"'
);

content = content.replace(
  'className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 z-10 shadow-xs backdrop-blur-md"',
  'className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 z-10 shadow-xs backdrop-blur-md print:static print:bg-white print:shadow-none print:text-black print:border-b-2 print:border-black"'
);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);
