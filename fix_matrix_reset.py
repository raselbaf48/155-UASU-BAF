import re

with open('src/components/DutyRatioMatrixView.tsx', 'r') as f:
    content = f.read()

# 1. Add state
state_block_old = "const [settingsTableIdx, setSettingsTableIdx] = useState<number | null>(null);"
state_block_new = "const [settingsTableIdx, setSettingsTableIdx] = useState<number | null>(null);\n  const [resetConfirmTableIdx, setResetConfirmTableIdx] = useState<number | null>(null);"
content = content.replace(state_block_old, state_block_new)

# 2. Update handleResetTable
handle_reset_old = """  const handleResetTable = (tableIndex: number) => {
    if (!window.confirm('Reset this table to 0 for all flights?')) return;
    const updated = [...matrix];
    const tableObj = { ...updated[tableIndex] };
    const flightData = { ...tableObj.data };
    flights.forEach(f => {
      flightData[f] = new Array(31).fill(0);
    });
    tableObj.data = flightData;
    updated[tableIndex] = tableObj;
    setMatrix(updated);
    saveDutyMatrix(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };"""

handle_reset_new = """  const handleResetTable = (tableIndex: number) => {
    setResetConfirmTableIdx(tableIndex);
  };

  const confirmResetTable = () => {
    if (resetConfirmTableIdx === null) return;
    const updated = [...matrix];
    const tableObj = { ...updated[resetConfirmTableIdx] };
    const flightData = { ...tableObj.data };
    flights.forEach(f => {
      flightData[f] = new Array(31).fill(0);
    });
    tableObj.data = flightData;
    updated[resetConfirmTableIdx] = tableObj;
    setMatrix(updated);
    saveDutyMatrix(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setResetConfirmTableIdx(null);
  };"""

content = content.replace(handle_reset_old, handle_reset_new)

# 3. Add modal JSX at the very end before the last closing tags
# Look for the last `</div>\n    </div>\n  );\n}`
modal_jsx = """
      {/* Reset Confirmation Modal */}
      {resetConfirmTableIdx !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Reset Duty Table?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to reset all flights for <strong className="text-slate-700 dark:text-slate-300">{matrix[resetConfirmTableIdx]?.title}</strong>? This action will set all values to 0.
            </p>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => setResetConfirmTableIdx(null)}
                className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetTable}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md rounded-xl transition-colors"
              >
                Reset Now
              </button>
            </div>
          </div>
        </div>
      )}
"""

end_pattern = r'(\s*)\{isImportModalOpen && \(\s*<ImportDutyRatioModal[\s\S]*?</ImportDutyRatioModal>\s*\)\}'
match = re.search(end_pattern, content)
if match:
    insert_pos = match.end()
    content = content[:insert_pos] + modal_jsx + content[insert_pos:]
else:
    # fallback, search for the last </div>
    last_div = content.rfind("</div>")
    if last_div != -1:
        content = content[:last_div] + modal_jsx + content[last_div:]

with open('src/components/DutyRatioMatrixView.tsx', 'w') as f:
    f.write(content)

