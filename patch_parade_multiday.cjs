const fs = require('fs');
let code = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

const oldRender = `const renderAirmanColumnList = (list: { airman: Airman }[]) => {
    if (!list || list.length === 0) {
      return <div className="text-center text-slate-400 font-normal py-1">-</div>;
    }
    return (
      <ol className="space-y-0.5 text-[11px] leading-snug font-normal text-left">
        {list.map((item, idx) => (
          <li key={idx} className="whitespace-nowrap">
            {idx + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}
          </li>
        ))}
      </ol>
    );
  };`;

const newRender = `const renderAirmanColumnList = (list: { airman: Airman, notes?: string }[], showNotes: boolean = false) => {
    if (!list || list.length === 0) {
      return <div className="text-center text-slate-400 font-normal py-1">-</div>;
    }
    return (
      <ol className="space-y-0.5 text-[11px] leading-snug font-normal text-left">
        {list.map((item, idx) => (
          <li key={idx} className="whitespace-nowrap">
            {idx + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}
            {showNotes && item.notes && item.notes !== 'None' ? \` - \${item.notes}\` : ''}
          </li>
        ))}
      </ol>
    );
  };`;

code = code.replace(oldRender, newRender);

const oldDutyOff = `{renderAirmanColumnList(dutyOff)}`;
const newDutyOff = `{renderAirmanColumnList(dutyOff, true)}`;
code = code.replace(oldDutyOff, newDutyOff);

fs.writeFileSync('src/components/ParadeStateFormattedView.tsx', code);
