const fs = require('fs');
const path = 'src/components/SettingsModal.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isBackingUp}
                  className="w-full py-3 text-sm font-bold text-slate-800 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                >
                  {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download JSON Backup
                </button>`;

const replacement = `                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={isBackingUp}
                    className="w-full sm:flex-1 py-3 text-sm font-bold text-slate-800 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                  >
                    {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download JSON Backup
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    disabled={isBackingUp}
                    className="w-full sm:flex-1 py-3 text-sm font-bold text-slate-800 bg-emerald-400 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                  >
                    {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download CSV Backup
                  </button>
                </div>`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
