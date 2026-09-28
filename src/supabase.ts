import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://asevtncnoytawykhcleg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

function isJwtKey(str: string | undefined | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.startsWith('eyJ') || (trimmed.split('.').length === 3 && !trimmed.startsWith('http'));
}

function isHttpUrl(str: string | undefined | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  return /^https?:\/\//i.test(trimmed);
}

// Helper to sanitize duplicated/malformed Supabase environment values
function cleanSupabaseUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return FALLBACK_SUPABASE_URL;
  let cleaned = url.trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null' || cleaned === '""' || cleaned === "''") {
    return FALLBACK_SUPABASE_URL;
  }
  // If a JWT key was passed as URL, return fallback
  if (isJwtKey(cleaned)) {
    return FALLBACK_SUPABASE_URL;
  }
  if (cleaned.length % 2 === 0 && cleaned.slice(0, cleaned.length / 2) === cleaned.slice(cleaned.length / 2)) {
    cleaned = cleaned.slice(0, cleaned.length / 2);
  }
  const httpsMatch = cleaned.match(/https?:\/\/[^\/\s]+/g);
  if (httpsMatch && httpsMatch.length > 0) {
    cleaned = httpsMatch[0];
  }
  cleaned = cleaned.replace(/\/+$/, '');

  // Must match http:// or https:// with a valid domain or localhost
  if (!/^https?:\/\/[a-zA-Z0-9_.-]+/.test(cleaned)) {
    return FALLBACK_SUPABASE_URL;
  }
  return cleaned;
}

function cleanSupabaseAnonKey(key: string | undefined | null): string {
  if (!key || typeof key !== 'string') return FALLBACK_SUPABASE_ANON_KEY;
  let cleaned = key.trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null' || cleaned === '""' || cleaned === "''") {
    return FALLBACK_SUPABASE_ANON_KEY;
  }
  // If an HTTP URL was passed as key, return fallback
  if (isHttpUrl(cleaned)) {
    return FALLBACK_SUPABASE_ANON_KEY;
  }
  if (cleaned.length % 2 === 0 && cleaned.slice(0, cleaned.length / 2) === cleaned.slice(cleaned.length / 2)) {
    cleaned = cleaned.slice(0, cleaned.length / 2);
  }
  if (!isJwtKey(cleaned)) {
    return FALLBACK_SUPABASE_ANON_KEY;
  }
  return cleaned;
}

const rawEnvUrl = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : process.env.VITE_SUPABASE_URL) || '';
const rawEnvKey = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : process.env.VITE_SUPABASE_ANON_KEY) || '';

// Detect and auto-heal if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY were swapped in the environment
let resolvedUrl = rawEnvUrl;
let resolvedKey = rawEnvKey;

if ((!resolvedUrl || isJwtKey(resolvedUrl)) && isHttpUrl(resolvedKey)) {
  resolvedUrl = rawEnvKey;
  resolvedKey = rawEnvUrl;
} else if (isHttpUrl(resolvedKey) && !isHttpUrl(resolvedUrl)) {
  resolvedUrl = resolvedKey;
}

export const DIRECT_SUPABASE_URL = cleanSupabaseUrl(resolvedUrl);
export const supabaseAnonKey = cleanSupabaseAnonKey(resolvedKey);
export const isSupabaseConfigured = Boolean(DIRECT_SUPABASE_URL && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing. Using default fallback values.');
}

/**
 * Smart fetch for Supabase:
 * Attempts direct fetch first for maximum speed, native streaming, and zero proxy bottlenecks.
 * If direct fetch is blocked by an ad-blocker or iframe restriction (Failed to fetch),
 * it automatically falls back to the same-origin /api/supabase proxy.
 */
const smartFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

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

  const isSupabaseCall = urlStr.includes(DIRECT_SUPABASE_URL) || urlStr.includes('supabase.co');

  if (isSupabaseCall) {
    // 1. Try direct fetch first (standard CORS, fast, native)
    try {
      const directRes = await fetch(input, modifiedInit);
      // Return if successful or if Supabase PostgREST returned standard HTTP response
      if (directRes.ok || (directRes.status >= 200 && directRes.status < 500)) {
        return directRes;
      }
    } catch (directErr) {
      // Network failure, browser block, or Adblocker blocked supabase.co - try local proxy fallback
      console.warn('Direct Supabase fetch failed (network or adblocker), attempting proxy fallback:', directErr);
    }

    // 2. Fallback to same-origin proxy
    let proxyBase = '/api/supabase';
    if (typeof window !== 'undefined') {
      proxyBase = `${window.location.origin}/api/supabase`;
    }
    const proxyUrl = urlStr.replace(/^https?:\/\/[^\/]+/, proxyBase);
    try {
      const proxyRes = await fetch(proxyUrl, modifiedInit);
      if (proxyRes.ok || (proxyRes.status >= 200 && proxyRes.status < 500)) {
        return proxyRes;
      }
    } catch (proxyErr) {
      console.warn('Proxy fallback also failed:', proxyErr);
    }
  }

  // Fallback to direct fetch
  return fetch(input, modifiedInit);
};

// Create a single supabase client for interacting with your database
function initSupabaseClient() {
  try {
    return createClient(
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
  } catch (err) {
    console.error('Failed to initialize custom Supabase client, falling back to default:', err);
    return createClient(
      FALLBACK_SUPABASE_URL,
      FALLBACK_SUPABASE_ANON_KEY,
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
  }
}

export const supabase = initSupabaseClient();

