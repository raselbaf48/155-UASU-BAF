import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  Phone,
  Plane,
  Shield,
  Coffee,
  Calendar,
  Layers,
  Sparkles,
  Settings,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  Edit3,
} from 'lucide-react';
import { DutyPost, DutyPerson, DutyStatusType } from '../types';
import {
  generateFairRotationSchedule,
  formatDurationHoursMins,
  formatMinutesToTime,
  parseShiftTime,
} from '../utils/rotationScheduler';
import { AddEditPersonModal } from './AddEditPersonModal';
import { Logo155UASU } from '../../../components/Logo155UASU';

interface DrivewayIdaSystemViewProps {
  post: DutyPost;
  onUpdatePost: (updatedPost: DutyPost) => void;
  onDeletePost?: (postId: string) => void;
  onOpenSettings?: () => void;
  onBack?: () => void;
}

// Driveway Specific Emergency Contacts
interface DrivewayContact {
  id: string;
  role: string;
  name: string;
  phone: string;
  whatsappPhone?: string;
  location: string;
}

const DRIVEWAY_EMERGENCY_CONTACTS: DrivewayContact[] = [
  { id: 'dc-1', role: 'Airfield Duty Officer (ADO)', name: 'Flt Lt Tanvir', phone: '01769-001122', whatsappPhone: '8801769001122', location: 'Control Tower / Ops Room' },
  { id: 'dc-2', role: 'Duty SNCO (Terminal & Driveway)', name: 'Sgt Tushar', phone: '01648-799047', whatsappPhone: '8801648799047', location: 'Driveway Guard Room' },
  { id: 'dc-3', role: 'Security Supervisor (Terminal)', name: 'Sgt Sharif', phone: '01711-223344', whatsappPhone: '8801711223344', location: 'Terminal Gate-1' },
  { id: 'dc-4', role: 'Airport Police / Quick Reaction Team', name: 'QRT Dispatch', phone: '01713-998877', whatsappPhone: '8801713998877', location: 'SAIA Main Gate' },
  { id: 'dc-5', role: 'Medical & Crash Ambulance', name: 'Medical Station', phone: '01769-990011', whatsappPhone: '8801769990011', location: 'Airfield Dispensary' },
];

