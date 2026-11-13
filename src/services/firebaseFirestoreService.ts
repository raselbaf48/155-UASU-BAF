import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import {
  db,
  isFirebaseConfigured,
  isFirestoreQuotaExceeded,
  isQuotaExceededError,
  setFirestoreQuotaExceeded,
  handleFirestoreError,
  OperationType,
  CLIENT_SESSION_ID,
} from '../firebase';

export interface FirebaseMigrationResult {
  success: boolean;
  airmenCount: number;
  dutyCount: number;
  paradeCount: number;
  usersCount: number;
  settingsCount: number;
  canteenMembersCount: number;
  canteenTxsCount: number;
  canteenExpensesCount: number;
  errors: string[];
}

export interface SyncManifest {
  id: string;
  revision: number;
  updatedAt: string;
  updatedBySessionId?: string;
  updatedByBdNo?: string;
  lastReason?: string;
  changedCollections?: string[];
}

export interface PendingAssignmentDelta {
  docId: string;
  updatedAt: string;
  isDeleted?: boolean;
  assignment?: any;
}

export interface PendingDeltaQueue {
  airmen: Record<string, string>; // key -> updatedAt
  assignments: Record<string, PendingAssignmentDelta>; // docId -> delta
  history: Record<string, string>; // id -> updatedAt
  users: Record<string, string>; // id -> updatedAt
  settings: Record<string, string>; // settingKey -> updatedAt
  canteenData: Record<string, string>; // docKey -> updatedAt
  canteenMembers: Record<string, string>; // airman_id -> updatedAt
  lastModifiedAt: string;
}

const PENDING_DELTA_QUEUE_KEY = 'baf_pending_delta_queue_v1';

// -------------------- Helpers --------------------

export function sanitizeDocId(raw: string): string {
  const s = String(raw || 'doc')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const trimmed = s || 'doc';
  if (trimmed.length <= 120) return trimmed;
  // Deterministic suffix hash for long keys
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return `${trimmed.slice(0, 105)}_${hash.toString(36)}`;
}

function clampStr(val: any, maxLen: number): string | undefined {
  if (val === undefined || val === null) return undefined;
  const s = String(val);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function toIsoString(val: any): string {
  if (typeof val === 'string' && val.trim()) {
    const t = Date.parse(val);
    if (!isNaN(t)) return new Date(t).toISOString();
  }
  if (typeof val === 'number' && !isNaN(val)) {
    return new Date(val).toISOString();
  }
  return new Date().toISOString();
}

function stripUndefinedDeep(obj: any): any {
  if (obj === undefined || obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map((v) => (v === undefined ? null : stripUndefinedDeep(v)));
  }
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out;
  }
  return obj;
}

function encodeNativeSettingValue(raw: any): any {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'boolean' || typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length <= 4800) {
          const cleaned = stripUndefinedDeep(parsed);
          const checkLen = JSON.stringify(cleaned).length;
          if (checkLen <= 850000) return cleaned;
        } else if (
          parsed &&
          typeof parsed === 'object' &&
          Object.keys(parsed).length <= 4800
        ) {
          const cleaned = stripUndefinedDeep(parsed);
          const checkLen = JSON.stringify(cleaned).length;
          if (checkLen <= 850000) return cleaned;
        }
      } catch {}
    }
    return raw.length > 890000 ? raw.slice(0, 890000) : raw;
  }
  if (Array.isArray(raw)) {
    if (raw.length <= 4800) {
      const cleaned = stripUndefinedDeep(raw);
      if (JSON.stringify(cleaned).length <= 850000) return cleaned;
    }
    const str = JSON.stringify(raw);
    return str.length > 890000 ? str.slice(0, 890000) : str;
  }
  if (typeof raw === 'object') {
    if (Object.keys(raw).length <= 4800) {
      const cleaned = stripUndefinedDeep(raw);
      if (JSON.stringify(cleaned).length <= 850000) return cleaned;
    }
    const str = JSON.stringify(raw);
    return str.length > 890000 ? str.slice(0, 890000) : str;
  }
  return String(raw);
}

