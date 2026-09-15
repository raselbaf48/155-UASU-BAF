const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const target1 = `  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);`;
const replacement1 = `  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);`;
content = content.replace(target1, replacement1);

const target2 = `  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    setShowDeleteConfirm(true);
  };
  
  const confirmDeleteGroup = async () => {
    if (!editingGroup) return;
    setShowDeleteConfirm(false);`;
const replacement2 = `  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    setShowDeleteGroupConfirm(true);
  };
  
  const confirmDeleteGroup = async () => {
    if (!editingGroup) return;
    setShowDeleteGroupConfirm(false);`;
content = content.replace(target2, replacement2);

const target3 = `              {showDeleteConfirm && (
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-800/90 z-10 flex flex-col items-center justify-center p-6 text-center rounded-xl backdrop-blur-sm">
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mb-4">Are you sure you want to completely remove this entry?</p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}`;
const replacement3 = `              {showDeleteGroupConfirm && (
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-800/90 z-10 flex flex-col items-center justify-center p-6 text-center rounded-xl backdrop-blur-sm">
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mb-4">Are you sure you want to completely remove this entry?</p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowDeleteGroupConfirm(false)}`;
content = content.replace(target3, replacement3);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
