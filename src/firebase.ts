import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUserType,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfigData from '../firebase-applet-config.json';

export const firebaseConfig = firebaseConfigData;

export const isFirebaseConfigured = Boolean(
  firebaseConfig &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'remixed-project-id' &&
  firebaseConfig.apiKey
);

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    authInstance = getAuth(appInstance);
  } catch (err) {
    console.warn('[Firebase] Initialization notice:', err);
  }
}

export const app = appInstance as FirebaseApp;
export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;
export const googleAuthProvider = new GoogleAuthProvider();

export { GoogleAuthProvider, signInWithPopup, onAuthStateChanged };
export const firebaseSignOut = async () => {
  if (authInstance) {
    await signOut(authInstance);
  }
};
export type FirebaseUser = FirebaseUserType;

export const CLIENT_SESSION_ID: string = (() => {
  if (typeof window === 'undefined') return `srv_${Date.now()}`;
  try {
    const existing = window.sessionStorage.getItem('baf_client_session_id');
    if (existing) return existing;
    const generated = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem('baf_client_session_id', generated);
    return generated;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
})();

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

const QUOTA_EXCEEDED_KEY = 'baf_firebase_quota_exceeded_at';
const QUOTA_MSG_KEY = 'baf_firebase_quota_error_msg';

let quotaExceededMemory: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(QUOTA_EXCEEDED_KEY);
    if (!saved) return false;
    const savedTime = Date.parse(saved);
    if (isNaN(savedTime)) return false;
    // Reset cached flag automatically if older than 12 hours or from previous UTC day
    const savedUtcDay = new Date(savedTime).toISOString().slice(0, 10);
    const currentUtcDay = new Date().toISOString().slice(0, 10);
    if (savedUtcDay !== currentUtcDay || Date.now() - savedTime > 12 * 60 * 60 * 1000) {
      window.localStorage.removeItem(QUOTA_EXCEEDED_KEY);
      window.localStorage.removeItem(QUOTA_MSG_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
})();

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const code = String((error as any)?.code || '').toLowerCase();
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('free daily read units') ||
    msg.includes('free daily write units') ||
    msg.includes('maximum backoff delay') ||
    msg.includes('429')
  );
}

export function isFirestoreQuotaExceeded(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(QUOTA_EXCEEDED_KEY);
      if (saved) {
        const savedTime = Date.parse(saved);
        if (!isNaN(savedTime)) {
          const savedUtcDay = new Date(savedTime).toISOString().slice(0, 10);
          const currentUtcDay = new Date().toISOString().slice(0, 10);
          if (savedUtcDay !== currentUtcDay || Date.now() - savedTime > 12 * 60 * 60 * 1000) {
            window.localStorage.removeItem(QUOTA_EXCEEDED_KEY);
            window.localStorage.removeItem(QUOTA_MSG_KEY);
            quotaExceededMemory = false;
            return false;
          }
          quotaExceededMemory = true;
          return true;
        }
      }
    } catch {}
  }
  return quotaExceededMemory;
}

export function getQuotaConsoleUpgradeUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
}

export function setFirestoreQuotaExceeded(exceeded: boolean = false, errorMsg?: string): void {
  const prev = quotaExceededMemory;
  quotaExceededMemory = exceeded;

  if (typeof window !== 'undefined') {
    try {
      if (exceeded) {
        window.localStorage.setItem(QUOTA_EXCEEDED_KEY, new Date().toISOString());
        if (errorMsg) window.localStorage.setItem(QUOTA_MSG_KEY, errorMsg);
      } else {
        window.localStorage.removeItem(QUOTA_EXCEEDED_KEY);
        window.localStorage.removeItem(QUOTA_MSG_KEY);
      }
    } catch {}

    window.dispatchEvent(
      new CustomEvent('baf_firebase_quota_status', {
        detail: { exceeded, errorMsg: errorMsg || '' },
      })
    );

    if (exceeded && !prev) {
      window.dispatchEvent(
        new CustomEvent('baf_firebase_quota_exceeded', {
          detail: {
            exceeded: true,
            errorMsg: errorMsg || 'Firestore daily quota exceeded',
            upgradeUrl: getQuotaConsoleUpgradeUrl(),
          },
        })
      );
    }
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errorStr = error instanceof Error ? error.message : String(error);
  if (isQuotaExceededError(error)) {
    setFirestoreQuotaExceeded(true, errorStr);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorStr,
    authInfo: {
      userId: authInstance?.currentUser?.uid || null,
      email: authInstance?.currentUser?.email || null,
      emailVerified: authInstance?.currentUser?.emailVerified || null,
      isAnonymous: authInstance?.currentUser?.isAnonymous || null,
      tenantId: authInstance?.currentUser?.tenantId || null,
      providerInfo:
        authInstance?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  if (!isFirebaseConfigured || !dbInstance) return false;
  try {
    await getDocFromServer(doc(dbInstance, 'test', 'connection'));
    if (isFirestoreQuotaExceeded()) {
      setFirestoreQuotaExceeded(false);
    }
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      const msg = error instanceof Error ? error.message : String(error);
      setFirestoreQuotaExceeded(true, msg);
      return false;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

if (typeof window !== 'undefined' && isFirebaseConfigured) {
  testConnection();
}

export default appInstance;
