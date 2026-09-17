const fs = require('fs');

let psfvCode = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

const oldStr = `const renderAirmanColumnList = (list: { airman: Airman }[]) => { if (!list || list.length === 0) { return <div className="text-center text-slate-400 font-normal py-1">-</div>; } return ( <ol className="space-y-0.5 text-[11px] leading-snug font-normal text-left"> {list.map((item, idx) => ( <li key={idx} className="whitespace-nowrap"> {idx + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)} </li> ))} </ol> ); };`;

const newStr = `const renderAirmanColumnList = (list: { airman: Airman, notes?: string }[], showNotes: boolean = false) => { if (!list || list.length === 0) { return <div className="text-center text-slate-400 font-normal py-1">-</div>; } return ( <ol className="space-y-0.5 text-[11px] leading-snug font-normal text-left"> {list.map((item, idx) => ( <li key={idx} className="whitespace-nowrap"> {idx + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}{showNotes && item.notes && item.notes !== 'None' ? ' - ' + item.notes : ''} </li> ))} </ol> ); };`;

psfvCode = psfvCode.replace(oldStr, newStr);

fs.writeFileSync('src/components/ParadeStateFormattedView.tsx', psfvCode);
