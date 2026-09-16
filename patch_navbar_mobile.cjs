const fs = require('fs');
let lines = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8').split('\n');

const startIndex = lines.findIndex((l, i) => i > 230 && l.includes("{currentUser.name === 'Guest' ? ("));
if (startIndex !== -1) {
    const replacement = `            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-indigo-500">
                   <img src={\`https://api.dicebear.com/7.x/avataaars/svg?seed=\${currentUser.name}&backgroundColor=0f172a\`} alt="Avatar" className="w-full h-full object-cover" />
            </div>`;
    
    lines.splice(startIndex, 9, replacement);
    fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', lines.join('\n'));
} else {
    console.log("Not found");
}
