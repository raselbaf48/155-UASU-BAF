const fs = require('fs');

const path = 'src/services/localDatabase.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  
  const restoreRegex = /public restoreDatabase\(uploadedData: any\): boolean \{[\s\S]*?return false;\s*\}/m;
  const newRestore = `public restoreDatabase(uploadedData: any): boolean {
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
  }`;

  content = content.replace(restoreRegex, newRestore);
  fs.writeFileSync(path, content);
}
