const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// Replace all \${isEmployee ? "..." : "..."} with just the dark theme version

code = code.replace(
    /\`w-64 border-r flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-\[40px\] \\\$\\{isEmployee \? "bg-white border-slate-100" : "bg-slate-900 dark:bg-slate-900 border-slate-700 dark:border-slate-800"\\}\`/g,
    '"w-64 bg-slate-900 dark:bg-slate-900 border-r border-slate-700 dark:border-slate-800 flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-[40px]"'
);

code = code.replace(
    /\`font-black text-2xl tracking-widest flex items-center space-x-2 \\\$\\{isEmployee \? "text-slate-900" : "text-white dark:text-white"\\}\`/g,
    '"font-black text-2xl text-white dark:text-white tracking-widest flex items-center space-x-2"'
);

code = code.replace(
    /\(isEmployee \? 'text-slate-400 hover:bg-slate-50 hover:text-slate-600' : 'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-800 hover:text-slate-300'\)/g,
    "'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-800 hover:text-slate-300'"
);

code = code.replace(
    /\`w-64 h-full flex flex-col shadow-2xl animate-in slide-in-from-left-4 \\\$\\{isEmployee \? "bg-white" : "bg-slate-900"\\}\`/g,
    '"w-64 bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-left-4"'
);

code = code.replace(
    /\`font-black text-xl tracking-widest flex items-center space-x-2 \\\$\\{isEmployee \? "text-slate-900" : "text-white"\\}\`/g,
    '"font-black text-xl text-white tracking-widest flex items-center space-x-2"'
);

code = code.replace(
    /\(isEmployee \? 'text-slate-400 hover:bg-slate-50 hover:text-slate-600' : 'text-slate-400 hover:bg-slate-800 hover:text-white'\)/g,
    "'text-slate-400 hover:bg-slate-800 hover:text-white'"
);

code = code.replace(
    /\`p-4 border-t \\\$\\{isEmployee \? "border-slate-100" : "border-slate-800"\\}\`/g,
    '"p-4 border-t border-slate-800"'
);

code = code.replace(
    /\`md:hidden h-16 border-b flex items-center justify-between px-4 z-10 sticky top-0 \\\$\\{isEmployee \? "bg-white border-slate-100" : "bg-slate-900 dark:bg-slate-900 border-slate-700 dark:border-slate-800"\\}\`/g,
    '"md:hidden h-16 bg-slate-900 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-800 flex items-center justify-between px-4 z-10 sticky top-0"'
);

code = code.replace(
    /\`p-2 rounded-lg \\\$\\{isEmployee \? "text-slate-600 bg-slate-100" : "text-slate-400 bg-slate-800"\\}\`/g,
    '"p-2 text-slate-400 bg-slate-800 rounded-lg"'
);

code = code.replace(
    /\`font-bold text-lg \\\$\\{isEmployee \? "text-slate-900" : "text-white dark:text-white"\\}\`/g,
    '"font-bold text-lg text-white dark:text-white"'
);

code = code.replace(
    /\`flex-1 overflow-y-auto p-4 sm:p-8 \\\$\\{isEmployee \? "bg-white" : "bg-\\[#f8fafc\\] dark:bg-\\[#0b1120\\]"\\}\`/g,
    '"flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0b1120] dark:bg-[#0b1120]"'
);

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