export function decodeNativeValueToString(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

export function getAssignmentDocId(a: any): string {
  const raw =
    a?.id ||
    `asn_${a?.airmanId || 'u'}_${a?.date || '0000'}_${a?.dutyCode || 'GD'}_${a?.idaShift || 'n'}_${a?.disposalScope || 'ALL'}`;
  return sanitizeDocId(raw);
}

export function getAirmanDocId(a: any): string {
  const cleanBd = String(a?.bdNo || '').replace(/\D/g, '');
  const raw = a?.id || (cleanBd ? `BD_${cleanBd}` : `airman_${Date.now()}`);
  return sanitizeDocId(raw);
}

// -------------------- Pending Offline Delta Queue --------------------

function emptyQueue(): PendingDeltaQueue {
  return {
    airmen: {},
    assignments: {},
    history: {},
    users: {},
    settings: {},
    canteenData: {},
    canteenMembers: {},
    lastModifiedAt: new Date().toISOString(),
  };
}

export function getPendingDeltaQueue(): PendingDeltaQueue {
  if (typeof window === 'undefined') return emptyQueue();
  try {
    const raw = window.localStorage.getItem(PENDING_DELTA_QUEUE_KEY);
    if (!raw) return emptyQueue();
    const p = JSON.parse(raw);
    return {
      airmen: p?.airmen || {},
      assignments: p?.assignments || {},
      history: p?.history || {},
      users: p?.users || {},
      settings: p?.settings || {},
      canteenData: p?.canteenData || {},
      canteenMembers: p?.canteenMembers || {},
      lastModifiedAt: p?.lastModifiedAt || new Date().toISOString(),
    };
  } catch {
    return emptyQueue();
  }
}

export function savePendingDeltaQueue(q: PendingDeltaQueue): void {
  if (typeof window === 'undefined') return;
  try {
    q.lastModifiedAt = new Date().toISOString();
    window.localStorage.setItem(PENDING_DELTA_QUEUE_KEY, JSON.stringify(q));
    window.dispatchEvent(new CustomEvent('baf_pending_delta_updated', { detail: getPendingDeltaCount(q) }));
  } catch (e) {
    console.warn('[FirebaseService] Failed saving pending delta queue:', e);
  }
}

export function getPendingDeltaCount(q?: PendingDeltaQueue): number {
  const queue = q || getPendingDeltaQueue();
  return (
    Object.keys(queue.airmen).length +
    Object.keys(queue.assignments).length +
    Object.keys(queue.history).length +
    Object.keys(queue.users).length +
    Object.keys(queue.settings).length +
    Object.keys(queue.canteenData).length +
    Object.keys(queue.canteenMembers).length
  );
}

export function hasPendingDeltas(): boolean {
  return getPendingDeltaCount() > 0;
}

export function recordPendingDeltas(params: {
  airmen?: any[];
  assignments?: any[];
  deletedAssignments?: any[];
  history?: any[];
  users?: any[];
  settingKeys?: string[];
  canteenKeys?: string[];
  canteenMemberIds?: string[];
}) {
  const q = getPendingDeltaQueue();
  const now = new Date().toISOString();

  (params.airmen || []).forEach((a) => {
    const id = getAirmanDocId(a);
    q.airmen[id] = a?.updatedAt || now;
  });

  (params.assignments || []).forEach((a) => {
    const docId = getAssignmentDocId(a);
    q.assignments[docId] = {
      docId,
      updatedAt: a?.updatedAt || now,
      isDeleted: false,
      assignment: { ...a, updatedAt: a?.updatedAt || now },
    };
  });

  (params.deletedAssignments || []).forEach((a) => {
    const docId = getAssignmentDocId(a);
    q.assignments[docId] = {
      docId,
      updatedAt: now,
      isDeleted: true,
      assignment: { ...a, isDeleted: true, updatedAt: now },
    };
  });

  (params.history || []).forEach((h) => {
    if (h?.id) q.history[sanitizeDocId(h.id)] = h.updatedAt || h.timestamp || now;
  });

  (params.users || []).forEach((u) => {
    const id = sanitizeDocId(u?.id || `user_${u?.bdNo || 'u'}`);
    q.users[id] = u?.updatedAt || now;
  });

  (params.settingKeys || []).forEach((k) => {
    if (k) q.settings[k] = now;
  });

  (params.canteenKeys || []).forEach((k) => {
    if (k) q.canteenData[k] = now;
  });

  (params.canteenMemberIds || []).forEach((id) => {
    if (id) q.canteenMembers[sanitizeDocId(id)] = now;
  });

  savePendingDeltaQueue(q);
}

export function clearPendingDeltas(partial?: {
  airmenIds?: string[];
  assignmentDocIds?: string[];
  historyIds?: string[];
  userIds?: string[];
  settingKeys?: string[];
  canteenKeys?: string[];
  canteenMemberIds?: string[];
  clearAll?: boolean;
}) {
  if (!partial || partial.clearAll) {
    savePendingDeltaQueue(emptyQueue());
    return;
  }
  const q = getPendingDeltaQueue();
  (partial.airmenIds || []).forEach((id) => delete q.airmen[id]);
  (partial.assignmentDocIds || []).forEach((id) => delete q.assignments[id]);
  (partial.historyIds || []).forEach((id) => delete q.history[id]);
  (partial.userIds || []).forEach((id) => delete q.users[id]);
  (partial.settingKeys || []).forEach((k) => delete q.settings[k]);
  (partial.canteenKeys || []).forEach((k) => delete q.canteenData[k]);
  (partial.canteenMemberIds || []).forEach((id) => delete q.canteenMembers[id]);
  savePendingDeltaQueue(q);
}

// -------------------- Health & Quota Probe --------------------

export async function probeFirebaseConnectionAndQuota(forceServerCheck = false): Promise<{
  ok: boolean;
  quotaExceeded: boolean;
  errorMsg?: string;
}> {
  if (!isFirebaseConfigured || !db) {
    return { ok: false, quotaExceeded: false, errorMsg: 'Firebase not configured' };
  }
  if (!forceServerCheck && isFirestoreQuotaExceeded()) {
    return { ok: false, quotaExceeded: true, errorMsg: 'Firestore daily quota exceeded' };
  }
  try {
    await withFirestoreTimeout(getDocFromServer(doc(db, 'test', 'connection')), 8000, 'probe:connection');
    if (isFirestoreQuotaExceeded()) {
      setFirestoreQuotaExceeded(false);
    }
    return { ok: true, quotaExceeded: false };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, msg);
      return { ok: false, quotaExceeded: true, errorMsg: msg };
    }
    return { ok: false, quotaExceeded: false, errorMsg: msg };
  }
}

