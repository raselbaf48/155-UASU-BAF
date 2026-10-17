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
import { INITIAL_AIRMEN } from '../data/initialAirmen';

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

        const rankVal = a.rank || a.Rank || 'LAC';
        const nameVal = a.name || a.Name || a["Surname"] || '';
        const flightVal = a.flightName || a.flight || a.Section || a.Flight || 'Admin';
        const bdNoVal = String(a.bdNo || a["BD No"] || a["Service Number"] || '');
        const cleanBdDigits = bdNoVal.replace(/\D/g, '');
        const isActive = a.active !== false;

        let fullNameVal = a.fullName || a["Full Name"] || '';
        if (!fullNameVal || fullNameVal.trim() === '' || fullNameVal === nameVal) {
          const initMatch = INITIAL_AIRMEN.find((init: any) => 
            String(init.bdNo).replace(/\D/g, '') === cleanBdDigits || init.id === docId
          );
          fullNameVal = (initMatch && initMatch.fullName) ? initMatch.fullName : (nameVal || 'Airman');
        }

        const data: any = {
          airman_id: docId,
          id: docId,
          bdNo: bdNoVal,
          "BD No": bdNoVal,
          "Service Number": bdNoVal,
          rank: rankVal,
          Rank: rankVal,
          name: nameVal || fullNameVal,
          Name: nameVal || fullNameVal,
          Surname: nameVal || fullNameVal,
          fullName: fullNameVal,
          "Full Name": fullNameVal,
          flightName: flightVal,
          Flight: flightVal,
          Section: flightVal,
          trade: a.trade || a.Trade || 'General',
          Trade: a.trade || a.Trade || 'General',
          bloodGroup: a.bloodGroup || a["Blood Group"] || '',
          "Blood Group": a.bloodGroup || a["Blood Group"] || '',
          mobileNo: a.mobileNo || a.contactNumber || a["Contact Number"] || '',
          contactNumber: a.mobileNo || a.contactNumber || a["Contact Number"] || '',
          "Contact Number": a.mobileNo || a.contactNumber || a["Contact Number"] || '',
          addressBlock: a.addressBlock || a.presentAddress || a["Present Address"] || 'L/O',
          presentAddress: a.addressBlock || a.presentAddress || a["Present Address"] || 'L/O',
          "Present Address": a.addressBlock || a.presentAddress || a["Present Address"] || 'L/O',
          permanentAddress: a.permanentAddress || a["Permanent Address"] || '',
          "Permanent Address": a.permanentAddress || a["Permanent Address"] || '',
          dateOfBirth: a.dateOfBirth || a["Date of Birth"] || '',
          dateJoined: a.dateJoined || a["Dt of Posting"] || '',
          active: isActive,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          Status: isActive ? 'ACTIVE' : 'INACTIVE',
          Photo: photoPayload,
          photoUrl: a.photoUrl || a.avatarUrl || '',
          avatarUrl: a.avatarUrl || a.photoUrl || '',
          seniority: Number(a.seniority ?? a.Seniority ?? a.serNo ?? 0),
          Seniority: Number(a.seniority ?? a.Seniority ?? a.serNo ?? 0),
          serNo: Number(a.serNo ?? a.seniority ?? 1),
          code: a.code || `${rankVal}-${(nameVal || fullNameVal).slice(0, 3).toUpperCase()}`,
          remarks: a.remarks || '',
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
      const rankVal = data.rank || data.Rank || 'LAC';
      const nameVal = data.name || data.Name || data.fullName || data["Full Name"] || data["Surname"] || '';
      const bdNoVal = String(data.bdNo || data["BD No"] || data["Service Number"] || '');
      const cleanBdDigits = bdNoVal.replace(/\D/g, '');
      const flightVal = data.flightName || data.Flight || data.flight || data.Section || 'Admin';
      const tradeVal = data.trade || data.Trade || 'General';
      const activeVal = data.active !== undefined 
        ? Boolean(data.active) 
        : (data.Status ? data.Status === 'ACTIVE' || data.Status === 'Active' : true);

      // Canonical ID in app is BD/XXXXX
      const rawId = data.airman_id || data.id || d.id;
      const canonicalId = cleanBdDigits ? `BD/${cleanBdDigits}` : String(rawId).replace(/_/g, '/');

      // Recover full name if missing or same as short surname
      let fullNameVal = data.fullName || data["Full Name"] || '';
      if (!fullNameVal || fullNameVal.trim() === '' || fullNameVal === nameVal) {
        const initMatch = INITIAL_AIRMEN.find((init: any) => 
          String(init.bdNo).replace(/\D/g, '') === cleanBdDigits || init.id === canonicalId
        );
        fullNameVal = (initMatch && initMatch.fullName) ? initMatch.fullName : (nameVal || 'Airman');
      }

      list.push({
        id: canonicalId,
        airman_id: canonicalId,
        serNo: Number(data.serNo || data.seniority || data.Seniority || 1),
        seniority: Number(data.seniority ?? data.Seniority ?? 0),
        code: data.code || `${rankVal}-${(nameVal || fullNameVal).slice(0, 3).toUpperCase()}`,
        bdNo: cleanBdDigits || bdNoVal,
        rank: rankVal,
        name: nameVal || fullNameVal,
        fullName: fullNameVal,
        flightName: flightVal,
        trade: tradeVal,
        mobileNo: data.mobileNo || data.contactNumber || data["Contact Number"] || '',
        bloodGroup: data.bloodGroup || data["Blood Group"] || '',
        permanentAddress: data.permanentAddress || data["Permanent Address"] || '',
        addressBlock: data.addressBlock || data.presentAddress || data["Present Address"] || 'L/O',
        active: activeVal,
        status: activeVal ? 'ACTIVE' : 'INACTIVE',
        remarks: data.remarks || '',
        photoUrl: data.photoUrl || data.avatarUrl || data.Photo || '',
        dateJoined: data.dateJoined || data["Dt of Posting"] || undefined,
        dateLeft: data.dateLeft || data["Unit Left date"] || undefined
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
        const dutyVal = String(anyA.dutyCode || anyA.dutyType || anyA.dutyName || anyA.duty_name || anyA.duty_type || '').trim();
        const dateVal = String(a.date || anyA.duty_date || anyA.date || '').trim();
        const rawAirman = a.airmanId || anyA.airman_id || anyA.airmanId || '';
        const airmanIdVal = rawAirman ? String(rawAirman).replace(/_/g, '/') : '';
        
        let docId = String(anyA.id || anyA.assignment_id || '').replace(/\//g, '_');
        if (!docId || docId === 'test') {
          const safeAir = airmanIdVal.replace(/[^a-zA-Z0-9_-]/g, '_');
          const safeDuty = String(dutyVal).replace(/[^a-zA-Z0-9_-]/g, '_');
          const shiftVal = anyA.shift || anyA.idaShift || 'n';
          const scopeVal = anyA.disposalScope || 'ALL';
          docId = `asn_${safeAir}_${dateVal}_${safeDuty}_${shiftVal}_${scopeVal}`;
        }

        const docRef = doc(db, path, docId);
        const data = {
          assignment_id: docId,
          duty_name: dutyVal,
          date: dateVal,
          airman_id: airmanIdVal,
          notes: a.notes || anyA.notes || anyA.remarks || '',
          shift: anyA.shift || anyA.idaShift || '',
          category: anyA.category || '',
          created_at: anyA.created_at || anyA.updatedAt || new Date().toISOString()
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
      if (d.id === 'test') return;
      const data = d.data();
      // Extract from document ID if fields were saved empty or need recovery
      const m = String(data.assignment_id || d.id || '').match(/^asn_(.+)_(\d{4}-\d{2}-\d{2})_(.+)_(.+?)_(.+?)$/);
      const parsedAirmanId = m ? m[1].replace(/_/g, '/') : '';
      const parsedDate = m ? m[2] : '';
      const parsedDuty = m ? m[3] : '';
      const parsedShift = m && m[4] !== 'n' ? m[4] : '';
      const parsedScope = m ? m[5] : undefined;

      const rawAirmanId = data.airman_id || data.airmanId || parsedAirmanId;
      const cleanAirmanId = rawAirmanId ? String(rawAirmanId).replace(/_/g, '/') : '';
      const cleanDate = (data.date && data.date.length >= 10) ? data.date : (data.duty_date || parsedDate || '');
      const cleanDuty = data.duty_name || data.duty_type || data.dutyType || data.dutyCode || parsedDuty || '';

      if (!cleanDate || cleanDate.length < 10) return; // Skip invalid or non-date items

      list.push({
        id: data.assignment_id || d.id,
        assignment_id: data.assignment_id || d.id,
        airmanId: cleanAirmanId,
        airman_id: cleanAirmanId,
        date: cleanDate,
        dutyCode: cleanDuty,
        dutyType: cleanDuty,
        dutyName: cleanDuty,
        shift: data.shift || parsedShift || undefined,
        disposalScope: parsedScope,
        category: data.category || undefined,
        notes: data.notes || '',
        updatedAt: data.created_at || new Date().toISOString()
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
  const FORBIDDEN_KEYS = ['baf_155_uasu_v2_db', 'baf_database_v2', 'baf_sync_logs', 'baf_pending_sync'];

  // Filter out forbidden keys and oversized payloads exceeding Firestore 1MB limit
  const validSettings = settings.filter(s => {
    if (!s || !s.setting_key) return false;
    const cleanKey = String(s.setting_key).trim();
    if (FORBIDDEN_KEYS.includes(cleanKey) || cleanKey.endsWith('_db')) return false;
    if (s.setting_value && typeof s.setting_value === 'string' && s.setting_value.length > 600000) {
      console.warn(`[pushAppSettingsToFirebase] Skipping oversized setting '${cleanKey}' (${s.setting_value.length} bytes) to protect Firestore document size limit`);
      return false;
    }
    return true;
  });

  if (validSettings.length === 0) return 0;

  try {
    const CHUNK_SIZE = 250;
    for (let i = 0; i < validSettings.length; i += CHUNK_SIZE) {
      const chunk = validSettings.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const s of chunk) {
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
    }
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
    let allAssignments: DutyAssignment[] = [];
    Object.values(localDb?.assignments || {}).forEach((arr: any) => {
      if (Array.isArray(arr)) allAssignments.push(...arr);
    });
    if (allAssignments.length === 0) {
      try {
        const res = await fetch('/api/duty-assignments');
        if (res.ok) {
          const srvObj = await res.json();
          Object.values(srvObj || {}).forEach((arr: any) => {
            if (Array.isArray(arr)) allAssignments.push(...arr);
          });
        }
      } catch {}
    }
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
    const IGNORED_KEYS = [
      'baf_155_uasu_v2_db',
      'baf_database_v2',
      'baf_official_duty_matrix_v4',
      'baf_sync_logs',
      'baf_pending_sync',
      'baf_presence',
      'baf_user_login_history',
      'baf_recent_logins',
      'baf_canteen_recent_logins',
      'baf_theme_pref',
      'baf_last_used_id',
      'baf_canteen_last_used_id',
      'baf_office_last_used_id',
      'baf_last_used_login_portal',
      'baf_dismissed_notice_sig',
      'baf_cleared_notices_v4'
    ];
    if (typeof window !== 'undefined') {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || IGNORED_KEYS.includes(key) || key.endsWith('_db')) continue;
        if (SETTING_PREFIXES.some(prefix => key.startsWith(prefix))) {
          const val = window.localStorage.getItem(key);
          if (val && val.length < 500000) settingsPayload.push({ setting_key: key, setting_value: val });
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
