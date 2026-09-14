const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// 1. Add createPortal to imports if missing
if (!content.includes("import { createPortal }")) {
  content = content.replace("import React, { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo } from 'react';\nimport { createPortal } from 'react-dom';");
}

// 2. Add showPrintPreview state to DutyDetailsModal
const modalStateStart = `const DutyDetailsModal: React.FC<{
  dutyId: string;
  assignments: DutyAssignment[];
  airmen: Airman[];
  currentYear: number;
  currentMonth: number;
  onClose: () => void;
  onViewProfile: (airman: Airman, config?: any) => void;
}> = ({ dutyId, assignments, airmen, currentYear, currentMonth, onClose, onViewProfile }) => {`;

const modalStateReplacement = `const DutyDetailsModal: React.FC<{
  dutyId: string;
  assignments: DutyAssignment[];
  airmen: Airman[];
  currentYear: number;
  currentMonth: number;
  onClose: () => void;
  onViewProfile: (airman: Airman, config?: any) => void;
}> = ({ dutyId, assignments, airmen, currentYear, currentMonth, onClose, onViewProfile }) => {
  const [showPrintPreview, setShowPrintPreview] = useState(false);`;

content = content.replace(modalStateStart, modalStateReplacement);

// 3. Update the Print button onClick
content = content.replace(
  '<button onClick={() => window.print()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden" title="Print Matrix">',
  '<button onClick={() => setShowPrintPreview(true)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden" title="Print Matrix">'
);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);