export async function checkFirebaseHealth(): Promise<boolean> {
  const res = await probeFirebaseConnectionAndQuota(false);
  return res.ok;
}

// -------------------- Chunked Batch Helper --------------------

function withFirestoreTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore ${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function commitSetOps(
  ops: Array<{ path: string; docId: string; data: Record<string, any> }>,
  collectionLabel: string
): Promise<number> {
  if (!isFirebaseConfigured || !db || ops.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;

  let written = 0;
  const CHUNK_SIZE = 350;
  const chunks: Array<Array<{ path: string; docId: string; data: Record<string, any> }>> = [];
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    chunks.push(ops.slice(i, i + CHUNK_SIZE));
  }

  const processChunk = async (chunk: Array<{ path: string; docId: string; data: Record<string, any> }>) => {
    if (isFirestoreQuotaExceeded()) return;
    try {
      const batch = writeBatch(db);
      for (const op of chunk) {
        batch.set(doc(db, op.path, op.docId), op.data, { merge: true });
      }
      await withFirestoreTimeout(batch.commit(), 15000, `batch:${collectionLabel}`);
      written += chunk.length;
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        setFirestoreQuotaExceeded(true, err?.message || `Quota exceeded writing ${collectionLabel}`);
        throw err;
      }
      const MINI_SIZE = 20;
      let loggedOnce = false;
      for (let j = 0; j < chunk.length; j += MINI_SIZE) {
        if (isFirestoreQuotaExceeded()) break;
        const mini = chunk.slice(j, j + MINI_SIZE);
        const results = await Promise.allSettled(
          mini.map((op) =>
            withFirestoreTimeout(
              setDoc(doc(db, op.path, op.docId), op.data, { merge: true }),
              8000,
              `setDoc:${op.path}/${op.docId}`
            )
          )
        );
        for (let k = 0; k < results.length; k++) {
          const r = results[k];
          if (r.status === 'fulfilled') {
            written++;
          } else {
            const singleErr: any = r.reason;
            if (isQuotaExceededError(singleErr)) {
              setFirestoreQuotaExceeded(true, singleErr?.message);
              throw singleErr;
            }
            if (!loggedOnce) {
              loggedOnce = true;
              console.warn(
                `[FirebaseService] Failed writing ${mini[k].path}/${mini[k].docId}:`,
                singleErr?.message || singleErr
              );
            }
          }
        }
      }
    }
  };

  // Run up to 3 batches in parallel so bulk writes complete 3x faster
  const PARALLEL_BATCHES = 3;
  for (let b = 0; b < chunks.length; b += PARALLEL_BATCHES) {
    if (isFirestoreQuotaExceeded()) break;
    await Promise.all(chunks.slice(b, b + PARALLEL_BATCHES).map(processChunk));
  }

  return written;
}

export async function fetchSyncManifestFromFirebase(): Promise<SyncManifest | null> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return null;
  try {
    const snap = await withFirestoreTimeout(
      getDoc(doc(db, 'system_meta', 'sync_manifest')),
      8000,
      'get:sync_manifest'
    );
    if (!snap.exists()) return null;
    return snap.data() as SyncManifest;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, err?.message);
    }
    return null;
  }
}

// -------------------- Sync Manifest --------------------

function getCurrentBdNo(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.sessionStorage.getItem('baf_user_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      return String(parsed?.bdNo || '').slice(0, 64);
    }
  } catch {}
  return '';
}

export async function publishSyncManifest(
  changedCollections: string[],
  reason: string = 'delta_sync'
): Promise<void> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return;
  try {
    const nowIso = new Date().toISOString();
    const safeCollections = changedCollections
      .filter((c) => typeof c === 'string' && c.trim().length > 0)
      .slice(0, 20);
    await withFirestoreTimeout(
      setDoc(
        doc(db, 'system_meta', 'sync_manifest'),
        {
          id: 'sync_manifest',
          revision: Date.now(),
          updatedAt: nowIso,
          updatedBySessionId: CLIENT_SESSION_ID.slice(0, 128),
          updatedByBdNo: getCurrentBdNo() || 'system',
          lastReason: clampStr(reason, 200) || 'delta_sync',
          changedCollections: safeCollections,
        },
        { merge: true }
      ),
      8000,
      'set:sync_manifest'
    );
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, err?.message);
    } else {
      console.warn('[FirebaseService] Manifest update notice:', err?.message);
    }
  }
}

