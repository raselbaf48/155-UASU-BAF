import { createClient } from '@supabase/supabase-js';

const DIRECT_SUPABASE_URL = 'https://asevtncnoytawykhcleg.supabase.co';
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
}

if (!supabaseUrl.startsWith('http')) {
  supabaseUrl = 'http://localhost:3000/api/supabase';
}

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
export const isSupabaseConfigured = true;

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
