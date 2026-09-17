const fs = require('fs');
const file = 'src/features/canteen/pages/PersonalPortal.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2 py-1 bg-rose-900/20 rounded-md transition-colors">
                                          <XCircle className="w-3 h-3" />
                                          <span>CANCEL</span>
                                      </button>
                                  )}`;

const replaceStr = `                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} title="Cancel Order" className="mt-2 text-rose-400 hover:text-rose-300 flex items-center justify-center p-1.5 bg-rose-900/20 hover:bg-rose-900/40 rounded-full transition-colors border border-rose-500/20">
                                          <XCircle className="w-5 h-5" />
                                      </button>
                                  )}`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync(file, code);