export function subscribeToSyncManifest(
  callback: (manifest: SyncManifest) => void
): () => void {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) {
    return () => {};
  }
  try {
    return onSnapshot(
      doc(db, 'system_meta', 'sync_manifest'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as SyncManifest;
        if (data && data.updatedAt) {
          callback(data);
        }
      },
      (err) => {
        if (isQuotaExceededError(err)) {
          setFirestoreQuotaExceeded(true, err?.message);
        }
      }
    );
  } catch {
    return () => {};
  }
}

// -------------------- 1. AIRMEN --------------------

function formatAirmanForFirestore(a: any, nowIso: string): { docId: string; data: Record<string, any> } {
  const docId = getAirmanDocId(a);
  const cleanBd = clampStr(a?.bdNo || a?.id || docId, 64) || docId;
  const payload: Record<string, any> = {
    id: clampStr(a?.id || docId, 128) || docId,
    bdNo: cleanBd,
    name: clampStr(a?.name || a?.fullName || 'Airman', 200) || 'Airman',
    updatedAt: toIsoString(a?.updatedAt || nowIso),
  };

  const optStrFields: Array<[string, any, number]> = [
    ['rank', a?.rank, 64],
    ['fullName', a?.fullName, 250],
    ['flightName', a?.flightName, 64],
    ['trade', a?.trade, 128],
    ['mobileNo', a?.mobileNo, 64],
    ['bloodGroup', a?.bloodGroup, 32],
    ['addressBlock', a?.addressBlock, 500],
    ['permanentAddress', a?.permanentAddress, 500],
    ['dateJoined', a?.dateJoined, 64],
    ['dateLeft', a?.dateLeft, 64],
    ['leaveReason', a?.leaveReason, 500],
    ['remarks', a?.remarks, 500],
    ['code', a?.code, 64],
    ['email', a?.email, 200],
  ];
  for (const [k, v, max] of optStrFields) {
    if (v !== undefined && v !== null) {
      const s = clampStr(v, max);
      if (s !== undefined) payload[k] = s;
    }
  }
  if (a?.seniority !== undefined && a?.seniority !== null && !isNaN(Number(a.seniority))) {
    payload.seniority = Number(a.seniority);
  }
  if (a?.serNo !== undefined && a?.serNo !== null && !isNaN(Number(a.serNo))) {
    payload.serNo = Number(a.serNo);
  }
  if (a?.active !== undefined) {
    payload.active = Boolean(a.active);
  }

  return { docId, data: payload };
}

export async function pushAirmenToFirebase(airmen: any[]): Promise<number> {
  if (!isFirebaseConfigured || !db || !Array.isArray(airmen) || airmen.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;
  const nowIso = new Date().toISOString();
  const ops = airmen.map((a) => {
    const formatted = formatAirmanForFirestore(a, nowIso);
    return { path: 'airmen', ...formatted };
  });
  return commitSetOps(ops, 'airmen');
}

export async function fetchAirmenFromFirebase(sinceIso?: string): Promise<any[]> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return [];
  try {
    const colRef = collection(db, 'airmen');
    const q = sinceIso ? query(colRef, where('updatedAt', '>', sinceIso)) : colRef;
    const snap = await withFirestoreTimeout(getDocs(q), 20000, 'list:airmen');
    const list: any[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data());
    });
    return list;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, (err as any)?.message);
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'airmen');
  }
}

// -------------------- 2. DUTY ASSIGNMENTS --------------------

function formatDutyAssignmentForFirestore(
  a: any,
  nowIso: string,
  forceDelete?: boolean
): { docId: string; data: Record<string, any> } {
  const docId = getAssignmentDocId(a);
  const updatedAt = toIsoString(forceDelete ? nowIso : a?.updatedAt || nowIso);
  const rawDate = String(a?.date || nowIso.slice(0, 10)).trim();
  const safeDate = rawDate.length >= 4 ? (rawDate.length > 32 ? rawDate.slice(0, 32) : rawDate) : nowIso.slice(0, 10);
  const rawCode = String(a?.dutyCode || 'GD').trim() || 'GD';
  const safeCode = rawCode.length > 64 ? rawCode.slice(0, 64) : rawCode;
  const payload: Record<string, any> = {
    id: clampStr(docId, 128) || docId,
    airmanId: clampStr(a?.airmanId || 'unknown', 128) || 'unknown',
    date: safeDate,
    dutyCode: safeCode,
    updatedAt,
  };

  const optStr: Array<[string, any, number]> = [
    ['dutyName', a?.dutyName, 200],
    ['idaShift', a?.idaShift, 32],
    ['proxyForFlight', a?.proxyForFlight, 64],
    ['disposalScope', a?.disposalScope || 'ALL', 32],
    ['notes', a?.notes, 1000],
    ['location', a?.location, 200],
    ['updatedBy', a?.updatedBy || a?.assignedBy || getCurrentBdNo() || 'user', 128],
  ];
  for (const [k, v, max] of optStr) {
    if (v !== undefined && v !== null) {
      const s = clampStr(v, max);
      if (s !== undefined) payload[k] = s;
    }
  }

  payload.isOfficial = Boolean(a?.isOfficial);
  payload.isCompleted = Boolean(a?.isCompleted);
  payload.isDeleted = Boolean(forceDelete !== undefined ? forceDelete : a?.isDeleted);

  return { docId, data: payload };
}

