/**
 * Standard Duty & Disposal short name formatting utility for 155 UASU BAF
 * 
 * Rules:
 * - NTF -> NTF
 * - Airfield / Airport -> Airfield
 * - IDAC Morning -> IDAC "A"
 * - IDAC Afternoon -> IDAC "B"
 * - IDAC Night -> IDAC "Nt" (Note: "Nt" instead of "C")
 * - GD / Security -> GD
 * - BTF -> BTF
 * - Halishahar -> Halishahar
 * - Bake & Bite -> Bake & Bite
 * - TDY -> TDY
 */

export function formatDutyOnShortName(
  dutyCode?: string | null,
  idaShift?: string | null,
  notes?: string | null,
  dutyName?: string | null
): string {
  const code = (dutyCode || '').toUpperCase().trim();
  const notesStr = (notes || '').trim();
  const notesLower = notesStr.toLowerCase();
  const nameStr = (dutyName || '').trim();
  const nameLower = nameStr.toLowerCase();

  // 1. IDAC Duty with shifts: A (Morning), B (Afternoon), Nt (Night)
  if (
    code === 'IDAC' ||
    code === 'IDA' ||
    notesLower.includes('idac') ||
    notesLower.includes('ida center') ||
    nameLower.includes('idac') ||
    nameLower.includes('ida center')
  ) {
    const shift = (idaShift || '').toLowerCase();
    
    // Explicit exact shift match first
    if (shift === 'night') return 'IDAC "Nt"';
    if (shift === 'afternoon') return 'IDAC "B"';
    if (shift === 'morning') return 'IDAC "A"';
    
    // Check for Night shift ("Nt")
    if (
      notesLower.includes('night') ||
      notesLower.includes('"nt"') ||
      notesLower.includes(' nt') ||
      notesLower.includes('shift c') ||
      notesLower.includes('"c"') ||
      nameLower.includes('night')
    ) {
      return 'IDAC "Nt"';
    }

    // Check for Afternoon ("B")
    if (
      notesLower.includes('afternoon') ||
      notesLower.includes('aft') ||
      notesLower.includes('"b"') ||
      notesLower.includes('shift b') ||
      nameLower.includes('afternoon')
    ) {
      return 'IDAC "B"';
    }

    // Check for Morning ("A")
    if (
      notesLower.includes('morning') ||
      notesLower.includes('morn') ||
      notesLower.includes('"a"') ||
      notesLower.includes('shift a') ||
      nameLower.includes('morning')
    ) {
      return 'IDAC "A"';
    }

    return 'IDAC "A"'; // Fallback for IDAC
  }

  // 2. NTF (Najirpara Taskforce)
  if (
    code === 'NTF' ||
    notesLower.includes('ntf') ||
    notesLower.includes('najirpara') ||
    nameLower.includes('ntf') ||
    nameLower.includes('najirpara')
  ) {
    return 'NTF';
  }

  // 3. BTF (Base Taskforce)
  if (
    code === 'BTF' ||
    notesLower.includes('btf') ||
    notesLower.includes('base taskforce') ||
    notesLower.includes('task force') ||
    notesLower.includes('taskforce') ||
    nameLower.includes('btf') ||
    nameLower.includes('taskforce')
  ) {
    return 'BTF';
  }

  // 4. Airfield / Airport / Air Fd
  if (
    code === 'AIRPORT' ||
    code === 'AIRFIELD' ||
    code === 'ATT' ||
    code === 'AIR_FD' ||
    notesLower.includes('airfield') ||
    notesLower.includes('air fd') ||
    notesLower.includes('airport') ||
    nameLower.includes('airfield') ||
    nameLower.includes('air fd') ||
    nameLower.includes('airport')
  ) {
    return 'Airfield';
  }

  // 5. Halishahar
  if (
    code === 'HALISHAHAR' ||
    notesLower.includes('halishahar') ||
    notesLower.includes('hali duty') ||
    nameLower.includes('halishahar')
  ) {
    return 'Halishahar';
  }

  // 6. Base Security / GD
  if (
    code === 'GD' ||
    notesLower.includes('base sec') ||
    notesLower.includes('guard duty') ||
    notesLower.includes('sy duty') ||
    notesLower.includes('security duty') ||
    notesLower.includes('gd') ||
    nameLower.includes('security') ||
    nameLower.includes('guard') ||
    nameLower.includes('gd')
  ) {
    return 'GD';
  }

  // 7. Bake & Bite
  if (
    code === 'BAKE_BITE' ||
    code === 'BAKE_N_BITE' ||
    notesLower.includes('bake') ||
    nameLower.includes('bake')
  ) {
    return 'Bake & Bite';
  }

  // 8. TDY
  if (
    code === 'TDY' ||
    code === 'ATT' ||
    code === 'DETT' ||
    notesLower.includes('tdy') ||
    notesLower.includes('attachment')
  ) {
    return 'TDY';
  }

  // 9. Leave
  if (
    code === 'LEAVE' ||
    notesLower.includes('leave') ||
    notesLower.includes('cl') ||
    notesLower.includes('al')
  ) {
    if (notesLower.includes('casual') || notesLower.includes('cl')) return 'CL';
    if (notesLower.includes('annual') || notesLower.includes('al')) return 'AL';
    return 'Leave';
  }

  // Custom fallback: clean any internal "imported" tag
  if (dutyName && !dutyName.toLowerCase().includes('imported')) {
    return dutyName;
  }
  if (notesStr && !notesLower.includes('imported')) {
    return notesStr;
  }

  return code || 'GD';
}

export function formatDutyOffShortName(
  previousDutyCode?: string | null,
  previousDutyName?: string | null,
  notes?: string | null
): string {
  const shortOn = formatDutyOnShortName(previousDutyCode, undefined, notes, previousDutyName);
  if (shortOn.toLowerCase().endsWith('off')) return shortOn;
  return `${shortOn} Off`;
}
