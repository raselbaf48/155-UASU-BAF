import { supabase, isSupabaseConfigured } from '../supabase';
import {
  Airman,
  DutyAssignment,
  FlightName,
  ParadeShift,
  ActivityHistoryItem,
  DutyCategoryCode,
  IDAShift,
  ImportHistoryBatch,
  ParadeStateResponse,
  AirmanDutyStats,
  ConflictAlert,
} from '../types';
import { INITIAL_AIRMEN } from '../data/initialAirmen';
import { DUTY_TYPES } from '../data/dutyTypes';
import { generateOfficialMonthAssignments, getOfficialParadeStateDocument } from '../data/officialJulyAugustData';
import { calculateDutyStats, detectConflicts, getDaysInMonth } from '../data/rosterGenerator';
import { DutyRatioTable, INITIAL_OFFICIAL_DUTY_MATRIX, getStoredDutyMatrix, saveDutyMatrix } from '../data/officialDutyRatioMatrix';
import { findBestAirmanMatch as matchAirmanRankFirst, parseRosterTextHeuristically } from '../utils/airmanMatcher';
import { sortAirmenBySeniority } from '../utils/seniority';
// import { saveDbToFirebase, getDbFromFirebase } from '../firebase';

export interface LocalStorageDB {
  airmen: Airman[];
  assignments: Record<string, DutyAssignment[]>; // monthKey YYYY-MM -> DutyAssignment[]
  activityHistory: ActivityHistoryItem[];
  adminPasscode: string;
  detailedUsers?: any[];
  importHistory: ImportHistoryBatch[];
  lastUpdated: string;
}


export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'PULL' | 'PUSH' | 'MANUAL';
  status: 'SUCCESS' | 'ERROR';
  message: string;
}
export interface FirebaseSyncStatusState {
  isConfigured: boolean;
  status: 'idle' | 'syncing' | 'connected' | 'error' | 'unconfigured';
  lastSyncTime: string | null;
  d1Active: boolean;
}

let firebaseConnected: boolean = false;
let firebaseLastSyncTime: string | null = null;
let syncLogs: SyncLog[] = JSON.parse(typeof window !== "undefined" ? window.localStorage.getItem("baf_sync_logs") || "[]" : "[]");

export const getSyncLogs = () => syncLogs;

export const emitSyncProgress = (percentage: number, message: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('baf_sync_progress', { detail: { percentage, message } }));
  }
};

export const addSyncLog = (log: Omit<SyncLog, "id">) => {
  const newLog = { ...log, id: "sync-" + Date.now() + Math.random() };
  syncLogs = [newLog, ...syncLogs].slice(0, 10);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("baf_sync_logs", JSON.stringify(syncLogs));
    window.dispatchEvent(new CustomEvent("baf_sync_logs_updated", { detail: syncLogs }));
  }
};


export const getFirebaseSyncState = (): FirebaseSyncStatusState => {
  return {
    isConfigured: firebaseConnected,
    status: firebaseConnected ? 'connected' : 'idle',
    lastSyncTime: firebaseLastSyncTime,
    d1Active: firebaseConnected,
  };
};

function broadcastSyncState(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('d1_sync_update', {
        detail: getFirebaseSyncState(),
      })
    );
  }
}

const STORAGE_KEY = 'baf_155_uasu_v2_db';
const DEFAULT_ADMIN_PASSCODE = '1124';