export async function pushDutyAssignmentsToFirebase(assignments: any[]): Promise<number> {
  if (!isFirebaseConfigured || !db || !Array.isArray(assignments) || assignments.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;
  const nowIso = new Date().toISOString();
  const ops = assignments.map((a) => {
    const formatted = formatDutyAssignmentForFirestore(a, nowIso, Boolean(a?.isDeleted));
    return { path: 'duty_assignments', ...formatted };
  });
  return commitSetOps(ops, 'duty_assignments');
}

export async function softDeleteDutyAssignmentsInFirebase(assignments: any[]): Promise<number> {
  if (!isFirebaseConfigured || !db || !Array.isArray(assignments) || assignments.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;
  const nowIso = new Date().toISOString();
  const ops = assignments.map((a) => {
    const formatted = formatDutyAssignmentForFirestore(a, nowIso, true);
    return { path: 'duty_assignments', ...formatted };
  });
  return commitSetOps(ops, 'duty_assignments');
}

export async function fetchDutyAssignmentsFromFirebase(sinceIso?: string): Promise<any[]> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return [];
  try {
    const colRef = collection(db, 'duty_assignments');
    const q = sinceIso ? query(colRef, where('updatedAt', '>', sinceIso)) : colRef;
    const snap = await withFirestoreTimeout(getDocs(q), 20000, 'list:duty_assignments');
    const list: any[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data());
    });
    return list;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, (err as any)?.message);
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'duty_assignments');
  }
}

// -------------------- 3. PARADE STATES / ACTIVITY HISTORY --------------------

function formatParadeStateForFirestore(h: any, nowIso: string): { docId: string; data: Record<string, any> } {
  const docId = sanitizeDocId(h?.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const timestamp = toIsoString(h?.timestamp || h?.created_at || h?.date || nowIso);
  const payload: Record<string, any> = {
    id: clampStr(h?.id || docId, 128) || docId,
    timestamp,
    updatedAt: toIsoString(h?.updatedAt || timestamp),
  };

  const optStr: Array<[string, any, number]> = [
    ['actionType', h?.actionType || h?.type, 64],
    ['airmanId', h?.airmanId, 128],
    ['airmanName', h?.airmanName, 200],
    ['airmanRank', h?.airmanRank, 64],
    ['airmanTrade', h?.airmanTrade, 128],
    ['dutyCode', h?.dutyCode, 64],
    ['idaShift', h?.idaShift, 32],
    ['fromDate', h?.fromDate || h?.date, 32],
    ['toDate', h?.toDate || h?.fromDate || h?.date, 32],
    ['notes', h?.notes, 1000],
    ['description', h?.description, 2000],
  ];
  for (const [k, v, max] of optStr) {
    if (v !== undefined && v !== null) {
      const s = clampStr(v, max);
      if (s !== undefined) payload[k] = s;
    }
  }
  return { docId, data: payload };
}

export async function pushParadeStatesToFirebase(states: any[]): Promise<number> {
  if (!isFirebaseConfigured || !db || !Array.isArray(states) || states.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;
  const nowIso = new Date().toISOString();
  const ops = states.map((h) => {
    const formatted = formatParadeStateForFirestore(h, nowIso);
    return { path: 'parade_states', ...formatted };
  });
  return commitSetOps(ops, 'parade_states');
}

export async function fetchParadeStatesFromFirebase(sinceIso?: string): Promise<any[]> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return [];
  try {
    const colRef = collection(db, 'parade_states');
    const q = sinceIso ? query(colRef, where('updatedAt', '>', sinceIso)) : colRef;
    const snap = await withFirestoreTimeout(getDocs(q), 20000, 'list:parade_states');
    const list: any[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data());
    });
    return list;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, (err as any)?.message);
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'parade_states');
  }
}

// -------------------- 4. USER PROFILES --------------------

