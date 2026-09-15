const fs = require('fs');

let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

// add formatBlockName
const formatFn = `
const formatBlockName = (block: string | undefined) => {
  if (!block) return 'L/O';
  let formatted = block;
  formatted = formatted.replace(/Airmen's Mess, Block No:\\s*/gi, '');
  formatted = formatted.replace(/\\s*&\\s*Svc\\s*/gi, '');
  return formatted.trim() || 'L/O';
};
`;
content = content.replace(/import React, { useState, useEffect, useMemo } from 'react';/, "import React, { useState, useEffect, useMemo } from 'react';\n" + formatFn);

// replace block: block.airman.addressBlock || 'L/O'
content = content.replace(/block:\s*block\.airman\.addressBlock\s*\|\|\s*'L\/O',/g, 'block: formatBlockName(block.airman.addressBlock),');

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);
