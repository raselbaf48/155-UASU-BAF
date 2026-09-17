const fs = require('fs');

// Patch UserLoginGate.tsx
let ulgCode = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

ulgCode = ulgCode.replace(/type=\{showPin \? "text" : "password"\}/g, 'type="text"\n                      style={{ WebkitTextSecurity: showPin ? "none" : "disc" }}');

// Patch the reset PINs in UserLoginGate
ulgCode = ulgCode.replace(/type="password"/g, 'type="text" style={{ WebkitTextSecurity: "disc" }}');

fs.writeFileSync('src/components/UserLoginGate.tsx', ulgCode);

// Patch AdminPasscodeModal.tsx
let apmCode = fs.readFileSync('src/components/AdminPasscodeModal.tsx', 'utf8');
apmCode = apmCode.replace(/type="password"/g, 'type="text" style={{ WebkitTextSecurity: "disc" }}');
fs.writeFileSync('src/components/AdminPasscodeModal.tsx', apmCode);

// Patch renderAirmanColumnList in ParadeStateFormattedView.tsx
let psfvCode = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

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

// Note: It's minified on a single line! Let's do a regex replacement.
psfvCode = psfvCode.replace(
  /const renderAirmanColumnList = \(list: \{ airman: Airman \}\[\]\) => \{ if \(!list \|\| list\.length === 0\) \{ return <div className="text-center text-slate-400 font-normal py-1">-<\/div>; \} return \( <ol className="space-y-0\.5 text-\[11px\] leading-snug font-normal text-left"> \{list\.map\(\(item, idx\) => \( <li key=\{idx\} className="whitespace-nowrap"> \{idx \+ 1\}\. \{formatAirmanName\(item\.airman\.rank\)\} \{formatAirmanName\(item\.airman\.name\)\} <\/li> \)\)\} <\/ol> \); \};/g,
  `const renderAirmanColumnList = (list: { airman: Airman, notes?: string }[], showNotes: boolean = false) => { if (!list || list.length === 0) { return <div className="text-center text-slate-400 font-normal py-1">-</div>; } return ( <ol className="space-y-0.5 text-[11px] leading-snug font-normal text-left"> {list.map((item, idx) => ( <li key={idx} className="whitespace-nowrap"> {idx + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}{showNotes && item.notes && item.notes !== 'None' ? ' - ' + item.notes : ''} </li> ))} </ol> ); };`
);

fs.writeFileSync('src/components/ParadeStateFormattedView.tsx', psfvCode);
