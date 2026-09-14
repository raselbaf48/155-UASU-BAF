const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const oldLogic = `                                if (dutyId === 'IDAC' || dutyId === 'ALL') {
                                  if (a.dutyCode === 'IDAC') label = 'IDAC-A';
                                  else if (a.dutyCode === 'IDA') label = 'IDAC-B';
                                  else label = label.substring(0, 3);
                                } else {
                                  label = label.substring(0, 3);
                                }`;

const newLogic = `                                if (dutyId === 'IDAC' || dutyId === 'ALL') {
                                  if (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') {
                                    if (a.idaShift === 'Morning') label = 'IDAC-A';
                                    else if (a.idaShift === 'Afternoon') label = 'IDAC-B';
                                    else if (a.idaShift === 'Night') label = 'IDAC-C';
                                    else label = 'IDAC-A'; // Default fallback
                                  } else {
                                    label = label.substring(0, 3);
                                  }
                                } else {
                                  label = label.substring(0, 3);
                                }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);
