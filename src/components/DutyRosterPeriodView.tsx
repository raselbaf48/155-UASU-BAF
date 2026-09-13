import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect } from 'react';
import { Airman, DutyAssignment, UserRole, FlightName } from '../types';
import { getFlightDutyQuotaForDate } from '../data/officialDutyRatioMatrix';
import {
 exportDutyRosterDocx,
 exportIdacRosterDocx,
 RosterSectionData,
 RosterExportItem,
 IdacRosterRow,
} from '../utils/docxExport';
import {
 Calendar,
 FileDown,
 Printer,
 RefreshCw,
 Layers,
 Shield,
 Clock,
 CheckCircle2,
 ListFilter,
} from 'lucide-react';
import { Logo155UASU } from './Logo155UASU';

interface DutyRosterPeriodViewProps {
 role: UserRole;
 airmen: Airman[];
 selectedDate?: string;
 onViewProfile?: (airman: Airman) => void;
}

export type RosterMode = 'BASE_DUTIES' | 'IDAC_DUTY';

export const DutyRosterPeriodView: React.FC<DutyRosterPeriodViewProps> = ({
 role,
 airmen,
 selectedDate = new Date().toISOString().split('T')[0],
 onViewProfile,
}) => {
 const [rosterMode, setRosterMode] = useState<RosterMode>('BASE_DUTIES');

 // Helper to get Friday-to-Thursday week boundaries
 const getDutyWeekRange = (refDateStr: string, offsetWeeks: number = 0) => {
 const [y, m, d] = (refDateStr || '2026-08-14').split('-').map(Number);
 const ref = new Date(Date.UTC(y, m - 1, d));
 const day = ref.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
 const daysSinceFriday = (day + 2) % 7;

 const start = new Date(ref);
 start.setUTCDate(ref.getUTCDate() - daysSinceFriday + offsetWeeks * 7);

 const end = new Date(start);
 end.setUTCDate(start.getUTCDate() + 6);

 const format = (dObj: Date) => {
 const yy = dObj.getUTCFullYear();
 const mm = String(dObj.getUTCMonth() + 1).padStart(2, '0');
 const dd = String(dObj.getUTCDate()).padStart(2, '0');
 return `${yy}-${mm}-${dd}`;
 };

 return {
 from: format(start),
 to: format(end),
 };
 };

 const initialThisWeek = getDutyWeekRange(selectedDate || '2026-08-14', 0);
 const [fromDate, setFromDate] = useState<string>(initialThisWeek.from);
 const [toDate, setToDate] = useState<string>(initialThisWeek.to);
 const [weekPreset, setWeekPreset] = useState<'THIS_WEEK' | 'NEXT_WEEK' | 'FULL_MONTH' | 'CUSTOM'>('THIS_WEEK');
 const [loading, setLoading] = useState<boolean>(false);
 const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
 const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);

 // Load assignments for months covered by fromDate and toDate
 const fetchRosterData = async () => {
 setLoading(true);
 try {
 const fromMonth = fromDate.slice(0, 7);
 const toMonth = toDate.slice(0, 7);
 const months = Array.from(new Set([fromMonth, toMonth]));

 const promises = months.map((mKey) =>
 fetch(`/api/roster?month=${mKey}`)
 .then(async (res) => {
 if (!res.ok) return [];
 const data = await res.json();
 if (data && Array.isArray(data.assignments)) {
 return data.assignments as DutyAssignment[];
 }
 if (Array.isArray(data)) {
 return data as DutyAssignment[];
 }
 return [];
 })
 .catch(() => [] as DutyAssignment[])
 );

 const results = await Promise.all(promises);
 const all = results.flat();
 setAssignments(all);
 } catch (err) {
 console.error('Failed to fetch period assignments:', err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchRosterData();
 const handleGlobalUpdate = () => {
 fetchRosterData();
 };
 window.addEventListener('baf_state_updated', handleGlobalUpdate);
 return () => {
 window.removeEventListener('baf_state_updated', handleGlobalUpdate);
 };
 }, [fromDate, toDate]);

 // Format date range header: e.g. "14 Aug 26 – 20 Aug 26"
 const formatDateForHeader = (dateStr: string) => {
 if (!dateStr) return '';
 const [y, m, d] = dateStr.split('-').map(Number);
 const dateObj = new Date(Date.UTC(y, m - 1, d));
 const day = String(dateObj.getUTCDate()).padStart(2, '0');
 const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 const month = months[dateObj.getUTCMonth()];
 const yr = String(dateObj.getUTCFullYear()).slice(-2);
 return `${day} ${month} ${yr}`;
 };

 const headerDateRange = `${formatDateForHeader(fromDate)} – ${formatDateForHeader(toDate)}`;

 // Generate date list in range
 const getDatesList = (startStr: string, endStr: string): string[] => {
 const list: string[] = [];
 try {
 const [sY, sM, sD] = startStr.split('-').map(Number);
 const [eY, eM, eD] = endStr.split('-').map(Number);
 const curr = new Date(Date.UTC(sY, sM - 1, sD));
 const end = new Date(Date.UTC(eY, eM - 1, eD));
 let limit = 0;
 while (curr <= end && limit < 65) {
 const yy = curr.getUTCFullYear();
 const mm = String(curr.getUTCMonth() + 1).padStart(2, '0');
 const dd = String(curr.getUTCDate()).padStart(2, '0');
 list.push(`${yy}-${mm}-${dd}`);
 curr.setUTCDate(curr.getUTCDate() + 1);
 limit++;
 }
 } catch (e) {
 // fallback
 }
 return list;
 };

 const activeDates = getDatesList(fromDate, toDate);

 // Helper to format list of consecutive day numbers into range string:
 // e.g. [1, 2, 3, 4] -> "1-4"
 // e.g. [1, 2, 3, 4, 10, 11] -> "1-4, 10-11"
 // e.g. [14, 15] -> "14-15"
 // e.g. [5] -> "5"
 const compressConsecutiveDays = (daysList: number[]): string => {
 if (!daysList || daysList.length === 0) return '';
 const sorted = Array.from(new Set(daysList)).sort((a, b) => a - b);
 const ranges: string[] = [];
 let start = sorted[0];
 let prev = sorted[0];

 for (let k = 1; k < sorted.length; k++) {
 const curr = sorted[k];
 if (curr === prev + 1) {
 prev = curr;
 } else {
 ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
 start = curr;
 prev = curr;
 }
 }
 ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
 return ranges.join(', ');
 };

 // Build Option 1: Base Duty (Up to Najirpara Taskforce / NTF)
 // Sections:
 // 1. SY DUTY (Cpl & Below) (GD)
 // 2. BASE TASKFORCE (BTF)
 // 3. NAZIRPARA TASKFORCE (NTF)
 const buildSectionItems = (dutyFilter: (code: string) => boolean): RosterExportItem[] => {
 // Collect all duty assignments matching filter in the active dates
 const assignmentsByDate = new Map<string, DutyAssignment[]>();
 activeDates.forEach(dStr => {
 const dayAss = assignments.filter((a) => a.date === dStr && dutyFilter(a.dutyCode));
 assignmentsByDate.set(dStr, dayAss);
 });

 // Extract all unique airmen involved
 const involvedAirmenIds = new Set<string>();
 assignmentsByDate.forEach(assList => {
 assList.forEach(a => involvedAirmenIds.add(a.airmanId));
 });

 // Create blocks of consecutive duties for each airman
 interface DutyBlock {
 airman: Airman;
 startDate: string;
 endDate: string;
 dates: string[];
 }
 const allBlocks: DutyBlock[] = [];

 involvedAirmenIds.forEach(airmanId => {
 const airman = airmen.find(a => a.id === airmanId);
 if (!airman) return;

 // get dates this airman has duty, sorted chronologically
 const airmanDates = activeDates.filter(dStr => {
 const dayAss = assignmentsByDate.get(dStr);
 return dayAss && dayAss.some(a => a.airmanId === airmanId);
 });

 if (airmanDates.length === 0) return;

 let currentBlock: DutyBlock = { airman, startDate: airmanDates[0], endDate: airmanDates[0], dates: [airmanDates[0]] };
 
 for (let i = 1; i < airmanDates.length; i++) {
 const prevDate = new Date(airmanDates[i - 1]);
 const currDate = new Date(airmanDates[i]);
 const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24));
 
 if (diffDays === 1) {
 // Consecutive
 currentBlock.endDate = airmanDates[i];
 currentBlock.dates.push(airmanDates[i]);
 } else {
 // Break in sequence -> push old block, start new
 allBlocks.push(currentBlock);
 currentBlock = { airman, startDate: airmanDates[i], endDate: airmanDates[i], dates: [airmanDates[i]] };
 }
 }
 allBlocks.push(currentBlock);
 });

 // Sort all blocks primarily by start date, then by rank seniority
 allBlocks.sort((a, b) => {
 return a.startDate.localeCompare(b.startDate);
 });

 const output: RosterExportItem[] = [];
 let serCounter = 1;

 allBlocks.forEach(block => {
 const getDayNum = (dStr: string) => parseInt(dStr.split('-')[2], 10);
 const startDay = getDayNum(block.startDate);
 const endDay = getDayNum(block.endDate);
 
 let dateRangeStr = `${startDay}`;
 if (startDay !== endDay) {
 dateRangeStr = `${startDay}-${endDay}`;
 }

 output.push({
 serNo: String(serCounter).padStart(2, '0'),
 bdNo: block.airman.bdNo.replace('BD/', ''),
 rank: block.airman.rank,
 name: block.airman.name,
 trade: block.airman.trade,
 block: block.airman.addressBlock || 'L/O',
 mobileNo: block.airman.mobileNo || '-',
 dateStr: dateRangeStr,
 section: '155 UASU',
 });
 serCounter++;
 });

 return output;
 };

 const syDutyItems = buildSectionItems((code) => code === 'GD');
 const baseTaskforceItems = buildSectionItems((code) => code === 'BTF');
 const nazirparaItems = buildSectionItems((code) => code === 'NTF');

 const baseDutiesSections: RosterSectionData[] = [
 {
 title: 'SY DUTY',
 subTitle: 'Cpl & Below',
 items: syDutyItems,
 },
 {
 title: 'BASE TASKFORCE',
 items: baseTaskforceItems,
 },
 {
 title: 'NAZIRPARA TASKFORCE',
 items: nazirparaItems,
 },
 ];

 // Format shift cell with proxy flight tag and flight placeholder fallback
 const formatShiftDutyDisplay = (
 dateStr: string,
 shift: 'Morning' | 'Afternoon' | 'Night',
 shiftAssignments: DutyAssignment[],
 airMap: Map<string, Airman>
 ): string => {
 const flightOrder: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];
 const requiredFlightSlots: FlightName[] = [];
 flightOrder.forEach((fl) => {
 const count = getFlightDutyQuotaForDate(dateStr, fl, 'IDAC', shift);
 for (let i = 0; i < count; i++) {
 requiredFlightSlots.push(fl);
 }
 });

 const getFlightShort = (fl: string) => {
 if (!fl) return '';
 if (fl.toLowerCase().includes('av')) return 'Avi Flt';
 if (fl.toLowerCase().includes('mech')) return 'Mech Flt';
 if (fl.toLowerCase().includes('gcs')) return 'GCS Flt';
 if (fl.toLowerCase().includes('admin') || fl.toLowerCase().includes('admn')) return 'Admn Flt';
 return `${fl} Flt`;
 };

 const assignedParts: string[] = [];
 const fulfilledFlights: FlightName[] = [];

 shiftAssignments.forEach((a) => {
 const air = airMap.get(a.airmanId);
 if (!air) {
 assignedParts.push(a.notes || 'Duty Airman');
 return;
 }

 const proxyFlight = a.proxyForFlight;
 const isProxy = proxyFlight && proxyFlight !== air.flightName;

 if (isProxy) {
 assignedParts.push(`${air.rank} ${air.name} (${getFlightShort(proxyFlight)})`);
 fulfilledFlights.push(proxyFlight);
 } else {
 assignedParts.push(`${air.rank} ${air.name}`);
 if (air.flightName) fulfilledFlights.push(air.flightName);
 }
 });

 // Calculate remaining unassigned flights from matrix quotas
 const remainingFlights = [...requiredFlightSlots];
 for (const ff of fulfilledFlights) {
 const idx = remainingFlights.indexOf(ff);
 if (idx !== -1) {
 remainingFlights.splice(idx, 1);
 } else if (remainingFlights.length > 0) {
 remainingFlights.shift();
 }
 }

 // Append flight placeholders for unfilled slots
 const placeholderParts = remainingFlights.map((rf) => getFlightShort(rf));
 const allParts = [...assignedParts, ...placeholderParts];

 if (allParts.length > 0) {
 return allParts.join(' & ');
 }

 return '-';
 };

 // Build Option 2: IDAC Center Duty Table Rows (Matching Attached BAF Format)
 // Format: Date | Day | Morning (0730F - 1430F) | Afternoon (1430F - 2100F) | Night (2100F - 0730F)
 const airmanMap = new Map<string, Airman>(airmen.map((a) => [a.id, a]));

 const idacRosterRows: IdacRosterRow[] = activeDates.map((dateStr) => {
 const [y, m, d] = dateStr.split('-').map(Number);
 const dObj = new Date(Date.UTC(y, m - 1, d));
 const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dObj.getUTCDay()];
 const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 const dateDisplay = `${d} ${months[dObj.getUTCMonth()]}`;

 const dateAss = assignments.filter((a) => a.date === dateStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA'));

 // Extract Morning, Afternoon, Night shift assignments
 const morningAss = dateAss.filter((a) => !a.idaShift || a.idaShift === 'Morning');
 const afternoonAss = dateAss.filter((a) => a.idaShift === 'Afternoon');
 const nightAss = dateAss.filter((a) => a.idaShift === 'Night');

 const morningDisplay = formatShiftDutyDisplay(dateStr, 'Morning', morningAss, airmanMap);
 const afternoonDisplay = formatShiftDutyDisplay(dateStr, 'Afternoon', afternoonAss, airmanMap);
 const nightDisplay = formatShiftDutyDisplay(dateStr, 'Night', nightAss, airmanMap);

 return {
 dateDisplay,
 dayDisplay: dayName,
 morning: morningDisplay,
 afternoon: afternoonDisplay,
 night: nightDisplay,
 };
 });

 // Handle Export Word Document (.docx)
 const handleExportDocx = async () => {
 setIsExportingDocx(true);
 try {
 if (rosterMode === 'BASE_DUTIES') {
 await exportDutyRosterDocx(
 '155 UASU, BAF',
 headerDateRange,
 baseDutiesSections,
 `Base_Duties_Roster_155_UASU_${fromDate}_to_${toDate}.docx`
 );
 } else {
 await exportIdacRosterDocx(
 '155 UASU BAF',
 headerDateRange,
 idacRosterRows,
 `IDAC_Center_Duty_Roster_155_UASU_${fromDate}_to_${toDate}.docx`
 );
 }
 } catch (err) {
 console.error('Error generating docx file:', err);
 } finally {
 setIsExportingDocx(false);
 }
 };

 const handlePrint = () => {
 window.print();
 };

 return (
 <div className="duty-register-print space-y-6">
 {/* Top Header & Option Selector Card */}
 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
 <Layers className="w-4 h-4" />
 <span>Official Duty Roster Generator • 155 UASU BAF</span>
 </div>
 <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
 Duty Roster Formats
 </h1>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
 Export and print standard BAF 155 UASU duty roster formats and Word documents.
 </p>
 </div>

 {/* Date Filter & Export Buttons */}
 <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
 {/* Quick Week / Period Presets */}
 <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold space-x-1">
 <button
 onClick={() => {
 const range = getDutyWeekRange(selectedDate || '2026-08-14', 0);
 setFromDate(range.from);
 setToDate(range.to);
 setWeekPreset('THIS_WEEK');
 }}
 className={`px-3 py-1.5 rounded-lg transition-all ${
 weekPreset === 'THIS_WEEK'
 ? 'bg-emerald-600 text-white shadow-xs font-black'
 : 'text-slate-700 dark:text-slate-300 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
 }`}
 >
 This Week (Fri – Thu)
 </button>
 <button
 onClick={() => {
 const range = getDutyWeekRange(selectedDate || '2026-08-14', 1);
 setFromDate(range.from);
 setToDate(range.to);
 setWeekPreset('NEXT_WEEK');
 }}
 className={`px-3 py-1.5 rounded-lg transition-all ${
 weekPreset === 'NEXT_WEEK'
 ? 'bg-emerald-600 text-white shadow-xs font-black'
 : 'text-slate-700 dark:text-slate-300 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
 }`}
 >
 Next Week (Fri – Thu)
 </button>
 <button
 onClick={() => {
 const now = new Date(selectedDate || '2026-08-14');
 const y = now.getFullYear();
 const m = String(now.getMonth() + 1).padStart(2, '0');
 const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
 setFromDate(`${y}-${m}-01`);
 setToDate(`${y}-${m}-${lastDay}`);
 setWeekPreset('FULL_MONTH');
 }}
 className={`px-2.5 py-1.5 rounded-lg transition-all ${
 weekPreset === 'FULL_MONTH'
 ? 'bg-emerald-600 text-white shadow-xs font-black'
 : 'text-slate-700 dark:text-slate-300 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
 }`}
 >
 Full Month
 </button>
 </div>

 <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold space-x-2">
 <span className="text-slate-500 font-semibold">From:</span>
 <DateNavigator
 
 value={fromDate || ''}
 onChange={(e) => {
 setFromDate(e.target.value);
 setWeekPreset('CUSTOM');
 }}
 className="bg-transparent text-slate-900 dark:text-white font-black outline-none cursor-pointer"
 />
 <span className="text-slate-400 font-semibold">To:</span>
 <DateNavigator
 
 value={toDate || ''}
 onChange={(e) => {
 setToDate(e.target.value);
 setWeekPreset('CUSTOM');
 }}
 className="bg-transparent text-slate-900 dark:text-white font-black outline-none cursor-pointer"
 />
 </div>

 {/* Refresh button */}
 

 {/* Export document button */}
 <button
 onClick={handleExportDocx}
 disabled={isExportingDocx}
 className="flex items-center space-x-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
 title="Download formatted document"
 >
 <FileDown className="w-4 h-4" />
 <span>{isExportingDocx ? 'Generating...' : 'Download Document'}</span>
 </button>

 {/* Print PDF button */}
 <button
 onClick={handlePrint}
 className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
 title="Print or Save as PDF"
 >
 <Printer className="w-4 h-4" />
 <span>Official Export / Print</span>
 </button>
 </div>
 </div>

 {/* 2 OPTIONS / TABS SWITCHER */}
 <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800 dark:border-slate-700 pb-3">
 <button
 onClick={() => setRosterMode('BASE_DUTIES')}
 className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-xs ${
 rosterMode === 'BASE_DUTIES'
 ? 'bg-emerald-600 text-white shadow-emerald-600/20'
 : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
 }`}
 >
 <Shield className="w-4 h-4" />
 <span>Base Duty</span>
 </button>

 <button
 onClick={() => setRosterMode('IDAC_DUTY')}
 className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-xs ${
 rosterMode === 'IDAC_DUTY'
 ? 'bg-blue-700 text-white shadow-blue-700/20'
 : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
 }`}
 >
 <Clock className="w-4 h-4" />
 <span>IDAC Duty</span>
 </button>
 </div>

 {/* ========================================================================= */}
 {/* OPTION 1: BASE DUTY (Up to Najirpara Taskforce with Range 1-4 Format) */}
 {/* ========================================================================= */}
 {rosterMode === 'BASE_DUTIES' && (
 <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg p-6 sm:p-10 max-w-4xl mx-auto font-sans print:p-0 print:border-none print:shadow-none">
 {/* Document Header */}
 <div className="text-center pb-4 border-b border-slate-300 dark:border-slate-700">
 <div className="flex justify-center mb-2">
 <Logo155UASU className="h-14 w-14" />
 </div>
 <h2 className="text-base sm:text-lg font-black uppercase tracking-wider underline">
 BASE DUTY: AIRMEN
 </h2>
 <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
 (155 UASU, BAF)
 </h3>
 <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
 ({headerDateRange})
 </p>
 </div>

 {/* Section Tables */}
 <div className="mt-6 space-y-8">
 {baseDutiesSections.map((sec, sIdx) => {
 if (sec.items.length === 0) return null;

 return (
 <div key={sIdx} className="space-y-2">
 {/* Section Title */}
 <div className="text-center">
 <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider underline">
 {sec.title}
 </h4>
 {sec.subTitle && (
 <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 dark:text-slate-300">
 ({sec.subTitle})
 </div>
 )}
 </div>

 {/* Table */}
 <div className="overflow-x-auto">
 <table className="w-full text-center border-collapse border border-black dark:border-white print:border-black text-xs font-medium">
 <thead>
 <tr className="bg-slate-200/80 dark:bg-slate-800/80 font-bold border-b border-black dark:border-white print:border-black text-[11px]">
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2 w-12">Ser No</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2">BD No</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2">Rank</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-3 text-center">Name</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2">Trade</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2">Block</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2">Mobile No</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2">Date</th>
 <th className="border border-black dark:border-white print:border-black py-1.5 px-2">Section</th>
 </tr>
 </thead>
 <tbody>
 {sec.items.map((item, idx) => (
 <tr key={idx} className="border-b border-black dark:border-white print:border-black hover:bg-slate-50 dark:hover:bg-slate-800">
 <td className="border border-black dark:border-white print:border-black py-1 px-2 font-mono">
 {item.serNo}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-2 font-mono font-bold">
 {item.bdNo}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-2 font-bold">
 {item.rank}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-3 text-center font-bold">
 {item.name}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-2">
 {item.trade}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-2 font-mono">
 {item.block}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-2 font-mono font-bold text-slate-800 dark:text-slate-200">
 {item.mobileNo}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-2 font-bold bg-slate-50 dark:bg-slate-800">
 {item.dateStr}
 </td>
 <td className="border border-black dark:border-white print:border-black py-1 px-2 font-bold">
 {item.section}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
 })}

 {/* Empty notice if no duties in this period */}
 {baseDutiesSections.every((s) => s.items.length === 0) && (
 <div className="py-12 text-center text-slate-400">
 <p className="text-sm font-semibold">
 No base duties assigned for the period {headerDateRange}.
 </p>
 <p className="text-xs mt-1">
 Assign duties from the Duty Register or Overview to populate this roster.
 </p>
 </div>
 )}
 </div>
 </div>
 )}

 {/* ========================================================================= */}
 {/* OPTION 2: IDAC DUTY (IDA CENTER DUTY - Font 12 Arial, Bold Header, Normal Below) */}
 {/* ========================================================================= */}
 {rosterMode === 'IDAC_DUTY' && (
 <div
 id="idac-duty-roster-sheet"
 className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border border-slate-300 dark:border-slate-700 shadow-lg p-6 sm:p-10 max-w-4xl mx-auto font-[Arial,Helvetica,sans-serif] print:p-0 print:border-none print:shadow-none"
 style={{ fontFamily: 'Arial, sans-serif' }}
 >
 {/* Document Header */}
 <div className="text-center pb-5 border-b border-slate-300 dark:border-slate-700">
 <div className="flex justify-center mb-2">
 <Logo155UASU className="h-14 w-14" />
 </div>
 <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide underline text-slate-950 dark:text-white">
 DUTY ROSTER : 155 UASU BAF
 </h2>
 <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
 (IDA CENTER DUTY)
 </h3>
 <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
 ({headerDateRange})
 </p>
 </div>

 {/* IDA Center Duty Table */}
 <div className="mt-6 overflow-x-auto">
 <table
 className="w-full text-center border-collapse border border-black dark:border-white print:border-black"
 style={{
 fontFamily: 'Arial, sans-serif',
 fontSize: '12pt',
 lineHeight: '1.4',
 }}
 >
 <thead>
 {/* Table Heading Row Bold */}
 <tr className="bg-slate-200/90 dark:bg-slate-800/90 font-bold border-b border-black dark:border-white print:border-black text-slate-950 dark:text-white">
 <th className="border border-black dark:border-white print:border-black py-2.5 px-3 font-bold w-24">Date</th>
 <th className="border border-black dark:border-white print:border-black py-2.5 px-3 font-bold w-28">Day</th>
 <th className="border border-black dark:border-white print:border-black py-2.5 px-4 font-bold">
 Morning
 <div className="text-[10pt] font-normal text-slate-700 dark:text-slate-300 dark:text-slate-300">(0730F - 1430F)</div>
 </th>
 <th className="border border-black dark:border-white print:border-black py-2.5 px-4 font-bold">
 Afternoon
 <div className="text-[10pt] font-normal text-slate-700 dark:text-slate-300 dark:text-slate-300">(1430F - 2100F)</div>
 </th>
 <th className="border border-black dark:border-white print:border-black py-2.5 px-4 font-bold">
 Night
 <div className="text-[10pt] font-normal text-slate-700 dark:text-slate-300 dark:text-slate-300">(2100F - 0730F)</div>
 </th>
 </tr>
 </thead>
 <tbody>
 {/* Data Rows: Normal Weight below heading */}
 {idacRosterRows.map((row, idx) => (
 <tr
 key={idx}
 className={`border-b border-black dark:border-white print:border-black ${idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'}`}
 >
 {/* Date */}
 <td className="border border-black dark:border-white print:border-black py-2 px-3 font-normal text-slate-900 dark:text-white whitespace-nowrap">
 {row.dateDisplay}
 </td>

 {/* Day */}
 <td className="border border-black dark:border-white print:border-black py-2 px-3 font-normal text-slate-900 dark:text-white whitespace-nowrap">
 {row.dayDisplay}
 </td>

 {/* Morning (0730F - 1430F) */}
 <td className="border border-black dark:border-white print:border-black py-2 px-3 font-normal text-slate-900 dark:text-white">
 {row.morning}
 </td>

 {/* Afternoon (1430F - 2100F) */}
 <td className="border border-black dark:border-white print:border-black py-2 px-3 font-normal text-slate-900 dark:text-white">
 {row.afternoon}
 </td>

 {/* Night (2100F - 0730F) */}
 <td className="border border-black dark:border-white print:border-black py-2 px-3 font-normal text-slate-900 dark:text-white">
 {row.night}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
};