function getDatesInRange(fromDateStr: string, toDateStr: string): string[] {
  const dates: string[] = [];
  const [fY, fM, fD] = fromDateStr.split('-').map(Number);
  const [tY, tM, tD] = toDateStr.split('-').map(Number);

  if (!fY || !fM || !fD || !tY || !tM || !tD) return dates;

  const current = new Date(Date.UTC(fY, fM - 1, fD));
  const end = new Date(Date.UTC(tY, tM - 1, tD));

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function getYesterdayDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class LocalDatabaseEngine {
  public db: LocalStorageDB;
  private isFirebaseSyncing: boolean = false;
  private isPushing: boolean = false;
  private saveTimeout: any = null;
  private lastSyncedDbStr: string = '';

  public getDb(): LocalStorageDB {
    return this.db;
  }

  constructor() {
    this.db = this.loadInitialLocalState();
    this.lastSyncedDbStr = JSON.stringify(this.db);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('baf_pending_sync');
      if (false) {
        this.saveToFirebase(this.db, true).then(() => this.syncFromFirebase());
      } else {
        this.syncFromFirebase();
      }
      window.addEventListener("baf_idac_settings_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db); });
      window.addEventListener("baf_duty_ratio_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db); });
      window.addEventListener("baf_signatures_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db); });
      window.addEventListener("baf_logo_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db); });
      window.addEventListener("baf_theme_updated", (e: any) => { if (e.detail?.source !== 'firebase') this.saveToFirebase(this.db); });
      
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          if (this.saveTimeout) { // Only sync if there are pending unsynced changes
            this.saveToFirebase(this.db, true);
          }
        }
      });
      window.addEventListener('beforeunload', () => {
        if (this.saveTimeout) {
          this.saveToFirebase(this.db, true);
        }
      });
      
      // Auto Sync Timer for Retries (Only runs if online and has pending sync)
      setInterval(() => {
        if (typeof window !== 'undefined' && window.localStorage.getItem('firebase_quota_exceeded')) {
          return; // Stop retrying if quota is exceeded
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return; // Stop retrying if offline
        }
        if (!this.isFirebaseSyncing) {
          const hasPendingSync = typeof window !== 'undefined' ? window.localStorage.getItem('baf_pending_sync') === 'true' : false;
          // Note: saveTimeout is handled by its own timeout, we only need to retry if hasPendingSync is true
          if (hasPendingSync && !this.saveTimeout) {
            this.saveToFirebase(this.db, true).then((success) => {
               if (success !== false) this.syncFromFirebase();
            });
          }
        }
      }, 15000);
    }
  }

  /**
   * Synchronize database with Firebase Firestore
   */
  public async syncFromFirebase(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    if (!isSupabaseConfigured) {
      return false;
    }
    
    if (this.isFirebaseSyncing) return false;
    
    this.isFirebaseSyncing = true;
    addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "SUCCESS", message: "Fetching data from Supabase..." });
    
    try {
      let dataChanged = false;
      const newDb = { ...this.db };
      
      // Helper to fetch all rows with pagination
      const fetchAll = async (table: string) => {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
          const { data, error } = await supabase.from(table).select('*').range(from, from + step - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < step) break;
          from += step;
        }
        return allData;
      };

      // 1. Pull Airmen (Staff)
      let staffData;
      try {
         staffData = await fetchAll('staff');
      } catch(e: any) { 
         throw new Error("Failed to fetch staff from Cloud: " + e.message); 
      }
      
      if (staffData) {
        staffData.sort((a, b) => {
           const getNum = (id) => {
              if (!id) return 9999;
              const match = id.match(/\d+/);
              return match ? parseInt(match[0], 10) : 9999;
           };
           return getNum(a.airman_id) - getNum(b.airman_id);
        });

        const parsedAirmen = staffData.map((s: any, idx: number) => ({
          id: (s.airman_id && s.airman_id !== "airman-undefined") ? s.airman_id : 'airman-' + (s['BD No'] && String(s['BD No']) !== "undefined" ? s['BD No'] : Math.random().toString(36).slice(2, 10)),
          serNo: idx + 1,
          code: `${s['Rank'] || ''}-${(s['Surname'] || '').slice(0, 3).toUpperCase()}`,
          bdNo: String(s['BD No'] || ''),
          rank: s['Rank'] || '',
          name: s['Surname'] || '',
          fullName: s['Full Name'] || s['Surname'] || '',
          flightName: s['Flight'] || '',
          trade: s['Trade'] || '',
          mobileNo: s['Mobile No'] || '',
          addressBlock: s['Address'] || 'L/O',
          active: s['Status'] === 'ACTIVE' || s['Status'] === null || s['Status'] === undefined,
          status: s['Status'] || 'ACTIVE',
          dateLeft: s['Unit Left date'] || undefined
        }));
        
        // Force replace to ensure 48 rows overrides 61 rows
        newDb.airmen = parsedAirmen;
        dataChanged = true;
      }
      
      // 2. Pull Assignments (Duty Rosters)
      let dutyData;
      try {
         dutyData = await fetchAll('duty_rosters');
      } catch(e: any) { 
         throw new Error("Failed to fetch duties from Cloud: " + e.message); 
      }
      
      if (dutyData) {
         const newAssignments: Record<string, DutyAssignment[]> = {};
         dutyData.forEach((d: any) => {
            const dateStr = d.duty_date;
            if (dateStr && dateStr.length >= 7) {
               const monthKey = dateStr.substring(0, 7); // YYYY-MM
               if (!newAssignments[monthKey]) newAssignments[monthKey] = [];
               newAssignments[monthKey].push({
                 airmanId: d.airman_id,
                 date: d.duty_date,
                 dutyCode: d.duty_type,
                 idaShift: d.shift || undefined,
                 disposalScope: 'ALL',
                 notes: d.remarks || undefined
               });
            }
         });
         newDb.assignments = newAssignments;
         dataChanged = true;
      }
      
      // 3. Pull Activity History (Parade States)
      let histData;
      try {
         histData = await fetchAll('parade_states');
      } catch(e: any) { 
         throw new Error("Failed to fetch history from Cloud: " + e.message); 
      }
      
      if (histData) {
         const parsedHistory = histData.map((h: any) => ({
            id: h.log_id || 'log-' + Math.random().toString(36).substring(2, 9),
            date: h.date || '',
            type: h.type || 'SYSTEM',
            title: h.title || '',
            description: h.description || '',
            performedByUserId: h.user_id || undefined,
            performedByUserName: h.user_name || undefined,
            timestamp: h.created_at || new Date().toISOString()
         })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
         
         newDb.activityHistory = parsedHistory;
         dataChanged = true;
      }
      
      // 4. Pull User Profiles
      let userData;
      try {
         userData = await fetchAll('user_profiles');
      } catch(e: any) { 
         throw new Error("Failed to fetch users from Cloud: " + e.message); 
      }
      
      if (userData && userData.length > 0) {
         const parsedUsers = userData.map((u: any) => ({
            id: u.id || 'user-' + u['User ID'],
            airmanId: u.airman_id || undefined,
            bdNo: u['User ID'] || '',
            name: u['Name'] || String(u['User ID']),
            rank: u['Rank'] || '',
            flightName: u['Flight'] || '',
            trade: u['Trade'] || '',
            role: u['Role'] || 'USER',
            status: u['Status'] || 'ACTIVE',
            password: u['User Login PIN']?.toString() || u.password || String(u['User ID']),
            adminPass: u['Admin Login PIN']?.toString() || u.adminPass || '',
            detailedAt: new Date().toISOString(),
            detailedBy: 'System'
         }));
         newDb.detailedUsers = parsedUsers;
         dataChanged = true;
      }
      
      // 5. Pull App Settings
      let settingsData;
      try {
         settingsData = await fetchAll('app_settings');
      } catch(e: any) { 
         console.warn("Settings fetch failed, but continuing:", e); 
      }
      
      if (settingsData && settingsData.length > 0) {
         if (typeof window !== 'undefined') {
            let settingsChanged = false;
            settingsData.forEach((row: any) => {
               if (row.setting_key && row.setting_value && row.setting_key !== 'baf_official_duty_matrix_v4') {
                  const currentVal = window.localStorage.getItem(row.setting_key);
                  if (currentVal !== row.setting_value) {
                     window.localStorage.setItem(row.setting_key, row.setting_value);
                     settingsChanged = true;
                  }
               }
            });
            if (settingsChanged) {
               window.dispatchEvent(new CustomEvent('baf_settings_updated'));
            }
         }
      }
      
      // 6. Pull Duty Ratio Matrix
      try {
         const matrixData = await fetchAll('duty_ratio_matrix');
         if (matrixData && matrixData.length > 0 && typeof window !== 'undefined') {
             const dutyMap = new Map<string, any>();
             matrixData.forEach((row: any) => {
                 if (!dutyMap.has(row.duty_id)) {
                     dutyMap.set(row.duty_id, {
                         id: row.duty_id,
                         title: row.duty_title,
                         dutyCode: row.duty_code,
                         shiftLabel: row.shift_label,
                         totalRequiredMonth: 0,
                         totalRequiredDaily: row.duty_total_daily || 0,
                         isDisabled: row.is_disabled || false,
                         data: {
                             Mechanics: Array(31).fill(0),
                             Avionics: Array(31).fill(0),
                             GCS: Array(31).fill(0),
                             Admin: Array(31).fill(0)
                         }
                     });
                 }
                 const duty = dutyMap.get(row.duty_id);
                 const f = row.flight;
                 if (duty.data[f]) {
                     for (let i = 0; i < 31; i++) {
                         duty.data[f][i] = row[`day_${i + 1}`] || 0;
                     }
                 }
             });
             
             const formattedMatrix = Array.from(dutyMap.values()).map(duty => {
                 let total = 0;
                 ['Mechanics', 'Avionics', 'GCS', 'Admin'].forEach(f => {
                     total += duty.data[f].reduce((sum: number, val: number) => sum + val, 0);
                 });
                 duty.totalRequiredMonth = total;
                 return duty;
             });

             const currentRaw = window.localStorage.getItem('baf_official_duty_matrix_v4');
             const newRaw = JSON.stringify(formattedMatrix);
             if (currentRaw !== newRaw) {
                 window.localStorage.setItem('baf_official_duty_matrix_v4', newRaw);
                 window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix: formattedMatrix } }));
             }
         }
      } catch (e: any) {
         console.warn("Duty ratio matrix fetch failed:", e);
      }
      
      if (dataChanged) {
        newDb.lastUpdated = new Date().toISOString();
        this.db = newDb;
        this.saveToStorage(newDb, true, false, false);
        if (typeof window !== 'undefined') window.localStorage.removeItem('baf_pending_sync');
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newDb));
        }
        window.dispatchEvent(new CustomEvent('baf_db_updated', { detail: { source: 'supabase' } }));
        addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "SUCCESS", message: "Data synced from Supabase successfully." });
      } else {
        addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "SUCCESS", message: "Supabase data is up to date." });
      }
      
      return true;
    } catch (err: any) {
      console.error("Supabase Pull Error:", err);
      addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "ERROR", message: "Failed to pull from Supabase." });
      return false;
    } finally {
      this.isFirebaseSyncing = false;
    }
  }

  /**
   * Push changes to Firebase Firestore
   */
  public async saveToFirebase(dbToSave: LocalStorageDB, immediate = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    if (!isSupabaseConfigured) {
      // Don't attempt to sync if Supabase isn't configured
      if (typeof window !== 'undefined') window.localStorage.removeItem('baf_pending_sync');
      return false;
    }
    
    // Prevent accidental pushes if we haven't finished our initial sync pull yet
    if (this.isFirebaseSyncing) {
       console.warn('Prevented saveToFirebase because a pull sync is currently in progress. Will retry later.');
       return false;
    }
    
    const doSave = async (): Promise<boolean> => {
      if (this.isPushing) return false;
      this.isPushing = true;
      try {
        let hasError = false;
        let errorMessage = '';

        let lastSyncedDb: any = {};
        try { lastSyncedDb = JSON.parse(this.lastSyncedDbStr || '{}'); } catch(e) {}
        
        let hasRealChanges = false;
        
        // Compute delta for airmen
        const changedAirmen = (dbToSave.airmen || []).filter(a => {
           if (!lastSyncedDb.airmen) return true;
           const prev = lastSyncedDb.airmen.find((p: any) => p.id === a.id);
           return !prev || JSON.stringify(prev) !== JSON.stringify(a);
        });
        
        // Compute delta for duties
        const changedAssignments: any[] = [];
        Object.keys(dbToSave.assignments || {}).forEach(monthKey => {
           const currentMonth = dbToSave.assignments[monthKey] || [];
           const prevMonth = (lastSyncedDb.assignments && lastSyncedDb.assignments[monthKey]) ? lastSyncedDb.assignments[monthKey] : [];
           
           currentMonth.forEach(a => {
              const prev = prevMonth.find((p: any) => p.airmanId === a.airmanId && p.date === a.date);
              if (!prev || JSON.stringify(prev) !== JSON.stringify(a)) {
                 changedAssignments.push(a);
              }
           });
        });
        
        // Compute delta for history
        const changedHistory = (dbToSave.activityHistory || []).filter(h => {
           if (!lastSyncedDb.activityHistory) return true;
           const prev = lastSyncedDb.activityHistory.find((p: any) => p.id === h.id);
           return !prev || JSON.stringify(prev) !== JSON.stringify(h);
        });
        
        // Compute delta for users
        const changedUsers = (dbToSave.detailedUsers || []).filter(u => {
           if (!lastSyncedDb.detailedUsers) return true;
           const prev = lastSyncedDb.detailedUsers.find((p: any) => p.id === u.id);
           return !prev || JSON.stringify(prev) !== JSON.stringify(u);
        });
        
        if (changedAirmen.length === 0 && changedAssignments.length === 0 && changedHistory.length === 0 && changedUsers.length === 0) {
           console.log("No data changes detected. Skipping Supabase upload.");
           if (typeof window !== 'undefined') window.localStorage.removeItem('baf_pending_sync');
           this.isPushing = false;
           return true; // Already in sync
        }
        
        console.log(`Uploading changes: ${changedAirmen.length} airmen, ${changedAssignments.length} duties, ${changedHistory.length} history, ${changedUsers.length} users`);

        emitSyncProgress(0, "Preparing data...");
        addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "SUCCESS", message: "Syncing data to Supabase..." });
        
        // 1. Sync Airmen (Staff)
        if (changedAirmen.length > 0) {
          let staffPayload = changedAirmen.map(a => ({
            airman_id: a.id,
            'BD No': a.bdNo,
            'Rank': a.rank,
            'Surname': a.name,
            'Full Name': a.fullName || a.name,
            'Flight': a.flightName,
            'Trade': a.trade || null,
            'Mobile No': a.mobileNo || null,
            'Address': a.addressBlock || null,
            'Status': a.active === false ? 'SUSPENDED' : 'ACTIVE',
            'Unit Left date': a.dateLeft || null
          }));
          // Deduplicate
          const uniqueStaffMap = new Map();
          staffPayload.forEach(a => uniqueStaffMap.set(a.airman_id, a));
          staffPayload = Array.from(uniqueStaffMap.values());
          
          const staffChunkSize = 50;
          for (let i = 0; i < staffPayload.length; i += staffChunkSize) {
             const chunk = staffPayload.slice(i, i + staffChunkSize);
             emitSyncProgress(Math.round((i / staffPayload.length) * 30), `Uploading staff ${i} of ${staffPayload.length}...`);
             const { data: staffDataRes, error: staffErr } = await supabase.from('staff').upsert(chunk, { onConflict: 'airman_id' }).select();
             if (!staffErr && (!staffDataRes || staffDataRes.length === 0) && chunk.length > 0) { console.error('Staff upsert blocked by RLS'); hasError = true; errorMessage = 'Row Level Security (RLS) is blocking the Staff upload in Supabase. Please disable RLS or add policies.'; break; }
             await delay(100);
             if (staffErr) {
               console.error("Error syncing staff to Supabase:", staffErr);
               hasError = true;
               errorMessage = staffErr.message?.includes('Failed to fetch') 
                  ? 'Network error (Failed to fetch). If you have an Adblocker or Brave Shields enabled, it might be blocking Supabase. Please disable it for this site.'
                  : (staffErr.message || 'Staff error');
               break;
             }
          }
        }
        
        // 2. Sync Assignments (Duty Rosters)
        const assignmentsPayload: any[] = [];
        if (changedAssignments.length > 0) {
          changedAssignments.forEach((a: any) => {
             // Generate an ID if it doesn't exist, using airmanId + date as a composite-like key
             const assignId = a.id || ('asn_' + a.airmanId + '_' + a.date + '_' + (a.dutyCode || 'u') + '_' + (a.idaShift || 'n') + '_' + (a.disposalScope || 'a'));
             const hasAirman = dbToSave.airmen.some(air => air.id === a.airmanId);
             if (!hasAirman) return; // Skip if airman doesn't exist (prevents FK error)
             
             assignmentsPayload.push({
               assignment_id: assignId,
               airman_id: a.airmanId,
               duty_date: a.date,
               duty_type: a.dutyCode || a.dutyType || 'UNKNOWN',
               shift: a.idaShift || a.shift || null,
               location: a.location || null,
               is_official: a.isOfficial || false,
               is_completed: a.isCompleted || false,
               remarks: a.notes || a.remarks || null
             });
          });
        }
        
        if (assignmentsPayload.length > 0) {
          // Deduplicate by assignment_id to prevent Postgres 21000 error
          const uniqueAssignmentsMap = new Map();
          assignmentsPayload.forEach(a => {
             uniqueAssignmentsMap.set(a.assignment_id, a);
          });
          const deduplicatedAssignments = Array.from(uniqueAssignmentsMap.values());
          
          // Break into chunks if too large
          const assignChunkSize = 50;
          for (let i = 0; i < deduplicatedAssignments.length; i += assignChunkSize) {
            const chunk = deduplicatedAssignments.slice(i, i + assignChunkSize);
            emitSyncProgress(30 + Math.round((i / deduplicatedAssignments.length) * 40), `Uploading duties ${i} of ${deduplicatedAssignments.length}...`);
            const { data: assignDataRes, error: assignErr } = await supabase.from('duty_rosters').upsert(chunk, { onConflict: 'assignment_id' }).select();
            if (!assignErr && (!assignDataRes || assignDataRes.length === 0) && chunk.length > 0) { console.error('Duty upsert blocked by RLS'); hasError = true; errorMessage = 'Row Level Security (RLS) is blocking the Duty upload in Supabase. Please disable RLS or add policies.'; break; }
            await delay(100);
            
            if (assignErr) {
               console.error("Error syncing duties to Supabase:", assignErr);
               hasError = true;
               errorMessage = assignErr.message?.includes('Failed to fetch') 
                  ? 'Network error (Failed to fetch). If you have an Adblocker or Brave Shields enabled, it might be blocking Supabase. Please disable it for this site.'
                  : (assignErr.message || 'Duties error');
               break;
            }
          }
        }
        
        // 3. Sync Activity History (Parade States/Logs)
        if (changedHistory.length > 0) {
           let historyPayload = changedHistory.map((h: any) => ({
              log_id: h.id || ('log_' + Math.random().toString(36).substring(2, 9)),
              date: h.date || h.timestamp?.substring(0, 10) || new Date().toISOString().substring(0, 10),
              type: h.type || h.actionType || 'SYSTEM',
              title: h.title || h.airmanName || 'Action',
              description: h.description || h.notes || h.details || '',
              user_id: h.performedByUserId || h.userId || null,
              user_name: h.performedByUserName || h.userName || null,
              created_at: h.timestamp || new Date().toISOString()
           }));
           
           // Deduplicate
           const uniqueHistMap = new Map();
           historyPayload.forEach(a => uniqueHistMap.set(a.log_id, a));
           historyPayload = Array.from(uniqueHistMap.values());
           
           const histChunkSize = 50;
           for (let i = 0; i < historyPayload.length; i += histChunkSize) {
              const chunk = historyPayload.slice(i, i + histChunkSize);
              emitSyncProgress(70 + Math.round((i / historyPayload.length) * 20), `Uploading history ${i} of ${historyPayload.length}...`);
              const { data: histDataRes, error: histErr } = await supabase.from('parade_states').insert(chunk).select();
              if (!histErr && (!histDataRes || histDataRes.length === 0) && chunk.length > 0) { console.error('History insert blocked by RLS'); hasError = true; errorMessage = 'Row Level Security (RLS) is blocking the History upload in Supabase. Please disable RLS or add policies.'; break; }
              await delay(100);
              
              if (histErr && histErr.code === '23505') {
                 console.log("History chunk contains existing records, skipping duplicate error");
              } else if (histErr && histErr.code !== '23505') {
                 console.error("Error syncing history to Supabase:", histErr);
                 hasError = true;
                 errorMessage = histErr.message?.includes('Failed to fetch')
                    ? 'Network error (Failed to fetch). If you have an Adblocker or Brave Shields enabled, it might be blocking Supabase.'
                    : (histErr.message || 'History error');
                 break;
              }
           }
        }

        // 4. Sync User Profiles
        if (changedUsers.length > 0) {
           let usersPayload = changedUsers.filter(u => u && u.bdNo).map((u: any) => ({
              airman_id: u.airmanId || null,
              'User ID': u.bdNo,
              'Rank': u.rank || '',
              'Name': u.name || '',
              'Flight': u.flightName || '',
              'Trade': u.trade || '',
              'Role': u.role || 'USER',
              'User Login PIN': (u.password && String(u.password).trim() !== '') ? Number(u.password) : null,
              'Admin Login PIN': (u.adminPass && String(u.adminPass).trim() !== '') ? Number(u.adminPass) : null
           }));
           
           // Deduplicate
           const uniqueUsersMap = new Map();
           usersPayload.forEach(a => uniqueUsersMap.set(a['User ID'], a));
           usersPayload = Array.from(uniqueUsersMap.values());
           
           const usersChunkSize = 50;
           for (let i = 0; i < usersPayload.length; i += usersChunkSize) {
              const chunk = usersPayload.slice(i, i + usersChunkSize);
              emitSyncProgress(90 + Math.round((i / usersPayload.length) * 10), `Uploading users ${i} of ${usersPayload.length}...`);
              const { data: usersDataRes, error: usersErr } = await supabase.from('user_profiles').upsert(chunk, { onConflict: '"User ID"' }).select();
              await delay(100);
              
              if (!usersErr && (!usersDataRes || usersDataRes.length === 0) && chunk.length > 0) {
                 console.error('User profiles upsert blocked by RLS');
                 hasError = true;
                 errorMessage = 'Row Level Security (RLS) is blocking the User Profiles upload in Supabase. Please disable RLS or add policies.';
                 break;
              } else if (usersErr) {
                 console.error("Error syncing users to Supabase:", usersErr);
                 hasError = true;
                 errorMessage = usersErr.message?.includes('Failed to fetch')
                    ? 'Network error (Failed to fetch). If you have an Adblocker or Brave Shields enabled, it might be blocking Supabase.'
                    : (usersErr.message || 'Users error');
                 break;
              }
           }
        }
        
        // 5. Sync Settings / Configurations
        const settingsPayload: any[] = [];
        const SETTING_PREFIXES = ['baf_', 'savedDisposalKeys', 'parade_historical', 'flg_wg_'];
        const IGNORED_KEYS = ['baf_official_duty_matrix_v4', 'baf_database_v2', 'baf_sync_logs', 'baf_pending_sync', 'baf_presence', 'baf_user_login_history', 'baf_recent_logins', 'baf_theme_pref', 'baf_last_used_id', 'baf_dismissed_notice_sig', 'baf_cleared_notices_v4'];
        
        if (typeof window !== 'undefined') {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (!key) continue;
            
            if (IGNORED_KEYS.includes(key)) continue;
            
            const isMatch = SETTING_PREFIXES.some(prefix => key.startsWith(prefix));
            
            if (isMatch) {
              const val = window.localStorage.getItem(key);
              if (val) {
                settingsPayload.push({
                  setting_key: key,
                  setting_value: val,
                  updated_at: new Date().toISOString()
                });
              }
            }
          }
        }

        if (settingsPayload.length > 0) {
           const { error: settingsErr } = await supabase.from('app_settings').upsert(settingsPayload, { onConflict: 'setting_key' });
           if (settingsErr) {
              console.warn("Could not sync settings. (app_settings table might not exist yet)", settingsErr);
           }
        }
        
        // 6. Sync Duty Ratio Matrix
        if (typeof window !== 'undefined') {
           const matrixRaw = window.localStorage.getItem('baf_official_duty_matrix_v4');
           if (matrixRaw) {
               try {
                   const matrix = JSON.parse(matrixRaw);
                   if (Array.isArray(matrix)) {
                       const matrixPayload: any[] = [];
                       matrix.forEach((m: any) => {
                           const flights = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
                           flights.forEach(f => {
                               const days = m.data?.[f] || Array(31).fill(0);
                               const flightTotal = days.reduce((sum: number, val: number) => sum + val, 0);
                               const row: any = {
                                   id: `${m.id || m.dutyCode}_${f}`,
                                   duty_id: m.id || m.dutyCode || 'unknown',
                                   duty_title: m.title || m.dutyCode || 'Unknown Duty',
                                   duty_code: m.dutyCode || 'UNKNOWN',
                                   shift_label: m.shiftLabel || null,
                                   flight: f,
                                   flight_total: flightTotal,
                                   duty_total_daily: m.totalRequiredDaily || 0,
                                   is_disabled: m.isDisabled || false
                               };
                               for (let i = 0; i < 31; i++) {
                                   row[`day_${i + 1}`] = days[i] || 0;
                               }
                               matrixPayload.push(row);
                           });
                       });
                       const { error: matrixErr } = await supabase.from('duty_ratio_matrix').upsert(matrixPayload, { onConflict: 'id' });
                       if (matrixErr) {
                           console.error("Error syncing duty matrix to Supabase:", matrixErr);
                       }
                   }
               } catch(e) {
                   console.error("Error parsing matrix for Supabase sync:", e);
               }
           }
        }

        if (hasError) {
           emitSyncProgress(0, "Sync Failed!");
           addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "ERROR", message: "Sync Failed: " + errorMessage });
           return false;
        } else {
           emitSyncProgress(100, "Successfully synced to Cloud!");
           addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "SUCCESS", message: "Successfully synced to Cloud!" });
           if (typeof window !== 'undefined') {
              window.localStorage.removeItem('baf_pending_sync');
           }
           this.lastSyncedDbStr = JSON.stringify(dbToSave);
           return true;
        }
      } catch (err: any) {
        console.error("Supabase Save Error:", err);
        addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "ERROR", message: "Failed to push to Supabase." });
        if (typeof window !== 'undefined') window.localStorage.setItem('baf_pending_sync', 'true');
        return false;
      } finally {
        this.isPushing = false;
      }
    };

    if (immediate) {
       return doSave();
    } else {
       if (this.saveTimeout) clearTimeout(this.saveTimeout);
       return new Promise((resolve) => {
         this.saveTimeout = setTimeout(async () => {
           resolve(await doSave());
         }, 10000);
       });
    }
  }

  private loadInitialLocalState(): LocalStorageDB {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.airmen) && parsed.airmen.length > 0) {
            const db: LocalStorageDB = {
              airmen: (() => { const seenIds = new Set<string>(); return parsed.airmen.map((a: Airman) => { let newId = a.id; if (!newId || newId === "airman-undefined" || seenIds.has(newId)) { newId = "airman-" + Math.random().toString(36).slice(2, 10); } seenIds.add(newId); return { ...a, id: newId }; }).sort((a: Airman, b: Airman) => a.serNo - b.serNo); })(),
              assignments: parsed.assignments || {},
              activityHistory: parsed.activityHistory || [],
              adminPasscode: parsed.adminPasscode || DEFAULT_ADMIN_PASSCODE,
              detailedUsers: parsed.detailedUsers || [],
              importHistory: parsed.importHistory || [],
              lastUpdated: parsed.lastUpdated || new Date().toISOString(),
            };


            return db;
          }
        }
      }
    } catch (err) {
      console.warn('Could not read from localStorage, using initial state:', err);
    }

    // Default fresh DB
    const initialPasscode = DEFAULT_ADMIN_PASSCODE;
    const initialDb: LocalStorageDB = {
      airmen: [],
      assignments: {
        
        
      },
      activityHistory: [],
      adminPasscode: initialPasscode,
      importHistory: [],
      lastUpdated: new Date().toISOString(),
    };

    this.saveToStorage(initialDb, false, false, true);
    return initialDb;
  }

  public forceSave() { this.saveToStorage(this.db, true, true, true); }
  public saveToStorage(dbToSave: LocalStorageDB = this.db, notify: boolean = true, pushToFirebase: boolean = true, updateTimestamp: boolean = true) {
    try {
      if (updateTimestamp) {
        dbToSave.lastUpdated = new Date().toISOString();
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dbToSave));
      }
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }

    if (pushToFirebase) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('baf_pending_sync', 'true');
      }
      this.saveToFirebase(dbToSave);
    }

    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_state_updated', { detail: { source: 'localDatabase' } }));
    }
  }

  private recordActivity(action: Omit<ActivityHistoryItem, 'id' | 'timestamp'>) {
    if (!this.db.activityHistory) {
      this.db.activityHistory = [];
    }
    const air = this.db.airmen.find((a) => a.id === action.airmanId);
    const item: ActivityHistoryItem = {
      ...action,
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      airmanRank: air?.rank,
      airmanTrade: air?.trade,
    };
    this.db.activityHistory.unshift(item);
    if (this.db.activityHistory.length > 100) {
      // this.db.activityHistory = this.db.activityHistory.slice(0, 100);
    }
  }

  public logSystemAction(airmanId: string, airmanName: string, description: string) {
    this.recordActivity({
      actionType: 'SYSTEM_ACTION',
      airmanId,
      airmanName,
      description
    });
  }

  // --- AIRMEN CRUD ---
  public getAirmen(filters?: { flight?: string; rank?: string; search?: string }): Airman[] {
    let list = [...this.db.airmen];
    if (filters?.flight && filters.flight !== 'Overall') {
      list = list.filter((a) => a.flightName === filters.flight);
    }
    if (filters?.rank && filters.rank !== 'All') {
      list = list.filter((a) => a.rank === filters.rank);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.bdNo.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          a.trade.toLowerCase().includes(q) ||
          a.addressBlock.toLowerCase().includes(q)
      );
    }
    return sortAirmenBySeniority(list);
  }

  public clearAllAirmen(): void {
    this.db.airmen = [];
    this.saveToStorage();
    this.recordActivity({
      type: 'Airman_Status',
      airmanId: 'ALL',
      dutyCode: 'OFF',
      details: 'Cleared all airmen from Nominal Roll',
      timestamp: new Date().toISOString()
    } as any);
  }

  public addAirman(data: Partial<Airman>): Airman {
    const newSerNo = this.db.airmen.length > 0 ? Math.max(...this.db.airmen.map((a) => a.serNo)) + 1 : 1;
    const id = `airman-${Date.now()}`;
    const newAirman: Airman = {
      id,
      serNo: newSerNo,
      code: data.code || `${data.rank || 'LAC'}-${(data.name || 'AIR').slice(0, 3).toUpperCase()}`,
      bdNo: data.bdNo || `BD/${Date.now().toString().slice(-6)}`,
      rank: data.rank || 'LAC',
      name: data.name || 'Airman',
      trade: data.trade || 'General Tech',
      addressBlock: data.addressBlock || '',
      mobileNo: data.mobileNo || '01700000000',
      flightName: (data.flightName as FlightName) || 'Admin',
      remarks: data.remarks || 'Newly Enlisted',
      active: true,
    };

    this.db.airmen.push(newAirman);
    this.logSystemAction(newAirman.id, `${newAirman.rank} ${newAirman.name}`, 'Added new airman to Nominal Roll');
    this.saveToStorage();

    return newAirman;
  }

  public bulkAddAirmen(airmenList: Partial<Airman>[]): { count: number; airmen: Airman[] } {
    let currentSerNo = this.db.airmen.length > 0 ? Math.max(...this.db.airmen.map((a) => a.serNo)) : 0;
    const createdAirmen: Airman[] = [];

    for (const item of airmenList) {
      currentSerNo++;
      const id = `airman-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanBd = item.bdNo ? (item.bdNo.toUpperCase().startsWith('BD') ? item.bdNo : `BD/${item.bdNo}`) : `BD/${Date.now().toString().slice(-6)}`;
      const newAirman: Airman = {
        id,
        serNo: currentSerNo,
        code: item.code || `${item.rank || 'LAC'}-${(item.name || 'AIR').slice(0, 3).toUpperCase()}`,
        bdNo: cleanBd,
        rank: item.rank || 'LAC',
        name: item.name || 'Airman',
        trade: item.trade || 'General Tech',
        addressBlock: item.addressBlock || '',
        mobileNo: item.mobileNo || '01700000000',
        flightName: (item.flightName as FlightName) || 'Admin',
        remarks: item.remarks || 'Bulk Imported',
        active: true,
      };

      createdAirmen.push(newAirman);
      this.db.airmen.push(newAirman);
    }

    this.saveToStorage();

    // Log in activity history
    this.recordActivity({
      actionType: 'BULK_IMPORT_AIRMEN' as any,
      airmanId: 'BULK_AIRMEN',
      airmanName: `${createdAirmen.length} Airmen Imported`,
      dutyCode: 'GD',
      fromDate: '',
      toDate: '',
      notes: `Bulk imported ${createdAirmen.length} airmen to Nominal Roll`,
    });

    return { count: createdAirmen.length, airmen: createdAirmen };
  }

  public updateAirman(id: string, data: Partial<Airman>): Airman | null {
    const idx = this.db.airmen.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const previous = this.db.airmen[idx];
    this.db.airmen[idx] = {
      ...previous,
      ...data,
      id,
    };
    
    if (previous.active && !data.active) {
      this.logSystemAction(id, `${previous.rank} ${previous.name}`, 'Posted out / Marked inactive from Nominal Roll');
    } else if (!previous.active && data.active) {
      this.logSystemAction(id, `${previous.rank} ${previous.name}`, 'Reactivated in Nominal Roll');
    }

    this.saveToStorage();

    return this.db.airmen[idx];
  }

  public deleteAirman(id: string): boolean {
    const initialCount = this.db.airmen.length;
    const target = this.db.airmen.find((a) => a.id === id);
    if (target) {
        this.logSystemAction(id, `${target.rank} ${target.name}`, 'Permanently deleted from Nominal Roll');
    }
    this.db.airmen = this.db.airmen.filter((a) => a.id !== id);

    // Clean assignments
    if (this.db.assignments) {
      Object.keys(this.db.assignments).forEach((monthKey) => {
        if (Array.isArray(this.db.assignments[monthKey])) {
          this.db.assignments[monthKey] = this.db.assignments[monthKey].filter((ass) => ass.airmanId !== id);
        }
      });
    }
    
    // Clean detailedUsers
    if (this.db.detailedUsers) {
      this.db.detailedUsers = this.db.detailedUsers.filter((u: any) => u.airmanId !== id && u.bdNo !== target?.bdNo);
    }

    this.saveToStorage();
    


    return true;
  }

  // --- ROSTER & ASSIGNMENTS ---
  public getRoster(monthKey?: string): { monthKey: string; assignments: DutyAssignment[] } {
    const today = new Date();
    const defaultMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const targetMonth = monthKey || defaultMonthKey;
    const assignments = this.db.assignments[targetMonth] || [];
    return { monthKey: targetMonth, assignments };
  }

  public getRosterYear(year?: number): { year: number; assignments: DutyAssignment[] } {
    const targetYear = year || new Date().getFullYear();
    const prefix = `${targetYear}-`;
    const assignments: DutyAssignment[] = [];
    Object.keys(this.db.assignments).forEach((mKey) => {
      if (mKey.startsWith(prefix)) {
        assignments.push(...(this.db.assignments[mKey] || []));
      }
    });
    return { year: targetYear, assignments };
  }

  public assignDuty(monthKey: string, assignment: DutyAssignment): DutyAssignment {
    if (!this.db.assignments[monthKey]) {
      this.db.assignments[monthKey] = [];
    }
    const list = this.db.assignments[monthKey];
    let index = -1;

    if (assignment.dutyCode === 'IDAC' || assignment.dutyCode === 'IDA') {
      if (assignment.idaShift === 'Night') {
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'
        );
      } else {
        // Any day duty that is IDAC day
        index = list.findIndex(
          (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night')
        );
      }
    } else {
      // Overwrite any existing day duty for this date
      index = list.findIndex(
        (a) => a.airmanId === assignment.airmanId && a.date === assignment.date && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night')
      );
    }

    const prevAssignment = index >= 0 ? { ...list[index] } : null;
    const newAss: DutyAssignment = {
      ...assignment,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      list[index] = newAss;
    } else {
      list.push(newAss);
    }

    const air = this.db.airmen.find((a) => a.id === assignment.airmanId);
    this.recordActivity({
      actionType: assignment.dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_DUTY',
      airmanId: assignment.airmanId,
      airmanName: air ? `${air.rank} ${air.name}` : assignment.airmanId,
      dutyCode: assignment.dutyCode,
      idaShift: assignment.idaShift,
      fromDate: assignment.date,
      toDate: assignment.date,
      notes: assignment.notes,
      previousAssignments: [
        {
          airmanId: assignment.airmanId,
          date: assignment.date,
          dutyCode: prevAssignment?.dutyCode,
          idaShift: prevAssignment?.idaShift,
          notes: prevAssignment?.notes,
        },
      ],
    });

    this.saveToStorage();
    return newAss;
  }

  public assignRange(params: {
    airmanId: string;
    dutyCode: DutyCategoryCode;
    idaShift?: IDAShift;
    fromDate: string;
    toDate: string;
    notes?: string;
    proxyForFlight?: FlightName;
    replaceAirmanId?: string;
    disposalScope?: 'ALL' | 'PARADE' | 'PT';
  }): { count: number; assignedDates: string[] } {
    const { airmanId, dutyCode, idaShift, fromDate, toDate, notes, proxyForFlight, replaceAirmanId, disposalScope } = params;
    const assignedDates = getDatesInRange(fromDate, toDate);
    const prevStates: Array<{ airmanId: string; date: string; dutyCode?: any; idaShift?: any; notes?: string }> = [];

    for (const dateStr of assignedDates) {
      const monthKey = dateStr.slice(0, 7);
      if (!this.db.assignments[monthKey]) {
        this.db.assignments[monthKey] = [];
      }

      if (replaceAirmanId && replaceAirmanId !== airmanId) {
        const oldIndex = this.db.assignments[monthKey].findIndex((a) => a.airmanId === replaceAirmanId && a.date === dateStr);
        if (oldIndex >= 0) {
          const oldItem = this.db.assignments[monthKey][oldIndex];
          prevStates.push({
            airmanId: replaceAirmanId,
            date: dateStr,
            dutyCode: oldItem.dutyCode,
            idaShift: oldItem.idaShift,
            notes: oldItem.notes,
          });
          this.db.assignments[monthKey].splice(oldIndex, 1);
        }
      }

      const list = this.db.assignments[monthKey];
      let index = -1;
      if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
        if (idaShift === 'Night') {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
        } else {
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'));
        }
      } else {
        index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night'));
      }

      if (index >= 0) {
        prevStates.push({ airmanId, date: dateStr, dutyCode: list[index].dutyCode, idaShift: list[index].idaShift, notes: list[index].notes });
      } else {
        prevStates.push({ airmanId, date: dateStr, dutyCode: undefined });
      }

      const assignment: DutyAssignment = {
        airmanId,
        date: dateStr,
        dutyCode,
        idaShift,
        proxyForFlight,
        disposalScope: disposalScope || 'ALL',
        notes: notes || '',
        updatedAt: new Date().toISOString(),
      };

      if (index >= 0) {
        list[index] = assignment;
      } else {
        list.push(assignment);
      }
    }

    const air = this.db.airmen.find((a) => a.id === airmanId);
    this.recordActivity({
      actionType: dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_RANGE',
      airmanId,
      airmanName: air ? `${air.rank} ${air.name}` : airmanId,
      dutyCode,
      idaShift,
      fromDate,
      toDate,
      notes,
      previousAssignments: prevStates,
    });

    this.saveToStorage();
    return { count: assignedDates.length, assignedDates };
  }

  public batchAssign(params: {
    fromDate: string;
    toDate: string;
    assignments: Array<{
      airmanId: string;
      dutyCode: DutyCategoryCode;
      idaShift?: IDAShift;
      proxyForFlight?: FlightName;
      notes?: string;
      disposalScope?: 'ALL' | 'PARADE' | 'PT';
    }>;
    removedAirmanIds?: string[];
  }): { count: number; assignedDates: string[] } {
    const { fromDate, toDate, assignments, removedAirmanIds } = params;
    const assignedDates = getDatesInRange(fromDate, toDate);
    const prevStates: Array<{ airmanId: string; date: string; dutyCode?: any; idaShift?: any; notes?: string }> = [];

    // Remove unassigned
    if (Array.isArray(removedAirmanIds) && removedAirmanIds.length > 0) {
      for (const dateStr of assignedDates) {
        const monthKey = dateStr.slice(0, 7);
        if (this.db.assignments[monthKey]) {
          for (const remId of removedAirmanIds) {
            const found = this.db.assignments[monthKey].find((a) => a.airmanId === remId && a.date === dateStr);
            if (found) {
              prevStates.push({ airmanId: remId, date: dateStr, dutyCode: found.dutyCode, idaShift: found.idaShift, notes: found.notes });
            }
            this.db.assignments[monthKey] = this.db.assignments[monthKey].filter(
              (a) => !(a.airmanId === remId && a.date === dateStr)
            );
          }
        }
      }
    }

    // Apply assignments
    for (const item of assignments) {
      const { airmanId, dutyCode, idaShift, proxyForFlight, notes, disposalScope } = item;
      if (!airmanId || !dutyCode) continue;

      for (const dateStr of assignedDates) {
        const monthKey = dateStr.slice(0, 7);
        if (!this.db.assignments[monthKey]) {
          this.db.assignments[monthKey] = [];
        }

        const list = this.db.assignments[monthKey];
        let index = -1;
        if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
          if (idaShift === 'Night') {
            index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift === 'Night');
          } else {
            index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && a.idaShift !== 'Night');
          }
        } else if (dutyCode === 'AIRPORT' || dutyCode === 'ATT' || dutyCode === 'DETT') {
          const scope = disposalScope || 'ALL';
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.dutyCode === 'AIRPORT' || a.dutyCode === 'ATT' || a.dutyCode === 'DETT') && (a.disposalScope || 'ALL') === scope);
        } else {
          const scope = disposalScope || 'ALL';
          index = list.findIndex((a) => a.airmanId === airmanId && a.date === dateStr && (a.disposalScope || 'ALL') === scope);
        }

        const assignment: DutyAssignment = {
          airmanId,
          date: dateStr,
          dutyCode,
          idaShift,
          proxyForFlight,
          disposalScope: disposalScope || 'ALL',
          notes: notes || '',
          updatedAt: new Date().toISOString(),
        };

        if (index >= 0) {
          list[index] = assignment;
        } else {
          list.push(assignment);
        }
      }
    }

    this.saveToStorage();
    return { count: assignments.length * assignedDates.length, assignedDates };
  }

  public deleteAssignment(airmanId: string, date: string, dutyCode?: DutyCategoryCode): boolean {
    const monthKey = date.slice(0, 7);
    if (!this.db.assignments[monthKey]) return false;

    const list = this.db.assignments[monthKey];
    let removed = false;

    if (dutyCode) {
      const idx = list.findIndex((a) => {
        if (a.airmanId !== airmanId || a.date !== date) return false;
        if (dutyCode === 'AIRPORT' || dutyCode === 'ATT' || dutyCode === 'DETT') {
          return a.dutyCode === 'AIRPORT' || a.dutyCode === 'ATT' || a.dutyCode === 'DETT';
        }
        if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
          return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
        }
        return a.dutyCode === dutyCode;
      });
      if (idx >= 0) {
        list.splice(idx, 1);
        removed = true;
      }
    } else {
      const initialLen = list.length;
      this.db.assignments[monthKey] = list.filter((a) => !(a.airmanId === airmanId && a.date === date));
      removed = this.db.assignments[monthKey].length < initialLen;
    }

    if (removed) {
      this.saveToStorage();
    }

    return removed;
  }

  public deleteRange(params: {
    airmanId: string;
    fromDate: string;
    toDate: string;
    dutyCode?: DutyCategoryCode;
  }): number {
    const { airmanId, fromDate, toDate, dutyCode } = params;
    const dates = getDatesInRange(fromDate, toDate);
    let count = 0;

    for (const d of dates) {
      if (this.deleteAssignment(airmanId, d, dutyCode)) {
        count++;
      }
    }

    return count;
  }

  public resetToEmptyRoster(): void {
    this.db.assignments = {};
    this.saveToStorage();
  }

  public clearMonth(monthKey: string): void {
    if (this.db.assignments[monthKey]) {
      delete this.db.assignments[monthKey];
      this.saveToStorage();
    }
  }

  public resetToOfficialData(): void {
    this.db.assignments = {
      
      
    };
    this.saveToStorage();
  }

  // --- PARADE STATE & PT STATE ---
  public getParadeState(params?: {
    date?: string;
    shift?: ParadeShift;
    flight?: FlightName | 'Overall';
    stateType?: string;
  }): ParadeStateResponse {
    const today = new Date().toISOString().split('T')[0];
    const date = params?.date || today;
    const shift = (params?.shift || 'Morning') as ParadeShift;
    const selectedFlight = params?.flight || 'Overall';
    const stateType = (params?.stateType || 'PARADE').toUpperCase();
    const isPT = stateType === 'PT';
    const isNightCount = stateType === 'NIGHT_COUNT';

    const monthKey = date.slice(0, 7);
    const monthAssignments = this.db.assignments[monthKey] || [];
    const dateAssignments = monthAssignments.filter((a) => a.date === date);

    const assignmentMap = new Map<string, DutyAssignment>();
    dateAssignments.forEach((a) => {
      const scope = a.disposalScope || 'ALL';
      const isApplicable = scope === 'ALL' || (isPT && scope === 'PT') || (isNightCount && scope === 'NIGHT_COUNT') || (!isPT && !isNightCount && scope === 'PARADE');
      if (isApplicable) {
        const existing = assignmentMap.get(a.airmanId);
        if (!existing || (existing.disposalScope || 'ALL') === 'ALL') {
          assignmentMap.set(a.airmanId, a);
        }
      }
    });

    // Calculate yesterday's assignments for auto duty off calculation safely via UTC
    const getYesterdayDateStr = (dateStr: string): string => {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return dateStr;
      const d = new Date(Date.UTC(year, month - 1, day));
      d.setUTCDate(d.getUTCDate() - 1);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const da = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    };

    const yestStr = getYesterdayDateStr(date);
    const yestMonthKey = yestStr.slice(0, 7);
    const yestAssignments = (this.db.assignments[yestMonthKey] || []).filter((a) => a.date === yestStr);
    const yestMap = new Map<string, DutyAssignment>();
    yestAssignments.forEach((a) => {
      const scope = a.disposalScope || 'ALL';
      const isApplicable = scope === 'ALL' || (isPT && scope === 'PT') || (isNightCount && scope === 'NIGHT_COUNT') || (!isPT && !isNightCount && scope === 'PARADE');
      if (isApplicable) {
        const existing = yestMap.get(a.airmanId);
        if (!existing || (existing.disposalScope || 'ALL') === 'ALL') {
          yestMap.set(a.airmanId, a);
        }
      }
    });

    // Target airmen filter
    const allAirmen = this.db.airmen || [];
    
    // Filter out airmen who haven't joined yet or have left before this date
    const dateActiveAirmen = allAirmen.filter(a => {
      if (a.dateJoined && a.dateJoined > date) return false;
      if (a.dateLeft && a.dateLeft < date) return false;
      return true;
    });

    const filteredAirmen = sortAirmenBySeniority(selectedFlight === 'Overall' 
      ? dateActiveAirmen 
      : dateActiveAirmen.filter((a) => a.flightName === selectedFlight));

    let onParade = 0;
    let onDuty = 0;
    let onLeave = 0;
    let tdy = 0;
    let otherOff = 0;
    let bakeNBite = 0;

    const resolveEffectiveAssignment = (airmanId: string): { 
      dutyCode: string; 
      idaShift?: string; 
      proxyForFlight?: string;
      disposalScope?: 'ALL' | 'PARADE' | 'PT' | 'NIGHT_COUNT';
      notes: string; 
      dutyName: string;
      previousDutyName?: string;
      statusCategory: string;
    } => {
      const ass = assignmentMap.get(airmanId);
      
      const scope = ass?.disposalScope || 'ALL';
      const isApplicable = scope === 'ALL' || (isPT && scope === 'PT') || (isNightCount && scope === 'NIGHT_COUNT') || (!isPT && !isNightCount && scope === 'PARADE');

      if (ass && isApplicable) {
        let dutyName: string = String(ass.dutyCode);
        let statusCategory: string = 'DUTY';
        let previousDutyName: string | undefined = undefined;

        const codeStr = String(ass.dutyCode);
        if (codeStr === 'GD') dutyName = 'Base Security Duty';
        else if (codeStr === 'BTF') dutyName = 'Base Taskforce Duty';
        else if (codeStr === 'NTF') dutyName = 'Najirpara Taskforce Duty';
        else if (codeStr === 'HALISHAHAR') dutyName = 'Halishahar Duty';
        else if (codeStr === 'AIRPORT' || codeStr === 'AIRFIELD' || codeStr === 'ATT' || codeStr === 'DETT') dutyName = 'Airfield';
        else if (codeStr === 'IDAC' || codeStr === 'IDA') {
          const s = ass.idaShift || 'Morning';
          dutyName = `IDAC Duty (${s})`;
          
          if (isPT) {
            statusCategory = 'DUTY';
          } else {
            if (s === 'Night' && shift === 'Morning') {
              const yestAss = yestMap.get(airmanId);
              const hadDutyYesterday = yestAss && (
                ['GD', 'BTF', 'NTF', 'AIRPORT', 'HALISHAHAR'].includes(yestAss.dutyCode) ||
                ((yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') && yestAss.idaShift === 'Night')
              );
              if (hadDutyYesterday) {
                statusCategory = 'OFF';
                previousDutyName = (yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') ? 'IDAC Nt Off' : `${yestAss.dutyCode} Off`;
                dutyName = previousDutyName;
              } else {
                statusCategory = 'PARADE';
                dutyName = 'On Parade';
              }
            } else {
              statusCategory = 'DUTY';
            }
          }
        }
        else if (codeStr === 'BAKE_N_BITE') {
          dutyName = 'Bake & Bite';
          statusCategory = 'BAKE_N_BITE';
        }
        else if (codeStr === 'LEAVE') {
          dutyName = ass.notes?.includes('Annual') || ass.notes?.includes('AL') ? 'Annual Leave (AL)' : 'Casual Leave (CL)';
          statusCategory = 'LEAVE';
        }
        else if (codeStr === 'TDY') {
          dutyName = 'TDY / Attachment';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'DUTY_OFF') {
          if (isPT) {
            return {
              dutyCode: 'ON_PARADE',
              dutyName: 'On PT',
              notes: '',
              statusCategory: 'PARADE',
              disposalScope: scope,
            };
          }

          const yestAss = yestMap.get(airmanId);
          let offShort = 'GD Off';

          if (yestAss) {
            const yestCodeStr = String(yestAss.dutyCode);
            if (yestCodeStr === 'GD') offShort = 'GD Off';
            else if (yestCodeStr === 'BTF') offShort = 'BTF Off';
            else if (yestCodeStr === 'NTF') offShort = 'NTF Off';
            else if (yestCodeStr === 'AIRPORT' || yestCodeStr === 'AIRFIELD' || yestCodeStr === 'ATT' || yestCodeStr === 'DETT') offShort = 'Airfield Off';
            else if (yestCodeStr === 'HALISHAHAR') offShort = 'Halishahar Off';
            else if ((yestCodeStr === 'IDAC' || yestCodeStr === 'IDA') && yestAss.idaShift === 'Night') offShort = 'IDAC Nt Off';
            else if (yestAss.notes?.toLowerCase().includes('idac') || yestAss.previousDutyName?.toLowerCase().includes('idac')) offShort = 'IDAC Nt Off';
            else if (yestCodeStr === 'DUTY_OFF') offShort = yestAss.previousDutyName || 'GD Off';
            else if (yestCodeStr === 'ON_PARADE') offShort = 'GD Off';
            else offShort = `${yestAss.dutyCode} Off`;
          } else if (ass.notes && !ass.notes.toLowerCase().includes('imported')) {
            if (ass.notes.toLowerCase().includes('idac')) offShort = 'IDAC Nt Off';
            else if (ass.notes.toLowerCase().includes('gd')) offShort = 'GD Off';
            else if (ass.notes.toLowerCase().includes('btf')) offShort = 'BTF Off';
            else if (ass.notes.toLowerCase().includes('ntf')) offShort = 'NTF Off';
            else if (ass.notes.toLowerCase().includes('airport')) offShort = 'Airfield Off';
            else if (ass.notes.toLowerCase().includes('halishahar')) offShort = 'Halishahar Off';
            else offShort = ass.notes;
          }

          offShort = (offShort || "")
            .replace(/DUTY_OFF/g, 'Duty')
            .replace(/Off Off/g, 'Off')
            .replace(/Duty Off Off/g, 'Duty Off');

          if (!offShort.toLowerCase().endsWith('off')) {
            offShort = `${offShort} Off`;
          }

          previousDutyName = offShort;
          dutyName = offShort;
          statusCategory = 'OFF';
        }
        else if (codeStr === 'ON_PARADE') {
          dutyName = isPT ? 'On PT' : 'On Parade';
          statusCategory = 'PARADE';
        }
        else if (codeStr === 'ESSN') {
          dutyName = 'Essential Task';
          statusCategory = 'ESSN';
        }
        else if (codeStr === 'CMH') {
          dutyName = 'BNS/BSH/CMH';
          statusCategory = 'CMH';
        }
        else if (codeStr === 'SICK_REPORT') {
          dutyName = 'Sick Report';
          statusCategory = 'SICK_REPORT';
        }
        else if (codeStr === 'ADMIN_ORDER') {
          dutyName = 'Admin Order';
          statusCategory = 'ADMIN_ORDER';
        }
        else if (codeStr === 'CLASS_TRG') {
          dutyName = 'Class / Training';
          statusCategory = 'CLASS_TRG';
        }
        else if (codeStr === 'ATT') {
          dutyName = 'Attachment';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'DETT') {
          dutyName = 'Detachment';
          statusCategory = 'TDY';
        }
        else if (codeStr === 'RECEPTION') {
          dutyName = isPT ? 'Reception Duty' : 'K/O & Reception';
          statusCategory = 'RECEPTION';
        }
        else if (codeStr === 'GAMES') {
          dutyName = 'G/H & Games';
          statusCategory = 'GAMES';
        }
        else if (codeStr === 'CANTEEN') {
          if (isPT) {
             return {
                dutyCode: 'RECEPTION',
                idaShift: ass.idaShift,
                proxyForFlight: ass.proxyForFlight,
                disposalScope: scope,
                notes: ass.notes || '',
                dutyName: 'Reception Duty',
                previousDutyName,
                statusCategory: 'RECEPTION',
             };
          } else {
             dutyName = 'Canteen';
             statusCategory = 'CANTEEN';
          }
        }
        else if (codeStr === 'DEPLOYMENT') {
          let dest = ass.notes || 'Deployment';
          if (dest.includes(' - ')) {
            dest = dest.split(' - ')[0].trim();
          }
          dutyName = dest;
          statusCategory = 'OTHERS'; // Treated as dynamic disposal
          
          return {
            dutyCode: dest,
            idaShift: ass.idaShift,
            proxyForFlight: ass.proxyForFlight,
            disposalScope: scope,
            notes: (ass.notes || '').toLowerCase().includes('imported') ? '' : (ass.notes || ''),
            dutyName: dest,
            previousDutyName,
            statusCategory: 'OTHERS'
          };
        }
        else if (codeStr === 'ABSENT') {
          dutyName = 'Absent';
          statusCategory = 'ABSENT';
        }
        else if (codeStr === 'OTHERS') {
          dutyName = ass.notes || 'Other Disposal';
          statusCategory = 'OTHERS';
        }

        const safeNotes = (ass.notes || '').toLowerCase().includes('imported') ? '' : (ass.notes || '');

        return { 
          dutyCode: ass.dutyCode, 
          idaShift: ass.idaShift, 
          proxyForFlight: ass.proxyForFlight,
          disposalScope: scope,
          notes: safeNotes, 
          dutyName,
          previousDutyName,
          statusCategory,
        };
      }

      if (!isPT) {
        const yestAss = yestMap.get(airmanId);
        if (yestAss) {
          let offShort = 'GD Off';
          if (yestAss.dutyCode === 'GD') offShort = 'GD Off';
          else if (yestAss.dutyCode === 'BTF') offShort = 'BTF Off';
          else if (yestAss.dutyCode === 'NTF') offShort = 'NTF Off';
          else if (yestAss.dutyCode === 'AIRPORT') offShort = 'Airfield Off';
          else if (yestAss.dutyCode === 'HALISHAHAR') offShort = 'Halishahar Off';
          else if ((yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') && yestAss.idaShift === 'Night') offShort = 'IDAC Nt Off';
          else if (yestAss.notes?.toLowerCase().includes('idac') || yestAss.previousDutyName?.toLowerCase().includes('idac')) offShort = 'IDAC Nt Off';
          else if (yestAss.dutyCode === 'DUTY_OFF') offShort = yestAss.previousDutyName || yestAss.notes || 'GD Off';
          else if (yestAss.dutyCode === 'ON_PARADE') offShort = 'GD Off';
          else offShort = `${yestAss.dutyCode} Off`;

          offShort = (offShort || "")
            .replace(/DUTY_OFF/g, 'Duty')
            .replace(/Off Off/g, 'Off')
            .replace(/Duty Off Off/g, 'Duty Off');

          const isHeavy =
            ['GD', 'BTF', 'NTF', 'AIRPORT', 'ATT', 'HALISHAHAR'].includes(yestAss.dutyCode) ||
            ((yestAss.dutyCode === 'IDAC' || yestAss.dutyCode === 'IDA') && yestAss.idaShift === 'Night') ||
            yestAss.notes?.toLowerCase().includes('idac');

          if (isHeavy) {
            return { 
              dutyCode: 'DUTY_OFF', 
              dutyName: offShort, 
              previousDutyName: offShort,
              proxyForFlight: yestAss.proxyForFlight,
              notes: offShort,
              statusCategory: 'OFF',
            };
          }
        }
      }

      return { 
        dutyCode: 'ON_PARADE', 
        dutyName: isPT ? 'On PT' : 'On Parade', 
        notes: '',
        statusCategory: 'PARADE',
      };
    };

    const personnelStatusList = filteredAirmen.map((airman) => {
      const eff = resolveEffectiveAssignment(airman.id);
      const dutyCode = eff.dutyCode;
      const idaShift = eff.idaShift;
      const proxyForFlight = eff.proxyForFlight;
      let notes = eff.notes;
      const dutyName = eff.dutyName;
      const previousDutyName = eff.previousDutyName;
      const statusCategory = eff.statusCategory;

      if (dutyCode === 'BAKE_N_BITE' || statusCategory === 'BAKE_N_BITE') {
        bakeNBite++;
      } else if (statusCategory === 'LEAVE' || dutyCode === 'LEAVE') {
        onLeave++;
      } else if (statusCategory === 'TDY' || ['TDY', 'ATT', 'DETT'].includes(dutyCode)) {
        tdy++;
      } else if (statusCategory === 'OFF' || dutyCode === 'DUTY_OFF') {
        otherOff++;
      } else if (statusCategory === 'DUTY') {
        onDuty++;
      } else if (statusCategory === 'PARADE' || dutyCode === 'ON_PARADE') {
        onParade++;
      } else {
        otherOff++;
      }

      if ((dutyCode === 'IDAC' || dutyCode === 'IDA') && idaShift === 'Night') {
        const shiftNote = 'IDAC Night';
        if (!notes) notes = shiftNote;
        else if (!notes.includes('IDAC')) notes = `${shiftNote} - ${notes}`;
      }

      return {
        airman,
        dutyCode,
        idaShift,
        proxyForFlight,
        statusCategory,
        notes,
        dutyName,
        previousDutyName,
      };
    });

    const flights: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];
    const flightBreakdown = {} as Record<FlightName, any>;

    flights.forEach((fl) => {
      const flAirmen = (this.db.airmen || []).filter((a) => a.flightName === fl);
      let flParade = 0;
      let flDuty = 0;
      let flLeave = 0;
      let flTdy = 0;
      let flOff = 0;
      let flBakeNBite = 0;

      flAirmen.forEach((a) => {
        const eff = resolveEffectiveAssignment(a.id);
        if (eff.dutyCode === 'BAKE_N_BITE' || eff.statusCategory === 'BAKE_N_BITE') {
          flBakeNBite++;
        } else if (eff.statusCategory === 'LEAVE' || eff.dutyCode === 'LEAVE') flLeave++;
        else if (eff.statusCategory === 'TDY' || ['TDY', 'ATT', 'DETT'].includes(eff.dutyCode)) flTdy++;
        else if (eff.statusCategory === 'OFF' || eff.dutyCode === 'DUTY_OFF') flOff++;
        else if (eff.statusCategory === 'DUTY') flDuty++;
        else if (eff.statusCategory === 'PARADE' || eff.dutyCode === 'ON_PARADE') flParade++;
        else flOff++;
      });

      flightBreakdown[fl] = {
        total: flAirmen.length,
        onParade: flParade,
        onDuty: flDuty,
        onLeave: flLeave,
        tdy: flTdy,
        otherOff: flOff,
        bakeNBite: flBakeNBite,
      };
    });

    return {
      date,
      shift,
      flight: selectedFlight,
      summary: {
        totalStrength: filteredAirmen.length,
        onParade,
        onDuty,
        onLeave,
        tdy,
        otherOff,
        bakeNBite,
      },
      flightBreakdown,
      personnelStatusList,
    } as any;
  }

  // --- ANALYTICS ---
  public getAnalytics(monthKey?: string): {
    monthKey: string;
    totalPersonnel: number;
    dutyStats: AirmanDutyStats[];
    conflicts: ConflictAlert[]; assignments: any[];
  } {
    const today = new Date();
    const defaultMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const targetMonth = monthKey || defaultMonthKey;
    const assignments = this.db.assignments[targetMonth] || [];

    const [yStr, mStr] = targetMonth.split('-');
    const yNum = parseInt(yStr, 10);
    const mNum = parseInt(mStr, 10);

    const dutyStats = calculateDutyStats(this.db.airmen, assignments, yNum, mNum);
    const conflicts = detectConflicts(this.db.airmen, assignments);

    return {
      monthKey: targetMonth,
      totalPersonnel: this.db.airmen.length, assignments,
      dutyStats,
      conflicts,
    };
  }

  // --- ACTIVITY HISTORY ---
  public getHistory(): ActivityHistoryItem[] {
    return this.db.activityHistory || [];
  }

  public undoHistory(historyId: string): boolean {
    const idx = (this.db.activityHistory || []).findIndex((h) => h.id === historyId);
    if (idx === -1) return false;

    const item = this.db.activityHistory[idx];
    if (Array.isArray(item.previousAssignments)) {
      for (const prev of item.previousAssignments) {
        const monthKey = prev.date.slice(0, 7);
        if (!this.db.assignments[monthKey]) continue;

        const list = this.db.assignments[monthKey];
        const existingIdx = list.findIndex((a) => a.airmanId === prev.airmanId && a.date === prev.date);

        if (prev.dutyCode) {
          const restored: DutyAssignment = {
            airmanId: prev.airmanId,
            date: prev.date,
            dutyCode: prev.dutyCode,
            idaShift: prev.idaShift,
            notes: prev.notes || '',
            updatedAt: new Date().toISOString(),
          };
          if (existingIdx >= 0) list[existingIdx] = restored;
          else list.push(restored);
        } else {
          if (item.dutyCode) {
            const exactIdx = list.findIndex(a => a.airmanId === prev.airmanId && a.date === prev.date && a.dutyCode === item.dutyCode && (item.idaShift ? a.idaShift === item.idaShift : true));
            if (exactIdx >= 0) list.splice(exactIdx, 1);
            else if (existingIdx >= 0) list.splice(existingIdx, 1);
          } else {
            if (existingIdx >= 0) list.splice(existingIdx, 1);
          }
        }
      }
    }

    this.db.activityHistory.splice(idx, 1);
    this.saveToStorage();
    return true;
  }

  // --- AUTH & PASSCODE ---
  public verifyPasscode(code: string): boolean {
    const trimmed = (code || '').trim();
    const stored = (this.db.adminPasscode || DEFAULT_ADMIN_PASSCODE).trim();
    return trimmed === stored || trimmed === DEFAULT_ADMIN_PASSCODE;
  }

  public changePasscode(current: string, newCode: string): boolean {
    if (this.verifyPasscode(current) && newCode && newCode.length === 4) {
      this.db.adminPasscode = newCode;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // --- DATABASE BACKUP & RESTORE ---
  public exportDatabase(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      unit: '155 UASU, BAF BASE ZHR',
      version: '2.0',
      airmen: this.db.airmen,
      assignments: this.db.assignments,
      activityHistory: this.db.activityHistory,
      adminPasscode: this.db.adminPasscode,
      importHistory: this.db.importHistory,
    }, null, 2);
  }

  public restoreDatabase(uploadedData: any): boolean {
    const airmen = uploadedData.airmen || uploadedData.database?.airmen;
    const assignments = uploadedData.assignments || uploadedData.database?.assignments;
    const detailedUsers = uploadedData.detailedUsers || uploadedData.database?.detailedUsers;
    const activityHistory = uploadedData.activityHistory || uploadedData.database?.activityHistory;

    let restoredAnything = false;
    if (airmen && Array.isArray(airmen)) {
      this.db.airmen = airmen;
      restoredAnything = true;
    }
    if (assignments && typeof assignments === 'object') {
      this.db.assignments = assignments;
      restoredAnything = true;
    }
    if (detailedUsers && Array.isArray(detailedUsers)) {
      this.db.detailedUsers = detailedUsers;
      restoredAnything = true;
    }
    if (activityHistory && Array.isArray(activityHistory)) {
      this.db.activityHistory = activityHistory;
      restoredAnything = true;
    }
    if (uploadedData.adminPasscode) {
      this.db.adminPasscode = uploadedData.adminPasscode;
      restoredAnything = true;
    }
    
    if (restoredAnything) {
      this.saveToStorage(this.db, true, false, true); // Do NOT auto push to firebase on restore
      return true;
    }
    return false;
  }

  // --- DUTY RATIO PERSISTENCE (Local & D1) ---
  public saveDutyRatioMatrix(matrix: DutyRatioTable[], updatedBy = 'ADMIN'): void {
    saveDutyMatrix(matrix);

    this.recordActivity({
      actionType: 'IMPORT_DUTY_RATIO' as any,
      airmanId: 'ADMIN_ACTION',
      airmanName: `Duty Ratio Matrix Updated`,
      dutyCode: 'GD',
      fromDate: '',
      toDate: '',
      notes: `Updated Official Duty Ratio with ${matrix.length} duty definitions`,
    });
  }

  // --- FUZZY AIRMAN MATCHER (RANK FIRST) ---
  private findBestAirmanMatch(rawText: string, flightHint?: FlightName | 'Overall'): { airman: Airman | null; confidence: number } {
    return matchAirmanRankFirst(rawText, this.db.airmen, flightHint);
  }

  private extractTextFromPdfBase64(base64Str: string): string {
    try {
      const clean = (base64Str || "").replace(/^data:[^;]+;base64,/, '');
      const binary = atob(clean);
      const textParts: string[] = [];

      const tjMatches = binary.match(/\(([^()]{2,200})\)\s*(?:Tj|'|")/g) || [];
      for (const m of tjMatches) {
        const c = m.replace(/^\(|\)\s*(?:Tj|'|")$/g, '').trim();
        if (c.length > 0) textParts.push(c);
      }

      const arrayTjMatches = binary.match(/\[\s*(\([^)]*\)[^\]]*)+\]\s*TJ/gi) || [];
      for (const arr of arrayTjMatches) {
        const innerTexts = arr.match(/\(([^()]*)\)/g) || [];
        const joined = innerTexts.map((t) => t.slice(1, -1)).join('');
        if (joined.trim().length > 1) textParts.push(joined.trim());
      }

      const btMatches = binary.match(/BT[\s\S]*?ET/g) || [];
      for (const bt of btMatches) {
        const inParens = bt.match(/\(([^()]+)\)/g) || [];
        for (const p of inParens) {
          const t = p.slice(1, -1).trim();
          if (t.length > 1 && !textParts.includes(t)) textParts.push(t);
        }
      }

      return textParts.join(' ');
    } catch {
      return '';
    }
  }

  // --- ANALYZE DUTY DOCUMENT ---
  public analyzeDutyDocument(payload: any): any {
    const { fileBase64, files, textSnippet, targetYear = 2026, targetFlight = 'Overall' } = payload || {};

    const fileList: Array<{ base64: string; mime: string; name?: string }> = [];
    if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        if (f.fileBase64 || f.base64) {
          fileList.push({
            base64: f.fileBase64 || f.base64,
            mime: f.mimeType || f.mime || 'application/pdf',
            name: f.fileName || f.name || 'Document',
          });
        }
      }
    } else if (fileBase64) {
      fileList.push({
        base64: fileBase64,
        mime: payload.mimeType || 'application/pdf',
        name: 'Document',
      });
    }

    let extractedText = textSnippet || '';

    for (const f of fileList) {
      if (f.base64) {
        const isPdf = (f.mime && f.mime.includes('pdf')) || (f.name && f.name.toLowerCase().endsWith('.pdf'));
        const isText = (f.mime && (f.mime.includes('text') || f.mime.includes('csv') || f.mime.includes('json'))) ||
          (f.name && /\.(txt|csv|tsv|json)$/i.test(f.name));

        if (isText) {
          try {
            const clean = (f.base64 || "").replace(/^data:[^;]+;base64,/, '');
            const decoded = atob(clean);
            extractedText += `\n${decoded}`;
          } catch {
            // Ignore decode error
          }
        } else if (isPdf) {
          const pdfText = this.extractTextFromPdfBase64(f.base64);
          if (pdfText) extractedText += `\n${pdfText}`;
        }
      }
    }

    if (!extractedText.trim()) {
      throw new Error('No readable text could be extracted from the uploaded file(s). Please paste table text directly in the "Paste Text / OCR" tab.');
    }

    // Run heuristic parser strictly on the user's extracted content
    const parsedResult = parseRosterTextHeuristically(
      extractedText,
      targetYear,
      targetFlight,
      this.db.airmen
    );

    if (!parsedResult.dates || parsedResult.dates.length === 0 || parsedResult.totalAssignmentsCount === 0) {
      throw new Error('Could not identify any duty dates or airman assignments from the provided input. Please verify that your file or text contains dates (e.g. 01 Aug) and duty columns.');
    }

    return {
      ...parsedResult,
      totalPages: Math.max(fileList.length, 1),
      totalFiles: fileList.length,
    };
  }

  // --- LOAD OFFICIAL ROSTER ---
  public loadOfficialRoster(targetYear = 2026, monthChoice: any = 'all'): any {
    const doc = getOfficialParadeStateDocument(targetYear, monthChoice, this.db.airmen);
    let totalAssignmentsCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    const enrichedDates = (doc.dates || []).map((dateEntry: any) => {
      const enrichedAssignments = (dateEntry.assignments || []).map((asn: any) => {
        totalAssignmentsCount++;
        const airman = this.db.airmen.find((a) => a.id === asn.matchedAirmanId);
        if (airman) {
          matchedCount++;
          return {
            ...asn,
            matchedAirmanName: airman.name,
            matchedAirmanRank: airman.rank,
            matchedAirmanTrade: airman.trade,
            matchedAirmanFlight: airman.flightName,
            matchedAirmanBdNo: airman.bdNo,
            confidence: 1.0,
          };
        } else {
          unmatchedCount++;
          return asn;
        }
      });

      return {
        date: dateEntry.date,
        dayName: dateEntry.dayName,
        assignments: enrichedAssignments,
      };
    });

    return {
      ...doc,
      dates: enrichedDates,
      totalAssignmentsCount,
      matchedCount,
      unmatchedCount,
    };
  }

  // --- APPLY DUTY DATA FROM IMPORT ---
  public applyDutyData(assignments: any[], sourceDoc = 'PDF Import'): { appliedCount: number; batchId: string; affectedDates: string[] } {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new Error('No assignments to apply');
    }

    const affectedDates = new Set<string>();
    const importedAssignmentsForBatch: any[] = [];
    const prevAssignmentsForBatch: any[] = [];
    const airmenNamesSet = new Set<string>();
    let appliedCount = 0;

    for (const item of assignments) {
      if (!item.airmanId || !item.date || !item.dutyCode) continue;
      if (item.dutyCode === 'ON_PARADE' || item.dutyCode === 'DUTY_OFF') continue;

      const dateStr = item.date;
      const monthKey = dateStr.slice(0, 7);
      affectedDates.add(dateStr);

      if (!this.db.assignments[monthKey]) {
        this.db.assignments[monthKey] = [];
      }

      const list = this.db.assignments[monthKey];
      const existingIdx = list.findIndex((a) => a.airmanId === item.airmanId && a.date === dateStr);
      const prevItem = existingIdx >= 0 ? { ...list[existingIdx] } : null;

      prevAssignmentsForBatch.push({
        airmanId: item.airmanId,
        date: dateStr,
        dutyCode: prevItem?.dutyCode,
        idaShift: prevItem?.idaShift,
        notes: prevItem?.notes,
      });

      const air = this.db.airmen.find((a) => a.id === item.airmanId);
      const airName = air ? `${air.rank} ${air.name}` : item.airmanId;
      airmenNamesSet.add(airName);

      const dutyAssignment: DutyAssignment = {
        airmanId: item.airmanId,
        date: dateStr,
        dutyCode: item.dutyCode,
        idaShift: item.dutyCode === 'IDAC' ? item.idaShift || 'Morning' : undefined,
        disposalScope: item.disposalScope || 'ALL',
        notes: item.notes && !item.notes.toLowerCase().includes('imported') ? item.notes : '',
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...dutyAssignment };
      } else {
        list.push(dutyAssignment);
      }

      importedAssignmentsForBatch.push({
        airmanId: item.airmanId,
        airmanName: airName,
        airmanRank: air?.rank,
        airmanFlight: air?.flightName,
        date: dateStr,
        dutyCode: item.dutyCode,
        idaShift: dutyAssignment.idaShift,
        notes: dutyAssignment.notes,
      });

      this.recordActivity({
        actionType: item.dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_DUTY',
        airmanId: item.airmanId,
        airmanName: airName,
        dutyCode: item.dutyCode,
        idaShift: dutyAssignment.idaShift,
        fromDate: dateStr,
        toDate: dateStr,
        notes: dutyAssignment.notes,
      });

      appliedCount++;
    }

    if (!this.db.importHistory) {
      this.db.importHistory = [];
    }

    const sortedDates = Array.from(affectedDates).sort();
    const newBatch: ImportHistoryBatch = {
      id: `import-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sourceDoc,
      dutyCount: appliedCount,
      datesCount: affectedDates.size,
      dates: sortedDates,
      airmenNames: Array.from(airmenNamesSet),
      importedAssignments: importedAssignmentsForBatch,
      previousAssignments: prevAssignmentsForBatch,
    };

    this.db.importHistory.unshift(newBatch);
    if (this.db.importHistory.length > 50) {
      // this.db.importHistory = this.db.importHistory.slice(0, 50);
    }

    this.recordActivity({
      actionType: 'IMPORT_PDF_ROSTER',
      airmanId: 'BULK_IMPORT',
      airmanName: `${appliedCount} Duties Imported`,
      dutyCode: 'GD',
      fromDate: sortedDates[0] || '',
      toDate: sortedDates[sortedDates.length - 1] || '',
      notes: `Imported ${appliedCount} active duties across ${affectedDates.size} dates (${sourceDoc})`,
    });

    this.saveToStorage();

    return {
      appliedCount,
      batchId: newBatch.id,
      affectedDates: sortedDates,
    };
  }

  // --- IMPORT HISTORY ACCESS ---
  public getImportHistory(): ImportHistoryBatch[] {
    return this.db.importHistory || [];
  }

  public deleteImportHistory(batchId: string): boolean {
    const idx = (this.db.importHistory || []).findIndex((b) => b.id === batchId);
    if (idx === -1) return false;

    const batch = this.db.importHistory[idx];
    const prevMap = new Map<string, any>();
    (batch.previousAssignments || []).forEach((p) => {
      prevMap.set(`${p.airmanId}_${p.date}`, p);
    });

    for (const item of batch.importedAssignments) {
      const monthKey = item.date.slice(0, 7);
      if (!this.db.assignments[monthKey]) continue;

      const list = this.db.assignments[monthKey];
      const existingIdx = list.findIndex((a) => a.airmanId === item.airmanId && a.date === item.date);
      const prev = prevMap.get(`${item.airmanId}_${item.date}`);

      if (prev && prev.dutyCode && prev.dutyCode !== 'ON_PARADE') {
        const restored: DutyAssignment = {
          airmanId: prev.airmanId,
          date: prev.date,
          dutyCode: prev.dutyCode,
          idaShift: prev.idaShift,
          notes: prev.notes || '',
          updatedAt: new Date().toISOString(),
        };
        if (existingIdx >= 0) list[existingIdx] = restored;
        else list.push(restored);
      } else {
        if (existingIdx >= 0) list.splice(existingIdx, 1);
      }
    }

    this.db.importHistory.splice(idx, 1);
    this.saveToStorage();
    return true;
  }
}

// Global Singleton Instance
export const localDb = new LocalDatabaseEngine();
