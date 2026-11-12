// Firebase has been completely disconnected.
// The system operates 100% on Local Cloud and Backup & Restore.

export const firebaseConfig = {};
export const app: any = null;
export const auth: any = null;
export const googleAuthProvider: any = null;
export const db: any = null;
export const isFirebaseConfigured = false;

export const GoogleAuthProvider: any = class {
  static credentialFromResult() {
    return null;
  }
  addScope() {}
  setCustomParameters() {}
};

export const signInWithPopup = async (..._args: any[]): Promise<any> => ({ user: null });
export const firebaseSignOut = async () => {};
export const onAuthStateChanged = (_auth: any, callback: (user: any) => void) => {
  callback(null);
  return () => {};
};

export type FirebaseUser = any;

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
  authInfo: Record<string, any>;
}

export function isQuotaExceededError(_error: unknown): boolean {
  return false;
}

export function isFirestoreQuotaExceeded(): boolean {
  return false;
}

export function setFirestoreQuotaExceeded(_exceeded: boolean = false) {}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  throw new Error(`Local storage mode: ${error}`);
}

export async function testConnection(): Promise<boolean> {
  return false;
}

export default null;
