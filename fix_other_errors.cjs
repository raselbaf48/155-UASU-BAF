const fs = require('fs');

// apiBridge
let apiCode = fs.readFileSync('src/services/apiBridge.ts', 'utf8');
apiCode = apiCode.replace(/console\.error\('Local Bridge API Error:', err\.stack\);/, "console.warn('Local Bridge API Error:', err.message);");
apiCode = apiCode.replace(/console\.error\("Supabase delete failed", e\);/, "console.warn('Supabase delete failed', e.message);");
fs.writeFileSync('src/services/apiBridge.ts', apiCode);

// App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/console\.error\('Failed to fetch conflict count:', err\);/g, "console.warn('Failed to fetch conflict count:', err);");
appCode = appCode.replace(/console\.error\('Error saving airman:', err\);/g, "console.warn('Error saving airman:', err);");
appCode = appCode.replace(/console\.error\('Error deleting airman:', err\);/g, "console.warn('Error deleting airman:', err);");
fs.writeFileSync('src/App.tsx', appCode);

