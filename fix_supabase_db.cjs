const fs = require('fs');

const dbPath = 'src/services/localDatabase.ts';
if (fs.existsSync(dbPath)) {
  let content = fs.readFileSync(dbPath, 'utf8');

  // Insert import at top
  if (!content.includes("import { supabase } from '../supabase';")) {
    content = "import { supabase } from '../supabase';\n" + content;
  }
  
  // Replace syncFromFirebase
  const syncFromFirebaseRegex = /public async syncFromFirebase\(\): Promise<boolean> \{[\s\S]*?\}\n\n  \/\*\*\n   \* Push changes to Firebase Firestore/m;
  const newSyncFromFirebase = `public async syncFromFirebase(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
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
      let staffData, staffErr;
      try {
         staffData = await fetchAll('staff');
      } catch(e) { staffErr = e; }
      if (!staffErr && staffData) {
        const parsedAirmen = staffData.map(s => ({
          id: s.airman_id || 'airman-' + s.bd_no,
          bdNo: s.bd_no,
          rank: s.rank || '',
          name: s.name || '',
          flightName: s.flight_name || '',
          trade: s.trade || '',
          mobileNo: s.phone || '',
          addressBlock: s.address || 'L/O',
          status: s.status || 'ACTIVE',
          dateLeft: s['Unit Left date'] || undefined
        }));
        if (JSON.stringify(parsedAirmen) !== JSON.stringify(this.db.airmen)) {
           newDb.airmen = parsedAirmen;
           dataChanged = true;
        }
      }
      
      // 2. Pull Assignments (Duty Rosters)
      let dutyData, dutyErr;
      try {
         dutyData = await fetchAll('duty_rosters');
      } catch(e) { dutyErr = e; }
      if (!dutyErr && dutyData) {
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
         if (JSON.stringify(newAssignments) !== JSON.stringify(this.db.assignments)) {
            newDb.assignments = newAssignments;
            dataChanged = true;
         }
      }
      
      // 3. Pull Activity History (Parade States)
      let histData, histErr;
      try {
         histData = await fetchAll('parade_states');
      } catch(e) { histErr = e; }
      if (!histErr && histData) {
         const parsedHistory = histData.map(h => ({
            id: h.log_id || 'log-' + Math.random().toString(36).substring(2, 9),
            date: h.date || '',
            type: h.type || 'SYSTEM',
            title: h.title || '',
            description: h.description || '',
            performedByUserId: h.user_id || undefined,
            performedByUserName: h.user_name || undefined,
            timestamp: h.created_at || new Date().toISOString()
         })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
         
         if (JSON.stringify(parsedHistory) !== JSON.stringify(this.db.activityHistory)) {
            newDb.activityHistory = parsedHistory;
            dataChanged = true;
         }
      }
      
      // 4. Pull User Profiles
      let userData, userErr;
      try {
         userData = await fetchAll('user_profiles');
      } catch(e) { userErr = e; }
      if (!userErr && userData && userData.length > 0) {
         // Create a map to merge with local detailedUsers or override
         const parsedUsers = userData.map(u => ({
            id: u.id || 'user-' + u.bd_no,
            airmanId: u.airman_id || undefined,
            bdNo: u.bd_no || '',
            name: u.name || String(u.bdNo),
            rank: u.rank || '',
            flightName: u.flight_name || '',
            trade: u.trade || '',
            role: u.role || 'USER',
            status: u.status || 'ACTIVE',
            password: u['User Login PIN']?.toString() || u.password || String(u.bd_no),
            adminPass: u['Admin Login PIN']?.toString() || u.adminPass || '',
            detailedAt: new Date().toISOString(),
            detailedBy: 'System'
         }));
         newDb.detailedUsers = parsedUsers;
         dataChanged = true;
      }
      
      if (dataChanged) {
        newDb.lastUpdated = new Date().toISOString();
        this.db = newDb;
        this.saveToStorage(newDb, true, false, false);
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
   * Push changes to Firebase Firestore`;
  
  if (!content.includes("Supabase data is up to date.")) {
    content = content.replace(syncFromFirebaseRegex, newSyncFromFirebase);
  }

  // Replace saveToFirebase
  const saveToFirebaseRegex = /public async saveToFirebase\(dbToSave: LocalStorageDB, immediate = false\): Promise<boolean> \{[\s\S]*?\}\n\n  private loadInitialLocalState\(\): LocalStorageDB \{/m;
  const newSaveToFirebase = `public async saveToFirebase(dbToSave: LocalStorageDB, immediate = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
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
        
        console.log(\`Uploading changes: \${changedAirmen.length} airmen, \${changedAssignments.length} duties, \${changedHistory.length} history, \${changedUsers.length} users\`);

        emitSyncProgress(0, "Preparing data...");
        addSyncLog({ timestamp: new Date().toISOString(), type: "PUSH", status: "SUCCESS", message: "Syncing data to Supabase..." });
        
        // 1. Sync Airmen (Staff)
        if (changedAirmen.length > 0) {
          let staffPayload = changedAirmen.map(a => ({
            airman_id: a.id,
            bd_no: a.bdNo,
            rank: a.rank,
            name: a.name,
            flight_name: a.flightName,
            trade: a.trade || null,
            phone: a.mobileNo || null,
            address: a.addressBlock || null,
            status: (a as any).status || 'ACTIVE',
            'Unit Left date': a.dateLeft || null
          }));
          // Deduplicate
          const uniqueStaffMap = new Map();
          staffPayload.forEach(a => uniqueStaffMap.set(a.airman_id, a));
          staffPayload = Array.from(uniqueStaffMap.values());
          
          const staffChunkSize = 50;
          for (let i = 0; i < staffPayload.length; i += staffChunkSize) {
             const chunk = staffPayload.slice(i, i + staffChunkSize);
             emitSyncProgress(Math.round((i / staffPayload.length) * 30), \`Uploading staff \${i} of \${staffPayload.length}...\`);
             const { data: staffDataRes, error: staffErr } = await supabase.from('staff').upsert(chunk, { onConflict: 'airman_id' }).select();
             if (!staffErr && (!staffDataRes || staffDataRes.length === 0) && chunk.length > 0) { console.error('Staff upsert blocked by RLS'); hasError = true; errorMessage = 'Row Level Security (RLS) is blocking the Staff upload in Supabase. Please disable RLS or add policies.'; break; }
             await delay(100);
             if (staffErr) {
               console.error("Error syncing staff to Supabase:", staffErr);
               hasError = true;
               errorMessage = staffErr.message || 'Staff error';
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
            emitSyncProgress(30 + Math.round((i / deduplicatedAssignments.length) * 40), \`Uploading duties \${i} of \${deduplicatedAssignments.length}...\`);
            const { data: assignDataRes, error: assignErr } = await supabase.from('duty_rosters').upsert(chunk, { onConflict: 'assignment_id' }).select();
            if (!assignErr && (!assignDataRes || assignDataRes.length === 0) && chunk.length > 0) { console.error('Duty upsert blocked by RLS'); hasError = true; errorMessage = 'Row Level Security (RLS) is blocking the Duty upload in Supabase. Please disable RLS or add policies.'; break; }
            await delay(100);
            
            if (assignErr) {
               console.error("Error syncing duties to Supabase:", assignErr);
               hasError = true;
               errorMessage = assignErr.message || 'Duties error';
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
              emitSyncProgress(70 + Math.round((i / historyPayload.length) * 20), \`Uploading history \${i} of \${historyPayload.length}...\`);
              const { data: histDataRes, error: histErr } = await supabase.from('parade_states').insert(chunk).select();
              if (!histErr && (!histDataRes || histDataRes.length === 0) && chunk.length > 0) { console.error('History insert blocked by RLS'); hasError = true; errorMessage = 'Row Level Security (RLS) is blocking the History upload in Supabase. Please disable RLS or add policies.'; break; }
              await delay(100);
              
              if (histErr && histErr.code === '23505') {
                 console.log("History chunk contains existing records, skipping duplicate error");
              } else if (histErr && histErr.code !== '23505') {
                 console.error("Error syncing history to Supabase:", histErr);
                 hasError = true;
                 errorMessage = histErr.message || 'History error';
                 break;
              }
           }
        }

        // 4. Sync User Profiles
        if (changedUsers.length > 0) {
           let usersPayload = changedUsers.filter(u => u && u.bdNo).map((u: any) => ({
              airman_id: u.airmanId || null,
              bd_no: u.bdNo,
              rank: u.rank || '',
              name: u.name || '',
              flight_name: u.flightName || '',
              trade: u.trade || '',
              role: u.role || 'USER',
              'User Login PIN': (u.password && String(u.password).trim() !== '') ? Number(u.password) : null,
              'Admin Login PIN': (u.adminPass && String(u.adminPass).trim() !== '') ? Number(u.adminPass) : null
           }));
           
           // Deduplicate
           const uniqueUsersMap = new Map();
           usersPayload.forEach(a => uniqueUsersMap.set(a.bd_no, a));
           usersPayload = Array.from(uniqueUsersMap.values());
           
           const usersChunkSize = 50;
           for (let i = 0; i < usersPayload.length; i += usersChunkSize) {
              const chunk = usersPayload.slice(i, i + usersChunkSize);
              emitSyncProgress(90 + Math.round((i / usersPayload.length) * 10), \`Uploading users \${i} of \${usersPayload.length}...\`);
              const { data: usersDataRes, error: usersErr } = await supabase.from('user_profiles').upsert(chunk, { onConflict: 'bd_no' }).select();
              await delay(100);
              
              if (!usersErr && (!usersDataRes || usersDataRes.length === 0) && chunk.length > 0) {
                 console.error('User profiles upsert blocked by RLS');
                 hasError = true;
                 errorMessage = 'Row Level Security (RLS) is blocking the User Profiles upload in Supabase. Please disable RLS or add policies.';
                 break;
              } else if (usersErr) {
                 console.error("Error syncing users to Supabase:", usersErr);
                 hasError = true;
                 errorMessage = usersErr.message || 'Users error';
                 break;
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

  private loadInitialLocalState(): LocalStorageDB {`;
  
  if (!content.includes("Supabase Save Error:")) {
    content = content.replace(saveToFirebaseRegex, newSaveToFirebase);
  }

  fs.writeFileSync(dbPath, content);
}
