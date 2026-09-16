const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

const oldRegex = /<div key=\{i\} className=\{\`bg-slate-900 rounded-2xl p-4 flex items-center justify-between border-2 transition-all shadow-sm \$\{inBasket \? 'border-\[\#4f46e5\]' : 'border-slate-800'\}\`\}>[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/m;

const newCard = `<div key={i} onClick={() => addToBasket(item)} className={\`bg-slate-900 rounded-2xl p-4 flex items-center justify-between border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.3)] group \${inBasket ? 'border-[#4f46e5] shadow-[0_10px_20px_-10px_rgba(79,70,229,0.2)]' : 'border-slate-800 hover:border-indigo-500/50'}\`}>
                  <div className="flex items-center space-x-4">
                     <div className={\`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-colors duration-300 \${inBasket ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[#0f172a] text-slate-400 group-hover:bg-slate-800 group-hover:text-indigo-300'}\`}>
                        <PackageIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest mb-0.5">{item.category}</p>
                        <h3 className="font-black text-white text-base group-hover:text-indigo-400 transition-colors">{item.name}</h3>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">STOCK: {item.stock}</p>
                     </div>
                  </div>
                  <div className="flex items-center space-x-6">
                     <p className="text-xl font-black tracking-tighter text-white">৳{item.price}</p>
                     <button onClick={(e) => { e.stopPropagation(); addToBasket(item); }} className={\`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-sm transition-all duration-300 \${inBasket ? 'bg-[#4f46e5] text-white hover:bg-[#4338ca] hover:scale-110' : 'bg-[#0f172a] text-white group-hover:bg-[#4f46e5] group-hover:scale-110'}\`}>
                        <Plus className="w-5 h-5" />
                     </button>
                  </div>
               </div>`;

code = code.replace(oldRegex, newCard);
fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', code);
