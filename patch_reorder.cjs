const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// 1. Extract the functions
const matchFn = content.match(/(const getGroupedList = \(list: any\[\]\) => \{[\s\S]*?return count;\s*\};\s*)\n\s*const formatDateRange/);
if (matchFn) {
  const fns = matchFn[1];
  
  // 2. Remove them from their current location
  content = content.replace(fns, '');
  
  // 3. Insert them before the Duty Counts
  content = content.replace(/\/\/ Duty counts/, fns + '\n  // Duty counts');
  
  fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
} else {
  console.log("Could not match the functions");
}
