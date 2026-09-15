const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const target1 = `  const [deletingGroup, setDeletingGroup] = useState(false);`;
const replacement1 = `  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);`;
content = content.replace(target1, replacement1);

const target2 = `  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    if (!window.confirm('Are you sure you want to completely remove this entry?')) return;
    
    setDeletingGroup(true);`;
const replacement2 = `  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    setShowDeleteConfirm(true);
  };
  
  const confirmDeleteGroup = async () => {
    if (!editingGroup) return;
    setShowDeleteConfirm(false);
    setDeletingGroup(true);`;
content = content.replace(target2, replacement2);

const target3 = `                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>`;
const replacement3 = `                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
              
              {showDeleteConfirm && (
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-800/90 z-10 flex flex-col items-center justify-center p-6 text-center rounded-xl backdrop-blur-sm">
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mb-4">Are you sure you want to completely remove this entry?</p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      No, Keep It
                    </button>
                    <button
                      onClick={confirmDeleteGroup}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                      Yes, Remove
                    </button>
                  </div>
                </div>
              )}`;
content = content.replace(target3, replacement3);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
