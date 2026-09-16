const fs = require('fs');
let code = fs.readFileSync('src/components/IdaCenterDutyView.tsx', 'utf8');

const oldLogic = `          // Total slots calculation
          const totalSlots = Math.max(requiredFlights.length, detailedAirmen.length, sh === 'Night' ? 2 : 1);
          const slots: IdaScheduleSlot[] = [];

          for (let sIdx = 0; sIdx < totalSlots; sIdx++) {
            if (detailedAirmen[sIdx]) {
              slots.push({
                slotId: \`\${dStr}-\${sh}-slot-\${sIdx}\`,
                airman: detailedAirmen[sIdx],
              });
            } else {
              const fallback =
                requiredFlights[sIdx] ||
                (sh === 'Night' ? (sIdx === 0 ? 'Mechanics' : 'Avionics') : 'Avionics');
              slots.push({
                slotId: \`\${dStr}-\${sh}-slot-\${sIdx}\`,
                fallbackFlight: fallback,
              });
            }
          }`;

const newLogic = `          // Match detailedAirmen to requiredFlights to find remaining unfulfilled flights
          const unfulfilledFlights = [...requiredFlights];
          detailedAirmen.forEach(a => {
              const idx = unfulfilledFlights.indexOf(a.flightName);
              if (idx !== -1) {
                  unfulfilledFlights.splice(idx, 1);
              } else if (unfulfilledFlights.length > 0) {
                  // If their specific flight isn't required but they are on duty, they consume a slot anyway
                  unfulfilledFlights.splice(0, 1);
              }
          });

          // Total slots calculation
          const totalSlots = Math.max(requiredFlights.length, detailedAirmen.length, sh === 'Night' ? 2 : 1);
          const slots: IdaScheduleSlot[] = [];

          for (let sIdx = 0; sIdx < totalSlots; sIdx++) {
            if (detailedAirmen[sIdx]) {
              slots.push({
                slotId: \`\${dStr}-\${sh}-slot-\${sIdx}\`,
                airman: detailedAirmen[sIdx],
              });
            } else {
              let fallback = unfulfilledFlights.shift();
              if (!fallback) {
                 fallback = (sh === 'Night' ? (sIdx === 0 ? 'Mechanics' : 'Avionics') : 'Avionics');
              }
              slots.push({
                slotId: \`\${dStr}-\${sh}-slot-\${sIdx}\`,
                fallbackFlight: fallback,
              });
            }
          }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/IdaCenterDutyView.tsx', code);
