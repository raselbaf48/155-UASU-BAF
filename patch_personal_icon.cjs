const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/PersonalPortal.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const importTarget = "import { Wallet, ShoppingCart, Zap, Clock, Activity, ArrowRight, TrendingUp, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';";
const importReplace = "import { Wallet, ShoppingCart, Zap, Clock, Activity, ArrowRight, TrendingUp, AlertCircle, RefreshCw, Trash2, XCircle } from 'lucide-react';";
code = code.replace(importTarget, importReplace);

const buttonTarget = `                                      <button onClick={() => setCancelConfirmId(act.id)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2 py-1 bg-rose-900/20 rounded-md transition-colors">
                                          <Trash2 className="w-3 h-3" />
                                          <span>CANCEL</span>
                                      </button>`;

const buttonReplace = `                                      <button onClick={() => setCancelConfirmId(act.id)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2 py-1 bg-rose-900/20 rounded-md transition-colors">
                                          <XCircle className="w-3 h-3" />
                                          <span>CANCEL</span>
                                      </button>`;

code = code.replace(buttonTarget, buttonReplace);

const modalIconTarget = `<Trash2 className="w-8 h-8" />`;
const modalIconReplace = `<XCircle className="w-8 h-8" />`;
code = code.replace(modalIconTarget, modalIconReplace);

fs.writeFileSync(mgrFile, code);
