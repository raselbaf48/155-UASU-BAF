const fs = require('fs');
let code = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const syncFromRegex = /public async syncFromFirebase\(\): Promise<boolean> \{[\s\S]*?\}\n\n  \/\*\*\n   \* Push changes to Firebase Firestore/m;
const syncFromNew = `public async syncFromFirebase(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.isFirebaseSyncing) return false;
    
    this.isFirebaseSyncing = true;
    addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "SUCCESS", message: "Fetching data from Firebase..." });
    
    try {
      const { getDbFromFirebase } = await import('../firebase');
      const data = await getDbFromFirebase();
      if (data) {
         let dataChanged = false;
         const newDb = { ...this.db };
         
         if (data.airmen && JSON.stringify(data.airmen) !== JSON.stringify(this.db.airmen)) {
            newDb.airmen = data.airmen;
            dataChanged = true;
         }
         
         if (data.assignments && JSON.stringify(data.assignments) !== JSON.stringify(this.db.assignments)) {
            newDb.assignments = data.assignments;
            dataChanged = true;
         }
         
         if (data.activityHistory && JSON.stringify(data.activityHistory) !== JSON.stringify(this.db.activityHistory)) {
            newDb.activityHistory = data.activityHistory;
            dataChanged = true;
         }
         
         if (data.detailedUsers && JSON.stringify(data.detailedUsers) !== JSON.stringify(this.db.detailedUsers)) {
            newDb.detailedUsers = data.detailedUsers;
            dataChanged = true;
         }
         
         if (dataChanged) {
            newDb.lastUpdated = new Date().toISOString();
            this.db = newDb;
            this.saveToStorage(newDb, true, false, false);
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newDb));
            }
            window.dispatchEvent(new CustomEvent('baf_db_updated', { detail: { source: 'firebase' } }));
            addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "SUCCESS", message: "Data synced from Firebase successfully." });
         } else {
            addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "SUCCESS", message: "Firebase data is up to date." });
         }
      }
      return true;
    } catch (err: any) {
      console.error("Firebase Pull Error:", err);
      addSyncLog({ timestamp: new Date().toISOString(), type: "PULL", status: "ERROR", message: "Failed to pull from Firebase." });
      return false;
    } finally {
      this.isFirebaseSyncing = false;
    }
  }

  /**
   * Push changes to Firebase Firestore`;

code = code.replace(syncFromRegex, syncFromNew);


const saveToRegex = /public async saveToFirebase\(dbToSave: LocalStorageDB, immediate = false\): Promise<boolean> \{[\s\S]*?\}\n\n  private loadInitialLocalState\(\): LocalStorageDB \{/m;
const saveToNew = `public async saveToFirebase(dbToSave: LocalStorageDB, immediate = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    if (this.isFirebaseSyncing) {
       console.warn('Prevented saveToFirebase because a pull sync is currently in progress.');
       return false;
    }
    
    const doSave = async (): Promise<boolean> => {
      if (this.isPushing) return false;
      this.isPushing = true;
      try {
        addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "SUCCESS", message: "Syncing data to Firebase..." });
        
        const { saveDbToFirebase } = await import('../firebase');
        const result = await saveDbToFirebase(dbToSave);
        
        if (result === 'QUOTA_EXCEEDED') {
           emitSyncProgress(0, "Sync Failed (Quota)");
           return false;
        } else if (result !== true) {
           emitSyncProgress(0, "Sync Failed!");
           addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "ERROR", message: "Sync Failed: " + result });
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
        console.error("Firebase Save Error:", err);
        addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "ERROR", message: "Failed to push to Firebase." });
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

  private loadInitialLocalState(): LocalStorageDB {`;

code = code.replace(saveToRegex, saveToNew);
code = code.replace(/import \{ supabase \} from '\.\.\/supabase';\n/, '');

fs.writeFileSync('src/services/localDatabase.ts', code);
