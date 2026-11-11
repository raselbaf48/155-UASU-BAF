// Firebase has been completely removed in favor of Local Database & Offline Storage.
// All functions and types are preserved as lightweight local stubs for full backward compatibility.

export const app: any = null;
export const db: any = null;
export const auth: any = null;
export const isFirebaseConfigured = false;

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
  return false;
}

export default null;
