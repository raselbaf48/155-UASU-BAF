import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FlyingWingStateView } from './FlyingWingStateView';
import { Printer, X } from 'lucide-react';

export const PrintableFlyingWingModal = ({ date, uasuStats, onClose }: any) => {
  const formatted = new Date(date).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year: '2-digit'}).replace(/Sept/gi, 'Sep').replace(/ /g, ' ');
 useEffect(() => {
 const originalTitle = document.title;
 // moved outside.toLocaleDateString("en-GB", {day:"2-digit", month:"short", year: '2-digit'}).replace(/ /g, ' '); 
 document.title = `Consolidated Night Count State - Flg Wg (${formatted})`;
 return () => {
 document.title = originalTitle;
 };
 }, [date]);

 return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-sm overflow-auto print:bg-white text-black print:p-0 print:static print:w-full print:h-auto print:z-[9999]">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
 {/* Top action bar - Hidden during print */}
 <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 p-4 print:hidden shadow-2xl">
 <div className="max-w-[10.5in] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div className="flex items-center space-x-4 text-white">
 <div>
 <h2 className="text-base sm:text-xl font-bold">Print Preview: Flying Wing</h2>
 <p className="text-slate-400 text-xs sm:text-sm">Review document before printing</p>
 </div>
 </div>
 <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
 <button
 onClick={() => { document.title = `Consolidated Night Count State - Flg Wg (${formatted})`; window.print(); }}
 className="flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
 >
 <Printer className="w-5 h-5" />
 <span>Official Export / Print</span>
 </button>
 <button 
 onClick={onClose} 
 className="flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 transition-colors text-white rounded-xl font-bold text-sm"
 >
 <X className="w-5 h-5" />
 <span>Close</span>
 </button>
 </div>
 </div>
 </div>

 <div className="p-8 print:p-0">
 <div className="max-w-[10.5in] mx-auto bg-white shadow-2xl print:shadow-none">
 <FlyingWingStateView 
 date={date} 
 uasuStats={uasuStats} 
 isAddModalOpen={false} 
 onCloseAddModal={() => {}} 
 onOpenAddModal={() => {}} 
 isPrepModalOpen={false}
 onClosePrepModal={() => {}}
 isPrintMode={true}
 />
 </div>
 </div>
 </div>,
    document.body
  );
};