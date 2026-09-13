import { Airman, FlightName, DutyCategoryCode, IDAShift, DocumentAnalysisResult } from '../types';
import { DUTY_TYPES } from '../data/dutyTypes';

/**
 * Detects military rank from a text token or phrase.
 * Matches specific BAF ranks (MWO, SWO, Flt Sgt, WO, Sgt, Cpl, LAC, AC).
 */
export function detectRankFromText(rawText: string): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const lower = rawText.toLowerCase().replace(/[\.]/g, '');

  if (/\b(?:mwo|master\s*warrant\s*officer|m\s*w\s*o)\b/i.test(lower)) return 'MWO';
  if (/\b(?:swo|senior\s*warrant\s*officer|s\s*w\s*o)\b/i.test(lower)) return 'SWO';
  if (/\b(?:flt\s*sgt|f\/sgt|flight\s*sergeant|fs)\b/i.test(lower)) return 'Flt Sgt';
  if (/\b(?:wo|warrant\s*officer|w\s*o)\b/i.test(lower)) return 'WO';
  if (/\b(?:sgt|sergeant)\b/i.test(lower)) return 'Sgt';
  if (/\b(?:cpl|corporal)\b/i.test(lower)) return 'Cpl';
  if (/\b(?:lac|leading\s*aircraftman|l\s*a\s*c)\b/i.test(lower)) return 'LAC';
  if (/\b(?:ac-1|ac 1|ac1)\b/i.test(lower)) return 'AC-1';
  if (/\b(?:ac-2|ac 2|ac2|ac|aircraftman|a\s*c)\b/i.test(lower)) return 'AC-2';

  return null;
}

/**
 * Strips ranks, numbers, flight names, and duty annotations to leave the clean person name.
 */
