import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  query, 
  where,
  getDocFromServer
} from 'firebase/firestore';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from '../firebase';
import { Airman, DutyAssignment, ActivityHistoryItem } from '../types';

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

/**
 * Check if Firebase connection is alive
 */
export async function checkFirebaseHealth(): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied' || (err?.message && !err.message.includes('offline'))) {
      // Permission or connection reached server
      return true;
    }
    return false;
  }
}

/**
 * Push Airmen list to Firestore in batches
 */
export async function pushAirmenToFirebase(airmen: any[]): Promise<number> {
  if (!db || !airmen.length) return 0;
  let count = 0;
  const path = 'airmen';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < airmen.length; i += CHUNK_SIZE) {
      const chunk = airmen.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const a of chunk) {
        const docId = String(a.id || a.airman_id || a.bdNo || `airman_${count}`).replace(/\//g, '_');
        const docRef = doc(db, path, docId);
        
        // Strip out excessive image strings if too large to fit in 1MB document
        let photoPayload = a.photo || a.Photo || a.photoUrl || '';
        if (typeof photoPayload === 'string' && photoPayload.length > 500000) {
          photoPayload = ''; // prevent exceeding Firestore 1MB doc limit
        }

        const data: any = {
          airman_id: docId,
          "Service Number": a.bdNo || a["Service Number"] || '',
          Rank: a.rank || a.Rank || '',
          Trade: a.trade || a.Trade || '',
          Name: a.name || a.Name || '',
          Section: a.section || a.Section || a.flightName || '',
          "Blood Group": a.bloodGroup || a["Blood Group"] || '',
          "Contact Number": a.contactNumber || a["Contact Number"] || a.mobileNo || '',
          "Medical Category": a.medicalCategory || a["Medical Category"] || '',
          "Living Status": a.livingStatus || a["Living Status"] || '',
          "Present Address": a.presentAddress || a["Present Address"] || '',
          "Permanent Address": a.permanentAddress || a["Permanent Address"] || '',
          "Date of Birth": a.dateOfBirth || a["Date of Birth"] || '',
          "Date of Enrolment": a.dateOfEnrolment || a["Date of Enrolment"] || '',
          "Date of Present Rank": a.dateOfPresentRank || a["Date of Present Rank"] || '',
          "Driver License": a.driverLicense || a["Driver License"] || '',
          "Service Status": a.serviceStatus || a["Service Status"] || 'Effective',
          Status: a.status || a.Status || 'Active',
          Photo: photoPayload,
          avatarUrl: a.avatarUrl || a.photoUrl || '',
          Seniority: Number(a.seniority ?? a.Seniority ?? 0),
          updatedAt: new Date().toISOString()
        };
        batch.set(docRef, data, { merge: true });
        count++;
      }
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch all Airmen from Firestore
 */
export async function fetchAirmenFromFirebase(): Promise<Airman[]> {
  if (!db) return [];
  const path = 'airmen';
  try {
    const snap = await getDocs(collection(db, path));
    const list: Airman[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: data.airman_id || d.id,
        airman_id: data.airman_id || d.id,
        bdNo: data["Service Number"] || data.bdNo || '',
        "Service Number": data["Service Number"] || data.bdNo || '',
        rank: data.Rank || '',
        Rank: data.Rank || '',
        trade: data.Trade || '',
        Trade: data.Trade || '',
        name: data.Name || '',
        Name: data.Name || '',
        section: data.Section || '',
        Section: data.Section || '',
        bloodGroup: data["Blood Group"] || '',
        "Blood Group": data["Blood Group"] || '',
        contactNumber: data["Contact Number"] || '',
        "Contact Number": data["Contact Number"] || '',
        medicalCategory: data["Medical Category"] || '',
        "Medical Category": data["Medical Category"] || '',
        livingStatus: data["Living Status"] || '',
        "Living Status": data["Living Status"] || '',
        presentAddress: data["Present Address"] || '',
        "Present Address": data["Present Address"] || '',
        permanentAddress: data["Permanent Address"] || '',
        "Permanent Address": data["Permanent Address"] || '',
        dateOfBirth: data["Date of Birth"] || '',
        "Date of Birth": data["Date of Birth"] || '',
        dateOfEnrolment: data["Date of Enrolment"] || '',
        "Date of Enrolment": data["Date of Enrolment"] || '',
        dateOfPresentRank: data["Date of Present Rank"] || '',
        "Date of Present Rank": data["Date of Present Rank"] || '',
        driverLicense: data["Driver License"] || '',
        "Driver License": data["Driver License"] || '',
        serviceStatus: data["Service Status"] || 'Effective',
        "Service Status": data["Service Status"] || 'Effective',
        status: data.Status || 'Active',
        Status: data.Status || 'Active',
        photo: data.Photo || '',
        avatarUrl: data.avatarUrl || '',
        seniority: Number(data.Seniority ?? 0),
        Seniority: Number(data.Seniority ?? 0)
      } as any);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Push Duty Assignments to Firestore
 */
export async function pushDutyAssignmentsToFirebase(assignments: DutyAssignment[]): Promise<number> {
  if (!db || !assignments.length) return 0;
  let count = 0;
  const path = 'duty_rosters';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < assignments.length; i += CHUNK_SIZE) {
      const chunk = assignments.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const a of chunk) {
        const anyA = a as any;
        const dutyVal = anyA.dutyCode || anyA.dutyType || anyA.dutyName || anyA.duty_name || '';
        const docId = String(anyA.id || anyA.assignment_id || `${a.airmanId}_${a.date}_${dutyVal}`).replace(/\//g, '_');
        const docRef = doc(db, path, docId);
        const data = {
          assignment_id: docId,
          duty_name: dutyVal,
          date: a.date || '',
          airman_id: a.airmanId || anyA.airman_id || '',
          notes: a.notes || '',
          shift: anyA.shift || anyA.idaShift || '',
          category: anyA.category || '',
          created_at: anyA.created_at || new Date().toISOString()
        };
        batch.set(docRef, data, { merge: true });
        count++;
      }
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch Duty Assignments from Firestore
 */
export async function fetchDutyAssignmentsFromFirebase(): Promise<DutyAssignment[]> {
  if (!db) return [];
  const path = 'duty_rosters';
  try {
    const snap = await getDocs(collection(db, path));
    const list: DutyAssignment[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: data.assignment_id || d.id,
        assignment_id: data.assignment_id || d.id,
        airmanId: data.airman_id,
        airman_id: data.airman_id,
        date: data.date,
        dutyType: data.duty_name,
        dutyName: data.duty_name,
        shift: data.shift || undefined,
        category: data.category || undefined,
        notes: data.notes || ''
      } as any);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Push Parade State History to Firestore
 */
export async function pushParadeStatesToFirebase(history: ActivityHistoryItem[]): Promise<number> {
  if (!db || !history.length) return 0;
  let count = 0;
  const path = 'parade_states';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < history.length; i += CHUNK_SIZE) {
      const chunk = history.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const h of chunk) {
        const anyH = h as any;
        const docId = String(anyH.id || anyH.log_id || `hist_${Date.now()}_${count}`).replace(/\//g, '_');
        const docRef = doc(db, path, docId);
        const data = {
          log_id: docId,
          date: anyH.timestamp || anyH.date || new Date().toISOString(),
          type: anyH.actionType || anyH.action || anyH.type || '',
          count: anyH.count || 0,
          notes: anyH.details || anyH.notes || '',
          details: typeof anyH.details === 'string' ? anyH.details : JSON.stringify(anyH.details || {}),
          user: anyH.user || anyH.assignedBy || 'System'
        };
        batch.set(docRef, data, { merge: true });
        count++;
      }
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch Parade State History from Firestore
 */
export async function fetchParadeStatesFromFirebase(): Promise<ActivityHistoryItem[]> {
  if (!db) return [];
  const path = 'parade_states';
  try {
    const snap = await getDocs(collection(db, path));
    const list: ActivityHistoryItem[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: data.log_id || d.id,
        timestamp: data.date || '',
        action: data.type || '',
        details: data.details || data.notes || '',
        user: data.user || 'Admin'
      } as any);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Push Detailed Users to Firestore
 */
export async function pushUserProfilesToFirebase(users: any[]): Promise<number> {
  if (!db || !users.length) return 0;
  let count = 0;
  const path = 'user_profiles';
  try {
    const batch = writeBatch(db);
    for (const u of users) {
      const userId = String(u.bdNo || u["User ID"] || u.id || `user_${count}`).replace(/\//g, '_');
      const docRef = doc(db, path, userId);
      const data = {
        "User ID": userId,
        "Password": u.password || u.Password || '',
        "Full Name": u.name || u.fullName || u["Full Name"] || '',
        "Rank": u.rank || u.Rank || '',
        "Role": u.role || u.Role || 'Operator',
        "Section": u.section || u.Section || '',
        "Status": u.status || u.Status || 'ACTIVE',
        "Last Active": u.lastActive || u["Last Active"] || new Date().toISOString()
      };
      batch.set(docRef, data, { merge: true });
      count++;
    }
    await batch.commit();
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch User Profiles from Firestore
 */
export async function fetchUserProfilesFromFirebase(): Promise<any[]> {
  if (!db) return [];
  const path = 'user_profiles';
  try {
    const snap = await getDocs(collection(db, path));
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: data["User ID"] || d.id,
        bdNo: data["User ID"] || d.id,
        "User ID": data["User ID"] || d.id,
        password: data.Password || '',
        name: data["Full Name"] || '',
        rank: data.Rank || '',
        role: data.Role || 'Operator',
        section: data.Section || '',
        status: data.Status || 'ACTIVE',
        lastActive: data["Last Active"] || ''
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Push App Settings to Firestore
 */
export async function pushAppSettingsToFirebase(settings: Array<{ setting_key: string; setting_value: string }>): Promise<number> {
  if (!db || !settings.length) return 0;
  let count = 0;
  const path = 'app_settings';
  try {
    const batch = writeBatch(db);
    for (const s of settings) {
      const key = String(s.setting_key).replace(/\//g, '_');
      const docRef = doc(db, path, key);
      batch.set(docRef, {
        setting_key: s.setting_key,
        setting_value: s.setting_value,
        updated_at: new Date().toISOString()
      }, { merge: true });
      count++;
    }
    await batch.commit();
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch App Settings from Firestore
 */
export async function fetchAppSettingsFromFirebase(): Promise<Record<string, string>> {
  if (!db) return {};
  const path = 'app_settings';
  try {
    const snap = await getDocs(collection(db, path));
    const res: Record<string, string> = {};
    snap.forEach((d) => {
      const data = d.data();
      if (data.setting_key) {
        res[data.setting_key] = data.setting_value;
      }
    });
    return res;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Push Canteen Members to Firestore
 */
export async function pushCanteenMembersToFirebase(members: any[]): Promise<number> {
  if (!db || !members.length) return 0;
  let count = 0;
  const path = 'canteen_members';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < members.length; i += CHUNK_SIZE) {
      const chunk = members.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const m of chunk) {
        const docId = String(m.airman_id || m.id || m.service_number || m["BD No"] || `mem_${count}`).replace(/\//g, '_');
        const docRef = doc(db, path, docId);
        
        // Strip out large base64 avatar if > 500KB
        let avatar = m.avatar || m.Photo || '';
        if (avatar.length > 500000) avatar = '';

        const data = {
          airman_id: docId,
          service_number: m.service_number || m["BD No"] || '',
          name: m.name || m.Surname || m.Name || '',
          rank: m.rank || m.Rank || '',
          section: m.section || m.Section || '',
          phone: m.phone || m["Contact Number"] || '',
          avatar: avatar,
          canteen_balance: Number(m.canteen_balance ?? m.Balance ?? 0),
          current_month_due: Number(m.current_month_due ?? 0),
          total_due: Number(m.total_due ?? m.Due ?? 0),
          status: m.status || m.Status || 'Active',
          updated_at: new Date().toISOString()
        };
        batch.set(docRef, data, { merge: true });
        count++;
      }
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch Canteen Members from Firestore
 */
export async function fetchCanteenMembersFromFirebase(): Promise<any[]> {
  if (!db) return [];
  const path = 'canteen_members';
  try {
    const snap = await getDocs(collection(db, path));
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        airman_id: data.airman_id || d.id,
        id: data.airman_id || d.id,
        "BD No": data.service_number || '',
        service_number: data.service_number || '',
        Name: data.name || '',
        Surname: data.name || '',
        name: data.name || '',
        Rank: data.rank || '',
        rank: data.rank || '',
        Section: data.section || '',
        section: data.section || '',
        "Contact Number": data.phone || '',
        phone: data.phone || '',
        avatar: data.avatar || '',
        Balance: data.canteen_balance || 0,
        canteen_balance: data.canteen_balance || 0,
        Due: data.total_due || 0,
        total_due: data.total_due || 0,
        current_month_due: data.current_month_due || 0,
        Status: data.status || 'Active',
        status: data.status || 'Active'
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Push Canteen Transactions (POS Sales History) to Firestore
 */
export async function pushCanteenTransactionsToFirebase(txs: any[]): Promise<number> {
  if (!db || !txs.length) return 0;
  let count = 0;
  const path = 'canteen_transactions';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < txs.length; i += CHUNK_SIZE) {
      const chunk = txs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const t of chunk) {
        if (!t) continue;
        const docId = String(t.id || t.tx_id || `tx_${Date.now()}_${count}`).replace(/\//g, '_');
        const docRef = doc(db, path, docId);
        const data = {
          id: docId,
          airman_id: t.airman_id || t.memberId || '',
          bd_no: t.bd_no || t["BD No"] || t.bdNo || '',
          amount: Number(t.amount ?? t.price ?? 0),
          category: t.category || t.item_name || 'POS_SALE',
          item_name: t.item_name || t.name || '',
          qty: Number(t.qty ?? 1),
          paymentMode: t.paymentMode || t.mode || 'DUE',
          type: t.type || 'SALE',
          month_key: t.month_key || '',
          date: t.date || t.timestamp || t.paymentDate || new Date().toISOString(),
          notes: t.notes || t.remarks || '',
          created_at: t.created_at || new Date().toISOString()
        };
        batch.set(docRef, data, { merge: true });
        count++;
      }
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch Canteen Transactions (POS Sales History) from Firestore
 */
export async function fetchCanteenTransactionsFromFirebase(): Promise<any[]> {
  if (!db) return [];
  const path = 'canteen_transactions';
  try {
    const snap = await getDocs(collection(db, path));
    const list: any[] = [];
    snap.forEach((d) => {
      list.push(d.data());
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Push Canteen Expenses to Firestore
 */
export async function pushCanteenExpensesToFirebase(expenses: any[]): Promise<number> {
  if (!db || !expenses.length) return 0;
  let count = 0;
  const path = 'canteen_expenses';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < expenses.length; i += CHUNK_SIZE) {
      const chunk = expenses.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const e of chunk) {
        if (!e) continue;
        const docId = String(e.id || `exp_${Date.now()}_${count}`).replace(/\//g, '_');
        const docRef = doc(db, path, docId);
        batch.set(docRef, { ...e, id: docId, updated_at: new Date().toISOString() }, { merge: true });
        count++;
      }
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch Canteen Expenses from Firestore
 */
export async function fetchCanteenExpensesFromFirebase(): Promise<any[]> {
  if (!db) return [];
  const path = 'canteen_expenses';
  try {
    const snap = await getDocs(collection(db, path));
    const list: any[] = [];
    snap.forEach((d) => {
      list.push(d.data());
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Full Migration Utility: Pulls local, server backups, and cached data and pushes to Firebase Firestore
 */
export async function executeFullMigrationToFirebase(localDb: any): Promise<FirebaseMigrationResult> {
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
    errors: []
  };

  if (!isFirebaseConfigured || !db) {
    result.errors.push("Firebase is not configured.");
    return result;
  }

  // 1. Airmen / Biodata Register
  try {
    let airmen = localDb?.airmen || [];
    if (!airmen || airmen.length === 0) {
      try {
        const res = await fetch('/api/airmen');
        if (res.ok) airmen = await res.json();
      } catch {}
    }
    if (airmen.length > 0) {
      result.airmenCount = await pushAirmenToFirebase(airmen);
    }
  } catch (err: any) {
    result.errors.push("Airmen migration error: " + err.message);
  }

  // 2. Duty Assignments (All months)
  try {
    const allAssignments: DutyAssignment[] = [];
    Object.values(localDb?.assignments || {}).forEach((arr: any) => {
      if (Array.isArray(arr)) allAssignments.push(...arr);
    });
    if (allAssignments.length > 0) {
      result.dutyCount = await pushDutyAssignmentsToFirebase(allAssignments);
    }
  } catch (err: any) {
    result.errors.push("Duty assignments migration error: " + err.message);
  }

  // 3. Parade States / Activity History
  try {
    const history = localDb?.activityHistory || [];
    if (history.length > 0) {
      result.paradeCount = await pushParadeStatesToFirebase(history);
    }
  } catch (err: any) {
    result.errors.push("Parade history migration error: " + err.message);
  }

  // 4. Canteen Members (Merge local cache, baf_canteen_members, and server file)
  try {
    let canteenMembers: any[] = [];
    if (typeof window !== 'undefined') {
      const rawCache = window.localStorage.getItem('canteen_members_cache');
      if (rawCache) {
        try { canteenMembers = JSON.parse(rawCache); } catch {}
      }
      if (!canteenMembers || canteenMembers.length === 0) {
        const rawBaf = window.localStorage.getItem('baf_canteen_members');
        if (rawBaf) {
          try { canteenMembers = JSON.parse(rawBaf); } catch {}
        }
      }
    }

    // Try fetching from server backup if empty
    if (!canteenMembers || canteenMembers.length === 0) {
      try {
        const res = await fetch('/api/canteen/export-full-backup');
        if (res.ok) {
          const srv = await res.json();
          if (Array.isArray(srv.members) && srv.members.length > 0) {
            canteenMembers = srv.members;
          }
        }
      } catch {}
    }

    if (!canteenMembers || canteenMembers.length === 0) {
      // Fallback from airmen
      const airmenList = localDb?.airmen || [];
      canteenMembers = airmenList.map((a: any) => ({
        airman_id: a.id || a.airman_id,
        "BD No": a.bdNo || a["Service Number"],
        Surname: a.name || a.Name,
        Rank: a.rank || a.Rank,
        Section: a.section || a.Section,
        Contact: a.contactNumber || a["Contact Number"],
        Due: 0,
        Balance: 0
      }));
    }

    if (canteenMembers.length > 0) {
      result.canteenMembersCount = await pushCanteenMembersToFirebase(canteenMembers);
    }
  } catch (err: any) {
    result.errors.push("Canteen members migration error: " + err.message);
  }

  // 5. POS Sales History (Canteen Transactions)
  try {
    let txs: any[] = [];
    if (typeof window !== 'undefined') {
      const rawTxs = window.localStorage.getItem('canteen_txs');
      if (rawTxs) {
        try { txs = JSON.parse(rawTxs); } catch {}
      }
    }
    if (!txs || txs.length === 0) {
      try {
        const res = await fetch('/api/canteen/export-full-backup');
        if (res.ok) {
          const srv = await res.json();
          if (Array.isArray(srv.transactions) && srv.transactions.length > 0) {
            txs = srv.transactions;
          }
        }
      } catch {}
    }
    if (txs.length > 0) {
      result.canteenTxsCount = await pushCanteenTransactionsToFirebase(txs);
    }
  } catch (err: any) {
    result.errors.push("POS sales history migration error: " + err.message);
  }

  // 6. Canteen Expenses
  try {
    let expenses: any[] = [];
    if (typeof window !== 'undefined') {
      const rawExp = window.localStorage.getItem('canteen_expenses');
      if (rawExp) {
        try { expenses = JSON.parse(rawExp); } catch {}
      }
    }
    if (expenses.length > 0) {
      result.canteenExpensesCount = await pushCanteenExpensesToFirebase(expenses);
    }
  } catch (err: any) {
    result.errors.push("Expenses migration error: " + err.message);
  }

  // 7. User Profiles (Office App Login Accounts - all Airmen & Canteen Members)
  try {
    const usersMap = new Map<string, any>();
    const existingUsers = localDb?.detailedUsers || [];
    existingUsers.forEach((u: any) => {
      const clean = String(u.bdNo || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      if (clean) usersMap.set(clean, u);
    });

    // Add all airmen
    const airmenList = localDb?.airmen || [];
    airmenList.forEach((a: any) => {
      const clean = String(a.bdNo || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      if (clean && !usersMap.has(clean)) {
        usersMap.set(clean, {
          id: `user-login-${clean}`,
          airmanId: a.id,
          bdNo: clean,
          rank: a.rank || 'LAC',
          name: a.name || 'Airman',
          flightName: a.flightName || 'Admin',
          trade: a.trade || 'General',
          role: clean === '48456' ? 'OWNER' : 'USER',
          password: clean,
          adminPass: clean === '48456' ? '1124' : '',
          status: 'ACTIVE'
        });
      }
    });

    const userList = Array.from(usersMap.values());
    if (userList.length > 0) {
      result.usersCount = await pushUserProfilesToFirebase(userList);
    }
  } catch (err: any) {
    result.errors.push("User profiles migration error: " + err.message);
  }

  // 8. App Settings & Canteen Catalog
  try {
    const settingsPayload: Array<{ setting_key: string; setting_value: string }> = [];
    const SETTING_PREFIXES = ['baf_', 'savedDisposalKeys', 'parade_historical', 'flg_wg_', 'canteen_'];
    if (typeof window !== 'undefined') {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (SETTING_PREFIXES.some(prefix => key.startsWith(prefix))) {
          const val = window.localStorage.getItem(key);
          if (val) settingsPayload.push({ setting_key: key, setting_value: val });
        }
      }
    }
    if (settingsPayload.length > 0) {
      result.settingsCount = await pushAppSettingsToFirebase(settingsPayload);
    }
  } catch (err: any) {
    result.errors.push("Settings migration error: " + err.message);
  }

  result.success = result.errors.length === 0;
  return result;
}
