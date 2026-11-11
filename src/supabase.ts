import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Vite (client-side) or Node (server-side proxy)
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
    return String((import.meta as any).env[key]).trim();
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return String(process.env[key]).trim();
  }
  if (typeof window !== 'undefined') {
    return String((window as any)[`__${key}__`] || window.localStorage?.getItem(key) || '').trim();
  }
  return '';
};

export const DIRECT_SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL') || '';
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || '';

export const isSupabaseConfigured = false;

// Resilient fallback query builder when credentials are not yet entered
class LocalFallbackBuilder {
  private table: string;
  constructor(table: string) {
    this.table = table;
  }
  select(..._args: any[]) { return this; }
  insert(data: any) { return Promise.resolve({ data, error: null }); }
  upsert(data: any, _opts?: any) { return Promise.resolve({ data, error: null }); }
  update(_data: any) { return this; }
  delete() { return this; }
  eq(..._args: any[]) { return this; }
  neq(..._args: any[]) { return this; }
  gt(..._args: any[]) { return this; }
  gte(..._args: any[]) { return this; }
  lt(..._args: any[]) { return this; }
  lte(..._args: any[]) { return this; }
  like(..._args: any[]) { return this; }
  ilike(..._args: any[]) { return this; }
  in(..._args: any[]) { return this; }
  contains(..._args: any[]) { return this; }
  range(..._args: any[]) { return Promise.resolve({ data: [], error: null }); }
  single() { return Promise.resolve({ data: null, error: null }); }
  maybeSingle() { return Promise.resolve({ data: null, error: null }); }
  order(..._args: any[]) { return this; }
  limit(..._args: any[]) { return this; }
  then(resolve: (res: { data: any[]; error: any }) => void) {
    return Promise.resolve({ data: [], error: null }).then(resolve);
  }
}

let realClient: SupabaseClient | null = null;

export const initSupabaseClient = (url: string, key: string): SupabaseClient | null => {
  if (url && key && url.startsWith('http') && !url.includes('firestore.firebase')) {
    try {
      realClient = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      if (typeof window !== 'undefined') {
        (window as any).__SUPABASE_URL__ = url;
        (window as any).__SUPABASE_ANON_KEY__ = key;
      }
      return realClient;
    } catch (err) {
      console.warn('[supabase] Error initializing official Supabase client:', err);
    }
  }
  return null;
};

// Supabase is completely disabled per user preference in favor of Local DB & Google Drive Backup

export const supabase: any = {
  from(table: string) {
    if (realClient) return realClient.from(table);
    return new LocalFallbackBuilder(table);
  },
  channel(name: string) {
    if (realClient) return realClient.channel(name);
    return {
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {}
    };
  },
  removeChannel(ch: any) {
    if (realClient) return realClient.removeChannel(ch);
  }
};
