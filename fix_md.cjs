const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');

code = code.replace(/                          \)\n                      \}\)\}\n                  <\/div>\n                  <button onClick=\{saveDailyMenu\}/, 
`                          )
                      })
                  )}
                  </div>
                  <button onClick={saveDailyMenu}`);

fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', code);
