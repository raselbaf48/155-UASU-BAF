import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';

export const DIRECT_SUPABASE_URL = 'https://firestore.firebase.google.com';
export const supabaseAnonKey = 'firebase-firestore-unified-key';
export const isSupabaseConfigured = true;

/**
 * Normalizes table names to Firebase Firestore collections
 */
function resolveCollectionName(table: string): string {
  const t = (table || '').trim();
  switch (t) {
    case 'app_settings':
      return 'app_settings';
    case 'Canteen_Member':
    case 'canteen_members':
      return 'canteen_members';
    case 'Canteen_Inventory':
    case 'canteen_inventory':
      return 'canteen_inventory';
    case 'Canteen_Menu':
    case 'canteen_menu':
      return 'canteen_menu';
    case 'Biodata Register':
    case 'airmen':
      return 'airmen';
    case 'duty_rosters':
    case 'All Duty & Daily Quota':
      return 'duty_rosters';
    case 'parade_states':
      return 'parade_states';
    case 'user_profiles':
      return 'user_profiles';
    case 'duty_ratio_matrix':
      return 'duty_ratio_matrix';
    case 'canteen_transactions':
      return 'canteen_transactions';
    case 'canteen_expenses':
      return 'canteen_expenses';
    case 'app_versions':
      return 'app_versions';
    default:
      return t.toLowerCase().replace(/\s+/g, '_');
  }
}

/**
 * Normalizes document IDs based on collection type
 */
