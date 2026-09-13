const fs = require('fs');

const path = 'src/components/SettingsModal.tsx';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  
  if (!content.includes("import Papa from 'papaparse';")) {
    content = "import Papa from 'papaparse';\n" + content;
  }
  
  // Add handleDownloadCSV
  const targetFn = "  const handleDownloadBackup = async () => {";
  const csvFn = `  const handleDownloadCSV = async () => {
    setIsBackingUp(true);
    try {
      const backupData = typeof localDb.exportDatabase === 'function' 
        ? JSON.parse(localDb.exportDatabase()) 
        : (localDb as any).db;

      const downloadFile = (csvString: string, filename: string) => {
         const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = filename;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
      };

      // Export Airmen
      if (backupData.airmen && backupData.airmen.length > 0) {
         downloadFile(Papa.unparse(backupData.airmen), \`155_UASU_Airmen_\${new Date().toISOString().split('T')[0]}.csv\`);
      }
      
      // Export Users
      const usersToExport = backupData.detailedUsers || (localDb as any).db.detailedUsers;
      if (usersToExport && usersToExport.length > 0) {
         downloadFile(Papa.unparse(usersToExport), \`155_UASU_Users_\${new Date().toISOString().split('T')[0]}.csv\`);
      }

      // Export Assignments
      const allAssignments: any[] = [];
      const assignmentsObj = backupData.assignments || (localDb as any).db.assignments || {};
      for (const month in assignmentsObj) {
         assignmentsObj[month].forEach((a: any) => allAssignments.push({ month, ...a }));
      }
      if (allAssignments.length > 0) {
         downloadFile(Papa.unparse(allAssignments), \`155_UASU_Assignments_\${new Date().toISOString().split('T')[0]}.csv\`);
      }
      
    } catch (err: any) {
      console.error('CSV Backup failed:', err);
      alert('Failed to generate CSV backup: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

`;
  if (!content.includes('const handleDownloadCSV')) {
    content = content.replace(targetFn, csvFn + targetFn);
  }
  
  // Modify restore handler to support CSV
  const restoreTarget = `      try {
        let rawText = event.target?.result as string;
        
        // Clean up markdown code blocks if any`;
        
  const restoreReplace = `      try {
        let rawText = event.target?.result as string;
        
        if (file.name.toLowerCase().endsWith('.csv')) {
           setRestoreStatus('Importing CSV...');
           Papa.parse(rawText, {
             header: true,
             skipEmptyLines: true,
             complete: async (results) => {
                let backupData: any = { database: {} };
                const data = results.data as any[];
                const fields = results.meta.fields || [];
                
                if (fields.includes('bdNo') && fields.includes('rank') && fields.includes('name')) {
                   if (fields.includes('role') && fields.includes('password')) {
                      backupData.database.detailedUsers = data;
                   } else {
                      const parsedAirmen = data.map((d: any) => ({
                         ...d,
                         active: d.active === 'true' || d.active === 'TRUE' || d.active === true,
                         serNo: Number(d.serNo) || 0
                      }));
                      backupData.database.airmen = parsedAirmen;
                   }
                } else if (fields.includes('airmanId') && fields.includes('dutyCode')) {
                   const assignmentsObj: any = {};
                   data.forEach((d: any) => {
                      const month = d.month || d.date.substring(0, 7);
                      if (!assignmentsObj[month]) assignmentsObj[month] = [];
                      assignmentsObj[month].push(d);
                   });
                   backupData.database.assignments = assignmentsObj;
                } else {
                   setRestoreStatus('❌ Unknown CSV format. Cannot identify data table.');
                   return;
                }
                
                const success = await localDb.restoreDatabase(backupData);
                if (success) {
                  setRestoreStatus(\`✅ CSV Restore complete! Please refresh the page to apply changes.\`);
                  if (onRosterUpdated) onRosterUpdated();
                } else {
                  setRestoreStatus('❌ CSV Restore failed.');
                }
             }
           });
           return;
        }

        // Clean up markdown code blocks if any`;
        
  if (!content.includes('if (file.name.toLowerCase().endsWith(\'.csv\'))')) {
    content = content.replace(restoreTarget, restoreReplace);
  }
  
  // Add the UI buttons
  // Find where the download button is
  const dlButtonTarget = `                  <button
                    onClick={handleDownloadBackup}
                    disabled={isBackingUp}
                    className="w-full py-3 text-sm font-bold text-slate-800 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                  >
                    {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download JSON Backup
                  </button>`;
                  
  const dlButtonReplace = `                  <button
                    onClick={handleDownloadBackup}
                    disabled={isBackingUp}
                    className="w-full py-3 text-sm font-bold text-slate-800 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                  >
                    {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download JSON Backup
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    disabled={isBackingUp}
                    className="w-full py-3 text-sm font-bold text-slate-800 bg-emerald-400 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer mt-2"
                  >
                    {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download CSV Backup
                  </button>`;
                  
  if (!content.includes('Download CSV Backup')) {
    content = content.replace(dlButtonTarget, dlButtonReplace);
  }
  
  // Update Upload input to accept CSV
  const uploadInputTarget = `                    type="file"
                    accept=".json"`;
                    
  const uploadInputReplace = `                    type="file"
                    accept=".json,.csv"`;
                    
  content = content.replace(uploadInputTarget, uploadInputReplace);
  
  const uploadLabelTarget = `Upload a JSON backup file.`;
  const uploadLabelReplace = `Upload a JSON or CSV backup file.`;
  content = content.replace(uploadLabelTarget, uploadLabelReplace);

  const uploadBtnTarget = `Upload JSON Backup`;
  const uploadBtnReplace = `Upload Backup (JSON/CSV)`;
  content = content.replace(uploadBtnTarget, uploadBtnReplace);
  
  fs.writeFileSync(path, content);
}
