import fs from 'fs';
const f = 'src/supabase.ts';
let code = fs.readFileSync(f, 'utf8');

const target = `let supabaseUrl = 'http://localhost:3000/api/supabase';

if (typeof window !== 'undefined') {
  try {
    const origin = window.location.origin;
    if (origin && origin !== 'null') {
      supabaseUrl = origin + '/api/supabase';
    } else if (window.location.host) {
      supabaseUrl = window.location.protocol + '//' + window.location.host + '/api/supabase';
    }
  } catch (e) {
    console.warn('Error determining origin, using default localhost');
  }
}`;

const replacement = `const DIRECT_SUPABASE_URL = 'https://asevtncnoytawykhcleg.supabase.co';
let supabaseUrl = 'http://localhost:3000/api/supabase';

if (typeof window !== 'undefined') {
  try {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    
    // Cloudflare pages does NOT have the Express backend running, so we must use the direct URL
    if (hostname.endsWith('.pages.dev')) {
       supabaseUrl = DIRECT_SUPABASE_URL;
    } else if (origin && origin !== 'null') {
      supabaseUrl = origin + '/api/supabase';
    } else if (window.location.host) {
      supabaseUrl = window.location.protocol + '//' + window.location.host + '/api/supabase';
    }
  } catch (e) {
    console.warn('Error determining origin, using default localhost');
  }
}`;

if(code.includes(target)) {
  fs.writeFileSync(f, code.replace(target, replacement));
  console.log("Patched successfully");
} else {
  console.log("Could not find target content");
}
