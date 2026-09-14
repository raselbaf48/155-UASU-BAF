import fs from 'fs';

const files = [
  'src/components/LeaveRegisterView.tsx',
  'src/components/TdyRegisterView.tsx',
  'src/components/DeploymentRegisterView.tsx'
];

for (const f of files) {
  let code = fs.readFileSync(f, 'utf8');

  const target1 = `export const LeaveRegisterView: React.FC<LeaveRegisterViewProps> = ({
  role = 'ADMIN',
  airmen,
  onViewProfile,
}) => {`;
  const replacement1 = `export const LeaveRegisterView: React.FC<LeaveRegisterViewProps> = ({
  role = 'ADMIN',
  airmen: rawAirmen,
  onViewProfile,
}) => {
  const airmen = React.useMemo(() => rawAirmen.filter(a => a.active !== false), [rawAirmen]);`;

  const target2 = `export const TdyRegisterView: React.FC<TdyRegisterViewProps> = ({
  role = 'ADMIN',
  airmen,
  onViewProfile,
}) => {`;
  const replacement2 = `export const TdyRegisterView: React.FC<TdyRegisterViewProps> = ({
  role = 'ADMIN',
  airmen: rawAirmen,
  onViewProfile,
}) => {
  const airmen = React.useMemo(() => rawAirmen.filter(a => a.active !== false), [rawAirmen]);`;

  const target3 = `export const DeploymentRegisterView: React.FC<DeploymentRegisterViewProps> = ({
  role = 'ADMIN',
  airmen,
  onViewProfile,
}) => {`;
  const replacement3 = `export const DeploymentRegisterView: React.FC<DeploymentRegisterViewProps> = ({
  role = 'ADMIN',
  airmen: rawAirmen,
  onViewProfile,
}) => {
  const airmen = React.useMemo(() => rawAirmen.filter(a => a.active !== false), [rawAirmen]);`;

  if (f.includes('Leave') && code.includes(target1)) code = code.replace(target1, replacement1);
  if (f.includes('Tdy') && code.includes(target2)) code = code.replace(target2, replacement2);
  if (f.includes('Deployment') && code.includes(target3)) code = code.replace(target3, replacement3);

  fs.writeFileSync(f, code);
  console.log(`Patched ${f}`);
}
