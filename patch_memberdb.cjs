const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

// Replace member card opening div
code = code.replace(
    /<div key=\{member\.airman_id \|\| i\} className=\{`bg-slate-900 rounded-\[2rem\] p-6 border-2 shadow-sm transition-all hover:shadow-md \$\{i === 0 \? 'border-\[\#4f46e5\]' : 'border-slate-800'}`\}>/g,
    `<div key={member.airman_id || i} onClick={() => openStatement(member)} className={\`bg-slate-900 rounded-[2rem] p-6 border-2 shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-indigo-500/50 \${i === 0 ? 'border-[#4f46e5]' : 'border-slate-800'}\`}>`
);

// Add stopPropagation to ADD BAKI
code = code.replace(
    /<button className="py-2.5 bg-rose-900\/30 hover:bg-rose-100 text-rose-500/g,
    `<button onClick={(e) => e.stopPropagation()} className="py-2.5 bg-rose-900/30 hover:bg-rose-100 text-rose-500`
);

// Add stopPropagation to PAY BILL
code = code.replace(
    /<button className="py-2.5 bg-emerald-900\/30 hover:bg-emerald-100 text-emerald-600/g,
    `<button onClick={(e) => e.stopPropagation()} className="py-2.5 bg-emerald-900/30 hover:bg-emerald-100 text-emerald-600`
);

// Modify STATEMENT button
code = code.replace(
    /<button onClick=\{[()]* \=\> openStatement\(member\)\} className="flex/g,
    `<button onClick={(e) => { e.stopPropagation(); openStatement(member); }} className="flex`
);

// Modify Edit button
code = code.replace(
    /<button onClick=\{[()]* \=\> handleEdit\(member\)\} className="p-1.5/g,
    `<button onClick={(e) => { e.stopPropagation(); handleEdit(member); }} className="p-1.5`
);

// Modify Delete button
code = code.replace(
    /<button onClick=\{[()]* \=\> setDeleteConfirmId\(member\.airman_id\)\} className="p-1.5/g,
    `<button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(member.airman_id); }} className="p-1.5`
);

fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);
