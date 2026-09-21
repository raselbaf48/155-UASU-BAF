import { createClient } from '@supabase/supabase-js';

// Helper to sanitize duplicated/malformed Supabase environment values
function cleanSupabaseUrl(url: string | undefined): string {
  if (!url) return 'https://asevtncnoytawykhcleg.supabase.co';
  let cleaned = url.trim();
  if (cleaned.length % 2 === 0 && cleaned.slice(0, cleaned.length / 2) === cleaned.slice(cleaned.length / 2)) {
    cleaned = cleaned.slice(0, cleaned.length / 2);
  }
  const httpsMatch = cleaned.match(/https?:\/\/[^\/]+/g);
  if (httpsMatch && httpsMatch.length > 1) {
    cleaned = httpsMatch[0];
  }
  return cleaned.replace(/\/+$/, '');
}

function cleanSupabaseAnonKey(key: string | undefined): string {
  const fallbackKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
  if (!key) return fallbackKey;
  let cleaned = key.trim();
  if (cleaned.length % 2 === 0 && cleaned.slice(0, cleaned.length / 2) === cleaned.slice(cleaned.length / 2)) {
    cleaned = cleaned.slice(0, cleaned.length / 2);
  }
  return cleaned;
}

const DIRECT_SUPABASE_URL = cleanSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
export const supabaseAnonKey = cleanSupabaseAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY);
export const isSupabaseConfigured = Boolean(DIRECT_SUPABASE_URL && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

/**
 * Smart fetch for Supabase:
 * Routes REST requests through the same-origin /api/supabase proxy to bypass
 * iframe restrictions, ad-blockers, and CORS network barriers,
 * with automatic fallback to direct fetch.
 */
const smartFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  // Determine local proxy base
  let proxyBase = '/api/supabase';
  if (typeof window !== 'undefined') {
    proxyBase = `${window.location.origin}/api/supabase`;
  }

  // Ensure headers are sanitized with valid clean keys
  const headers = new Headers(init?.headers);
  headers.set('apikey', supabaseAnonKey);
  const currentAuth = headers.get('authorization') || '';
  if (!currentAuth || currentAuth.includes(supabaseAnonKey) || currentAuth.length > supabaseAnonKey.length) {
    headers.set('authorization', `Bearer ${supabaseAnonKey}`);
  }

  const modifiedInit: RequestInit = {
    ...init,
    headers,
  };

  // If this is a call to the Supabase endpoint, route through our local proxy first
  if (urlStr.includes(DIRECT_SUPABASE_URL) || urlStr.includes('supabase.co')) {
    const proxyUrl = urlStr.replace(/^https?:\/\/[^\/]+/, proxyBase);
    try {
      const res = await fetch(proxyUrl, modifiedInit);
      if (res.status !== 502 && res.status !== 504) {
        return res;
      }
    } catch {
      // Local proxy unreachable, proceed to direct fetch
    }
  }

  // Fallback to direct fetch
  return fetch(input, modifiedInit);
};

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  DIRECT_SUPABASE_URL,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: smartFetch,
    },
  }
);

