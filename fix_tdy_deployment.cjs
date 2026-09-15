const fs = require('fs');

function fixFile(filePath, codeVal) {
  let content = fs.readFileSync(filePath, 'utf8');

  const groupingLogic = `
        // Group into contiguous date spans
        const spans: Array<Array<any>> = [];
        let currentSpan: any[] = [];

        airman${codeVal}Assignments.forEach((ass: any) => {
          if (currentSpan.length === 0) {
            currentSpan.push(ass);
          } else {
            const prevAss = currentSpan[currentSpan.length - 1];
            const prevDate = new Date(prevAss.date);
            const currDate = new Date(ass.date);
            const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              currentSpan.push(ass);
            } else {
              spans.push([...currentSpan]);
              currentSpan = [ass];
            }
          }
        });
        if (currentSpan.length > 0) spans.push(currentSpan);

        // Process spans
        spans.forEach((span) => {
          const first = span[0];
          const last = span[span.length - 1];
          const location = first.notes || 'Outstation';
          
          span.forEach((ass) => {
            rec.total${codeVal}Days++;
            if (ass.date === todayStr) {
              rec.currentlyOn${codeVal} = true;
              rec.current${codeVal}Location = location;
            }
          });
          
          rec.${codeVal.toLowerCase()}Entries.push({
            date: first.date,
            endDate: last.date,
            notes: location,
            days: span.length
          });
        });
`;

  const oldForEach = `airman${codeVal}Assignments.forEach((ass: any) => {
          rec.total${codeVal}Days++;
          rec.${codeVal.toLowerCase()}Entries.push({
            date: ass.date,
            notes: ass.notes,
          });

          if (ass.date === todayStr) {
            rec.currentlyOn${codeVal} = true;
            rec.current${codeVal}Location = ass.notes || '${codeVal === 'Tdy' ? 'TDY Outstation' : 'Deployment Outstation'}';
          }
        });`;

  content = content.replace(oldForEach, groupingLogic);
  
  // Fix Interface
  const interfaceRegex = new RegExp(`(${codeVal.toLowerCase()}Entries:\\s*Array<{\\s*date:\\s*string;)(\\s*notes\\?:\\s*string;\\s*}>;)`);
  content = content.replace(interfaceRegex, `$1\n    endDate?: string;\n    days?: number;$2`);
  
  // Fix UI Rendering
  const tdRenderRegex = new RegExp(`(<td>\\s*<div className="flex flex-col space-y-1">\\s*{rec\\.${codeVal.toLowerCase()}Entries\\.map\\(\\(entry, i\\) => \\()([\\s\\S]*?)(}\\)\\s*</div>\\s*</td>)`);
  
  // We need to find the correct place to update the UI
  // Let's do a more robust string replacement for the UI
  
  fs.writeFileSync(filePath, content);
}

fixFile('src/components/TdyRegisterView.tsx', 'Tdy');
fixFile('src/components/DeploymentRegisterView.tsx', 'Att');
console.log("Grouping logic applied.");
