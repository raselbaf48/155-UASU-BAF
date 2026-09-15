const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

const target1 = `  const renderDocument = () => (
    <>
      {/* ========================================================================= */}`;

const replace1 = `    </div>
  );

  const renderDocument = () => (
    <>
      {/* ========================================================================= */}`;
content = content.replace(target1, replace1);

const target2 = `
      {renderDocument()}
      {showPrintPreview && createPortal(`;

const replace2 = `  return (
    <div className="duty-register-print space-y-6">
      {topContent}
      {renderDocument()}
      {showPrintPreview && createPortal(`;

content = content.replace(target2, replace2);

// And we change the first return to save into a variable
content = content.replace("return (\n <div className=\"duty-register-print space-y-6\">\n {/* Top Header & Option Selector Card */}", "const topContent = (\n <>\n {/* Top Header & Option Selector Card */}");

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);
