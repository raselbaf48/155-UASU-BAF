const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// Insert isEmployee variable
code = code.replace(
    "const navItems = currentUser.role === 'manager' ?",
    "const isEmployee = currentUser.role === 'employee' || currentUser.name === 'Guest';\n  const navItems = currentUser.role === 'manager' ?"
);

// Sidebar - Desktop
code = code.replace(
    '<div className="w-64 bg-slate-900 dark:bg-slate-900 border-r border-slate-700 dark:border-slate-800 flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-[40px]">',
    '<div className={`w-64 border-r flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-[40px] ${isEmployee ? "bg-white border-slate-100" : "bg-slate-900 dark:bg-slate-900 border-slate-700 dark:border-slate-800"}`}>'
);

code = code.replace(
    '<h1 className="font-black text-2xl text-white dark:text-white tracking-widest flex items-center space-x-2">',
    '<h1 className={`font-black text-2xl tracking-widest flex items-center space-x-2 ${isEmployee ? "text-slate-900" : "text-white dark:text-white"}`}>'
);

code = code.replace(
    ': \'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-800 hover:text-slate-300\'',
    ': (isEmployee ? \'text-slate-400 hover:bg-slate-50 hover:text-slate-600\' : \'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-800 hover:text-slate-300\')'
);

// Sidebar Mobile Overlay
code = code.replace(
    '<div className="w-64 bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-left-4" onClick={e => e.stopPropagation()}>',
    '<div className={`w-64 h-full flex flex-col shadow-2xl animate-in slide-in-from-left-4 ${isEmployee ? "bg-white" : "bg-slate-900"}`} onClick={e => e.stopPropagation()}>'
);

code = code.replace(
    '<h1 className="font-black text-xl text-white tracking-widest flex items-center space-x-2">',
    '<h1 className={`font-black text-xl tracking-widest flex items-center space-x-2 ${isEmployee ? "text-slate-900" : "text-white"}`}>'
);

code = code.replace(
    ': \'text-slate-400 hover:bg-slate-800 hover:text-white\'',
    ': (isEmployee ? \'text-slate-400 hover:bg-slate-50 hover:text-slate-600\' : \'text-slate-400 hover:bg-slate-800 hover:text-white\')'
);

code = code.replace(
    '<div className="p-4 border-t border-slate-800">',
    '<div className={`p-4 border-t ${isEmployee ? "border-slate-100" : "border-slate-800"}`}>'
);

// Top Header for Mobile only
code = code.replace(
    '<div className="md:hidden h-16 bg-slate-900 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-800 flex items-center justify-between px-4 z-10 sticky top-0">',
    '<div className={`md:hidden h-16 border-b flex items-center justify-between px-4 z-10 sticky top-0 ${isEmployee ? "bg-white border-slate-100" : "bg-slate-900 dark:bg-slate-900 border-slate-700 dark:border-slate-800"}`}>'
);

code = code.replace(
    '<button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-400 bg-slate-800 rounded-lg">',
    '<button onClick={() => setMobileMenuOpen(true)} className={`p-2 rounded-lg ${isEmployee ? "text-slate-600 bg-slate-100" : "text-slate-400 bg-slate-800"}`}>'
);

code = code.replace(
    '<span className="font-bold text-lg text-white dark:text-white">CAFEUAV</span>',
    '<span className={`font-bold text-lg ${isEmployee ? "text-slate-900" : "text-white dark:text-white"}`}>CAFEUAV</span>'
);

// Background of content
code = code.replace(
    '<div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#f8fafc] dark:bg-[#0b1120]">',
    '<div className={`flex-1 overflow-y-auto p-4 sm:p-8 ${isEmployee ? "bg-white" : "bg-[#f8fafc] dark:bg-[#0b1120]"}`}>'
);

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
