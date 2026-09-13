const fs = require('fs');
let code = fs.readFileSync('src/utils/authSession.ts', 'utf8');
code = code.replace(/import \{ supabase \} from '\.\.\/supabase';\n/, '');
code = code.replace(/    \/\/ Async sync to Supabase[\s\S]*?\}\)\(\);\n/, '');
code = code.replace(/  \/\/ Async delete from Supabase[\s\S]*?\}\);\n/, '');
code = code.replace(/    \/\/ Check Supabase first[\s\S]*?\} catch\(e\) \{[\s\S]*?\}\n/, '');
fs.writeFileSync('src/utils/authSession.ts', code);
