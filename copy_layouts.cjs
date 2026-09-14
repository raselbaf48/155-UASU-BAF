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
  .replace(/depDurationDays/g, 'editTdyDurationDays') // use TdyDurationDays or a generic one
  .replace(/handlePresetToggle/g, 'handleEditDepPresetToggle');


// --- INJECT INTO MODAL ---
const targetRegex = /\{editingGroup\[0\]\.dutyCode === 'LEAVE' \? \([\s\S]*?\) : \(/;

const newReplacement = `{editingGroup[0].dutyCode === 'LEAVE' ? (
                        <>
${newLeaveBlock}
                        </>
                      ) : editingGroup[0].dutyCode === 'TDY' ? (
                        <div className="space-y-4">
${newTdyBlock}
                        </div>
                      ) : editingGroup[0].dutyCode === 'ATT' ? (
                        <div className="space-y-4">
${newDepBlock}
                        </div>
                      ) : (`;

modal = modal.replace(targetRegex, newReplacement);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', modal);
console.log('Layouts updated successfully.');
