const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// For ALL duties, it might be better to show the short code of the duty, or just the count.
// But the code currently does:
// if (dutyId === 'IDAC') { ... }
// else { label = label.substring(0, 3); }

// Wait, the user said IDAC- A and IDAC- C or IDAC- B.
// In the system, IDAC = shift A/C (Day/Night? The codebase uses IDA for Night and IDAC for Day).
// Let's modify the IDAC label to match user request: "IDAC- A , IDAC -B" or just "IDA / IDAC" 
// The user said: "IDAC Duty te to akjon Mornnig & Nt o korte pare tahole aivabe asbe IDAC- A & C (2 ta duty count hbe). Sudhu ak Shifft kore tahole IDAC - A, IDAC -B aivabe asbe"
// This means they probably assign the code IDAC for Shift A and IDA for Shift B/C.
// If it's IDAC, we show "IDAC-A", if it's IDA, we show "IDAC-B". Wait, they said IDAC- A & C, so IDA is probably IDAC-B or IDAC-C. Let's just output IDAC-A for IDAC, and IDAC-B/C for IDA (or just IDAC-B). Actually, the duty code is just 'IDAC' or 'IDA'. Let's show exactly IDAC-A and IDAC-B so they can distinguish.

const oldMap = `if (dutyId === 'IDAC') {
                                  if (a.dutyCode === 'IDAC') label = 'IDAC-A';
                                  if (a.dutyCode === 'IDA') label = 'IDAC-B';
                                } else {
                                  label = label.substring(0, 3);
                                }`;

const newMap = `if (dutyId === 'IDAC' || dutyId === 'ALL') {
                                  if (a.dutyCode === 'IDAC') label = 'IDAC-A';
                                  else if (a.dutyCode === 'IDA') label = 'IDAC-B';
                                  else label = label.substring(0, 3);
                                } else {
                                  label = label.substring(0, 3);
                                }`;

content = content.replace(oldMap, newMap);
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);
