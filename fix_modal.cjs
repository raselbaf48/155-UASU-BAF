const fs = require('fs');
let code = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

code = code.replace(/DUTY_TYPE_MAP\[first\.dutyCode\]\?\.label/, "DUTY_TYPE_MAP.get(first.dutyCode)?.name");
code = code.replace(/DUTY_TYPE_MAP\[initialCategory as any\]\?\.name/, "DUTY_TYPE_MAP.get(initialCategory as any)?.name");
code = code.replace(/DUTY_TYPE_MAP\[item\.dutyCode\]/, "DUTY_TYPE_MAP.get(item.dutyCode)");

fs.writeFileSync('src/components/AirmanProfileModal.tsx', code);
