const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const brokenPart = `                                       <span className="text-white font-black">৳{po.total}</span>
                       </div>
                   ))
               )}
            </div>`;

code = code.replace(brokenPart, '');

fs.writeFileSync(mgrFile, code);
