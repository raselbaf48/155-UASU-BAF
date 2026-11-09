import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, disableNetwork, enableNetwork, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

try {
  setLogLevel('silent');
} catch {}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const isFirebaseConfigured = Boolean(firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String((error as any)?.message || error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('Free daily read units') ||
    msg.includes('Free daily write units') ||
    msg.includes('resource-exhausted') ||
    msg.includes('maximum backoff delay')
  );
}

let quotaExceededCached: boolean | null = null;

export function isFirestoreQuotaExceeded(): boolean {
  if (quotaExceededCached !== null) return quotaExceededCached;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('baf_firestore_quota_exceeded_timestamp') || localStorage.getItem('baf_firestore_write_quota_exceeded');
      if (stored) {
        const time = parseInt(stored, 10);
        // Quota resets daily (check if it was recorded within last 24 hours)
        if (!isNaN(time) && Date.now() - time < 24 * 60 * 60 * 1000) {
          quotaExceededCached = true;
          return true;
        } else if (stored === 'true') {
          quotaExceededCached = true;
          return true;
        } else {
          localStorage.removeItem('baf_firestore_quota_exceeded_timestamp');
          localStorage.removeItem('baf_firestore_write_quota_exceeded');
          localStorage.removeItem('firebase_quota_exceeded');
        }
      }
      if (localStorage.getItem('firebase_quota_exceeded') === new Date().toDateString()) {
        quotaExceededCached = true;
        return true;
      }
    } catch {}
  }
  quotaExceededCached = false;
  return false;
}

export function setFirestoreQuotaExceeded(exceeded: boolean = true) {
  quotaExceededCached = exceeded;
  if (typeof window !== 'undefined') {
    try {
      if (exceeded) {
        localStorage.setItem('baf_firestore_quota_exceeded_timestamp', String(Date.now()));
        localStorage.setItem('firebase_quota_exceeded', new Date().toDateString());
        localStorage.setItem('baf_firestore_write_quota_exceeded', 'true');
        window.dispatchEvent(new CustomEvent('baf_firestore_quota_status', { detail: { exceeded: true } }));
        if (db) {
          disableNetwork(db).catch(() => {});
        }
      } else {
        localStorage.removeItem('baf_firestore_quota_exceeded_timestamp');
        localStorage.removeItem('firebase_quota_exceeded');
        localStorage.removeItem('baf_firestore_write_quota_exceeded');
        window.dispatchEvent(new CustomEvent('baf_firestore_quota_status', { detail: { exceeded: false } }));
        if (db) {
          enableNetwork(db).catch(() => {});
        }
      }
    } catch {}
  }
}

// Global safety net: intercept any unhandled quota limit errors to prevent retry loops
if (typeof window !== 'undefined') {
  // Silence Firestore SDK console.error for quota exhaustion so it doesn't pollute the error boundary
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const firstArg = String(args[0] || '');
    const secondArg = args[1] ? String(args[1]?.message || args[1] || '') : '';
    const combined = `${firstArg} ${secondArg}`;
    if (isQuotaExceededError(combined)) {
      setFirestoreQuotaExceeded(true);
      if (db) disableNetwork(db).catch(() => {});
      console.warn('[Firestore Offline] Running safely in offline/local storage mode due to daily quota limit.');
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    if (isQuotaExceededError(reason)) {
      setFirestoreQuotaExceeded(true);
      if (db) disableNetwork(db).catch(() => {});
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isQuotaExceededError(event?.error || event?.message)) {
      setFirestoreQuotaExceeded(true);
      if (db) disableNetwork(db).catch(() => {});
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  if (isQuotaExceededError(error)) {
    setFirestoreQuotaExceeded(true);
    console.warn(`[Firestore Quota] Free tier daily quota limit reached on path '${path}'. Switching safely to local offline storage.`);
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      setFirestoreQuotaExceeded(true);
      console.warn("Firestore free tier quota limit reached. Running in offline/local storage mode.");
      return false;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or network status.");
    }
    return false;
  }
}

// Initial boot check
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  if (isFirestoreQuotaExceeded()) {
    if (db) disableNetwork(db).catch(() => {});
  } else {
    testConnection().catch(() => {});
  }
}

export default app;
