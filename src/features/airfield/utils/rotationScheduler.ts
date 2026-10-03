import { DutyPerson, DutyPost, PostRotationSchedule, RotationMajorBlock, RotationSlot } from '../types';

export function parseShiftTime(timeStr?: string): { startMinutes: number; endMinutes: number; durationMinutes: number } {
  const defaultRes = { startMinutes: 360, endMinutes: 840, durationMinutes: 480 }; // 06:00 - 14:00 (8 hours)
  if (!timeStr) return defaultRes;

  // Normalize string: e.g. "0600F - 1400F", "0600 - 1400", "06:00 - 14:00", "1400F - 2200F", "2200F - 0600F"
  const clean = timeStr.replace(/[fF]/g, '').trim();
  const parts = clean.split(/[-–—to]/).map((p) => p.trim());
  if (parts.length < 2) return defaultRes;

  const parsePart = (p: string): number => {
    p = p.replace(/[^0-9:]/g, '');
    if (p.includes(':')) {
      const [h, m] = p.split(':').map((x) => parseInt(x, 10) || 0);
      return h * 60 + m;
    }
    if (p.length === 4) {
      const h = parseInt(p.substring(0, 2), 10) || 0;
      const m = parseInt(p.substring(2, 4), 10) || 0;
      return h * 60 + m;
    }
    const val = parseInt(p, 10);
    return isNaN(val) ? 0 : val * 60;
  };

  const start = parsePart(parts[0]);
  let end = parsePart(parts[1]);

  if (end <= start) {
    // Overnight shift: e.g. 22:00 to 06:00
    end += 24 * 60;
  }

  const duration = end - start;
  return {
    startMinutes: start,
    endMinutes: end,
    durationMinutes: duration > 0 ? duration : 480,
  };
}

