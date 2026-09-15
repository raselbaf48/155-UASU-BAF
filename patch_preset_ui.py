with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

ui_search = """                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAddressPreset}
                    onChange={(e) => setIsAddressPreset(e.target.checked)}
                    className="w-3.5 h-3.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700"
                  />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Preset (Vill, P/O, P/S, Dist)</span>
                </label>"""

ui_replace = """                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setIsAddressPreset(false)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${!isAddressPreset ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddressPreset(true)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${isAddressPreset ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Preset
                  </button>
                </div>"""
content = content.replace(ui_search, ui_replace)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)
