const url = 'http://localhost:3000/api/supabase/rest/v1/user_profiles?bd_no=eq.48456';
const resp = await fetch(url);
console.log(resp.status);
console.log(await resp.text());
