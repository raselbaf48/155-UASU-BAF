const fs = require('fs');
const file = 'src/features/canteen/pages/PersonalPortal.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} title="Cancel Order" className="mt-2 text-rose-400 hover:text-rose-300 flex items-center justify-center p-1.5 bg-rose-900/20 hover:bg-rose-900/40 rounded-full transition-colors border border-rose-500/20">
                                          <XCircle className="w-5 h-5" />
                                      </button>
                                  )}`;

const replaceStr = `                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} title="Cancel Order" className="mt-2 text-rose-400 hover:text-rose-300 flex items-center justify-center p-1.5 bg-rose-900/20 hover:bg-rose-900/40 rounded-full transition-colors border border-rose-500/20">
                                          <X className="w-5 h-5" />
                                      </button>
                                  )}`;

code = code.replace(targetStr, replaceStr);

const importTarget = "import { Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, Clock, Trash2, CheckCircle2, XCircle } from 'lucide-react';";
const importReplace = "import { Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, Clock, Trash2, CheckCircle2, XCircle, X } from 'lucide-react';";
code = code.replace(importTarget, importReplace);

fs.writeFileSync(file, code);
