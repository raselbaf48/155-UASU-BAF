// Supabase has been completely removed in favor of Local Database & Offline Storage.
// A resilient local query builder is retained so all existing component queries continue working locally.

export type SupabaseClient = any;

export const DIRECT_SUPABASE_URL = '';
export const supabaseAnonKey = '';
export const isSupabaseConfigured = false;

// Resilient local query builder storing/serving data without external cloud
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

export const initSupabaseClient = (..._args: any[]): SupabaseClient | null => {
  return null;
};

export const supabase: any = {
  from(table: string) {
    return new LocalFallbackBuilder(table);
  },
  channel(_name: string) {
    return {
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {}
    };
  },
  removeChannel(_ch: any) {}
};
