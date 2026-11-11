// Firebase has been completely removed in favor of Local Database & Offline Storage.
// Functions are implemented locally to ensure full compatibility with localDb and UI components.

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

export async function checkFirebaseHealth(): Promise<boolean> {
  return false;
}

export async function pushAirmenToFirebase(airmen: any[]): Promise<number> {
  return airmen?.length || 0;
}

export async function fetchAirmenFromFirebase(): Promise<any[]> {
  return [];
}

export async function pushDutyAssignmentsToFirebase(assignments: any[]): Promise<number> {
  return assignments?.length || 0;
}

export async function fetchDutyAssignmentsFromFirebase(): Promise<any[]> {
  return [];
}

export async function pushParadeStatesToFirebase(states: any[]): Promise<number> {
  return states?.length || 0;
}

export async function fetchParadeStatesFromFirebase(): Promise<any[]> {
  return [];
}

export async function pushUserProfilesToFirebase(users: any[]): Promise<number> {
  return users?.length || 0;
}

export async function fetchUserProfilesFromFirebase(): Promise<any[]> {
  return [];
}

export async function pushAppSettingsToFirebase(settings: any[]): Promise<number> {
  return settings?.length || 0;
}

export async function fetchAppSettingsFromFirebase(): Promise<any[]> {
  return [];
}

export async function pushCanteenMembersToFirebase(members: any[]): Promise<number> {
  return members?.length || 0;
}

export async function executeFullMigrationToFirebase(_dbData?: any): Promise<FirebaseMigrationResult> {
  return {
    success: true,
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
}