function resolveDocId(collectionName: string, item: any): string {
  if (!item || typeof item !== 'object') {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
  if (collectionName === 'app_settings') {
    return String(item.setting_key || item.id || `setting_${Date.now()}`).trim();
  }
  if (collectionName === 'canteen_members') {
    const raw = item.airman_id || item.id || item['BD No'] || item.service_number;
    return String(raw || `mem_${Date.now()}`).replace(/\//g, '_').trim();
  }
  if (collectionName === 'airmen') {
    const raw = item.airman_id || item.id || item.bdNo || item['BD No'];
    return String(raw || `airman_${Date.now()}`).replace(/\//g, '_').trim();
  }
  if (collectionName === 'duty_rosters') {
    const raw = item.assignment_id || item.assignmentId || item.id || `${item.airmanId}_${item.date}_${item.shift || 'D'}`;
    return String(raw).replace(/\//g, '_').trim();
  }
  if (collectionName === 'parade_states') {
    const raw = item.log_id || item.id || `parade_${item.date}_${item.shift || 'MORNING'}`;
    return String(raw).replace(/\//g, '_').trim();
  }
  if (collectionName === 'user_profiles') {
    const clean = String(item['User ID'] || item.userId || item.bdNo || item.id || '').replace(/^BD\/?/i, '').trim().toLowerCase();
    return clean ? `user-login-${clean}` : `user_${Date.now()}`;
  }
  if (collectionName === 'app_versions') {
    return 'latest';
  }
  const fallback = item.id || item.key || item.docId || item.name;
  return String(fallback || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`).replace(/\//g, '_');
}

/**
 * Normalizes outbound record to match both Supabase and Firestore field naming
 */
function normalizeRecord(collectionName: string, docData: any, docId: string): any {
  if (!docData || typeof docData !== 'object') return docData;

  if (collectionName === 'app_settings') {
    return {
      setting_key: docData.setting_key || docId,
      setting_value: docData.setting_value !== undefined ? docData.setting_value : JSON.stringify(docData),
      updated_at: docData.updated_at || new Date().toISOString()
    };
  }

  if (collectionName === 'canteen_members') {
    const aid = docData.airman_id || docId;
    const bdNo = String(docData['BD No'] || docData.service_number || aid.replace(/^airman-/, '')).replace(/\D/g, '');
    const surname = docData.Surname || docData.surname || docData.name || '';
    const rank = docData.Rank || docData.rank || 'LAC';
    const contact = docData.Contact || docData.contact || docData.phone || docData['Contact Number'] || '';
    const due = Number(docData.Due ?? docData.total_due ?? docData.due ?? 0);
    const balance = Number(docData.Balance ?? docData.canteen_balance ?? docData.balance ?? 0);
    const dp = docData.DP || docData.dp || docData.avatar || '';
    const nameBn = docData.Name_BN || docData.name_bn || '';
    const rankBn = docData.Rank_BN || docData.rank_bn || '';
    const role = docData.Role || docData.role || 'Member';
    const isActive = docData.active !== false && docData.status !== 'Inactive';

    return {
      airman_id: aid,
      id: aid,
      'BD No': bdNo,
      service_number: bdNo,
      Surname: surname,
      name: surname,
      Rank: rank,
      rank: rank,
      Contact: contact,
      phone: contact,
      Due: due,
      total_due: due,
      Balance: balance,
      canteen_balance: balance,
      DP: dp,
      avatar: dp,
      Name_BN: nameBn,
      name_bn: nameBn,
      Rank_BN: rankBn,
      rank_bn: rankBn,
      Role: role,
      role: role,
      active: isActive,
      status: isActive ? 'Active' : 'Inactive',
      updated_at: docData.updated_at || new Date().toISOString()
    };
  }

  if (collectionName === 'airmen') {
    const aid = docData.airman_id || docData.id || docId;
    const bdNo = String(docData.bdNo || docData['BD No'] || '').replace(/\D/g, '');
    const name = docData.name || docData.Name || docData.fullName || 'Airman';
    const rank = docData.rank || docData.Rank || 'LAC';
    return {
      airman_id: aid,
      id: aid,
      bdNo: bdNo,
      'BD No': bdNo,
      name: name,
      Name: name,
      fullName: docData.fullName || name,
      rank: rank,
      Rank: rank,
      flightName: docData.flightName || docData.Flight || 'Admin',
      Flight: docData.flightName || docData.Flight || 'Admin',
      trade: docData.trade || docData.Trade || 'General',
      Trade: docData.trade || docData.Trade || 'General',
      seniority: Number(docData.seniority ?? docData.Seniority ?? 0),
      Seniority: Number(docData.seniority ?? docData.Seniority ?? 0),
      contactNumber: docData.contactNumber || docData.mobileNo || '',
      presentAddress: docData.presentAddress || docData.addressBlock || 'L/O',
      active: docData.active !== false,
      photoUrl: docData.photoUrl || docData.Photo || '',
      Photo: docData.photoUrl || docData.Photo || '',
      updatedAt: docData.updatedAt || new Date().toISOString()
    };
  }

  if (collectionName === 'duty_rosters') {
    return {
      assignment_id: docData.assignment_id || docData.assignmentId || docData.id || docId,
      id: docData.id || docId,
      airmanId: docData.airmanId || docData.airman_id || '',
      date: docData.date || '',
      shift: docData.shift || 'D',
      dutyType: docData.dutyType || 'DUTY',
      dutyTypeCode: docData.dutyTypeCode || docData.dutyCode || docData.dutyType || 'DUTY',
      monthKey: docData.monthKey || '',
      remarks: docData.remarks || docData.notes || '',
      status: docData.status || 'SCHEDULED',
      updatedAt: docData.updatedAt || new Date().toISOString()
    };
  }

  if (collectionName === 'user_profiles') {
    const clean = String(docData['User ID'] || docData.bdNo || docId.replace(/^user-login-/, '')).replace(/\D/g, '');
    return {
      'User ID': clean,
      id: `user-login-${clean}`,
      bdNo: clean,
      rank: docData.rank || 'LAC',
      name: docData.name || 'Airman',
      flightName: docData.flightName || 'Admin',
      Role: docData.role || docData.Role || (clean === '48456' ? 'OWNER' : 'USER'),
      role: docData.role || docData.Role || (clean === '48456' ? 'OWNER' : 'USER'),
      Status: docData.status || docData.Status || 'ACTIVE',
      status: docData.status || docData.Status || 'ACTIVE',
      password: docData.password || clean,
      adminPass: docData.adminPass || (clean === '48456' ? '1124' : ''),
      updated_at: docData.updated_at || new Date().toISOString()
    };
  }

  return { id: docId, ...docData };
}

type QueryOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'ilike' | 'or';

interface FilterItem {
  field: string;
  op: QueryOp;
  value: any;
}

/**
 * Universal Firestore-backed Query Builder matching PostgREST/Supabase SDK fluent API
 */
export class FirestoreQueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private collectionName: string;
  private operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private mutateData: any = null;
  private filters: FilterItem[] = [];
  private orderField?: string;
  private orderAscending: boolean = true;
  private limitCount?: number;
  private isSingle: boolean = false;

  constructor(table: string) {
    this.collectionName = resolveCollectionName(table);
  }

  select(_columns?: string): this {
    // If called after insert/upsert/update/delete (e.g. .upsert(...).select()),
    // it remains chainable and doesn't override the mutation operation
    return this;
  }

  insert(values: any | any[]): this {
    this.operation = 'insert';
    this.mutateData = values;
    return this;
  }

  upsert(values: any | any[], _options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.mutateData = values;
    return this;
  }

  update(values: any): this {
    this.operation = 'update';
    this.mutateData = values;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any): this {
    const cleanCol = column === 'airman_id' && this.collectionName === 'canteen_members' ? 'airman_id' : column;
    this.filters.push({ field: cleanCol, op: '==', value });
    return this;
  }

  neq(column: string, value: any): this {
    this.filters.push({ field: column, op: '!=', value });
    return this;
  }

  lt(column: string, value: any): this {
    this.filters.push({ field: column, op: '<', value });
    return this;
  }

  lte(column: string, value: any): this {
    this.filters.push({ field: column, op: '<=', value });
    return this;
  }

  gt(column: string, value: any): this {
    this.filters.push({ field: column, op: '>', value });
    return this;
  }

  gte(column: string, value: any): this {
    this.filters.push({ field: column, op: '>=', value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push({ field: column, op: 'in', value: values });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ field: column, op: 'ilike', value: pattern });
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters.push({ field: column, op: 'ilike', value: pattern });
    return this;
  }

  or(filterString: string): this {
    this.filters.push({ field: '__or__', op: 'or', value: filterString });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderField = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(_from: number, _to: number): this {
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.isSingle = true;
    return this;
  }

  private async executeSelect(): Promise<{ data: any; error: any }> {
    if (!db) {
      return { data: null, error: new Error('Firebase Firestore is not initialized') };
    }

    try {
      // 1. Direct doc lookup optimization: if querying by docId
      if (this.collectionName === 'app_settings') {
        const keyEq = this.filters.find(f => f.field === 'setting_key' && f.op === '==');
        if (keyEq && typeof keyEq.value === 'string') {
          const snap = await getDoc(doc(db, 'app_settings', keyEq.value));
          if (!snap.exists()) {
            return { data: this.isSingle ? null : [], error: null };
          }
          const rec = normalizeRecord('app_settings', snap.data(), snap.id);
          return { data: this.isSingle ? rec : [rec], error: null };
        }
      }

      if (this.collectionName === 'canteen_members') {
        const idEq = this.filters.find(f => (f.field === 'airman_id' || f.field === 'id') && f.op === '==');
        if (idEq && typeof idEq.value === 'string') {
          const snap = await getDoc(doc(db, 'canteen_members', idEq.value));
          if (snap.exists()) {
            const rec = normalizeRecord('canteen_members', snap.data(), snap.id);
            return { data: this.isSingle ? rec : [rec], error: null };
          }
        }
      }

      // 2. Fetch full collection
      const colRef = collection(db, this.collectionName);
      const snap = await getDocs(colRef);
      let results: any[] = [];

      snap.forEach(d => {
        results.push(normalizeRecord(this.collectionName, d.data(), d.id));
      });

      // Apply in-memory filtering
      for (const f of this.filters) {
        if (f.op === 'or') {
          // Parse basic PostgREST OR string like "bdNo.eq.123,airman_id.eq.456"
          const parts = String(f.value).split(',');
          results = results.filter(item => {
            return parts.some(p => {
              const [col, op, val] = p.split('.');
              if (!col || !val) return false;
              const itemVal = String(item[col] ?? '').toLowerCase();
              const targetVal = String(val).toLowerCase();
              if (op === 'eq') return itemVal === targetVal;
              if (op === 'ilike') return itemVal.includes(targetVal.replace(/%/g, ''));
              return itemVal === targetVal;
            });
          });
        } else if (f.op === 'in') {
          const arr = Array.isArray(f.value) ? f.value : [f.value];
          results = results.filter(item => arr.includes(item[f.field]));
        } else if (f.op === '==') {
          results = results.filter(item => {
            const val = item[f.field];
            return val === f.value || String(val).toLowerCase() === String(f.value).toLowerCase();
          });
        } else if (f.op === '!=') {
          results = results.filter(item => item[f.field] !== f.value);
        } else if (f.op === '<') {
          results = results.filter(item => Number(item[f.field]) < Number(f.value));
        } else if (f.op === '<=') {
          results = results.filter(item => Number(item[f.field]) <= Number(f.value));
        } else if (f.op === '>') {
          results = results.filter(item => Number(item[f.field]) > Number(f.value));
        } else if (f.op === '>=') {
          results = results.filter(item => Number(item[f.field]) >= Number(f.value));
        } else if (f.op === 'ilike') {
          const cleanPattern = String(f.value).replace(/%/g, '').toLowerCase();
          results = results.filter(item => String(item[f.field] ?? '').toLowerCase().includes(cleanPattern));
        }
      }

      // Order
      if (this.orderField) {
        const field = this.orderField;
        const asc = this.orderAscending;
        results.sort((a, b) => {
          const vA = a[field] ?? '';
          const vB = b[field] ?? '';
          if (vA < vB) return asc ? -1 : 1;
          if (vA > vB) return asc ? 1 : -1;
          return 0;
        });
      }

      // Limit
      if (this.limitCount && this.limitCount > 0) {
        results = results.slice(0, this.limitCount);
      }

      if (this.isSingle) {
        return { data: results.length > 0 ? results[0] : null, error: null };
      }
      return { data: results, error: null };
    } catch (err: any) {
      console.warn(`[FirestoreSupabaseBridge] Query error on ${this.collectionName}:`, err);
      return { data: this.isSingle ? null : [], error: err };
    }
  }

  private async executeMutate(): Promise<{ data: any; error: any }> {
    if (!db) {
      return { data: null, error: new Error('Firebase Firestore is not initialized') };
    }

    try {
      if (this.operation === 'insert' || this.operation === 'upsert') {
        const items = Array.isArray(this.mutateData) ? this.mutateData : [this.mutateData];
        if (items.length === 0) return { data: [], error: null };

        const batch = writeBatch(db);
        const normalizedItems: any[] = [];
        let writeCount = 0;

        for (const item of items) {
          if (!item) continue;
          const docId = resolveDocId(this.collectionName, item);

          // Firestore max document size is 1MB. Guard against writing full client DB cache to app_settings.
          if (this.collectionName === 'app_settings') {
            if (docId === 'baf_155_uasu_v2_db' || item.setting_key === 'baf_155_uasu_v2_db' || docId.endsWith('_db')) {
              console.warn(`[FirestoreSupabaseBridge] Skipping client database cache key '${docId}' in app_settings`);
              continue;
            }
            if (item.setting_value && typeof item.setting_value === 'string' && item.setting_value.length > 600000) {
              console.warn(`[FirestoreSupabaseBridge] Skipping oversized setting '${docId}' (${item.setting_value.length} bytes)`);
              continue;
            }
          }

          const norm = normalizeRecord(this.collectionName, item, docId);
          normalizedItems.push(norm);

          const docRef = doc(db, this.collectionName, docId);
          batch.set(docRef, norm, { merge: true });
          writeCount++;

          // If saving app_settings, also save to local server route as backup
          if (this.collectionName === 'app_settings' && typeof window !== 'undefined') {
            fetch('/api/canteen/save-setting', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ setting_key: norm.setting_key, setting_value: norm.setting_value })
            }).catch(() => {});
          }
        }

        if (writeCount > 0) {
          await batch.commit();
        }
        return { data: normalizedItems, error: null };
      }

      if (this.operation === 'update') {
        const values = this.mutateData || {};
        const idFilter = this.filters.find(f => f.field === 'airman_id' || f.field === 'id' || f.field === 'User ID' || f.field === 'setting_key');
        if (idFilter && idFilter.value) {
          if (this.collectionName === 'app_settings' && (idFilter.value === 'baf_155_uasu_v2_db' || String(idFilter.value).endsWith('_db'))) {
            return { data: [values], error: null };
          }
          const docId = resolveDocId(this.collectionName, { [idFilter.field]: idFilter.value, ...values });
          const docRef = doc(db, this.collectionName, docId);
          await setDoc(docRef, values, { merge: true });
          return { data: [values], error: null };
        }

        const { data: matched } = await this.executeSelect();
        if (Array.isArray(matched)) {
          for (const item of matched) {
            const docId = resolveDocId(this.collectionName, item);
            await setDoc(doc(db, this.collectionName, docId), values, { merge: true });
          }
        }
        return { data: matched, error: null };
      }

      if (this.operation === 'delete') {
        const idFilter = this.filters.find(f => f.field === 'airman_id' || f.field === 'id' || f.field === 'User ID' || f.field === 'setting_key' || f.field === 'assignment_id');
        if (idFilter && idFilter.value) {
          const docId = resolveDocId(this.collectionName, { [idFilter.field]: idFilter.value });
          await deleteDoc(doc(db, this.collectionName, docId));
          return { data: null, error: null };
        }

        const { data: matched } = await this.executeSelect();
        if (Array.isArray(matched)) {
          for (const item of matched) {
            const docId = resolveDocId(this.collectionName, item);
            await deleteDoc(doc(db, this.collectionName, docId));
          }
        }
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.warn(`[FirestoreSupabaseBridge] Mutate error on ${this.collectionName}:`, err);
      return { data: null, error: err };
    }
  }

  async execute(): Promise<{ data: any; error: any }> {
    if (this.operation === 'select') {
      return this.executeSelect();
    } else {
      return this.executeMutate();
    }
  }

  // Makes FirestoreQueryBuilder directly awaitable anywhere in code
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Universal Firestore-backed Realtime Channel
 */
export class FirestoreRealtimeChannel {
  private channelName: string;
  private unsubs: Unsubscribe[] = [];

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(
    _event: string,
    filter: { event?: string; schema?: string; table?: string; filter?: string; [key: string]: any },
    callback: (payload: any) => void
  ): this {
    if (!db || !filter || !filter.table) return this;

    const colName = resolveCollectionName(filter.table);
    try {
      const unsub = onSnapshot(collection(db, colName), (snap) => {
        snap.docChanges().forEach((change) => {
          const docData = change.doc.data();
          const norm = normalizeRecord(colName, docData, change.doc.id);
          callback({
            eventType: change.type === 'removed' ? 'DELETE' : (change.type === 'added' ? 'INSERT' : 'UPDATE'),
            new: norm,
            old: change.type === 'removed' ? norm : undefined,
            schema: 'public',
            table: filter.table
          });
        });
      }, (err) => {
        console.warn(`[FirestoreRealtime] Snapshot warning for ${colName}:`, err);
      });

      this.unsubs.push(unsub);
    } catch (err) {
      console.warn(`[FirestoreRealtime] Channel subscription warning for ${colName}:`, err);
    }

    return this;
  }

  subscribe(callback?: (status: string) => void): this {
    if (callback) {
      setTimeout(() => callback('SUBSCRIBED'), 0);
    }
    return this;
  }

  unsubscribe(): void {
    this.unsubs.forEach(unsub => {
      try { unsub(); } catch {}
    });
    this.unsubs = [];
  }
}

/**
 * Unified Supabase client instance completely routed through Firebase Firestore
 */
export const supabase = {
  from(table: string) {
    return new FirestoreQueryBuilder(table);
  },
  channel(name: string) {
    return new FirestoreRealtimeChannel(name);
  },
  removeChannel(ch: any) {
    if (ch && typeof ch.unsubscribe === 'function') {
      ch.unsubscribe();
    }
  }
};
