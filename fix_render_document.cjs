const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

// The original logic:
// const handlePrint = () => { setShowPrintPreview(true); };
// return (
//   <div className="duty-register-print space-y-6">
// ...
// const renderDocument = () => (
// ...
//   return (
//     <>
//       {renderDocument()}

// It got super mangled. Let's extract everything from `const handlePrint` down and rebuild it properly.

const startToken = "  const handlePrint = () => { setShowPrintPreview(true); };";
const parts = content.split(startToken);

if (parts.length < 2) {
  console.log("startToken not found");
  process.exit(1);
}

const before = parts[0];
const after = startToken + parts[1];

// we want to move `const renderDocument = () => (` up above `return (`
// Let's just find `const renderDocument = () => (` and move it above the main `return (`

let renderDocMatch = after.indexOf("const renderDocument = () => (");
let firstReturnMatch = after.indexOf("return (");

if (renderDocMatch > firstReturnMatch) {
  // Extract everything from `const renderDocument = () => (` up to its closing `  );`
  // And the `return (` at the top is the main component return. Wait, the main component return was already modified in fix_roster.cjs:
  // "const endStr = "      )}\n </div>\n );\n};\n";"
}

