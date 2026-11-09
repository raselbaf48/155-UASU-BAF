import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

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
    msg.includes('resource-exhausted')
  );
}

let quotaExceededCached: boolean | null = null;

export function isFirestoreQuotaExceeded(): boolean {
  if (quotaExceededCached !== null) return quotaExceededCached;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('baf_firestore_quota_exceeded_timestamp');
      if (stored) {
        const time = parseInt(stored, 10);
        // Quota resets daily (check if it was recorded within last 12 hours)
        if (Date.now() - time < 12 * 60 * 60 * 1000) {
          quotaExceededCached = true;
          return true;
        } else {
          localStorage.removeItem('baf_firestore_quota_exceeded_timestamp');
        }
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
        window.dispatchEvent(new CustomEvent('baf_firestore_quota_status', { detail: { exceeded: true } }));
      } else {
        localStorage.removeItem('baf_firestore_quota_exceeded_timestamp');
        window.dispatchEvent(new CustomEvent('baf_firestore_quota_status', { detail: { exceeded: false } }));
      }
    } catch {}
  }
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
  testConnection().catch(() => {});
}

export default app;
