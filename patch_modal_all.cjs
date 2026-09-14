const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// 1. Add refreshKey state and effect
const refreshLogic = `
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [refreshKey, setRefreshKey] = useState<number>(0);
  useEffect(() => {
    const handleUpdate = () => setRefreshKey(k => k + 1);
    window.addEventListener('baf_roster_updated', handleUpdate);
    return () => window.removeEventListener('baf_roster_updated', handleUpdate);
  }, []);
`;
content = content.replace(/const \[errorMsg, setErrorMsg\] = useState<string>\(''\);/, refreshLogic.trim());

// 2. Add dependencies to fetchHistory
content = content.replace(/fetchHistory\(\);\s*\}, \[airman.id, fromDate, toDate\]\);/, 'fetchHistory();\n  }, [airman.id, fromDate, toDate, refreshKey]);');

// 3. Add state variables for Leave and Deployment
const stateVars = `
  const [editTdyDestination, setEditTdyDestination] = useState<string>('');
  const [editTdyCustomDestination, setEditTdyCustomDestination] = useState<string>('');
  const [editTdyRemarks, setEditTdyRemarks] = useState<string>('');

  const [editLeaveType, setEditLeaveType] = useState<string>('Casual');

  const [editDepLocation, setEditDepLocation] = useState<string>('');
  const [editDepCustomLocation, setEditDepCustomLocation] = useState<string>('');
  const [editDepRemarks, setEditDepRemarks] = useState<string>('');

  const presetDeployLocations = ['Canteen', 'Bake & Bite'];
`;
content = content.replace(/const \[editTdyDestination, setEditTdyDestination\].*?setEditTdyRemarks\] = useState<string>\(''\);/s, stateVars.trim());

// 4. Update handleGroupClick
const groupClickLogic = `
  const handleGroupClick = (group: DutyAssignment[]) => {
    setEditingGroup(group);
    setEditFromDate(group[0].date);
    setEditToDate(group[group.length - 1].date);
    const rawNotes = group[0].notes || '';
    setEditNotes(rawNotes);

    if (group[0].dutyCode === 'TDY') {
        let dest = 'Custom';
        let customDest = rawNotes;
        let rem = '';
        let matched = false;
        for (const loc of presetLocations) {
            if (rawNotes.startsWith(loc)) {
                dest = loc;
                customDest = '';
                const remainder = rawNotes.substring(loc.length).trim();
                rem = remainder.startsWith('-') ? remainder.substring(1).trim() : remainder;
                matched = true;
                break;
            }
        }
        if (!matched && rawNotes.includes('-')) {
           const parts = rawNotes.split('-');
           customDest = parts[0].trim();
           rem = parts.slice(1).join('-').trim();
        }
        setEditTdyDestination(dest);
        setEditTdyCustomDestination(customDest);
        setEditTdyRemarks(rem);
    } else if (group[0].dutyCode === 'LEAVE') {
        let type = 'Casual';
        if (rawNotes.includes('Annual')) type = 'Annual';
        else if (rawNotes.includes('Sick')) type = 'Sick';
        else if (rawNotes.includes('Recreation')) type = 'Recreation';
        setEditLeaveType(type);
    } else if (group[0].dutyCode === 'DEPLOYMENT') {
        let dest = 'Custom';
        let customDest = rawNotes;
        let rem = '';
        let matched = false;
        for (const loc of presetDeployLocations) {
            if (rawNotes.startsWith(loc)) {
                dest = loc;
                customDest = '';
                const remainder = rawNotes.substring(loc.length).trim();
                rem = remainder.startsWith('-') ? remainder.substring(1).trim() : remainder;
                matched = true;
                break;
            }
        }
        if (!matched && rawNotes.includes('-')) {
           const parts = rawNotes.split('-');
           customDest = parts[0].trim();
           rem = parts.slice(1).join('-').trim();
        }
        setEditDepLocation(dest);
        setEditDepCustomLocation(customDest);
        setEditDepRemarks(rem);
    }
    
    setErrorMsg('');
  };
`;
content = content.replace(/const handleGroupClick = \(group: DutyAssignment\[\]\) => \{[\s\S]*?setErrorMsg\(''\);\s*\};/, groupClickLogic.trim());

// 5. Update handleSaveEdit
const saveEditLogic = `
  const handleSaveEdit = async () => {
    if (!editingGroup) return;
    
    let finalNotes = editNotes;
    if (editingGroup[0].dutyCode === 'TDY') {
        const destToUse = editTdyDestination === 'Custom' ? editTdyCustomDestination : editTdyDestination;
        if (!destToUse) {
            setErrorMsg('Please select or enter a destination.');
            return;
        }
        finalNotes = editTdyRemarks.trim() ? \`\${destToUse} - \${editTdyRemarks.trim()}\` : destToUse;
    } else if (editingGroup[0].dutyCode === 'LEAVE') {
        // Keep user typed notes if they modified it manually, otherwise reconstruct
        const fullTypeName = editLeaveType === 'Casual' ? 'Casual Leave' : editLeaveType === 'Annual' ? 'Annual Leave' : editLeaveType === 'Sick' ? 'Sick Leave' : editLeaveType === 'Recreation' ? 'Recreation Leave' : 'Leave';
        if (editNotes && !editNotes.includes(fullTypeName) && editNotes !== 'Leave' && editNotes !== 'Casual Leave' && editNotes !== 'Annual Leave' && editNotes !== 'Recreation Leave' && editNotes !== 'Sick Leave') {
             finalNotes = editNotes; // Keep custom notes if modified heavily
        } else {
             // For simple leave edit, just use the selected type if editNotes matches an old type
             finalNotes = fullTypeName;
             if (editNotes.includes('F-295')) {
                 const match = editNotes.match(/\\(F-295.*?\\)/);
                 if (match) finalNotes += \` \${match[0]}\`;
             }
        }
    } else if (editingGroup[0].dutyCode === 'DEPLOYMENT') {
        const destToUse = editDepLocation === 'Custom' ? editDepCustomLocation : editDepLocation;
        if (!destToUse) {
            setErrorMsg('Please select or enter a deployment location.');
            return;
        }
        finalNotes = editDepRemarks.trim() ? \`\${destToUse} - \${editDepRemarks.trim()}\` : destToUse;
    }
`;
content = content.replace(/const handleSaveEdit = async \(\) => \{[\s\S]*?finalNotes = editTdyRemarks\.trim\(\) \? `\$\{destToUse\} - \$\{editTdyRemarks\.trim\(\)\}` : destToUse;\s*\}/, saveEditLogic.trim());

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

