import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyAghzYPv96SlMO3D8hY4XONdrM7y-jVTmo",
  authDomain: "gen-lang-client-0797073810.firebaseapp.com",
  projectId: "gen-lang-client-0797073810",
  appId: "1:367957581249:web:b5a444855f7d5654646340",
  firestoreDatabaseId: "ai-studio-b35f5376-7153-4462-a1fc-c0db9156c963"
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Configure Google Auth Provider with Account Chooser prompt
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account' // Forces the Google Account Chooser popup with device Gmail list
});

export { GoogleAuthProvider, signInWithPopup, firebaseSignOut, onAuthStateChanged };
export type { FirebaseUser };

// Database stubs preserved for offline and local storage mode
export const db: any = null;
export const isFirebaseConfigured = true;

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

export function isQuotaExceededError(_error: unknown): boolean {
  return false;
}

export function isFirestoreQuotaExceeded(): boolean {
  return false;
}

export function setFirestoreQuotaExceeded(_exceeded: boolean = false) {
  // No-op: Local storage mode is permanent
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  return true;
}

export default app;
