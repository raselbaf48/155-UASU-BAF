import re

with open('src/services/localDatabase.ts', 'r') as f:
    content = f.read()

bad_block = """             const currentRaw = window.localStorage.getItem('baf_official_duty_matrix_v4');
             const currentMatrix: any[] = currentRaw ? JSON.parse(currentRaw) : [];
             const formattedMatrix = Array.from(dutyMap.values()).map(duty => {
                 let total = 0;
                 ['Mechanics', 'Avionics', 'GCS', 'Admin'].forEach(f => {
                     total += duty.data[f].reduce((sum: number, val: number) => sum + val, 0);
                 });
                 duty.totalRequiredMonth = total;
                 const existingDuty = currentMatrix.find((d: any) => d.id === duty.id);
                 if (existingDuty) {
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
                 return duty;
             });"""

good_block = """             const currentRaw = window.localStorage.getItem('baf_official_duty_matrix_v4');
             const currentMatrix: any[] = currentRaw ? JSON.parse(currentRaw) : [];
             const metadataRaw = window.localStorage.getItem('baf_duty_matrix_metadata');
             const metadataList: any[] = metadataRaw ? JSON.parse(metadataRaw) : [];

             const formattedMatrix = Array.from(dutyMap.values()).map(duty => {
                 let total = 0;
                 ['Mechanics', 'Avionics', 'GCS', 'Admin'].forEach(f => {
                     total += duty.data[f].reduce((sum: number, val: number) => sum + val, 0);
                 });
                 duty.totalRequiredMonth = total;
                 
                 const existingDuty = currentMatrix.find((d: any) => d.id === duty.id) || {};
                 const metaDuty = metadataList.find((m: any) => m.id === duty.id) || {};
                 
                 // Apply metadata (which came from cloud settings sync) OR fallback to local existing
                 if (metaDuty.serNo !== undefined) duty.serNo = metaDuty.serNo;
                 else if (existingDuty.serNo !== undefined) duty.serNo = existingDuty.serNo;
                 
                 if (metaDuty.title !== undefined) duty.title = metaDuty.title;
                 else if (existingDuty.title !== undefined) duty.title = existingDuty.title;
                 
                 if (metaDuty.eligibleFlights !== undefined) duty.eligibleFlights = metaDuty.eligibleFlights;
                 else if (existingDuty.eligibleFlights !== undefined) duty.eligibleFlights = existingDuty.eligibleFlights;
                 
                 if (metaDuty.eligibleRanks !== undefined) duty.eligibleRanks = metaDuty.eligibleRanks;
                 else if (existingDuty.eligibleRanks !== undefined) duty.eligibleRanks = existingDuty.eligibleRanks;
                 
                 if (metaDuty.flightTargets !== undefined) duty.flightTargets = metaDuty.flightTargets;
                 else if (existingDuty.flightTargets !== undefined) duty.flightTargets = existingDuty.flightTargets;
                 
                 if (metaDuty.dutyCode !== undefined) duty.dutyCode = metaDuty.dutyCode;
                 else if (existingDuty.dutyCode !== undefined) duty.dutyCode = existingDuty.dutyCode;

                 if (metaDuty.isDisabled !== undefined) duty.isDisabled = metaDuty.isDisabled;
                 else if (existingDuty.isDisabled !== undefined) duty.isDisabled = existingDuty.isDisabled;

                 return duty;
             });"""

content = content.replace(bad_block, good_block)

with open('src/services/localDatabase.ts', 'w') as f:
    f.write(content)

