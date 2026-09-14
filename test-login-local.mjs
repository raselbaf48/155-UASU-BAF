import { validateUserLogin } from './src/utils/authSession.ts';
import { supabase, isSupabaseConfigured } from './src/supabase.ts';

async function test() {
  console.log("Supabase configured?", isSupabaseConfigured);
  const result = await validateUserLogin('474455', '474455', []);
  console.log("Result:", result);
}
test();