function formatUserProfileForFirestore(u: any, nowIso: string): { docId: string; data: Record<string, any> } {
  const cleanBd = clampStr(String(u?.bdNo || '').replace(/^BD\/?/i, '').trim() || 'unknown', 64) || 'unknown';
  const docId = sanitizeDocId(u?.id || `user_login_${cleanBd}`);
  const payload: Record<string, any> = {
    id: clampStr(u?.id || docId, 128) || docId,
    bdNo: cleanBd,
    updatedAt: toIsoString(u?.updatedAt || nowIso),
  };

  const optStr: Array<[string, any, number]> = [
    ['airmanId', u?.airmanId, 128],
    ['rank', u?.rank, 64],
    ['name', u?.name, 200],
    ['mobileNo', u?.mobileNo, 64],
    ['flightName', u?.flightName, 64],
    ['trade', u?.trade, 128],
    ['role', u?.role, 32],
    ['status', u?.status, 32],
    ['password', u?.password, 128],
    ['adminPass', u?.adminPass, 128],
    ['ownerPass', u?.ownerPass, 128],
    ['detailOrder', u?.detailOrder, 128],
    ['detailedAt', u?.detailedAt, 64],
    ['detailedBy', u?.detailedBy, 128],
    ['remarks', u?.remarks, 500],
  ];
  for (const [k, v, max] of optStr) {
    if (v !== undefined && v !== null) {
      const s = clampStr(v, max);
      if (s !== undefined) payload[k] = s;
    }
  }
  return { docId, data: payload };
}

export async function pushUserProfilesToFirebase(users: any[]): Promise<number> {
  if (!isFirebaseConfigured || !db || !Array.isArray(users) || users.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;
  const nowIso = new Date().toISOString();
  const validUsers = users.filter((u) => u && u.bdNo && String(u.bdNo).toLowerCase() !== 'deleted_admin');
  if (validUsers.length === 0) return 0;
  const ops = validUsers.map((u) => {
    const formatted = formatUserProfileForFirestore(u, nowIso);
    return { path: 'user_profiles', ...formatted };
  });
  return commitSetOps(ops, 'user_profiles');
}

export async function fetchUserProfilesFromFirebase(sinceIso?: string): Promise<any[]> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return [];
  try {
    const colRef = collection(db, 'user_profiles');
    const q = sinceIso ? query(colRef, where('updatedAt', '>', sinceIso)) : colRef;
    const snap = await withFirestoreTimeout(getDocs(q), 20000, 'list:user_profiles');
    const list: any[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data());
    });
    return list;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, (err as any)?.message);
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'user_profiles');
  }
}

// -------------------- 5. APP SETTINGS --------------------

export interface AppSettingItemInput {
  settingKey: string;
  value: any;
  updatedAt?: string;
  updatedBy?: string;
}

export async function pushAppSettingsToFirebase(settings: AppSettingItemInput[]): Promise<number> {
  if (!isFirebaseConfigured || !db || !Array.isArray(settings) || settings.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;
  const nowIso = new Date().toISOString();
  const updatedBy = getCurrentBdNo() || 'user';
  const ops = settings
    .filter((s) => s && s.settingKey)
    .map((s) => {
      const docId = sanitizeDocId(s.settingKey);
      return {
        path: 'app_settings',
        docId,
        data: {
          settingKey: clampStr(s.settingKey, 200) || docId,
          value: encodeNativeSettingValue(s.value),
          updatedAt: toIsoString(s.updatedAt || nowIso),
          updatedBy: clampStr(s.updatedBy || updatedBy, 128) || 'user',
        },
      };
    });
  return commitSetOps(ops, 'app_settings');
}

export async function fetchAppSettingsWithMetaFromFirebase(
  sinceIso?: string
): Promise<Record<string, { valueStr: string; rawValue: any; updatedAt: string; updatedBy?: string }>> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return {};
  try {
    const colRef = collection(db, 'app_settings');
    const q = sinceIso ? query(colRef, where('updatedAt', '>', sinceIso)) : colRef;
    const snap = await withFirestoreTimeout(getDocs(q), 20000, 'list:app_settings');
    const result: Record<string, { valueStr: string; rawValue: any; updatedAt: string; updatedBy?: string }> = {};
    snap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      if (d && d.settingKey) {
        result[d.settingKey] = {
          valueStr: decodeNativeValueToString(d.value),
          rawValue: d.value,
          updatedAt: String(d.updatedAt || ''),
          updatedBy: d.updatedBy,
        };
      }
    });
    return result;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, (err as any)?.message);
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'app_settings');
  }
}

export async function fetchAppSettingsFromFirebase(sinceIso?: string): Promise<Record<string, string>> {
  const withMeta = await fetchAppSettingsWithMetaFromFirebase(sinceIso);
  const out: Record<string, string> = {};
  Object.entries(withMeta).forEach(([k, info]) => {
    out[k] = info.valueStr;
  });
  return out;
}

// -------------------- 6. CANTEEN MEMBERS --------------------

