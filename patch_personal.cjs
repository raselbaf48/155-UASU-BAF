const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/PersonalPortal.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const targetStr = `                              <div className="text-right flex flex-col items-end">
                                  <p className="text-sm font-black text-white">৳{act.amount}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2 py-1 bg-rose-900/20 rounded-md transition-colors">
                                          <Trash2 className="w-3 h-3" />
                                          <span>CANCEL</span>
                                      </button>
                                  )}`;

const replaceStr = `                              <div className="text-right flex flex-col items-end">
                                  {act.type !== 'PRE-ORDER' && (
                                      <>
                                          <p className="text-sm font-black text-white">৳{act.amount}</p>
                                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
                                      </>
                                  )}
                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2 py-1 bg-rose-900/20 rounded-md transition-colors">
                                          <Trash2 className="w-3 h-3" />
                                          <span>CANCEL</span>
                                      </button>
                                  )}`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync(mgrFile, code);