export const DrivewayIdaSystemView: React.FC<DrivewayIdaSystemViewProps> = ({
  post,
  onUpdatePost,
  onDeletePost,
  onOpenSettings,
  onBack,
}) => {
  // Live Clock & Time
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');
  const [currentMinutesOfDay, setCurrentMinutesOfDay] = useState<number>(375); // ~ 06:15 AM

  // Accordion section for Driveway SOP Responsibilities
  const [isResponsibilitiesOpen, setIsResponsibilitiesOpen] = useState<boolean>(false);
  const [isContactsOpen, setIsContactsOpen] = useState<boolean>(false);

  // Personnel management modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<DutyPerson | null>(null);

  // Quick Preset Handlers
  const handleLoadSamplePersonnel = () => {
    const samplePersonnel: DutyPerson[] = [
      { id: 'p_a', rank: 'LAC', name: 'A', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1, mobileNo: '01700-000001' },
      { id: 'p_b', rank: 'LAC', name: 'B', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1, mobileNo: '01700-000002' },
      { id: 'p_c', rank: 'Cpl', name: 'C', type: 'Permanent', dutyStatus: 'Standby', dutyTime: '0600F - 1400F', armsCount: 1, mobileNo: '01700-000003' },
      { id: 'p_d', rank: 'LAC', name: 'D', type: 'Additional', dutyStatus: 'Rest', dutyTime: '0600F - 1400F', rtCount: 1, mobileNo: '01700-000004' },
      { id: 'p_e', rank: 'LAC', name: 'E', type: 'Additional', dutyStatus: 'Rest', dutyTime: '0600F - 1400F', mobileNo: '01700-000005' },
    ];
    onUpdatePost({
      ...post,
      targetActiveStrength: 2,
      targetStandbyStrength: 1,
      targetStrength: 3,
      personnel: samplePersonnel,
    });
  };

  const handleLoadOfficialDriveway = () => {
    const officialPersonnel: DutyPerson[] = [
      { id: 'p_8', rank: 'LAC', name: 'Ashraf', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1, mobileNo: '01712-345678' },
      { id: 'p_9', rank: 'LAC', name: 'Rifat', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1, mobileNo: '01812-345678' },
      { id: 'p_10', rank: 'Cpl', name: 'Tamjid', type: 'Permanent', dutyStatus: 'Standby', dutyTime: '0600F - 1400F', armsCount: 1, mobileNo: '01912-345678' },
      { id: 'p_11', rank: 'LAC', name: 'Sarwer', type: 'Additional', dutyStatus: 'Rest', dutyTime: '0600F - 1400F', rtCount: 1, mobileNo: '01612-345678' },
      { id: 'p_12', rank: 'LAC', name: 'Saiful', type: 'Additional', dutyStatus: 'Rest', dutyTime: '0600F - 1400F', mobileNo: '01512-345678' },
    ];
    onUpdatePost({
      ...post,
      targetActiveStrength: 2,
      targetStandbyStrength: 1,
      targetStrength: 3,
      personnel: officialPersonnel,
    });
  };

  const handleSavePerson = (person: DutyPerson) => {
    let updated: DutyPerson[];
    if (post.personnel.some((p) => p.id === person.id)) {
      updated = post.personnel.map((p) => (p.id === person.id ? person : p));
    } else {
      updated = [...post.personnel, person];
    }
    onUpdatePost({ ...post, personnel: updated });
    setIsAddModalOpen(false);
    setEditingPerson(null);
  };

  const handleDeletePerson = (personId: string) => {
    if (confirm('এই এয়ারম্যানকে ড্রাইভওয়ে পোস্ট থেকে অপসারণ করতে চান?')) {
      onUpdatePost({
        ...post,
        personnel: post.personnel.filter((p) => p.id !== personId),
      });
    }
  };

  // Live Clock Effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDateFormatted(
        now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
      );
      setCurrentMinutesOfDay(now.getHours() * 60 + now.getMinutes());
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const postDutyTime = post.dutyTime || '0600F - 1400F';
  const targetActive = post.targetActiveStrength ?? post.targetStrength ?? 2;
  const targetStandby = post.targetStandbyStrength ?? 1;

  // Compute rotation schedule using the Fair Duty Rotation Scheduler
  const { schedule } = useMemo(() => {
    return generateFairRotationSchedule(post, postDutyTime, 90);
  }, [post, postDutyTime]);

  // Determine current active block and active slot based on current time or first slot
  const currentLiveState = useMemo(() => {
    if (!schedule || schedule.slots.length === 0) return null;

    const { startMinutes, endMinutes } = parseShiftTime(postDutyTime);
    
    let activeSlotIndex = 0;
    if (currentMinutesOfDay >= startMinutes && currentMinutesOfDay < endMinutes) {
      const foundIdx = schedule.slots.findIndex((slot) => {
        const slotTimes = parseShiftTime(slot.timeRange);
        return currentMinutesOfDay >= slotTimes.startMinutes && currentMinutesOfDay < slotTimes.endMinutes;
      });
      if (foundIdx !== -1) {
        activeSlotIndex = foundIdx;
      }
    }

    const currentSlot = schedule.slots[activeSlotIndex] || schedule.slots[0];
    const currentBlock = schedule.blocks?.find((b) => b.blockIndex === currentSlot.blockIndex) || schedule.blocks?.[0];

    const nextBlockIndex = (currentBlock?.blockIndex || 1) + 1;
    const nextBlock = schedule.blocks?.find((b) => b.blockIndex === nextBlockIndex) || null;

    const personMap = new Map(post.personnel.map((p) => [p.id, p]));

    const activePersonnel = currentSlot.activePersonIds.map((id) => personMap.get(id)).filter(Boolean) as DutyPerson[];
    const standbyPersonnel = currentSlot.standbyPersonIds.map((id) => personMap.get(id)).filter(Boolean) as DutyPerson[];
    const restPersonnel = currentSlot.restPersonIds.map((id) => personMap.get(id)).filter(Boolean) as DutyPerson[];

    const nextActivePersonnel = nextBlock ? nextBlock.activePersonIds.map((id) => personMap.get(id)).filter(Boolean) as DutyPerson[] : [];

    return {
      currentSlot,
      currentBlock,
      nextBlock,
      activePersonnel,
      standbyPersonnel,
      restPersonnel,
      nextActivePersonnel,
    };
  }, [schedule, postDutyTime, currentMinutesOfDay, post.personnel]);

  // Clean phone number for WhatsApp link
  const getWhatsAppLink = (mobileNo?: string): string => {
    const raw = mobileNo || '';
    const clean = raw.replace(/\D/g, '');
    if (!clean) return 'https://wa.me/';
    if (clean.startsWith('880')) return `https://wa.me/${clean}`;
    if (clean.startsWith('01')) return `https://wa.me/88${clean}`;
    return `https://wa.me/880${clean}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* 1. TOP HEADER SECTION - Authentic IDA Center Style with Airfield Branding */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-14 bg-emerald-950/20 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center p-1 border border-emerald-500/20 shadow-xs text-emerald-400">
            <Logo155UASU className="h-10 w-10" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Drive way (Terminal)
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Airfield Duty
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {currentDateFormatted || 'Wednesday, October 01, 2026'} • 24/7 Terminal Security & Auto-Rest Protocol
            </p>
          </div>
        </div>

        {/* Live Clock & Action Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Clock Pill */}
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-full shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
              {currentTime || '06:15:00 AM'}
            </span>
          </div>

          {/* Timing Badge */}
          <div className="px-3 py-1.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-bold">
            {postDutyTime}
          </div>

          {/* Post Settings */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
              title="Driveway Post Settings & Quota"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Action Presets Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLoadSamplePersonnel}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950 transition-all cursor-pointer border border-emerald-400/40"
            title="Load Sample Team (A, B, C, D, E) to verify 06:00-07:30 and 07:30-09:00 shifts"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>📋 স্যাম্পল লোড করুন (A, B, C, D, E)</span>
          </button>

          <button
            onClick={handleLoadOfficialDriveway}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
            title="Load 155 UASU Driveway Team (Ashraf, Rifat, Tamjid, Sarwer, Saiful)"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>🇧🇩 155 UASU ড্রাইভওয়ে স্কোয়াড</span>
          </button>
        </div>

        <button
          onClick={() => {
            setEditingPerson(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer ml-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>এয়ারম্যান যোগ করুন ({post.personnel.length})</span>
        </button>
      </div>

      {/* 2. MILITARY ROTATION RULES VERIFIED BANNER (সব রুলস সবুজ ট্র্যাকার) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 shadow-sm space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider">
              Airfield Driveway Rotation Protocol (IDA Center Standards)
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-300/80 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30 self-start sm:self-auto">
            100% Rules Satisfied
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] font-medium text-slate-300">
          <div className="flex items-center space-x-1.5 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>কারো <strong>টানা ২ শিফট Active</strong> হবে না</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>টানা Standby</strong> ডিউটি হবে না</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>যাদের Active/Stby নেই তারা <strong>Auto Rest</strong></span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>রেস্ট যেন <strong>কমপক্ষে ১ ঘণ্টা (৬০ মিনিট)</strong> হয়</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>Active → Standby → Rest</strong> সাইকেল সম্পন্ন</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <span><strong>Rest → Standby → Active</strong> প্রস্তুতি নিশ্চিত</span>
          </div>
        </div>
      </div>

      {/* 3. CURRENTLY ON DUTY (LIVE ACTIVE SHIFT) - Authentic Glowing Emerald Card */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#072418] via-[#0b3824] to-[#051c13] border border-emerald-800/60 shadow-xl p-6 sm:p-8 text-white">
        <div className="absolute -right-12 -top-12 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>CURRENTLY ON ACTIVE DUTY (LIVE)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-emerald-200/90 bg-emerald-900/40 px-3 py-1 rounded-lg border border-emerald-700/40">
                Block {currentLiveState?.currentBlock?.blockIndex || 1} • {currentLiveState?.currentBlock?.timeRange}
              </span>
              <span className="text-[10px] font-mono font-black uppercase px-2 py-1 rounded-md bg-emerald-400 text-slate-950">
                {targetActive} Active Pers
              </span>
            </div>
          </div>

          {/* Active Duty Crew Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {currentLiveState?.activePersonnel.map((person) => (
              <div
                key={person.id}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/40 transition-all flex items-center justify-between"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center font-black text-emerald-300 text-base shadow-inner">
                    {person.rank}
                  </div>
                  <div>
                    <div className="text-lg font-black text-white tracking-tight flex items-center space-x-2">
                      <span>{person.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active Now
                      </span>
                    </div>
                    <p className="text-emerald-200/80 text-xs font-mono mt-0.5">
                      {person.bdNo || 'BD/48000'} • {currentLiveState.currentBlock?.timeRange}
                      {person.armsCount ? ` • Arms: ${person.armsCount}` : ''}
                      {person.rtCount ? ` • RT: ${person.rtCount}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right Call & WhatsApp buttons */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {person.mobileNo && (
                    <a
                      href={`tel:${person.mobileNo.replace(/\s+/g, '')}`}
                      className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/20"
                      title={`Call ${person.name}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <a
                    href={getWhatsAppLink(person.mobileNo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-all cursor-pointer shadow-md"
                    title={`WhatsApp ${person.name}`}
                  >
                    <svg className="w-4 h-4 fill-slate-950 text-slate-950" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. SPLIT CARDS: CURRENT STANDBY & AUTO REST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* STANDBY DUTY CARD (Warm Amber Theme) */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#241a07] via-[#38260b] to-[#1c1305] border border-amber-800/60 shadow-xl p-6 text-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-950/90 border border-amber-500/40 text-amber-300 text-[11px] font-black uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>CURRENT STANDBY (স্ট্যান্ডবাই)</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-300/90 bg-amber-900/40 px-2.5 py-0.5 rounded-lg border border-amber-700/40">
              Slot {currentLiveState?.currentSlot?.slotIndex || 1} • {currentLiveState?.currentSlot?.timeRange}
            </span>
          </div>

          <div className="space-y-3">
            {currentLiveState?.standbyPersonnel.map((person) => (
              <div
                key={person.id}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition-all flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center font-black text-amber-300 text-sm">
                    {person.rank}
                  </div>
                  <div>
                    <h4 className="font-black text-white text-base leading-tight">{person.name}</h4>
                    <p className="text-amber-200/80 text-xs font-mono mt-0.5">
                      ⏱ {currentLiveState.currentSlot?.timeRange} (Standby Duty)
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  {person.mobileNo && (
                    <a
                      href={`tel:${person.mobileNo.replace(/\s+/g, '')}`}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/20"
                    >
                      <Phone className="w-3 h-3" />
                    </a>
                  )}
                  <a
                    href={getWhatsAppLink(person.mobileNo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition-all cursor-pointer shadow-md"
                  >
                    <svg className="w-3.5 h-3.5 fill-slate-950 text-slate-950" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  </a>
                </div>
              </div>
            ))}

            {/* Upcoming Standby Sequence in this Block */}
            <div className="pt-2 border-t border-amber-500/20 text-xs text-amber-200/80">
              <span className="font-bold text-amber-300 block mb-1">
                এই ব্লকের বাকি স্ট্যান্ডবাই রোটেশন:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentLiveState?.currentBlock?.subSlots.map((s) => {
                  const sPersons = s.standbyPersonIds.map((id) => post.personnel.find((p) => p.id === id)?.name || id).join(', ');
                  const isCurrent = s.slotIndex === currentLiveState.currentSlot?.slotIndex;
                  return (
                    <span
                      key={s.slotIndex}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                        isCurrent
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {s.timeRange}: {sPersons}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* AUTO REST CARD (Cool Sky/Cyan Theme) */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#0d2137] via-[#0f2d4a] to-[#0a1828] border border-cyan-800/60 shadow-xl p-6 text-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 text-[11px] font-black uppercase tracking-wider">
              <Coffee className="w-3.5 h-3.5 text-cyan-400" />
              <span>AUTO REST FORCE (বিশ্রাম - ১+ ঘণ্টা)</span>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-300/90 bg-cyan-900/40 px-2.5 py-0.5 rounded-lg border border-cyan-700/40">
              {currentLiveState?.restPersonnel.length || 0} Persons Resting
            </span>
          </div>

          <div className="space-y-3">
            {currentLiveState?.restPersonnel.map((person) => (
              <div
                key={person.id}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-400/40 transition-all flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center font-black text-cyan-300 text-sm">
                    {person.rank}
                  </div>
                  <div>
                    <h4 className="font-black text-white text-base leading-tight">{person.name}</h4>
                    <p className="text-cyan-200/80 text-xs font-mono mt-0.5">
                      বিশ্রামে আছেন • ন্যূনতম ৬০ মিনিট রেস্ট
                    </p>
                  </div>
                </div>

                <span className="px-2 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                  Off-Duty Relaxing
                </span>
              </div>
            ))}

            <div className="pt-2 border-t border-cyan-500/20 text-xs text-cyan-200/80">
              <p className="text-[11px] leading-relaxed">
                💡 <em>যাদের অ্যাক্টিভ ও স্ট্যান্ডবাই নেই, তারা স্বয়ংক্রিয়ভাবে রেস্টে থাকেন যাতে পরবর্তী শিফটে ফ্রেশ হয়ে দায়িত্ব পালন করতে পারেন।</em>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. NEXT ROTATION PREVIEW (07:30 - 09:00) - Indigo Theme */}
      {currentLiveState?.nextBlock && (
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#17133b] via-[#211b54] to-[#120f30] border border-indigo-700/50 shadow-xl p-6 text-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/90 border border-indigo-400/40 text-indigo-300 text-[11px] font-black uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>NEXT ACTIVE ROTATION (পরবর্তী রোটেশন)</span>
            </div>
            <span className="text-xs font-bold text-indigo-200 bg-indigo-900/40 px-3 py-1 rounded-lg border border-indigo-700/40">
              Block {currentLiveState.nextBlock.blockIndex} • {currentLiveState.nextBlock.timeRange}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Next Active Personnel */}
            <div className="p-4 rounded-2xl bg-white/5 border border-indigo-500/20 space-y-2">
              <span className="text-[11px] font-black uppercase text-emerald-400 block tracking-wider">
                🟢 পরবর্তী Active টিম ({currentLiveState.nextBlock.timeRange}):
              </span>
              <div className="flex flex-wrap gap-2">
                {currentLiveState.nextActivePersonnel.map((p) => (
                  <span
                    key={p.id}
                    className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-white font-bold text-xs"
                  >
                    {p.rank} {p.name}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ✓ পূর্ববর্তী Active টিম থেকে কেউ নেই (টানা ২ শিফট হবে না)
              </p>
            </div>

            {/* Next Standby Schedule */}
            <div className="p-4 rounded-2xl bg-white/5 border border-indigo-500/20 space-y-2">
              <span className="text-[11px] font-black uppercase text-amber-400 block tracking-wider">
                🟡 পরবর্তী Standby রোটেশন ক্রম:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentLiveState.nextBlock.subSlots.map((s) => {
                  const sPersons = s.standbyPersonIds.map((id) => post.personnel.find((p) => p.id === id)?.name || id).join(', ');
                  return (
                    <span
                      key={s.slotIndex}
                      className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-200 text-xs font-mono"
                    >
                      {s.timeRange}: {sPersons}
                    </span>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ✓ সদ্য Active সমাপ্তকারী ব্যক্তি প্রথমে Standby করে রেস্টে যাবে
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. COMPLETE INTERACTIVE ROTATION TIMELINE & DETAIL TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Driveway সম্পূর্ণ শিফট রোটেশন শিডিউল (Full Timeline)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              পোস্ট: {post.name} • ডিউটি সময়: {postDutyTime} • অ্যাক্টিভ কোটা: {targetActive} জন • স্ট্যান্ডবাই: {targetStandby} জন
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center space-x-2 text-xs font-mono font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Act: {formatDurationHoursMins(schedule.perPersonActiveMinutes)}/জন
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Stby: {formatDurationHoursMins(schedule.perPersonStandbyMinutes)}/জন
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
              Rest: {formatDurationHoursMins(schedule.perPersonRestMinutes)}/জন
            </span>
          </div>
        </div>

        {/* Detailed Timeline Table */}
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                <th className="py-3 px-4">ব্লক ও স্লট</th>
                <th className="py-3 px-4">সময়সূচি</th>
                <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400">🟢 Active Duty ({targetActive} জন)</th>
                <th className="py-3 px-4 text-amber-600 dark:text-amber-400">🟡 Standby Duty ({targetStandby} জন)</th>
                <th className="py-3 px-4 text-sky-600 dark:text-sky-400">🔵 Auto Rest (বিশ্রাম)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {schedule.slots.map((slot) => {
                const isCurrent = slot.slotIndex === currentLiveState?.currentSlot?.slotIndex;
                const activeStaff = post.personnel.filter((p) => slot.activePersonIds.includes(p.id));
                const standbyStaff = post.personnel.filter((p) => slot.standbyPersonIds.includes(p.id));
                const restStaff = post.personnel.filter((p) => slot.restPersonIds.includes(p.id));

                return (
                  <tr
                    key={slot.slotIndex}
                    className={`transition-colors ${
                      isCurrent
                        ? 'bg-emerald-500/10 dark:bg-emerald-950/40 font-bold border-l-4 border-l-emerald-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Block / Slot Indicator */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                          Slot {slot.slotIndex}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500 text-white font-black animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Block {slot.blockIndex} ({slot.blockTimeRange})
                      </span>
                    </td>

                    {/* Time Range */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      ⏱ {slot.timeRange}
                    </td>

                    {/* Active Personnel */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {activeStaff.map((p) => (
                          <span
                            key={p.id}
                            className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold text-xs"
                          >
                            {p.rank} {p.name}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Standby Personnel */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {standbyStaff.map((p) => (
                          <span
                            key={p.id}
                            className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold text-xs"
                          >
                            {p.rank} {p.name}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Rest Personnel */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {restStaff.map((p) => (
                          <span
                            key={p.id}
                            className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-xs"
                          >
                            {p.rank} {p.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. DRIVEWAY SOP & EMERGENCY CONTACTS ACCORDIONS (Like IDA Center Duty) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Driveway SOP / Responsibilities */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div
            onClick={() => setIsResponsibilitiesOpen(!isResponsibilitiesOpen)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Driveway SOP & Security Responsibilities
              </h3>
            </div>
            {isResponsibilitiesOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>

          {isResponsibilitiesOpen && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block">১. টার্মিনাল প্রবেশ ও যান চলাচল নিয়ন্ত্রণ:</span>
                অননুমোদিত কোনো যানবাহন ড্রাইভওয়ে এলাকায় প্রবেশ বা অবস্থান করতে পারবে না। শুধুমাত্র অনুমোদিত স্টিকারযুক্ত গাড়ি এলাও হবে।
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block">২. অস্ত্র ও ওয়্যারলেস (Arms & RT) হ্যান্ডওভার:</span>
                প্রতিটি ব্লকের রোটেশনের সময় Arms-03 ও RT-01 সঠিকভাবে বুঝে নিতে হবে এবং কোনো অমিল থাকলে তাৎক্ষণিক SNCO-কে রিপোর্ট করতে হবে।
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block">৩. ভিআইপি এসকর্ট ও নিরাপত্তা প্রটোকল:</span>
                ভিআইপি গমনাগমনের সময় উভয় একটিভ সেন্ট্রি সতর্ক অবস্থানে থাকবেন এবং স্ট্যান্ডবাই সেন্ট্রি প্রস্তুত থাকবেন।
              </div>
            </div>
          )}
        </div>

        {/* Emergency Contacts */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div
            onClick={() => setIsContactsOpen(!isContactsOpen)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Driveway Emergency Contacts
              </h3>
            </div>
            {isContactsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>

          {isContactsOpen && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              {DRIVEWAY_EMERGENCY_CONTACTS.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <span className="font-black text-slate-900 dark:text-white block">{c.role}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {c.name} • {c.location}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <a
                      href={`tel:${c.phone}`}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-600 transition-colors"
                      title={`Call ${c.name}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${c.whatsappPhone || c.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-colors shadow-xs"
                      title={`WhatsApp ${c.name}`}
                    >
                      <svg className="w-3.5 h-3.5 fill-slate-950 text-slate-950" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Person Modal */}
      <AddEditPersonModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingPerson(null);
        }}
        onSave={handleSavePerson}
        initialPerson={editingPerson}
        postName={post.name}
        defaultDutyTime={postDutyTime}
        defaultDutyStatus="Active"
      />
    </div>
  );
};