function formatCanteenMemberForFirestore(m: any, nowIso: string): { docId: string; data: Record<string, any> } {
  const rawBd = String(m?.['BD No'] || m?.bdNo || '').replace(/^BD\/?/i, '').trim();
  const cleanDigits = rawBd.replace(/\D/g, '');
  const airmanIdRaw = String(m?.airman_id || m?.id || (cleanDigits ? `airman-${cleanDigits}` : `mem-${Date.now()}`));
  const docId = sanitizeDocId(airmanIdRaw);

  const payload: Record<string, any> = {
    airman_id: clampStr(airmanIdRaw, 128) || docId,
    bdNo: clampStr(rawBd || cleanDigits || docId, 64) || docId,
    updatedAt: toIsoString(m?.updatedAt || m?.updated_at || nowIso),
  };

  const optStr: Array<[string, any, number]> = [
    ['rank', m?.Rank || m?.rank, 64],
    ['surname', m?.Surname || m?.surname || m?.Name || m?.name, 200],
    ['contact', m?.Contact || m?.['Mobile No'] || m?.contact || m?.mobileNo, 64],
    ['dp', m?.DP || m?.dp, 490000],
    ['role', m?.Role || m?.role, 64],
    ['nameBn', m?.Name_BN || m?.name_bn || m?.nameBn, 200],
    ['rankBn', m?.Rank_BN || m?.rank_bn || m?.rankBn, 100],
  ];
  for (const [k, v, max] of optStr) {
    if (v !== undefined && v !== null) {
      const s = clampStr(v, max);
      if (s !== undefined) payload[k] = s;
    }
  }

  const dueVal = Number(m?.Due ?? m?.due ?? m?.baki ?? 0);
  payload.due = isNaN(dueVal) ? 0 : dueVal;

  const senVal = m?.Seniority ?? m?.seniority;
  if (senVal !== undefined && senVal !== null && !isNaN(Number(senVal))) {
    payload.seniority = Number(senVal);
  }
  payload.active = m?.active !== false;

  return { docId, data: payload };
}

function hydrateCanteenMemberFromFirestore(d: any): any {
  const bdNo = String(d?.bdNo || '').trim();
  const dueNum = Number(d?.due ?? 0);
  return {
    airman_id: d?.airman_id,
    'BD No': bdNo,
    bdNo,
    Rank: d?.rank || '',
    rank: d?.rank || '',
    Surname: d?.surname || '',
    surname: d?.surname || '',
    Contact: d?.contact || '',
    contact: d?.contact || '',
    Due: dueNum,
    due: dueNum,
    baki: dueNum,
    DP: d?.dp || '',
    dp: d?.dp || '',
    Role: d?.role || '',
    role: d?.role || '',
    Seniority: d?.seniority,
    seniority: d?.seniority,
    Name_BN: d?.nameBn || '',
    name_bn: d?.nameBn || '',
    nameBn: d?.nameBn || '',
    Rank_BN: d?.rankBn || '',
    rank_bn: d?.rankBn || '',
    rankBn: d?.rankBn || '',
    active: d?.active !== false,
    updatedAt: d?.updatedAt,
  };
}

export async function pushCanteenMembersToFirebase(members: any[]): Promise<number> {
  if (!isFirebaseConfigured || !db || !Array.isArray(members) || members.length === 0) return 0;
  if (isFirestoreQuotaExceeded()) return 0;
  const nowIso = new Date().toISOString();
  const ops = members
    .filter((m) => m && (m.airman_id || m['BD No'] || m.bdNo))
    .map((m) => {
      const formatted = formatCanteenMemberForFirestore(m, nowIso);
      return { path: 'canteen_members', ...formatted };
    });
  return commitSetOps(ops, 'canteen_members');
}

export async function fetchCanteenMembersFromFirebase(sinceIso?: string): Promise<any[]> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return [];
  try {
    const colRef = collection(db, 'canteen_members');
    const q = sinceIso ? query(colRef, where('updatedAt', '>', sinceIso)) : colRef;
    const snap = await withFirestoreTimeout(getDocs(q), 20000, 'list:canteen_members');
    const list: any[] = [];
    snap.forEach((docSnap) => {
      list.push(hydrateCanteenMemberFromFirestore(docSnap.data()));
    });
    return list;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, (err as any)?.message);
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'canteen_members');
  }
}

// -------------------- 7. CANTEEN DATA --------------------

export async function pushCanteenDataKeyToFirebase(
  docKey: string,
  value: any,
  updatedAt?: string
): Promise<boolean> {
  if (!isFirebaseConfigured || !db || !docKey) return false;
  if (isFirestoreQuotaExceeded()) return false;
  const docId = sanitizeDocId(docKey);
  const nowIso = toIsoString(updatedAt || new Date().toISOString());
  try {
    await withFirestoreTimeout(
      setDoc(
        doc(db, 'canteen_data', docId),
        {
          docKey: clampStr(docKey, 128) || docId,
          value: encodeNativeSettingValue(value),
          updatedAt: nowIso,
          updatedBy: clampStr(getCurrentBdNo() || 'canteen_user', 128) || 'canteen_user',
        },
        { merge: true }
      ),
      10000,
      `set:canteen_data/${docKey}`
    );
    return true;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, err?.message);
      return false;
    }
    console.warn(`[FirebaseService] Failed pushing canteen_data/${docKey}:`, err?.message);
    return false;
  }
}