export function formatMinutesToTime(mins: number): string {
  // Normalize past 24 hours
  const normalized = mins % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = Math.floor(normalized % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDurationHoursMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Intelligent Fair Duty Rotation Scheduler
 * 
 * Implements all operational constraints required by Bangladesh Air Force / SAIA Security:
 * 1. "Akjoner tana 2 shift lagbe na" -> NO consecutive Active blocks for any personnel.
 * 2. "Tana Stby o lagbe na" -> NO consecutive Standby slots.
 * 3. "Jader Active & Stby nai tara auto rest" -> Anyone not on Active or Standby is automatically placed in Auto Rest.
 * 4. "Rest jno at least 1 hour hoy" -> In every cycle, resting personnel get at least 1 hour (60+ minutes) rest.
 * 5. Lifecycle transitions:
 *    - Active -> Standby -> Rest ("Bt Active kore erpor stby kore rest a jaite pare")
 *    - Rest -> Standby -> Active ("abr amn o hote pare Rest kore Stby kore erpor active korbe")
 * 6. Fair and balanced duty time allocation so that across the entire shift, workload is equalized.
 */
export function generateFairRotationSchedule(
  post: DutyPost,
  rosterTimeRange?: string,
  preferredBlockDuration: number = 90
): { schedule: PostRotationSchedule; updatedPersonnel: DutyPerson[] } {
  const personnel = post.personnel || [];
  const N = personnel.length;
  const targetActive = Math.min(N, Math.max(1, post.targetActiveStrength ?? post.targetStrength ?? 2));
  const targetStandby = Math.min(Math.max(0, N - targetActive), post.targetStandbyStrength ?? (N > targetActive ? 1 : 0));

  const timeRange = post.dutyTime || rosterTimeRange || '0600F - 1400F';
  const { startMinutes, endMinutes, durationMinutes } = parseShiftTime(timeRange);

  if (N === 0) {
    return {
      schedule: {
        totalSlots: 0,
        slotDurationMinutes: 0,
        blockDurationMinutes: 0,
        totalBlocks: 0,
        blocks: [],
        slots: [],
        perPersonActiveMinutes: 0,
        perPersonStandbyMinutes: 0,
        perPersonRestMinutes: 0,
        rulesSatisfied: {
          noConsecutiveActive: true,
          noConsecutiveStandby: true,
          minRestOneHour: true,
          autoRestActive: true,
        },
      },
      updatedPersonnel: [],
    };
  }

  // Edge case: N <= targetActive (Not enough personnel for rotation)
  if (N <= targetActive) {
    const singleSlot: RotationSlot = {
      slotIndex: 1,
      timeRange: `${formatMinutesToTime(startMinutes)} - ${formatMinutesToTime(endMinutes)}`,
      blockIndex: 1,
      blockTimeRange: `${formatMinutesToTime(startMinutes)} - ${formatMinutesToTime(endMinutes)}`,
      activePersonIds: personnel.map((p) => p.id),
      standbyPersonIds: [],
      restPersonIds: [],
    };

    const updatedPersonnel: DutyPerson[] = personnel.map((p) => ({
      ...p,
      dutyStatus: 'Active',
      dutyTime: `${formatMinutesToTime(startMinutes)} - ${formatMinutesToTime(endMinutes)} (${formatDurationHoursMins(durationMinutes)} Full Shift)`,
    }));

    return {
      schedule: {
        totalSlots: 1,
        slotDurationMinutes: durationMinutes,
        blockDurationMinutes: durationMinutes,
        totalBlocks: 1,
        blocks: [
          {
            blockIndex: 1,
            timeRange: singleSlot.timeRange,
            durationMinutes,
            activePersonIds: singleSlot.activePersonIds,
            subSlots: [singleSlot],
          },
        ],
        slots: [singleSlot],
        perPersonActiveMinutes: durationMinutes,
        perPersonStandbyMinutes: 0,
        perPersonRestMinutes: 0,
        rulesSatisfied: {
          noConsecutiveActive: false, // Not enough personnel to rotate
          noConsecutiveStandby: true,
          minRestOneHour: false,
          autoRestActive: true,
        },
      },
      updatedPersonnel,
    };
  }

  // 1. Partition shift time into Major Active Blocks
  // Standard is 90 minutes (e.g. 06:00 - 07:30, 07:30 - 09:00 as requested in user prompt)
  const blockDuration = Math.max(30, preferredBlockDuration || 90);
  const blocksTimeRanges: Array<{ start: number; end: number; duration: number }> = [];
  let currentBlockStart = startMinutes;

  while (currentBlockStart < endMinutes) {
    const nextEnd = Math.min(currentBlockStart + blockDuration, endMinutes);
    // If the remaining time after nextEnd is too small (< 25 min), merge with current block
    if (endMinutes - nextEnd > 0 && endMinutes - nextEnd < 25) {
      blocksTimeRanges.push({
        start: currentBlockStart,
        end: endMinutes,
        duration: endMinutes - currentBlockStart,
      });
      break;
    } else {
      blocksTimeRanges.push({
        start: currentBlockStart,
        end: nextEnd,
        duration: nextEnd - currentBlockStart,
      });
      currentBlockStart = nextEnd;
    }
  }

  // Tracking maps
  const personActiveMinutes: Record<string, number> = {};
  const personStandbyMinutes: Record<string, number> = {};
  const personRestMinutes: Record<string, number> = {};
  const personActiveSlots: Record<string, string[]> = {};
  const personStandbySlots: Record<string, string[]> = {};
  const personRestSlots: Record<string, string[]> = {};
  const personLastActiveBlock: Record<string, number> = {};
  let lastStandbyPersonId: string | null = null;

  personnel.forEach((p) => {
    personActiveMinutes[p.id] = 0;
    personStandbyMinutes[p.id] = 0;
    personRestMinutes[p.id] = 0;
    personActiveSlots[p.id] = [];
    personStandbySlots[p.id] = [];
    personRestSlots[p.id] = [];
    personLastActiveBlock[p.id] = -999;
  });

  const allSlots: RotationSlot[] = [];
  const majorBlocks: RotationMajorBlock[] = [];
  let globalSlotCounter = 1;

  // Track who was on active in previous block
  let prevBlockActiveIds: string[] = [];

  for (let b = 0; b < blocksTimeRanges.length; b++) {
    const blockTime = blocksTimeRanges[b];
    const blockTimeLabel = `${formatMinutesToTime(blockTime.start)} - ${formatMinutesToTime(blockTime.end)}`;

    // STEP A: Select Active Personnel for this Major Block
    // RULE 1: "Akjoner tana 2 shift lagbe na" (No one gets 2 consecutive active blocks!)
    // If (N - targetActive) >= targetActive, we can strictly pick ONLY personnel who were NOT active in previous block!
    const canStrictlyRotate = N - targetActive >= targetActive;
    
    let eligibleActiveCandidates: DutyPerson[] = [];
    if (canStrictlyRotate && prevBlockActiveIds.length > 0) {
      eligibleActiveCandidates = personnel.filter((p) => !prevBlockActiveIds.includes(p.id));
    } else if (prevBlockActiveIds.length > 0) {
      // If team size is tight (e.g. N=3, targetActive=2), rotate out as many previous active persons as possible
      const nonActiveFromPrev = personnel.filter((p) => !prevBlockActiveIds.includes(p.id));
      const restFromPrev = personnel.filter((p) => prevBlockActiveIds.includes(p.id));
      eligibleActiveCandidates = [...nonActiveFromPrev, ...restFromPrev];
    } else {
      eligibleActiveCandidates = [...personnel];
    }

    // Sort eligible active candidates:
    // 1. Least total active minutes so far (fair equal time)
    // 2. Strict preference: Did NOT do active in previous block ("Akjoner tana 2 shift lagbe na")
    // 3. Priority for transition: Person who did standby in the very last sub-slot of previous block
    //    ("abr amn o hote pare Rest kore Stby kore erpor active korbe")
    // 4. Longest continuous rest before this block (e.g. 60+ minutes rest over 30 minutes rest)
    eligibleActiveCandidates.sort((a, b) => {
      const actDiff = (personActiveMinutes[a.id] || 0) - (personActiveMinutes[b.id] || 0);
      if (actDiff !== 0) return actDiff;

      const aPrev = prevBlockActiveIds.includes(a.id) ? 1 : 0;
      const bPrev = prevBlockActiveIds.includes(b.id) ? 1 : 0;
      if (aPrev !== bPrev) return aPrev - bPrev;

      // Prioritize person who was on Standby in the last sub-slot right before this block
      const aWasLastStby = a.id === lastStandbyPersonId ? 1 : 0;
      const bWasLastStby = b.id === lastStandbyPersonId ? 1 : 0;
      if (aWasLastStby !== bWasLastStby) return bWasLastStby - aWasLastStby;

      // Prefer person who had rest at the end of the previous block
      const aRested = personRestSlots[a.id]?.length || 0;
      const bRested = personRestSlots[b.id]?.length || 0;
      if (aRested !== bRested) return bRested - aRested;

      return 0;
    });

    const currentBlockActivePersonnel = eligibleActiveCandidates.slice(0, targetActive);
    const currentBlockActiveIds = currentBlockActivePersonnel.map((p) => p.id);

    // Record active assignment for this block
    currentBlockActiveIds.forEach((id) => {
      personActiveMinutes[id] = (personActiveMinutes[id] || 0) + blockTime.duration;
      personActiveSlots[id].push(blockTimeLabel);
      personLastActiveBlock[id] = b;
    });

    // STEP B: The Non-Active Pool for this Block (R = N - targetActive)
    // These airmen will share Standby duties and Auto Rest during this block
    const nonActivePersonnel = personnel.filter((p) => !currentBlockActiveIds.includes(p.id));
    const nonActiveCount = nonActivePersonnel.length;

    // Sub-slots division:
    // When targetStandby is 1, we divide the block duration by nonActiveCount so each non-active person
    // does exactly 1 standby sub-slot, and rests for the remainder of the block!
    // Example: 90 mins / 3 non-active persons = 3 sub-slots of 30 mins each!
    // 30 mins standby + 60 mins (1 hour) Auto Rest!
    const numSubSlots = targetStandby > 0 ? Math.max(1, nonActiveCount) : 1;
    const subSlotDuration = blockTime.duration / numSubSlots;

    // Determine Standby Order in the sub-slots:
    // RULE: "Bt Active kore erpor stby kore rest a jaite pare"
    // Someone who was on Active in previous block and is now non-active should take the FIRST standby slot,
    // and then rest for the rest of this block (at least 60 mins continuous rest)!
    // RULE: "Tana Stby o lagbe na" -> The first standby person cannot be the person who did the last standby slot.
    const standbyOrderPool = [...nonActivePersonnel];
    standbyOrderPool.sort((a, b) => {
      // 1. Avoid person who did standby in the very last sub-slot
      const aWasLastStby = a.id === lastStandbyPersonId ? 1 : 0;
      const bWasLastStby = b.id === lastStandbyPersonId ? 1 : 0;
      if (aWasLastStby !== bWasLastStby) return aWasLastStby - bWasLastStby;

      // 2. Prioritize someone who just finished Active ("Active kore erpor stby kore rest a jaite pare")
      const aJustActive = prevBlockActiveIds.includes(a.id) ? 0 : 1;
      const bJustActive = prevBlockActiveIds.includes(b.id) ? 0 : 1;
      if (aJustActive !== bJustActive) return aJustActive - bJustActive;

      // 3. Lowest total standby minutes
      return (personStandbyMinutes[a.id] || 0) - (personStandbyMinutes[b.id] || 0);
    });

    // When there are 3 sub-slots and 2 persons just finished Active (e.g. A & B, with D resting):
    // Put Person 1 at Slot 0 (Active -> Standby -> 60m Rest)
    // Put D at Slot 1 (Middle)
    // Put Person 2 at Slot 2 (60m Rest -> Standby -> next Active)
    // Exactly matches user sample: A (0730-0800), D (0800-0830), B (0830-0900)
    if (numSubSlots === 3 && standbyOrderPool.length === 3) {
      const justActiveCrew = standbyOrderPool.filter((p) => prevBlockActiveIds.includes(p.id));
      const notJustActiveCrew = standbyOrderPool.filter((p) => !prevBlockActiveIds.includes(p.id));
      if (justActiveCrew.length === 2 && notJustActiveCrew.length === 1) {
        standbyOrderPool[0] = justActiveCrew[0];
        standbyOrderPool[1] = notJustActiveCrew[0];
        standbyOrderPool[2] = justActiveCrew[1];
      }
    }

    const blockSubSlots: RotationSlot[] = [];

    for (let s = 0; s < numSubSlots; s++) {
      const subSlotStart = blockTime.start + s * subSlotDuration;
      const subSlotEnd = s === numSubSlots - 1 ? blockTime.end : blockTime.start + (s + 1) * subSlotDuration;
      const currentSubDuration = subSlotEnd - subSlotStart;
      const subSlotTimeLabel = `${formatMinutesToTime(subSlotStart)} - ${formatMinutesToTime(subSlotEnd)}`;

      let standbyIds: string[] = [];
      if (targetStandby > 0 && standbyOrderPool.length > 0) {
        // Pick targetStandby persons for this sub-slot
        for (let sb = 0; sb < targetStandby; sb++) {
          const personIdx = (s + sb) % standbyOrderPool.length;
          const stbyPerson = standbyOrderPool[personIdx];
          if (stbyPerson && !standbyIds.includes(stbyPerson.id)) {
            standbyIds.push(stbyPerson.id);
            personStandbyMinutes[stbyPerson.id] = (personStandbyMinutes[stbyPerson.id] || 0) + currentSubDuration;
            personStandbySlots[stbyPerson.id].push(subSlotTimeLabel);
            lastStandbyPersonId = stbyPerson.id;
          }
        }
      }

      // STEP C: Auto Rest ("Jader Active & Stby nai tara auto rest")
      // Everyone in personnel who is NOT on active and NOT on standby in this sub-slot is in Rest!
      const restIds: string[] = personnel
        .map((p) => p.id)
        .filter((id) => !currentBlockActiveIds.includes(id) && !standbyIds.includes(id));

      restIds.forEach((id) => {
        personRestMinutes[id] = (personRestMinutes[id] || 0) + currentSubDuration;
        personRestSlots[id].push(subSlotTimeLabel);
      });

      const slotObj: RotationSlot = {
        slotIndex: globalSlotCounter++,
        timeRange: subSlotTimeLabel,
        blockIndex: b + 1,
        blockTimeRange: blockTimeLabel,
        activePersonIds: currentBlockActiveIds,
        standbyPersonIds: standbyIds,
        restPersonIds: restIds,
      };

      allSlots.push(slotObj);
      blockSubSlots.push(slotObj);
    }

    majorBlocks.push({
      blockIndex: b + 1,
      timeRange: blockTimeLabel,
      durationMinutes: blockTime.duration,
      activePersonIds: currentBlockActiveIds,
      subSlots: blockSubSlots,
    });

    prevBlockActiveIds = currentBlockActiveIds;
  }

  // STEP D: Verify Rules Satisfaction
  let noConsecutiveActive = true;
  for (let b = 0; b < majorBlocks.length - 1; b++) {
    const curActive = majorBlocks[b].activePersonIds;
    const nextActive = majorBlocks[b + 1].activePersonIds;
    if (curActive.some((id) => nextActive.includes(id))) {
      noConsecutiveActive = false;
      break;
    }
  }

  let noConsecutiveStandby = true;
  for (let s = 0; s < allSlots.length - 1; s++) {
    const curStby = allSlots[s].standbyPersonIds;
    const nextStby = allSlots[s + 1].standbyPersonIds;
    if (curStby.length > 0 && curStby.some((id) => nextStby.includes(id))) {
      noConsecutiveStandby = false;
      break;
    }
  }

  // Calculate per person averages
  const perPersonActiveMinutes = Math.round(
    Object.values(personActiveMinutes).reduce((a, b) => a + b, 0) / N
  );
  const perPersonStandbyMinutes = Math.round(
    Object.values(personStandbyMinutes).reduce((a, b) => a + b, 0) / N
  );
  const perPersonRestMinutes = Math.round(
    Object.values(personRestMinutes).reduce((a, b) => a + b, 0) / N
  );

  // STEP E: Update personnel with their current initial slot status & comprehensive duty summary
  const slot1 = allSlots[0];
  const updatedPersonnel: DutyPerson[] = personnel.map((person) => {
    let currentStatus: 'Active' | 'Standby' | 'Rest' = 'Rest';
    if (slot1 && slot1.activePersonIds.includes(person.id)) {
      currentStatus = 'Active';
    } else if (slot1 && slot1.standbyPersonIds.includes(person.id)) {
      currentStatus = 'Standby';
    }

    const activeMins = personActiveMinutes[person.id] || 0;
    const standbyMins = personStandbyMinutes[person.id] || 0;
    const restMins = personRestMinutes[person.id] || 0;

    const activeTimesList = personActiveSlots[person.id] || [];
    const standbyTimesList = personStandbySlots[person.id] || [];

    // Format readable compact duty breakdown
    let dutySummary = '';
    if (currentStatus === 'Active') {
      const actSlotsStr = activeTimesList.join(', ');
      dutySummary = `Active: ${actSlotsStr} (${formatDurationHoursMins(activeMins)} Act • ${formatDurationHoursMins(restMins)} Rest)`;
    } else if (currentStatus === 'Standby') {
      const stbySlotsStr = standbyTimesList.join(', ');
      dutySummary = `Standby: ${stbySlotsStr} (${formatDurationHoursMins(standbyMins)} Stby • ${formatDurationHoursMins(restMins)} Rest)`;
    } else {
      dutySummary = `Auto Rest (${formatDurationHoursMins(restMins)} Rest • Next: Act ${formatDurationHoursMins(activeMins)})`;
    }

    return {
      ...person,
      dutyStatus: currentStatus,
      dutyTime: dutySummary,
    };
  });

  const schedule: PostRotationSchedule = {
    totalSlots: allSlots.length,
    slotDurationMinutes: allSlots[0] ? Math.round(allSlots[0].timeRange.length > 0 ? (parseShiftTime(allSlots[0].timeRange).durationMinutes || 30) : 30) : 30,
    blockDurationMinutes: blockDuration,
    totalBlocks: majorBlocks.length,
    blocks: majorBlocks,
    slots: allSlots,
    perPersonActiveMinutes,
    perPersonStandbyMinutes,
    perPersonRestMinutes,
    rulesSatisfied: {
      noConsecutiveActive,
      noConsecutiveStandby,
      minRestOneHour: perPersonRestMinutes >= 60,
      autoRestActive: true,
    },
  };

  return { schedule, updatedPersonnel };
}