export function cleanAirmanNameFromText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/^[0-9]+[.\-)]\s*/, '') // remove leading serial/number e.g. "1. "
    .replace(/\b(?:bd\/?|)(\d{5,7})\b/gi, '') // remove BD numbers
    .replace(/\b(?:mwo|swo|flt\s*sgt|f\/sgt|wo|sgt|cpl|lac|ac-1|ac-2|ac1|ac2|ac)\b/gi, '') // remove rank acronyms
    .replace(/\b(?:master\s*warrant\s*officer|senior\s*warrant\s*officer|flight\s*sergeant|warrant\s*officer|sergeant|corporal|leading\s*aircraftman|aircraftman)\b/gi, '')
    .replace(/\b(?:avi|mech|gcs|admin)\s*(?:flt|flight)?\b/gi, '') // remove flight names
    .replace(/\((?:Morning|Afternoon|Night|CL|AL|Leave|Off|GD|BTF|NTF|IDAC|TDY|Bakery|CMH|Airport)\)/gi, '') // remove parenthetical tags
    .replace(/^(?:Sy Duty|TF Duty|BTF|NTF|GD|IDAC|Leave|TDY)\s*[-:]\s*/gi, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes rank string for consistent comparison.
 */
function normalizeRank(rank: string): string {
  const r = rank.toUpperCase().replace(/[\.\s]/g, '');
  if (r === 'MWO' || r === 'MASTERWARRA') return 'MWO';
  if (r === 'SWO' || r === 'SENIORWARRA') return 'SWO';
  if (r === 'FLTSGT' || r === 'FS' || r === 'FLIGHTSERG') return 'FLT SGT';
  if (r === 'WO' || r === 'WARRANTOFF') return 'WO';
  if (r === 'SGT' || r === 'SERGEANT') return 'Sgt';
  if (r === 'CPL' || r === 'CORPORAL') return 'Cpl';
  if (r === 'LAC' || r === 'LEADINGAIR') return 'LAC';
  if (r === 'AC-1' || r === 'AC1') return 'AC-1';
  if (r === 'AC-2' || r === 'AC2' || r === 'AC' || r === 'AIRCRAFTMA') return 'AC-2';
  return r;
}

/**
 * Matches extracted text to the correct Airman in the database.
 * CRITICAL RULE: Rank is matched FIRST, and only then the name is searched within that rank.
 * Example: "LAC Mehedi" -> filters all LAC airmen first, then finds Mehedi.
 */
export function findBestAirmanMatch(
  rawText: string,
  airmenList: Airman[],
  flightHint?: FlightName | 'Overall'
): { airman: Airman | null; confidence: number } {
  if (!rawText || !rawText.trim() || !Array.isArray(airmenList) || airmenList.length === 0) {
    return { airman: null, confidence: 0 };
  }

  const rawTrimmed = rawText.trim();
  const cleaned = rawTrimmed.replace(/^[0-9]+[.\-)]\s*/, '').trim().toLowerCase();

  // 1. Direct BD Number check (Unique military identifier)
  const bdMatch = cleaned.match(/\b(?:bd\/?|)(\d{5,7})\b/i);
  if (bdMatch) {
    const found = airmenList.find((a) => a.bdNo.includes(bdMatch[1]));
    if (found) return { airman: found, confidence: 0.99 };
  }

  // 2. Direct Airman Code check (e.g. LAC-MHD, CPL-SJB)
  const codeFound = airmenList.find((a) => cleaned.includes(a.code.toLowerCase()));
  if (codeFound) return { airman: codeFound, confidence: 0.98 };

  // 3. Rank-First Detection
  const detectedRank = detectRankFromText(rawTrimmed);
  const cleanName = cleanAirmanNameFromText(rawTrimmed).toLowerCase();

  if (detectedRank) {
    const normDetectedRank = normalizeRank(detectedRank);
    // Filter candidates strictly by the detected rank
    const rankCandidates = airmenList.filter((a) => normalizeRank(a.rank) === normDetectedRank);

    if (rankCandidates.length > 0) {
      // If flight hint is provided, prioritize airmen of this flight within the rank
      let searchPool = rankCandidates;
      if (flightHint && flightHint !== 'Overall') {
        const flightRank = rankCandidates.filter((a) => a.flightName === flightHint);
        if (flightRank.length > 0) {
          searchPool = [...flightRank, ...rankCandidates.filter((a) => a.flightName !== flightHint)];
        }
      }

      // 3.a Exact name match inside this rank
      for (const a of searchPool) {
        const aName = a.name.toLowerCase();
        if (cleanName && cleanName === aName) {
          return { airman: a, confidence: 0.96 };
        }
      }

      // 3.b Substring name match inside this rank
      for (const a of searchPool) {
        const aName = a.name.toLowerCase();
        if (cleanName.length >= 3 && (aName.includes(cleanName) || cleanName.includes(aName))) {
          return { airman: a, confidence: 0.94 };
        }
      }

      // 3.c Token / Word match inside this rank
      const queryWords = cleanName.split(/\s+/).filter((w) => w.length >= 3);
      let bestRankMatch: Airman | null = null;
      let highestScore = 0;

      for (const a of searchPool) {
        const aWords = a.name.toLowerCase().split(/[\s,./-]+/).filter((w) => w.length >= 3);
        let score = 0;
        for (const qw of queryWords) {
          for (const aw of aWords) {
            if (qw === aw) score += 2;
            else if (aw.includes(qw) || qw.includes(aw)) score += 1;
          }
        }
        if (score > highestScore) {
          highestScore = score;
          bestRankMatch = a;
        }
      }

      if (bestRankMatch && highestScore > 0) {
        return { airman: bestRankMatch, confidence: 0.90 };
      }
    }
  }

  // 4. Fallback: If no rank detected, match across all candidates by name
  let candidatePool = airmenList;
  if (flightHint && flightHint !== 'Overall') {
    const flightAirmen = airmenList.filter((a) => a.flightName === flightHint);
    if (flightAirmen.length > 0) {
      candidatePool = [...flightAirmen, ...airmenList.filter((a) => a.flightName !== flightHint)];
    }
  }

  const searchName = (cleanName || cleaned).toLowerCase();

  // 4.a Full name exact or substring match
  for (const a of candidatePool) {
    const aName = a.name.toLowerCase();
    if (searchName.length >= 3 && (aName.includes(searchName) || searchName.includes(aName))) {
      return { airman: a, confidence: 0.88 };
    }
  }

  // 4.b Word overlap match
  const searchWords = searchName.split(/[\s,./-]+/).filter((w) => w.length >= 3);
  let bestCandidate: Airman | null = null;
  let maxScore = 0;

  for (const a of candidatePool) {
    const aWords = a.name.toLowerCase().split(/[\s,./-]+/).filter((w) => w.length >= 3);
    let score = 0;
    for (const sw of searchWords) {
      for (const aw of aWords) {
        if (sw === aw) score += 2;
        else if (aw.includes(sw) || sw.includes(aw)) score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCandidate = a;
    }
  }

  if (bestCandidate && maxScore >= 2) {
    return { airman: bestCandidate, confidence: 0.82 };
  }

  return { airman: null, confidence: 0 };
}

/**
 * Heuristically parses multi-page or tabular roster text.
 * Strictly extracts only what is in the input text without fallback to fake demo data.
 */
export function parseRosterTextHeuristically(
  rawInputText: string,
  targetYear: number,
  targetFlight: FlightName | 'Overall',
  airmenList: Airman[]
): DocumentAnalysisResult {
  const lines = rawInputText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let defaultFlight: FlightName = targetFlight === 'Overall' ? 'Avionics' : targetFlight;
  let currentFlight: FlightName = defaultFlight;

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', may_: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const dateMap = new Map<string, { date: string; dayName: string; assignments: any[] }>();
  const dateRegex = /(?:^|\b)(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+([A-Za-z]+))?/i;
  const numericDateRegex = /(?:^|\b)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/;

  let activeSectionDuty: DutyCategoryCode | null = null;
  let activeSectionDutyName = '';
  let activeSectionIdaShift: IDAShift | null = null;

  const detectSectionDuty = (line: string): { code: DutyCategoryCode; name: string; shift: IDAShift | null } | null => {
    const upper = line.toUpperCase().trim();
    if (upper === 'SY DUTY' || upper === 'SECURITY DUTY' || upper.startsWith('SY DUTY') || upper.startsWith('BASE SECURITY') || upper === 'GD') {
      return { code: 'GD', name: 'Base Security Duty', shift: null };
    }
    if (upper === 'TF DUTY' || upper === 'TASK FORCE DUTY' || upper.startsWith('TF DUTY') || upper.startsWith('TASK FORCE')) {
      return { code: 'BTF', name: 'Base Taskforce Duty', shift: null };
    }
    if (upper === 'NTF' || upper.includes('NAJIRPARA')) {
      return { code: 'NTF', name: 'Najirpara Taskforce Duty', shift: null };
    }
    if (upper.includes('HALISHAHAR') || upper === 'HALI DUTY') {
      return { code: 'HALISHAHAR', name: 'Halishahar Taskforce Duty', shift: null };
    }
    if (upper.includes('AIRFIELD') || upper.includes('AIRPORT')) {
      return { code: 'ATT', name: 'Airfield Duty', shift: null };
    }
    if (upper.includes('IDAC') || upper.includes('IDA CENTER')) {
      let shift: IDAShift = 'Morning';
      if (upper.includes('NIGHT')) shift = 'Night';
      else if (upper.includes('AFTERNOON') || upper.includes('AFT')) shift = 'Afternoon';
      return { code: 'IDAC', name: 'IDA Center Duty', shift };
    }
    if (upper === 'LEAVE' || upper.startsWith('LEAVE') || upper === 'CL' || upper === 'AL') {
      return { code: 'LEAVE', name: 'Leave (CL/AL)', shift: null };
    }
    if (upper.includes('BAKE N BITE') || upper.includes('BAKE & BITE')) {
      return { code: 'BAKE_N_BITE', name: 'Bake & Bite', shift: null };
    }
    if (upper === 'TDY' || upper.startsWith('TDY')) {
      return { code: 'TDY', name: 'TDY', shift: null };
    }
    return null;
  };


  let currentDateStr = '';
  let currentDayName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    if (upperLine.includes('AVI FLT') || upperLine.includes('AVIONIC')) {
      currentFlight = 'Avionics';
    } else if (upperLine.includes('MECH FLT') || upperLine.includes('MECHANIC')) {
      currentFlight = 'Mechanics';
    } else if (upperLine.includes('GCS FLT') || upperLine.includes('GCS')) {
      currentFlight = 'GCS';
    } else if (upperLine.includes('ADMIN FLT') || upperLine.includes('ADMIN')) {
      currentFlight = 'Admin';
    }

    const sectionMatch = detectSectionDuty(line);
    if (sectionMatch && !line.match(dateRegex)) {
      activeSectionDuty = sectionMatch.code;
      activeSectionDutyName = sectionMatch.name;
      activeSectionIdaShift = sectionMatch.shift;
      continue;
    }

    let lineContent = line;

    const match = line.match(dateRegex);
    if (match) {
      const dayNum = match[1].padStart(2, '0');
      const monthStr = match[2].toLowerCase().slice(0, 3);
      const monthNum = monthMap[monthStr] || '08';
      currentDayName = match[3] || '';
      currentDateStr = `${targetYear}-${monthNum}-${dayNum}`;
      lineContent = line.slice(match.index + match[0].length).replace(/^[\s:—|]+/, '').trim();
    } else {
      const numMatch = line.match(numericDateRegex);
      if (numMatch) {
        if (numMatch[1]) {
          currentDateStr = `${numMatch[1]}-${numMatch[2].padStart(2, '0')}-${numMatch[3].padStart(2, '0')}`;
        } else {
          const yr = numMatch[6].length === 2 ? `20${numMatch[6]}` : numMatch[6];
          currentDateStr = `${yr}-${numMatch[5].padStart(2, '0')}-${numMatch[4].padStart(2, '0')}`;
        }
        lineContent = line.slice(numMatch.index + numMatch[0].length).replace(/^[\s:—|]+/, '').trim();
      }
    }
    
    // If we haven't found a date yet, try to assign to today or skip
    if (!currentDateStr) {
      const today = new Date();
      currentDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    if (currentDateStr) {
      if (!dateMap.has(currentDateStr)) {
        dateMap.set(currentDateStr, { date: currentDateStr, dayName: currentDayName, assignments: [] });
      }
      const entry = dateMap.get(currentDateStr);

      // Process tokens in lineContent
      const tokens = lineContent.split(/(?:[-—|•\t;]+|\s{2,})/);

      for (const token of tokens) {
        const cleanToken = token.trim();
        if (!cleanToken || cleanToken === '-' || cleanToken === '--' || cleanToken.length < 2) continue;

        const subNames = cleanToken
          .split(/(?=\d+[.\-)])|,/)
          .map((s) => s.replace(/^\d+[.\-)]\s*/, '').trim())
          .filter((s) => s.length > 2);
        const namesToProcess = subNames.length > 0 ? subNames : [cleanToken];

        for (const item of namesToProcess) {
          let dutyCode: DutyCategoryCode = activeSectionDuty || 'ON_PARADE';
          let dutyName = activeSectionDutyName || 'On Parade';
          let idaShift: IDAShift | null = activeSectionIdaShift || null;

          const itemUpper = item.toUpperCase();
          const fullLineUpper = lineContent.toUpperCase();

          if (itemUpper.includes('NTF') || itemUpper.includes('NAJIRPARA') || fullLineUpper.includes('NAJIRPARA')) {
            dutyCode = 'NTF';
            dutyName = 'Najirpara Taskforce Duty';
          } else if (itemUpper.includes('BTF') || fullLineUpper.includes('BASE TASKFORCE') || itemUpper.includes('TF DUTY')) {
            dutyCode = 'BTF';
            dutyName = 'Base Taskforce Duty';
          } else if (itemUpper.includes('GD') || itemUpper.includes('SY DUTY') || fullLineUpper.includes('BASE SECURITY')) {
            dutyCode = 'GD';
            dutyName = 'Base Security Duty';
          } else if (itemUpper.includes('HALISHAHAR') || itemUpper.includes('HALI')) {
            dutyCode = 'HALISHAHAR';
            dutyName = 'Halishahar Taskforce Duty';
          } else if (itemUpper.includes('AIRFIELD') || itemUpper.includes('AIRPORT')) {
            dutyCode = 'ATT';
            dutyName = 'Airfield Duty';
          } else if (itemUpper.includes('LEAVE') || itemUpper.includes(' C/L') || itemUpper.includes(' A/L')) {
            dutyCode = 'LEAVE';
            dutyName = 'Leave (CL/AL)';
          } else if (itemUpper.includes('NIGHT') || itemUpper.includes('IDA NIGHT')) {
            dutyCode = 'IDAC';
            dutyName = 'IDA Center Duty';
            idaShift = 'Night';
          } else if (itemUpper.includes('AFTERNOON') || itemUpper.includes('IDA AFT')) {
            dutyCode = 'IDAC';
            dutyName = 'IDA Center Duty';
            idaShift = 'Afternoon';
          } else if (itemUpper.includes('MORNING') || itemUpper.includes('IDA MORN')) {
            dutyCode = 'IDAC';
            dutyName = 'IDA Center Duty';
            idaShift = 'Morning';
          } else if (itemUpper.includes('OFF') || itemUpper.includes('DUTY OFF')) {
            dutyCode = 'DUTY_OFF';
            dutyName = 'Duty Off';
          }

          const rawAirmanName = item
            .replace(/\((?:Morning|Afternoon|Night|CL|AL|Leave|Off|GD|BTF|NTF|IDAC|TDY|Bakery|CMH)\)/gi, '')
            .replace(/^(?:Sy Duty|TF Duty|BTF|NTF|GD|IDAC|Leave|TDY)\s*[-:]\s*/gi, '')
            .trim();

          if (dutyCode === 'DUTY_OFF' || dutyCode === 'ON_PARADE') {
            continue;
          }

          // Rank-First Matching
          const matched = findBestAirmanMatch(rawAirmanName || item, airmenList, currentFlight);

          if (matched.airman) {
            const alreadyExists = entry.assignments.some(
              (a) => a.matchedAirmanId === matched.airman!.id && a.dutyCode === dutyCode && (dutyCode !== 'IDAC' || a.idaShift === idaShift)
            );
            if (!alreadyExists) {
              entry.assignments.push({
                rawText: rawAirmanName || item,
                dutyCode,
                dutyName,
                idaShift,
                matchedAirmanId: matched.airman.id,
                matchedAirmanName: matched.airman.name,
                matchedAirmanRank: matched.airman.rank,
                matchedAirmanFlight: matched.airman.flightName,
                matchedAirmanBdNo: matched.airman.bdNo,
                confidence: matched.confidence,
                isIgnored: false,
              });
            }
          } else if (rawAirmanName.length > 2 && !['DUTY', 'PARADE', 'STATE', 'FLIGHT', 'TOTAL', 'OFF', 'PRESENT', 'LEAVE'].some((k) => itemUpper === k)) {
            const alreadyExists = entry.assignments.some((a) => a.rawText === (rawAirmanName || item) && a.dutyCode === dutyCode);
            if (!alreadyExists) {
              entry.assignments.push({
                rawText: rawAirmanName || item,
                dutyCode,
                dutyName,
                idaShift,
                matchedAirmanId: null,
                matchedAirmanName: rawAirmanName || item,
                confidence: 0,
                isIgnored: false,
              });
            }
          }
        }
      }
    }
  }

  const dates = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  let totalAssignmentsCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;

  dates.forEach((d) => {
    d.assignments.forEach((asn) => {
      totalAssignmentsCount++;
      if (asn.matchedAirmanId) matchedCount++;
      else unmatchedCount++;
    });
  });

  return {
    documentTitle: `PARADE STATE / DUTY ROSTER : ${currentFlight.toUpperCase()} FLT`,
    detectedFlight: currentFlight,
    year: targetYear,
    month: dates[0] ? parseInt(dates[0].date.slice(5, 7), 10) : 8,
    totalDates: dates.length,
    totalPages: 1,
    totalFiles: 1,
    dateRange: {
      start: dates[0]?.date || `${targetYear}-08-01`,
      end: dates[dates.length - 1]?.date || `${targetYear}-08-31`,
    },
    dates,
    totalAssignmentsCount,
    matchedCount,
    unmatchedCount,
  };
}