export async function fetchCanteenDataFromFirebase(
  sinceIso?: string
): Promise<Array<{ docKey: string; value: any; updatedAt: string; updatedBy?: string }>> {
  if (!isFirebaseConfigured || !db || isFirestoreQuotaExceeded()) return [];
  try {
    const colRef = collection(db, 'canteen_data');
    const q = sinceIso ? query(colRef, where('updatedAt', '>', sinceIso)) : colRef;
    const snap = await withFirestoreTimeout(getDocs(q), 20000, 'list:canteen_data');
    const list: Array<{ docKey: string; value: any; updatedAt: string; updatedBy?: string }> = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      if (d && d.docKey) {
        list.push({
          docKey: String(d.docKey),
          value: d.value,
          updatedAt: String(d.updatedAt || ''),
          updatedBy: d.updatedBy,
        });
      }
    });
    return list;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, (err as any)?.message);
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'canteen_data');
  }
}

export async function fetchSingleCanteenDocFromFirebase(docKey: string): Promise<any | null> {
  if (!isFirebaseConfigured || !db || !docKey || isFirestoreQuotaExceeded()) return null;
  try {
    const snap = await withFirestoreTimeout(
      getDoc(doc(db, 'canteen_data', sanitizeDocId(docKey))),
      8000,
      `get:canteen_data/${docKey}`
    );
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    return d?.value ?? null;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true, err?.message);
    }
    return null;
  }
}

// -------------------- 8. FULL MIGRATION TO FIREBASE --------------------

export async function executeFullMigrationToFirebase(dbData?: any): Promise<FirebaseMigrationResult> {
  const result: FirebaseMigrationResult = {
    success: false,
    airmenCount: 0,
    dutyCount: 0,
    paradeCount: 0,
    usersCount: 0,
    settingsCount: 0,
    canteenMembersCount: 0,
    canteenTxsCount: 0,
    canteenExpensesCount: 0,
    errors: [],
  };

  if (!isFirebaseConfigured || !db) {
    result.errors.push('Firebase is not configured');
    return result;
  }
  if (isFirestoreQuotaExceeded()) {
    result.errors.push('Firebase daily quota exceeded');
    return result;
  }

  try {
    const data = dbData || {};
    if (Array.isArray(data.airmen) && data.airmen.length > 0) {
      result.airmenCount = await pushAirmenToFirebase(data.airmen);
    }

    const flatAssignments: any[] = [];
    if (data.assignments && typeof data.assignments === 'object') {
      Object.values(data.assignments).forEach((list: any) => {
        if (Array.isArray(list)) {
          list.forEach((a) => {
            if (a && a.airmanId && a.date && a.dutyCode) flatAssignments.push(a);
          });
        }
      });
    }
    if (flatAssignments.length > 0) {
      result.dutyCount = await pushDutyAssignmentsToFirebase(flatAssignments);
    }

    if (Array.isArray(data.activityHistory) && data.activityHistory.length > 0) {
      result.paradeCount = await pushParadeStatesToFirebase(data.activityHistory.slice(0, 300));
    }

    if (Array.isArray(data.detailedUsers) && data.detailedUsers.length > 0) {
      result.usersCount = await pushUserProfilesToFirebase(data.detailedUsers);
    }

    if (typeof window !== 'undefined') {
      // Canteen members
      try {
        const memRaw = window.localStorage.getItem('canteen_members_cache');
        if (memRaw) {
          const mems = JSON.parse(memRaw);
          if (Array.isArray(mems) && mems.length > 0) {
            result.canteenMembersCount = await pushCanteenMembersToFirebase(mems);
          }
        }
      } catch {}

      // Canteen transactions & expenses
      try {
        const txsRaw = window.localStorage.getItem('canteen_txs');
        if (txsRaw) {
          const txs = JSON.parse(txsRaw);
          if (Array.isArray(txs)) {
            await pushCanteenDataKeyToFirebase('canteen_txs', txs);
            result.canteenTxsCount = txs.length;
          }
        }
        const expRaw = window.localStorage.getItem('canteen_expenses');
        if (expRaw) {
          const exps = JSON.parse(expRaw);
          if (Array.isArray(exps)) {
            await pushCanteenDataKeyToFirebase('canteen_expenses', exps);
            result.canteenExpensesCount = exps.length;
          }
        }
      } catch {}

      // App settings
      const settingItems: AppSettingItemInput[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || k === 'baf_155_uasu_v2_db' || k === 'baf_database_v2' || k === PENDING_DELTA_QUEUE_KEY) continue;
        if (k.startsWith('baf_') || k.startsWith('savedDisposalKeys') || k.startsWith('parade_historical') || k.startsWith('flg_wg_')) {
          const v = window.localStorage.getItem(k);
          if (v !== null && v.length < 700000) {
            settingItems.push({ settingKey: k, value: v });
          }
        }
      }
      if (settingItems.length > 0) {
        result.settingsCount = await pushAppSettingsToFirebase(settingItems);
      }
    }

    await publishSyncManifest(
      ['airmen', 'duty_assignments', 'parade_states', 'user_profiles', 'app_settings', 'canteen_members', 'canteen_data'],
      'full_migration'
    );
    result.success = true;
  } catch (err: any) {
    result.errors.push(err?.message || String(err));
  }

  return result;
}
