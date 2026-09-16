const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/CanteenReports.tsx', 'utf8');

const dynamicMetrics = `
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800">
            <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">SALES TOTAL</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">
                ৳{reports.filter(r => r.type !== 'BILL PAYMENT').reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
         <div className="bg-emerald-900/30 rounded-[2rem] p-6 shadow-sm border border-emerald-900/50">
            <p className="text-[8px] font-black text-emerald-500 tracking-widest uppercase mb-1">COLLECTIONS</p>
            <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
                ৳{reports.filter(r => r.type === 'BILL PAYMENT').reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
         <div className="bg-rose-900/30 rounded-[2rem] p-6 shadow-sm border border-rose-900/50">
            <p className="text-[8px] font-black text-rose-500 tracking-widest uppercase mb-1">NEW DUE</p>
            <h3 className="text-3xl font-black text-rose-600 tracking-tighter">
                ৳{reports.filter(r => r.type !== 'BILL PAYMENT' && r.gateway === 'DUE').reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
         <div className="bg-indigo-900/30 rounded-[2rem] p-6 shadow-sm border border-indigo-900/50">
            <p className="text-[8px] font-black text-indigo-500 tracking-widest uppercase mb-1">NET CASH</p>
            <h3 className="text-3xl font-black text-indigo-600 tracking-tighter">
                ৳{reports.filter(r => r.type === 'BILL PAYMENT' || (r.type !== 'BILL PAYMENT' && r.gateway !== 'DUE')).reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
      </div>
`;

code = code.replace(
    /\{\/\* Metrics Cards \*\/\}\s*<div className="grid grid-cols-1 md:grid-cols-4 gap-6">[\s\S]*?<\/div>\s*<\/div>/m,
    dynamicMetrics.trim()
);

code = code.replace(
    /<span className="text-\[10px\] font-black text-slate-400 uppercase tracking-widest">253 RECORDS<\/span>/,
    `<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{reports.length} RECORDS</span>`
);

fs.writeFileSync('src/features/canteen/pages/CanteenReports.tsx', code);
