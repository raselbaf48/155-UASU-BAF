const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

// Fix Printer import
content = content.replace(" Printer, X\n} from 'lucide-react';", " X\n} from 'lucide-react';");

// Add showPrintPreview
if (!content.includes("const [showPrintPreview, setShowPrintPreview]")) {
  content = content.replace(/const \[rosterMode, setRosterMode\] = useState<'BASE_DUTIES' \| 'IDAC_DUTY'>\('BASE_DUTIES'\);/, "const [rosterMode, setRosterMode] = useState<'BASE_DUTIES' | 'IDAC_DUTY'>('BASE_DUTIES');\n  const [showPrintPreview, setShowPrintPreview] = useState(false);");
}

// Add formatBlockName if missing
if (!content.includes("const formatBlockName")) {
  const formatFn = `
const formatBlockName = (block: string | undefined) => {
  if (!block) return 'L/O';
  let formatted = block;
  formatted = formatted.replace(/Airmen's Mess, Block No:\\s*/gi, '');
  formatted = formatted.replace(/\\s*&\\s*Svc\\s*/gi, '');
  return formatted.trim() || 'L/O';
};
`;
  content = content.replace("export const DutyRosterPeriodView: React.FC<DutyRosterPeriodViewProps> = ({", formatFn + "\nexport const DutyRosterPeriodView: React.FC<DutyRosterPeriodViewProps> = ({");
}

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);
