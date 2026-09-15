import re

with open('src/data/officialDutyRatioMatrix.ts', 'r') as f:
    content = f.read()

bad_block = """export function saveDutyMatrix(matrix: DutyRatioTable[]) {
  try {
    localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrix));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix } }));
    }"""

good_block = """export function saveDutyMatrix(matrix: DutyRatioTable[]) {
  try {
    localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrix));
    
    // Save metadata separately so it gets synced via app_settings
    const metadata = matrix.map(m => ({
        id: m.id,
        serNo: m.serNo,
        title: m.title,
        dutyCode: m.dutyCode,
        eligibleFlights: m.eligibleFlights,
        eligibleRanks: m.eligibleRanks,
        flightTargets: m.flightTargets,
        isDisabled: m.isDisabled,
        totalRequiredDaily: m.totalRequiredDaily
    }));
    localStorage.setItem('baf_duty_matrix_metadata', JSON.stringify(metadata));
    localStorage.setItem('baf_pending_sync', 'true');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated', { detail: { matrix } }));
    }"""

content = content.replace(bad_block, good_block)

with open('src/data/officialDutyRatioMatrix.ts', 'w') as f:
    f.write(content)

