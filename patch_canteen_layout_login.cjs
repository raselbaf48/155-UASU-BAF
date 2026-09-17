const fs = require('fs');
const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `                                       if (finalVal === '1234') {
                                           setCurrentUser({ name: 'System Admin', role: 'manager' });
                                           setActiveTab('manager_dashboard');
                                           setShowLogin(false);
                                           setLoginInput('');
                                           setLoginError('');
                                       } else if (finalVal.length === 4) {
                                           setLoginError('Invalid PIN.');
                                       }`;

const replaceStr = `                                       if (finalVal.length === 4) {
                                           setLoginError('Verifying...');
                                           supabase.from('Canteen').select('Name, Rank').eq('BD No', finalVal).single().then(({data, error}) => {
                                               if (error || !data) {
                                                   setLoginError('Invalid Manager ID.');
                                                   setTimeout(() => {
                                                       setLoginInput('');
                                                       setLoginError('');
                                                       document.getElementById('pin-0')?.focus();
                                                   }, 800);
                                               } else {
                                                   setCurrentUser({ name: \`\${data.Rank} \${data.Name}\`, role: 'manager', bdNo: finalVal });
                                                   setActiveTab('manager_dashboard');
                                                   setShowLogin(false);
                                                   setLoginInput('');
                                                   setLoginError('');
                                               }
                                           });
                                       }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync(file, code);
