with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

color_search = """                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  livingType === 'L_IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : !livingType ? 'bg-amber-50/40 text-amber-700 dark:text-amber-300 border border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}"""

color_replace = """                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  livingType === 'L_IN'
                    ? 'bg-emerald-600 text-white shadow-xs border-transparent'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                }`}"""
content = content.replace(color_search, color_replace)

color_search2 = """                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  livingType === 'L_OUT'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : !livingType ? 'bg-amber-50/40 text-amber-700 dark:text-amber-300 border border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}"""
color_replace2 = """                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  livingType === 'L_OUT'
                    ? 'bg-emerald-600 text-white shadow-xs border-transparent'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                }`}"""
content = content.replace(color_search2, color_replace2)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)
