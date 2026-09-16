const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const oldHandleLogin = `  const handleLogin = async () => {
    if (loginTab === 'member') {
      try {
        setLoginError('Checking...');
        const { data, error } = await supabase
          .from('Canteen')
          .select('Name, Rank')
          .eq('BD No', loginInput)
          .single();
        
        if (error || !data) {
          setLoginError('Member not found. Check BD No.');
        } else {
          setCurrentUser({ name: \`\${data.Rank} \${data.Name}\`, role: 'employee' });
          setActiveTab('dashboard');
          setShowLogin(false);
          setLoginInput('');
          setLoginError('');
        }
      } catch (err) {
        setLoginError('Network Error.');
      }
    } else {
      if (loginInput === '1234') {`;

const newHandleLogin = `  const handleLogin = async () => {
    if (loginTab === 'member') {
      try {
        setLoginError('Checking...');
        const cleanInput = loginInput.replace(/^BD\\/?/i, '').trim();
        
        // Check local DB first
        const airmen = localDb.getAirmen();
        const localMatch = airmen.find(a => a.bdNo === cleanInput);
        if (localMatch) {
            setCurrentUser({ name: \`\${localMatch.rank} \${localMatch.name}\`, role: 'employee' });
            setActiveTab('dashboard');
            setShowLogin(false);
            setLoginInput('');
            setLoginError('');
            return;
        }

        const { data, error } = await supabase
          .from('Canteen')
          .select('Name, Rank')
          .eq('BD No', loginInput)
          .single();
        
        if (error || !data) {
          setLoginError('Member not found. Check BD No.');
        } else {
          setCurrentUser({ name: \`\${data.Rank} \${data.Name}\`, role: 'employee' });
          setActiveTab('dashboard');
          setShowLogin(false);
          setLoginInput('');
          setLoginError('');
        }
      } catch (err) {
        setLoginError('Network Error.');
      }
    } else {
      if (loginInput === '1234') {`;

code = code.replace(oldHandleLogin, newHandleLogin);

const importStr = "import { supabase } from '../../../supabase';";
const newImportStr = "import { supabase } from '../../../supabase';\nimport { localDb } from '../../../services/localDatabase';";
if (!code.includes('services/localDatabase')) {
    code = code.replace(importStr, newImportStr);
}

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);
