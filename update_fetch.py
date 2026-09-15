import re

with open('src/services/localDatabase.ts', 'r') as f:
    content = f.read()

bad_block = """                 if (existingDuty) {
                     if (existingDuty.serNo !== undefined) duty.serNo = existingDuty.serNo;
                     if (existingDuty.title !== undefined) duty.title = existingDuty.title;
                     if (existingDuty.eligibleFlights !== undefined) duty.eligibleFlights = existingDuty.eligibleFlights;
                     if (existingDuty.eligibleRanks !== undefined) duty.eligibleRanks = existingDuty.eligibleRanks;
                 }
                 return duty;"""

good_block = """                 if (existingDuty) {
                     // Preserve all local fields that are not explicitly updated from cloud
                     Object.keys(existingDuty).forEach(key => {
                         if (duty[key] === undefined) {
                             duty[key] = existingDuty[key];
                         }
                     });
                     if (existingDuty.serNo !== undefined) duty.serNo = existingDuty.serNo;
                     if (existingDuty.title !== undefined) duty.title = existingDuty.title;
                     if (existingDuty.eligibleFlights !== undefined) duty.eligibleFlights = existingDuty.eligibleFlights;
                     if (existingDuty.eligibleRanks !== undefined) duty.eligibleRanks = existingDuty.eligibleRanks;
                     if (existingDuty.flightTargets !== undefined) duty.flightTargets = existingDuty.flightTargets;
                     if (existingDuty.dutyCode !== undefined) duty.dutyCode = existingDuty.dutyCode;
                 }
                 return duty;"""

content = content.replace(bad_block, good_block)

with open('src/services/localDatabase.ts', 'w') as f:
    f.write(content)
