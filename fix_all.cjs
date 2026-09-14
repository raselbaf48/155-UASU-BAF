const fs = require('fs');

const leaveTab = fs.readFileSync('src/components/AssignLeaveTab.tsx', 'utf8');
const tdyTab = fs.readFileSync('src/components/AssignTdyTab.tsx', 'utf8');
const depTab = fs.readFileSync('src/components/AssignDeploymentTab.tsx', 'utf8');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// --- EXTRACT LEAVE BLOCK ---
const leaveBlockRegex = /\{\/\*\s*Date Range\s*\*\/\}([\s\S]*?)\{\/\*\s*Modal Buttons\s*\*\/\}/;
let newLeaveBlock = leaveTab.match(leaveBlockRegex)[1];
newLeaveBlock = newLeaveBlock
  .replace(/leaveFromDate/g, 'editFromDate')
  .replace(/setLeaveFromDate/g, 'setEditFromDate')
  .replace(/leaveToDate/g, 'editToDate')
  .replace(/setLeaveToDate/g, 'setEditToDate')
  .replace(/selectedPresetDays/g, 'editSelectedPresetDays')
  .replace(/setSelectedPresetDays/g, 'setEditSelectedPresetDays')
  .replace(/isCustomPresetActive/g, 'editIsCustomPresetActive')
  .replace(/setIsCustomPresetActive/g, 'setEditIsCustomPresetActive')
  .replace(/customLeaveDays/g, 'editCustomLeaveDays')
  .replace(/handleCustomLeaveDaysChange/g, 'handleEditCustomLeaveDaysChange')
  .replace(/includeF295/g, 'editIncludeF295')
  .replace(/handleF295Toggle/g, 'setEditIncludeF295')
  .replace(/f295Option/g, 'editF295Option')
  .replace(/handleF295OptionChange/g, 'handleEditF295OptionChange')
  .replace(/f295CustomDays/g, 'editF295CustomDays')
  .replace(/setF295CustomDays/g, 'setEditF295CustomDays')
  .replace(/leaveType/g, 'editLeaveType')
  .replace(/setLeaveType/g, 'setEditLeaveType')
  .replace(/leaveDurationDays/g, 'editLeaveDurationDays')
  .replace(/modalDaysCalc/g, 'editModalDaysCalc') 
  .replace(/daysCalc/g, 'editModalDaysCalc')
  .replace(/handlePresetToggle/g, 'handleEditPresetToggle');

// --- EXTRACT TDY BLOCK ---
const tdyBlockRegex = /\{\/\*\s*Destination\s*\*\/\}([\s\S]*?)\{\/\*\s*Modal Buttons\s*\*\/\}/;
let newTdyBlock = tdyTab.match(tdyBlockRegex)[1];
newTdyBlock = newTdyBlock
  .replace(/tdyFromDate/g, 'editFromDate')
  .replace(/setTdyFromDate/g, 'setEditFromDate')
  .replace(/tdyToDate/g, 'editToDate')
  .replace(/setTdyToDate/g, 'setEditToDate')
  .replace(/tdyDestination/g, 'editTdyDestination')
  .replace(/setTdyDestination/g, 'setEditTdyDestination')
  .replace(/tdyCustomDestination/g, 'editTdyCustomDestination')
  .replace(/setTdyCustomDestination/g, 'setEditTdyCustomDestination')
  .replace(/selectedPresetDays/g, 'editTdyPresetDays')
  .replace(/setSelectedPresetDays/g, 'setEditTdyPresetDays')
  .replace(/tdyDurationDays/g, 'editTdyDurationDays')
  .replace(/handlePresetToggle/g, 'handleEditTdyPresetToggle');

// --- EXTRACT DEP BLOCK ---
const depBlockRegex = /\{\/\*\s*Destination\s*\*\/\}([\s\S]*?)\{\/\*\s*Modal Buttons\s*\*\/\}/;
let newDepBlock = depTab.match(depBlockRegex)[1];
newDepBlock = newDepBlock
  .replace(/depFromDate/g, 'editFromDate')
  .replace(/setDepFromDate/g, 'setEditFromDate')
  .replace(/depToDate/g, 'editToDate')
  .replace(/setDepToDate/g, 'setEditToDate')
  .replace(/depDestination/g, 'editDepLocation')
  .replace(/setDepDestination/g, 'setEditDepLocation')
  .replace(/depCustomDestination/g, 'editDepCustomLocation')
  .replace(/setDepCustomDestination/g, 'setEditDepCustomLocation')
  .replace(/selectedPresetDays/g, 'editDepPresetDays')
  .replace(/setSelectedPresetDays/g, 'setEditDepPresetDays')
  .replace(/depDurationDays/g, 'editTdyDurationDays') 
  .replace(/handlePresetToggle/g, 'handleEditDepPresetToggle');


// Construct the FULL logic block
const fullReplacement = `{editingGroup[0].dutyCode === 'LEAVE' ? (
                        <div className="space-y-4">
${newLeaveBlock}
                        </div>
                      ) : editingGroup[0].dutyCode === 'TDY' ? (
                        <div className="space-y-4">
${newTdyBlock}
                        </div>
                      ) : editingGroup[0].dutyCode === 'ATT' ? (
                        <div className="space-y-4">
${newDepBlock}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">From Date</label>
                              <DateNavigator
                                value={editFromDate}
                                onChange={(e) => setEditFromDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">To Date</label>
                              <DateNavigator
                                value={editToDate}
                                onChange={(e) => setEditToDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Extra Details</label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Remarks or details..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                            />
                          </div>
                        </div>
                      )}`;

// Split the file and replace
const startMarker = "{editingGroup[0].dutyCode === 'LEAVE' ? (";
const endMarker = '<div className="flex items-center gap-3 pt-2">';

const startIndex = modal.indexOf(startMarker);
const endIndex = modal.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const before = modal.substring(0, startIndex);
    
    // We want to skip past the `)}` that precedes the endMarker.
    const between = modal.substring(startIndex, endIndex);
    const lastBraceIndex = between.lastIndexOf(')}');
    
    // Safety check in case it's formatted differently
    const after = modal.substring(endIndex - (between.length - lastBraceIndex - 2));

    const newModal = before + fullReplacement + '\n                      ' + after;
    fs.writeFileSync('src/components/AirmanProfileModal.tsx', newModal);
    console.log('Fixed successfully!');
} else {
    console.log('Markers not found!');
}
