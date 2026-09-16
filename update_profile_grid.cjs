const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const newGrid = `              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Ser
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                    {airman.serNo}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    BD No
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                    {airman.bdNo}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Rank
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {formatAirmanName(airman.rank)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Full Name
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {airman.fullName || airman.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Trade
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {airman.trade}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Flight
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {airman.flightName}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                {variant === 'biodata' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold text-xs">Blood Group</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{airman.bloodGroup || 'N/A'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold text-xs">{variant === 'biodata' ? 'Present Address' : 'Address'}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{airman.addressBlock || 'N/A'}</span>
                </div>
                {variant === 'biodata' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold text-xs">Permanent Address</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{airman.permanentAddress || 'N/A'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold text-xs">Contact</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">{airman.mobileNo || 'N/A'}</span>
                </div>
                {variant === 'biodata' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold text-xs">Dt of Posting</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{airman.dateJoined || 'N/A'}</span>
                  </div>
                )}
                {variant === 'biodata' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold text-xs">Status</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{airman.active === false ? 'SUSPENDED' : 'ACTIVE'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 font-semibold text-xs">Remarks</span>
                  <span className="italic text-slate-600 dark:text-slate-300 text-sm text-right">{airman.remarks || 'None'}</span>
                </div>
              </div>`;

const regex = /<div className="grid grid-cols-2 gap-3\.5 bg-slate-50 dark:bg-slate-800\/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">[\s\S]*?<div className="bg-slate-50 dark:bg-slate-800\/60 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">/m;
code = code.replace(regex, newGrid + '\n            </div>\n          )}\n        </div>\n\n        {/* Footer */}\n        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">');
fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
