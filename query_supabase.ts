import { supabase } from './src/supabase';
async function test() {
  const { data, error } = await supabase.from('Biodata Register').select('*').limit(1);
  console.log(data);
  if (error) console.error(error);
}
test();
