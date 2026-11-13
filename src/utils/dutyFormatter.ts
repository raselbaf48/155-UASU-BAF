import { getCustomDutyName, getCustomDuties } from './customDuties';
import { DUTY_TYPE_MAP } from '../data/dutyTypes';

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
    if (shift === 'night' || shift === 'nt' || shift === 'c') return 'IDAC "C"';
    if (shift === 'afternoon' || shift === 'aft' || shift === 'b') return 'IDAC "B"';
    if (shift === 'morning' || shift === 'morn' || shift === 'a') return 'IDAC "A"';
    
    // Check for Night shift ("Nt" / "C")
    if (
      notesLower.includes('night') ||
      notesLower.includes('"nt"') ||
      notesLower.includes(' nt') ||
      notesLower.includes('shift c') ||
      notesLower.includes('"c"') ||
      nameLower.includes('night')
    ) {
      return 'IDAC "C"';
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

  // 6. Canteen
  if (code === 'CANTEEN' || notesLower.includes('canteen') || nameLower.includes('canteen')) {
    return 'Canteen';
  }

  // 6.1 Escort Duty
  if (
    code === 'ESCORT' ||
    code === 'ESC' ||
    code === 'ESCT' ||
    code.includes('1794394') ||
    notesLower.includes('escort') ||
    nameLower.includes('escort')
  ) {
    return 'Esct Duty';
  }

  // 7. Orderly Room & UWO
  if (code.includes('ORDERLY') || notesLower.includes('orderly') || nameLower.includes('orderly')) {
    return 'Orderly Room';
  }
  if (code === 'UWO' || notesLower.includes('uwo') || nameLower.includes('uwo')) {
    return 'UWO';
  }

  // 8. Bake & Bite
  if (
    code === 'BAKE_BITE' ||
    code === 'BAKE_N_BITE' ||
    notesLower.includes('bake') ||
    nameLower.includes('bake')
  ) {
    return 'Bake & Bite';
  }

  // 9. TDY
  if (
    code === 'TDY' ||
    code === 'ATT' ||
    code === 'DETT' ||
    notesLower.includes('tdy') ||
    notesLower.includes('attachment')
  ) {
    return 'TDY';
  }

  // 10. Leave
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

  // 11. Base Security / GD / SY Duty
  if (
    code === 'GD' ||
    code === 'GUARD_DUTY' ||
    code === 'SECURITY' ||
    code === 'SY' ||
    code === 'SY_DUTY' ||
    notesLower.includes('base sec') ||
    notesLower.includes('guard duty') ||
    notesLower.includes('sy duty') ||
    notesLower.includes('sy on') ||
    notesLower.includes('security duty') ||
    /\bgd\b/i.test(notesLower) ||
    /\bsy\b/i.test(notesLower) ||
    nameLower.includes('security') ||
    nameLower.includes('guard duty') ||
    /\bgd\b/i.test(nameLower) ||
    /\bsy\b/i.test(nameLower) ||
    nameLower.includes('sy duty') ||
    nameLower.includes('sy on')
  ) {
    return 'SY';
  }

  // 12. Custom duty code resolution (handles CUST_..., timestamp codes, custom duties)
  const isRawCode = (str?: string | null) => Boolean(
    str && (
      str.toUpperCase().startsWith('CUST_') ||
      str.includes('1794394') ||
      /^[A-Z0-9_]{10,}$/.test(str.trim())
    )
  );
  const isGenericDuty = (str: string) => ['DUTY', 'DUTY_ON', 'ON DUTY', 'DUTY ON'].includes(str.toUpperCase().trim());

  if (isRawCode(code) || isRawCode(dutyName)) {
    const rawTarget = isRawCode(code) ? code : (dutyName || '');
    if (rawTarget.includes('1794394')) return 'Esct Duty';
    const resolvedName = getCustomDutyName(rawTarget) ||
      DUTY_TYPE_MAP.get(rawTarget as any)?.name ||
      getCustomDuties().find(d => d.code === rawTarget)?.name;
    if (resolvedName && !isRawCode(resolvedName)) {
      if (resolvedName.toLowerCase().includes('escort')) return 'Esct Duty';
      return resolvedName;
    }
  }

  // 13. Custom fallback: clean any internal "imported" tag and avoid returning generic "DUTY" or raw codes
  if (dutyName && !isRawCode(dutyName) && !dutyName.toLowerCase().includes('imported') && !isGenericDuty(dutyName)) {
    if (dutyName.toLowerCase().includes('escort')) return 'Esct Duty';
    return dutyName;
  }
  if (notesStr && !isRawCode(notesStr) && !notesLower.includes('imported') && !isGenericDuty(notesStr)) {
    if (notesLower.includes('escort')) return 'Esct Duty';
    return notesStr;
  }

  // 14. If the code was a raw custom code and wasn't resolved yet
  if (isRawCode(code)) {
    return code.includes('1794394') ? 'Esct Duty' : 'Special Duty';
  }

  // 15. Never silently fall back baseline or generic codes to Security Duty
  const isBaseline = ['ON_PARADE', 'PT', 'PT_PARADE', 'P', 'PRESENT'].includes(code);
  return (code && !isGenericDuty(code) && !isBaseline) ? code : 'Duty';
}

export function formatDutyOffShortName(
  previousDutyCode?: string | null,
  previousDutyName?: string | null,
  notes?: string | null
): string {
  const code = String(previousDutyCode || '').toUpperCase();
  const name = String(previousDutyName || '').toLowerCase();
  const n = String(notes || '').toLowerCase();
  if (
    code.includes('1794394') ||
    code === 'ESCORT' ||
    code === 'ESC' ||
    code === 'ESCT' ||
    name.includes('escort') ||
    name.includes('esct') ||
    n.includes('escort') ||
    n.includes('esct')
  ) {
    return 'Esct Off';
  }
  const shortOn = formatDutyOnShortName(previousDutyCode, undefined, notes, previousDutyName);
  if (shortOn.toLowerCase().endsWith('off')) return shortOn;
  if (
    shortOn === 'ESC' ||
    shortOn === 'ESCT' ||
    shortOn === 'Esct Duty' ||
    shortOn === 'Escort Duty' ||
    shortOn.toLowerCase() === 'escort'
  ) {
    return 'Esct Off';
  }
  if (shortOn === 'SY' || shortOn === 'Sy Duty' || shortOn === 'GD') return 'SY Off';
  if (!shortOn || shortOn === 'Duty') return 'Duty Off';
  return `${shortOn} Off`;
}
