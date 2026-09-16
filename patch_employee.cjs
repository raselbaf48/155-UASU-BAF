const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', 'utf8');

code = code.replace(
  "export const EmployeeDashboard: React.FC = () => {",
  "interface EmployeeDashboardProps { onManagerPortalClick?: () => void; }\n\nexport const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick }) => {"
);

const oldBtn = `<button className="px-6 py-3 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold tracking-widest transition-all shadow-md shadow-indigo-500/30">
               PERSONAL PORTAL
            </button>`;
const newBtn = `<button onClick={onManagerPortalClick} className="px-6 py-3 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold tracking-widest transition-all shadow-md shadow-indigo-500/30">
               PERSONAL PORTAL
            </button>`;
code = code.replace(oldBtn, newBtn);

fs.writeFileSync('src/features/canteen/pages/EmployeeDashboard.tsx', code);
