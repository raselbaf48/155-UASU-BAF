import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
 Airman,
 FlightName,
 ParadeShift,
 ParadeStateResponse,
 UserRole,
 DutyCategoryCode,
 IDAShift,
} from '../types';
import { DUTY_TYPES, DUTY_TYPE_MAP } from '../data/dutyTypes';
import { formatDutyOnShortName, formatDutyOffShortName } from '../utils/dutyFormatter';
import {
 Calendar,
 Printer,
 RefreshCw,
 Shield,
 Users,
 Search,
 Plus,
 Edit3,
 Eye,
 EyeOff,
 Filter,
 MapPin,
 Phone,
 Sliders,
 CalendarRange,
 X,
 Check,
 ChevronDown,
 ChevronUp,
 Download,
 FileDown,
 UserPlus,
 PenTool,
 CheckSquare,
Settings,
} from 'lucide-react';
import { DutyCellPopover } from './DutyCellPopover';
import { getStoredDutyRatiosForDate } from '../data/dutyRatios';
import { getIdacShiftsForDateAndFlight } from '../data/officialDutyRatioMatrix';
import { FlightDutyRatioModal } from './FlightDutyRatioModal';
import {
 SignatureConfigModal,
 getSavedPreparedBy,
 getSavedAuthorizedBy,
 SignatureDetails,
} from './SignatureConfigModal';
import {
 exportParadeStateSingleDocx,
 exportParadeStateMultiDocx,
 MultiParadeDayItem,
} from '../utils/docxExport';

interface NightCountStateViewProps {
 role?: UserRole;
 userFlight?: string;
 selectedDate: string;
 setSelectedDate: (date: string) => void;
 airmen: Airman[];
 initialDocumentType?: 'PARADE' | 'PT';
 onOpenPrintModal?: () => void;
 onViewAirmanProfile?: (airman: Airman) => void;
  onDownloadDocx?: () => void;
 onOpenImportModal?: () => void;
}

export const PrintableNightCountModal: React.FC<NightCountStateViewProps & { onClose: () => void }> = ({
 onClose,

 role = 'ADMIN',
 userFlight,
 selectedDate,
 setSelectedDate,
 airmen,
 initialDocumentType = 'NIGHT',
 onOpenPrintModal,
 onViewAirmanProfile,
  initialFromDate,
  initialToDate,
  onDownloadDocx,
}) => {
 const isPtDocument = false;
 const [fromDate, setFromDate] = useState<string>(initialFromDate || selectedDate);
 const [toDate, setToDate] = useState<string>(initialToDate || selectedDate);
 const [selectedFlight, setSelectedFlight] = useState<FlightName | 'Overall'>('Overall');

 const [singleParadeData, setSingleParadeData] = useState<ParadeStateResponse | null>(null);
 const [multiDayStates, setMultiDayStates] = useState<Record<string, ParadeStateResponse>>({});
 const [loading, setLoading] = useState<boolean>(false);

 // Internal Print Modal state
 const [isInternalPrintOpen, setIsInternalPrintOpen] = useState<boolean>(false);

 // Signature Config Modal state
 const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false);
 const [signatureInitialTab, setSignatureInitialTab] = useState<'PREPARED_BY' | 'AUTHORIZED_BY'>('PREPARED_BY');
 const [preparedBy, setPreparedBy] = useState<SignatureDetails>(getSavedPreparedBy);
 const [authorizedBy, setAuthorizedBy] = useState<SignatureDetails>(getSavedAuthorizedBy);

 // Single Airman Row Quick Edit Popover
 const [activeEditCell, setActiveEditCell] = useState<{
 airman: Airman;
 date: string;
 dutyCode: DutyCategoryCode;
 idaShift?: IDAShift;
 proxyForFlight?: FlightName;
 notes?: string;
 } | null>(null);

 // Add Disposal Modal State
 const todayStr = new Date().toISOString().split('T')[0];
 const [showAddDisposalModal, setShowAddDisposalModal] = useState<boolean>(false);
 const [disposalDateMode, setDisposalDateMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
 const [disposalFlight, setDisposalFlight] = useState<FlightName>(role === 'ADMIN' && userFlight ? userFlight as FlightName : 'Avionics');
 const [disposalCategory, setDisposalCategory] = useState<string>('');
 const [disposalCustomTitle, setDisposalCustomTitle] = useState<string>('');
 const [selectedDisposalAirmenIds, setSelectedDisposalAirmenIds] = useState<string[]>([]);
 const [disposalPersonnelStatusMap, setDisposalPersonnelStatusMap] = useState<Record<string, { statusCategory: string; dutyCode: string; notes?: string; dutyName?: string }>>({});
 const [disposalFromDate, setDisposalFromDate] = useState<string>(selectedDate);
 const [disposalToDate, setDisposalToDate] = useState<string>(selectedDate);
 const [disposalScope, setDisposalScope] = useState<'ALL' | 'PARADE' | 'PT'>('ALL');
 const [disposalNotes, setDisposalNotes] = useState<string>('');
 const [disposalLoading, setDisposalLoading] = useState<boolean>(false);
 const [disposalSuccessMsg, setDisposalSuccessMsg] = useState<string>('');

 const [savedDisposals, setSavedDisposals] = useState<Array<{code: string, label: string, customTitle?: string}>>(() => {
 try {
 const saved = localStorage.getItem('savedDisposalKeys_NC');
 return saved ? JSON.parse(saved) : [];
 } catch { return []; }
 });
 const [showDisposalDropdown, setShowDisposalDropdown] = useState(false);
 const [isEditingDisposals, setIsEditingDisposals] = useState(false);

 const ALL_DISPOSAL_OPTIONS = [{"code":"TDY","label":"TDY"},{"code":"DETT","label":"Detachment"},{"code":"LEAVE","label":"Leave"},{"code":"OTHERS","customTitle":"Course","label":"Course"},{"code":"CLASS_TRG","label":"Class"},{"code":"OTHERS","customTitle":"Exam","label":"Exam"},{"code":"AWL","label":"AWOL"},{"code":"ABSENT","label":"Detention"},{"code":"SICK_REPORT","label":"Sick report"},{"code":"ED","label":"ED"},{"code":"EX_PPGF","label":"Ex PPGF"},{"code":"CMH","label":"CMH"},{"code":"BNS","label":"BNS"},{"code":"BSH","label":"BSH"},{"code":"OTHERS","customTitle":"Quarantine","label":"Quarantine"},{"code":"OTHERS","customTitle":"U/C","label":"U/C"},{"code":"OTHERS","customTitle":"U/Board","label":"U/Board"},{"code":"OFFICE","label":"Office Duty"},{"code":"OTHERS","customTitle":"Aft Flg","label":"Aft Flg"},{"code":"OTHERS","customTitle":"Ni Flg","label":"Ni Flg"},{"code":"OTHERS","customTitle":"Ni Duty","label":"Ni Duty"},{"code":"GD","label":"Base Security (GD)"},{"code":"BTF","label":"Base Taskforce (BTF)"},{"code":"AIRPORT","label":"Airfield Duty"},{"code":"OTHERS","customTitle":"Driving","label":"Driving"},{"code":"GAMES","label":"Games"},{"code":"GH","label":"Guard of Honor"},{"code":"OTHERS","label":"✨ Custom..."}];

 const handleAddDisposalOption = (opt: any) => {
 if (opt.code === 'OTHERS' && !opt.customTitle) {
 setDisposalCategory('OTHERS');
 setDisposalCustomTitle('');
 setShowDisposalDropdown(false);
 return;
 }
 
 const isAlreadyAdded = savedDisposals.some(d => d.label === opt.label);
 if (!isAlreadyAdded) {
 const updated = [...savedDisposals, opt];
 setSavedDisposals(updated);
 localStorage.setItem('savedDisposalKeys_NC', JSON.stringify(updated));
 }
 setDisposalCategory(opt.code);
 if (opt.customTitle) setDisposalCustomTitle(opt.customTitle);
 setShowDisposalDropdown(false);
 };

 const handleRemoveDisposalOption = (label: string) => {
 const updated = savedDisposals.filter(d => d.label !== label);
 setSavedDisposals(updated);
 localStorage.setItem('savedDisposalKeys_NC', JSON.stringify(updated));
 if (updated.length === 0) setIsEditingDisposals(false);
 };


 // Edit / Change Disposal Modal State
 const [editDisposalModal, setEditDisposalModal] = useState<{
 airman: Airman;
 date: string;
 currentDutyCode: string;
 currentDutyName?: string;
 notes?: string;
 } | null>(null);
 const [editDisposalCategory, setEditDisposalCategory] = useState<string>('LEAVE');
 const [editDisposalCustomTitle, setEditDisposalCustomTitle] = useState<string>('');
 const [editDisposalFromDate, setEditDisposalFromDate] = useState<string>(selectedDate);
 const [editDisposalToDate, setEditDisposalToDate] = useState<string>(selectedDate);
 const [editDisposalLoading, setEditDisposalLoading] = useState<boolean>(false);

 // Flight Duty Ratio / Quota States
 const [showRatioModal, setShowRatioModal] = useState<boolean>(false);
 const [ratioRefreshTrigger, setRatioRefreshTrigger] = useState<number>(0);
 const [filterByRatio, setFilterByRatio] = useState<boolean>(true);

 // Keep fromDate/toDate in sync when parent selectedDate updates
 useEffect(() => {
 setFromDate(selectedDate);
 setToDate(selectedDate);
 setDisposalFromDate(selectedDate);
 setDisposalToDate(selectedDate);
 }, [selectedDate]);

 // Listen for signature updates
 useEffect(() => {
 const handleSigUpdated = () => {
 setPreparedBy(getSavedPreparedBy());
 setAuthorizedBy(getSavedAuthorizedBy());
 };
 window.addEventListener('baf_signatures_updated', handleSigUpdated);
 return () => window.removeEventListener('baf_signatures_updated', handleSigUpdated);
 }, []);

 // Fetch personnel status for disposal fromDate
 useEffect(() => {
    const fetchStatuses = () => {
      if (!showAddDisposalModal || !disposalFromDate) return;
      fetch(`/api/parade-state?date=${disposalFromDate}&shift=Morning`)
        .then((r) => r.json())
        .then((data) => {
          const map = {};
          (data?.personnelStatusList || []).forEach((item) => {
            map[item.airman.id] = {
              statusCategory: item.statusCategory,
              dutyCode: item.dutyCode,
              notes: item.notes,
              dutyName: item.dutyName,
            };
          });
          setDisposalPersonnelStatusMap(map);
        })
        .catch((err) => console.error('Failed to fetch disposal personnel statuses:', err));
    };

    fetchStatuses();
    window.addEventListener('baf_state_updated', fetchStatuses);
    return () => window.removeEventListener('baf_state_updated', fetchStatuses);
  }, [showAddDisposalModal, disposalFromDate]);

 // Format Date: e.g. "14 Aug 26"
 const getPdfTitle = () => {
 const formattedDate = formatDateShort(fromDate);
 return `Night Count State - 155 UASU BAF (${formattedDate})`;
 };

 useEffect(() => {
 const originalTitle = document.title;
 document.title = getPdfTitle();
 
 const handleBeforePrint = () => {
 document.title = getPdfTitle();
 };
 
 window.addEventListener('beforeprint', handleBeforePrint);
 
 return () => {
 document.title = originalTitle;
 window.removeEventListener('beforeprint', handleBeforePrint);
 };
 }, [fromDate]);

 const formatDateShort = (dStr: string) => {
 if (!dStr) return '';
 const parts = dStr.split('-');
 if (parts.length !== 3) return dStr;
 const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
 const dayStr = String(dateObj.getDate()).padStart(2, '0');
 const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 const monthStr = months[dateObj.getMonth()];
 const yearStr = String(dateObj.getFullYear()).slice(-2);
 return `${dayStr} ${monthStr} ${yearStr}`;
 };

 const formatDateSuperShort = (dStr: string) => {
 if (!dStr) return '';
 const parts = dStr.split('-');
 if (parts.length !== 3) return dStr;
 const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
 const dayStr = String(dateObj.getDate()).padStart(2, '0');
 const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 return `${dayStr} ${months[dateObj.getMonth()]}`;
 };

 const getShortFlightName = (flName?: string) => {
 if (!flName) return '';
 if (flName.toLowerCase().includes('avionics')) return 'Avn';
 if (flName.toLowerCase().includes('mechanics')) return 'Mech';
 if (flName.toLowerCase().includes('gcs')) return 'GCS';
 if (flName.toLowerCase().includes('admin')) return 'Adm';
 return flName.slice(0, 4);
 };

 const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

 // Calculate list of dates in range
 const getDatesInRange = (startStr: string, endStr: string) => {
 if (!startStr || !endStr) return [selectedDate];
 if (startStr > endStr) return [startStr];
 const dates: string[] = [];
 const partsStart = startStr.split('-');
 const partsEnd = endStr.split('-');
 if (partsStart.length !== 3 || partsEnd.length !== 3) return [startStr];

 const curr = new Date(parseInt(partsStart[0]), parseInt(partsStart[1]) - 1, parseInt(partsStart[2]));
 const end = new Date(parseInt(partsEnd[0]), parseInt(partsEnd[1]) - 1, parseInt(partsEnd[2]));

 let limit = 0;
 while (curr <= end && limit < 60) {
 const yyyy = curr.getFullYear();
 const mm = String(curr.getMonth() + 1).padStart(2, '0');
 const dd = String(curr.getDate()).padStart(2, '0');
 dates.push(`${yyyy}-${mm}-${dd}`);
 curr.setDate(curr.getDate() + 1);
 limit++;
 }
 return dates;
 };

 const datesInRange = getDatesInRange(fromDate, toDate);
 const isMultiDay = datesInRange.length > 1;

 // Single Day Fetch
 const fetchSingle = async () => {
 setLoading(true);
 try {
 const stateType = isPtDocument ? 'PT' : 'PARADE';
 const res = await fetch(`/api/parade-state?date=${fromDate}&shift=Morning&flight=Overall&stateType=${stateType}`);
 if (res.ok) {
 const d = await res.json();
 setSingleParadeData(d);
 }
 } catch (err) {
 console.error('Failed to fetch single parade state:', err);
 } finally {
 setLoading(false);
 }
 };

 // Multi Day Fetch
 const fetchMulti = async () => {
 setLoading(true);
 try {
 const stateType = isPtDocument ? 'PT' : 'PARADE';
 const results = await Promise.all(
 datesInRange.map((dStr) =>
 fetch(`/api/parade-state?date=${dStr}&shift=Morning&flight=Overall&stateType=${stateType}`)
 .then((res) => (res.ok ? res.json() : null))
 .catch(() => null)
 )
 );
 const newMap: Record<string, ParadeStateResponse> = {};
 datesInRange.forEach((dStr, idx) => {
 if (results[idx]) {
 newMap[dStr] = results[idx];
 }
 });
 setMultiDayStates(newMap);
 } catch (err) {
 console.error('Failed to fetch multi-day parade state:', err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (isMultiDay) {
 fetchMulti();
 } else {
 fetchSingle();
 }
 const handleGlobalUpdate = () => {
 if (isMultiDay) fetchMulti();
 else fetchSingle();
 };
 window.addEventListener('baf_state_updated', handleGlobalUpdate);
 return () => {
 window.removeEventListener('baf_state_updated', handleGlobalUpdate);
 };
 }, [fromDate, toDate, isPtDocument]);

 // Quick Preset Handlers (Calculated relative to selected fromDate)
 const handleSetPreset = (type: 'today' | '7days' | '15days' | 'month') => {
 const today = new Date();
 const yyyy = today.getFullYear();
 const mm = String(today.getMonth() + 1).padStart(2, '0');
 const dd = String(today.getDate()).padStart(2, '0');
 const todayStr = `${yyyy}-${mm}-${dd}`;

 if (type === 'today') {
 setFromDate(todayStr);
 setToDate(todayStr);
 setSelectedDate(todayStr);
 } else if (type === '7days') {
 const baseDateStr = fromDate || todayStr;
 const [bY, bM, bD] = baseDateStr.split('-').map(Number);
 const target = new Date(bY, bM - 1, bD);
 target.setDate(target.getDate() + 6);
 const tY = target.getFullYear();
 const tM = String(target.getMonth() + 1).padStart(2, '0');
 const tD = String(target.getDate()).padStart(2, '0');
 setToDate(`${tY}-${tM}-${tD}`);
 } else if (type === '15days') {
 const baseDateStr = fromDate || todayStr;
 const [bY, bM, bD] = baseDateStr.split('-').map(Number);
 const target = new Date(bY, bM - 1, bD);
 target.setDate(target.getDate() + 14);
 const tY = target.getFullYear();
 const tM = String(target.getMonth() + 1).padStart(2, '0');
 const tD = String(target.getDate()).padStart(2, '0');
 setToDate(`${tY}-${tM}-${tD}`);
 } else if (type === 'month') {
 const baseDateStr = fromDate || todayStr;
 const [bY, bM] = baseDateStr.split('-').map(Number);
 const firstDay = `${bY}-${String(bM).padStart(2, '0')}-01`;
 const lastDate = new Date(bY, bM, 0).getDate();
 const lastDay = `${bY}-${String(bM).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
 setFromDate(firstDay);
 setToDate(lastDay);
 }
 };

 // Handle single row duty assignment save
 const handleSaveSingleRowDuty = async (code: DutyCategoryCode, idaShift?: IDAShift, notes?: string, proxyForFlight?: FlightName) => {
 if (!activeEditCell) return;
 const monthKey = activeEditCell.date.slice(0, 7);
 try {
 const res = await fetch('/api/roster/assign', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 monthKey,
 assignment: {
 airmanId: activeEditCell.airman.id,
 date: activeEditCell.date,
 dutyCode: code,
 idaShift,
 proxyForFlight,
 disposalScope: isPtDocument ? 'PT' : 'PARADE',
 notes,
 },
 }),
 });
 if (res.ok) {
 window.dispatchEvent(new CustomEvent('baf_state_updated'));
 if (isMultiDay) await fetchMulti();
 else await fetchSingle();
 }
 } catch (err) {
 console.error('Failed to save row duty:', err);
 } finally {
 setActiveEditCell(null);
 }
 };

 // Handle single row duty delete
 const handleDeleteRowDuty = async () => {
 if (!activeEditCell) return;
 try {
 const res = await fetch('/api/roster/delete-assignment', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 airmanId: activeEditCell.airman.id,
 date: activeEditCell.date,
 }),
 });
 if (res.ok) {
 window.dispatchEvent(new CustomEvent('baf_state_updated'));
 if (isMultiDay) await fetchMulti();
 else await fetchSingle();
 }
 } catch (err) {
 console.error('Failed to delete row duty:', err);
 } finally {
 setActiveEditCell(null);
 }
 };

 // Handle Add Disposal submit (multi-person support)
 const handleAddDisposalSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (selectedDisposalAirmenIds.length === 0 || !disposalFromDate || !disposalToDate || !disposalCategory) return;

 setDisposalLoading(true);
 setDisposalSuccessMsg('');
 try {
 const isCustom = disposalCategory === 'OTHERS';
 const effectiveDutyCode = isCustom ? 'OTHERS' : disposalCategory;
 const effectiveNotes = isCustom ? (disposalCustomTitle.trim() || 'Custom Disposal') : undefined;
 if (isCustom && effectiveNotes && effectiveNotes !== 'Custom Disposal') {
 setSavedDisposals(prev => {
 const exists = prev.some(d => d.label === effectiveNotes);
 if (!exists) {
 const updated = [...prev, { code: 'OTHERS', customTitle: effectiveNotes, label: effectiveNotes }];
 localStorage.setItem('savedDisposalKeys_NC', JSON.stringify(updated));
 return updated;
 }
 return prev;
 });
 }

 const effectiveScope = isPtDocument ? 'PT' : (disposalScope === 'PT' ? 'PT' : 'PARADE');

 const promises = selectedDisposalAirmenIds.map((airmanId) =>
 fetch('/api/roster/assign-range', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 airmanId,
 dutyCode: effectiveDutyCode,
 fromDate: disposalFromDate,
 toDate: disposalToDate,
 disposalScope: effectiveScope,
 notes: effectiveNotes,
 }),
 }).then((r) => r.json().catch(() => ({})))
 );

 const results = await Promise.all(promises);
 const successCount = results.filter((r) => r.success).length;

 if (successCount > 0) {
 setDisposalSuccessMsg(`✅ Disposal assigned to ${successCount} personnel successfully!`);
 window.dispatchEvent(new CustomEvent('baf_state_updated'));
 if (isMultiDay) await fetchMulti();
 else await fetchSingle();
 setTimeout(() => {
 setShowAddDisposalModal(false);
 setDisposalSuccessMsg('');
 setSelectedDisposalAirmenIds([]);
 }, 1200);
 } else {
 alert('Failed to add disposal for selected personnel');
 }
 } catch (err: any) {
 console.error('Failed to submit disposal:', err);
 alert(`Error adding disposal: ${err?.message || 'Network request failed'}`);
 } finally {
 setDisposalLoading(false);
 }
 };

 // Open Edit / Change Disposal Modal for a specific airman
 const openEditDisposal = (airman: Airman, dutyCode: string, dutyName?: string, note?: string) => {
 const isStandardCat = [
 'ESSN',
 'CMH',
 'SICK_REPORT',
 'ADMIN_ORDER',
 'LEAVE',
 'BAKE_N_BITE',
 'RECEPTION',
 'TDY',
 'ADMIN_ORDER',
 'CLASS_TRG',
 'ATT',
 'GAMES',
 'ABSENT',
 'DUTY_ON',
 'DUTY_OFF',
 ].includes(dutyCode);

 setEditDisposalModal({
 airman,
 date: fromDate,
 currentDutyCode: dutyCode,
 currentDutyName: dutyName || dutyCode,
 notes: note,
 });
 setEditDisposalCategory(isStandardCat ? dutyCode : 'OTHERS');
 setEditDisposalCustomTitle(!isStandardCat ? (dutyName || note || dutyCode || '') : '');
 setEditDisposalFromDate(fromDate);
 setEditDisposalToDate(isMultiDay ? toDate : fromDate);
 };

 // Save changes to edited disposal
 const handleSaveEditDisposal = async (overrideCat?: string) => {
  const activeCategory = overrideCat || editDisposalCategory;
 if (!editDisposalModal || !editDisposalFromDate || !editDisposalToDate) return;
 setEditDisposalLoading(true);
 try {
 const isCustom = activeCategory === 'OTHERS';
 const effectiveDutyCode = isCustom ? 'OTHERS' : activeCategory;
 const effectiveNotes = isCustom ? (editDisposalCustomTitle.trim() || 'Custom Disposal') : undefined;

 const res = await fetch('/api/roster/assign-range', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 airmanId: editDisposalModal.airman.id,
 dutyCode: effectiveDutyCode,
 fromDate: editDisposalFromDate,
 toDate: editDisposalToDate,
 disposalScope: isPtDocument ? 'PT' : 'PARADE',
 notes: effectiveNotes,
 }),
 });

 if (res.ok) {
 window.dispatchEvent(new CustomEvent('baf_state_updated'));
 if (isMultiDay) await fetchMulti();
 else await fetchSingle();
 setEditDisposalModal(null);
 } else {
 alert('Failed to update disposal');
 }
 } catch (err: any) {
 console.error('Failed to update disposal:', err);
 alert(`Error updating disposal: ${err?.message || 'Network error'}`);
 } finally {
 setEditDisposalLoading(false);
 }
 };

 // Delete / Clear disposal (Revert to On Parade)
 const handleDeleteEditDisposal = async () => {
 if (!editDisposalModal || !editDisposalFromDate || !editDisposalToDate) return;
 setEditDisposalLoading(true);
 try {
 const res = await fetch('/api/roster/delete-range', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 airmanId: editDisposalModal.airman.id,
          fromDate: editDisposalFromDate,
          toDate: editDisposalToDate,
          disposalScope: "NIGHT_COUNT",
 }),
 });

 if (res.ok) {
 window.dispatchEvent(new CustomEvent('baf_state_updated'));
 if (isMultiDay) await fetchMulti();
 else await fetchSingle();
 setEditDisposalModal(null);
 } else {
 alert('Failed to remove disposal');
 }
 } catch (err: any) {
 console.error('Failed to delete disposal:', err);
 alert(`Error deleting disposal: ${err?.message || 'Network error'}`);
 } finally {
 setEditDisposalLoading(false);
 }
 };

 const handleExportOrPrint = () => {
 if (onOpenPrintModal) {
 onOpenPrintModal();
 } else {
 setIsInternalPrintOpen(true);
 }
 };

 const handleDownloadDocx = () => {
 document.title = getPdfTitle(); window.print();
 };
 // Compute Flight Stats for Single-Day Summary Matrix
  // Compute Flight Stats for Single-Day Summary Matrix
  const getFlightStats = (fl: FlightName | 'Overall') => {
    const flightAirmen = (fl === 'Overall' ? airmen : airmen.filter((a) => a.flightName === fl)).filter(a => {
      if (!['CPL', 'Cpl', 'LAC', 'AC'].includes(a.rank)) return false;
      const block = (a.addressBlock || '').toLowerCase();
      if (block.includes('qtr') || block.includes('quarter') || block.includes('outside') || block.includes('maizpara') || block.includes('dhaka') || block.includes('mirpur') || block.includes('cantt') || block.includes('ghat') || block.includes('l/o') || block.includes('l/out') || block.includes('living out') || block === 'lo' || block === 'l o') return false;
      return true;
    });

    const rawPersonnel = (singleParadeData?.personnelStatusList || []).filter(item => {
      const a = item.airman;
      if (!['CPL', 'Cpl', 'LAC', 'AC'].includes(a.rank)) return false;
      const block = (a.addressBlock || '').toLowerCase();
      if (block.includes('qtr') || block.includes('quarter') || block.includes('outside') || block.includes('maizpara') || block.includes('dhaka') || block.includes('mirpur') || block.includes('cantt') || block.includes('ghat') || block.includes('l/o') || block.includes('l/out') || block.includes('living out') || block === 'lo' || block === 'l o') return false;
      return true;
    });

    const pList = fl === 'Overall' ? rawPersonnel : rawPersonnel.filter((p) => p.airman.flightName === fl);

    let detTdyCount = 0;
    let leaveCount = 0;
    let essnCount = 0;
    let hospitalCount = 0;
    let sickExCount = 0;
    let koReceptionCount = 0;
    let drillCatCCount = 0;
    let guardDutyCount = 0;
    let bakeBiteCount = 0;
    let floodCellCount = 0;
    let adminCommCount = 0;
    let detentionCount = 0;
    let classTrgCount = 0;
    let airFdDutyCount = 0;
    let gamesCount = 0;
    let absentCount = 0;
    let officeDutyCount = 0;
    let othersCount = 0;

    if (pList.length > 0) {
      pList.forEach((item) => {
        const { dutyCode, statusCategory, notes, idaShift } = item;
        const codeUpper = (dutyCode || '').toUpperCase();
        const notesLower = (notes || '').toLowerCase();

        const isNightCountIdacA = codeUpper === 'IDAC' && idaShift === 'Morning';
        const isDutyOff = codeUpper === 'DUTY_OFF' || codeUpper === 'OFF_DUTY' || statusCategory === 'OFF' || notesLower.includes('off duty') || notesLower.includes('nt off') || notesLower.includes('night off');
        const isIdacB = codeUpper === 'IDAC' && idaShift === 'Afternoon';
        const isIdacC = codeUpper === 'IDAC' && idaShift === 'Night';
        const isBake = ['BAKE_BITE', 'BAKE_N_BITE'].includes(codeUpper) || statusCategory === 'BAKE_N_BITE';

        if (codeUpper === 'ON_PARADE' || statusCategory === 'PARADE' || isNightCountIdacA || isDutyOff || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {
          // Available on Parade / PT - Do not add to totalOutPt
        } else if (codeUpper === 'LEAVE' || statusCategory === 'LEAVE') {
          leaveCount++;
        } else if (['TDY', 'ATT', 'DETT', 'ATTACHMENT', 'DETACHMENT'].includes(codeUpper) || statusCategory === 'TDY') {
          detTdyCount++;
        
        } else if (codeUpper === 'ESSN' || notesLower.includes('essn')) {
          essnCount++;
        } else if (['CMH', 'HOSPITAL'].includes(codeUpper) || notesLower.includes('cmh')) {
          hospitalCount++;
        } else if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf') || notesLower === 'ed' || notesLower.startsWith('ed ')) {
          sickExCount++;
        } else if (['ADMIN_ORDER', 'CAT_C', 'DRILL'].includes(codeUpper) || notesLower.includes('drill')) {
          adminCommCount++;
        } else if (['GAMES', 'GH', 'GAME_HONOR'].includes(codeUpper) || notesLower.includes('games') || notesLower.includes('g/h')) {
          gamesCount++;
        } else if (['CLASS_TRG', 'CLASS', 'TRG', 'LTTB'].includes(codeUpper) || notesLower.includes('class') || notesLower.includes('trg')) {
          classTrgCount++;
        } else if (['AIRPORT', 'AIR_FD', 'AIRFIELD', 'ATT'].includes(codeUpper) || notesLower.includes('air fd') || notesLower.includes('airfield')) {
          airFdDutyCount++;
        } else if (['ABSENT', 'AWL', 'OSL'].includes(codeUpper) || notesLower.includes('absent')) {
          absentCount++;
        } else if (isBake) {
          bakeBiteCount++;
        } else if (isIdacB || isIdacC || codeUpper === 'OFFICE' || notesLower.includes('office')) {
          othersCount++;
        } else if (['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA', 'AIRPORT', 'AIRFIELD', 'ATT', 'AIR_FD'].includes(codeUpper) || statusCategory === 'DUTY') {
          // dutyOn handled directly by calculation
        } else {
          othersCount++;
        }
      });
    }

    const onPtList: { airman: Airman; note?: string }[] = [];
    const dutyOnList: { airman: Airman; note?: string }[] = [];
    const tdyList: { airman: Airman; note?: string }[] = [];
    const leaveList: { airman: Airman; note?: string }[] = [];
    const sickReportList: { airman: Airman; note?: string }[] = [];
    const essnList: { airman: Airman; note?: string }[] = [];
    const cmhList: { airman: Airman; note?: string }[] = [];
    const adminOrderList: { airman: Airman; note?: string }[] = [];
    const gamesList: { airman: Airman; note?: string }[] = [];
    const absentList: { airman: Airman; note?: string }[] = [];
    const classTrgList: { airman: Airman; note?: string }[] = [];
    
    const dutyOffList: { airman: Airman; note?: string }[] = [];
    const bakeBiteList: { airman: Airman; note?: string }[] = [];
    const receptionList: { airman: Airman; note?: string }[] = [];

    const customDisposalsMap: Record<string, { airman: Airman; note?: string }[]> = {};

    if (singleParadeData) {
      flightAirmen.forEach((airman) => {
        const st = singleParadeData.personnelStatusList.find((p) => p.airman.id === airman.id);
        if (!st) {
          onPtList.push({ airman, note: '' });
        } else {
          const { statusCategory, dutyCode, notes, idaShift } = st;
          const codeUpper = (dutyCode || '').toUpperCase();
          const notesLower = (notes || '').toLowerCase();
          const isIdacB = codeUpper === 'IDAC' && idaShift === 'Afternoon';
          const isIdacC = codeUpper === 'IDAC' && idaShift === 'Night';
          const isBake = ['BAKE_BITE', 'BAKE_N_BITE'].includes(codeUpper) || statusCategory === 'BAKE_N_BITE';
          
          if (codeUpper === 'ON_PARADE' || codeUpper === 'PT' || codeUpper === 'PT_PARADE' || statusCategory === 'PARADE' || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o') || codeUpper === 'DUTY_OFF' || codeUpper === 'OFF_DUTY' || statusCategory === 'OFF' || notesLower.includes('off duty') || notesLower.includes('nt off') || notesLower.includes('night off')) {
            onPtList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : '' });
          } else if (codeUpper === 'LEAVE' || statusCategory === 'LEAVE') {
            leaveList.push({ airman, note: '' });
          } else if (codeUpper === 'ESSN' || notesLower.includes('essn')) {
            essnList.push({ airman, note: 'ESSN' });
          } else if (['CMH', 'HOSPITAL'].includes(codeUpper) || notesLower.includes('cmh')) {
            cmhList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : (st.dutyName || dutyCode || 'CMH') });
          } else if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf') || notesLower === 'ed' || notesLower.startsWith('ed ')) {
            sickReportList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : (st.dutyName || dutyCode || 'Sick Report') });
          } else if (['ADMIN_ORDER', 'CAT_C', 'DRILL'].includes(codeUpper) || notesLower.includes('drill')) {
            adminOrderList.push({ airman, note: "Admin Order" });
          } else if (['TDY', 'ATT', 'DETT', 'ATTACHMENT', 'DETACHMENT'].includes(codeUpper) || statusCategory === 'TDY') {
            tdyList.push({ airman, note: 'TDY' });
          } else if (['AIRPORT', 'AIR_FD', 'AIRFIELD', 'ATT'].includes(codeUpper) || notesLower.includes('air fd') || notesLower.includes('airfield')) {
            dutyOnList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : 'Airfield' });
          } else if (['ADMIN_ORDER', 'BOI', 'COMMITTEE'].includes(codeUpper) || notesLower.includes('admin order') || notesLower.includes('boi')) {
            adminOrderList.push({ airman, note: 'Admin Order' });
          } else if (['CLASS_TRG', 'CLASS', 'TRG', 'LTTB'].includes(codeUpper) || notesLower.includes('class') || notesLower.includes('trg')) {
            classTrgList.push({ airman, note: 'Class/Trg' });
          } else if (['GAMES', 'GH', 'GAME_HONOR'].includes(codeUpper) || notesLower.includes('games') || notesLower.includes('g/h')) {
            gamesList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : 'G/H & Games' });
          } else if (['ABSENT', 'AWL', 'OSL'].includes(codeUpper) || notesLower.includes('absent')) {
            absentList.push({ airman, note: 'Absent' });
          
          } else if (isBake) {
            bakeBiteList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : '' });
          } else if (isIdacB || isIdacC || codeUpper === 'OFFICE' || notesLower.includes('office')) {
            dutyOnList.push({ airman, note: 'Office Duty' });
          } else if (['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA', 'AIRPORT', 'AIRFIELD', 'ATT', 'AIR_FD'].includes(codeUpper) || statusCategory === 'DUTY') {
            const dutyDisplay = formatDutyOnShortName(codeUpper, idaShift, notes, st.dutyName);
            dutyOnList.push({ airman, note: dutyDisplay });
          } else {
            let customKey = dutyCode === 'OTHERS' ? (notes || 'OTHER DISPOSAL') : (st.dutyName || dutyCode || 'OTHER DISPOSAL');
            if (notes) {
              if (!['LEAVE', 'ATT', 'TDY', 'DETT', 'BAKE_N_BITE', 'RECEPTION', 'ESSN', 'CMH', 'BNS', 'BSH', 'SICK_REPORT', 'ED', 'ADMIN_ORDER', 'CLASS_TRG', 'GAMES', 'ABSENT'].includes(codeUpper)) { 
                customKey = notes; 
              }
            }
            if (!customDisposalsMap[customKey]) customDisposalsMap[customKey] = [];
            const safeNotes = notes && !notesLower.includes('imported') ? notes : undefined;
            customDisposalsMap[customKey].push({ airman, note: safeNotes });
          }
        }
      });
    } else {
      flightAirmen.forEach((airman) => {
        onPtList.push({ airman });
      });
    }

    const totalStr = flightAirmen.length;
    const totalOutPt = leaveCount + detTdyCount + bakeBiteCount + essnCount + hospitalCount + sickExCount + adminCommCount + gamesCount + classTrgCount + absentCount + othersCount + airFdDutyCount;
    const effStr = totalStr - totalOutPt;

    return {
      totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, drillCatCCount, essnCount, guardDutyCount, bakeBiteCount, detentionCount, totalOutPt, officeDutyCount, onPtParadeCount: onPtList.length, adminCommCount,
      onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap
    };
  };


  
  


  const stats = getFlightStats(selectedFlight);
  
  const {
    totalStr, effStr, detTdyCount, leaveCount, sickExCount, hospitalCount, othersCount, koReceptionCount, airFdDutyCount, gamesCount, classTrgCount, absentCount, adminCommCount, essnCount, onPtList, dutyOnList, tdyList, leaveList, sickReportList, essnList, cmhList, adminOrderList, gamesList, absentList, classTrgList, dutyOffList, bakeBiteList, receptionList, customDisposalsMap, totalOutPt, onPtParadeCount, guardDutyCount, drillCatCCount, bakeBiteCount, detentionCount, officeDutyCount
  } = stats;


 const otherDisposals: { title: string; airmen: Airman[] }[] = Object.entries(customDisposalsMap).map(([title, items]: [string, any]) => ({
 title,
 airmen: items.map((i: any) => i.airman),
 })
 );

 // Chunk ON PARADE into max 15 items per vertical column
 const onPtChunks: { airman: Airman; note?: string; globalIndex: number }[][] = [];
 for (let i = 0; i < onPtList.length; i += 15) {
 onPtChunks.push(
 onPtList.slice(i, i + 15).map((item, idx) => ({
 ...item,
 globalIndex: i + idx + 1,
 }))
 );
 }


  
  

 // Helper to render airman list inside multi-day table cells (without flight tags)
 const renderAirmanColumnList = (list: { airman: Airman }[]) => {
 if (!list || list.length === 0) {
 return <div className="text-center text-slate-400 font-normal py-1">-</div>;
 }
 return (
 <ol className="space-y-0.5 text-[11px] leading-snug font-normal text-left">
 {list.map((item, idx) => (
 <li key={idx} className="whitespace-nowrap">
 {idx + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}
 </li>
 ))}
 </ol>
 );
 };

 // Helper to render interactive disposal list items (with ✏️ edit click for admin)
 const renderDisposalAirmenList = (
 list: { airman: Airman; note?: string }[],
 dutyCode: string,
 dutyName: string
 ) => {
 return (
 <ol className="space-y-0.5 font-normal leading-tight">
 {list.map((item, i) => {
 const isDutyOn = dutyCode === 'DUTY_ON' || ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA', 'AIRPORT'].includes(dutyCode);
 const isDutyOff = dutyCode === 'DUTY_OFF';
 let noteText = item.note && !item.note.toLowerCase().includes('imported') ? item.note : '';

 return (
 <li
 key={item.airman.id || i}
 onClick={() => {
 if ((role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER')) {
 openEditDisposal(item.airman, dutyCode, dutyName, item.note);
 }
 }}
 className={`truncate group flex items-center justify-between ${
 (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER')
 ? 'cursor-pointer hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-950/40 px-1 rounded transition-colors'
 : ''
 }`}
 title={(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? 'Click to edit, change or remove disposal' : undefined}
 >
 <span className="truncate">
 {i + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}
 {(isDutyOn || isDutyOff) && noteText ? (
 <span className="text-slate-800 dark:text-slate-200 font-medium"> - {noteText}</span>
 ) : noteText && noteText !== dutyName && noteText !== dutyCode ? (
 <span className="text-[9px] text-slate-400 ml-1">({noteText})</span>
 ) : null}
 </span>
 {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
 <span className="opacity-0 group-hover:opacity-100 text-[10px] text-purple-600 font-bold ml-1 shrink-0 print:hidden">
 ✏️
 </span>
 )}
 </li>
 );
 })}
 </ol>
 );
 };

 return (
    <div className="space-y-6">
  {/* PRINT STYLES */}
 <style>{`
            @media print {
              @page {
 size: A4 landscape;
 margin: 8mm;
 }
              body { 
                 background: white !important; 
                 color: black !important;
                -webkit-print-color-adjust: exact !important; 
                 print-color-adjust: exact !important; 
               }
               
              /* Force black borders and text in print */
              .print\:border-black, table, th, td {
                 border-color: black !important;
              }
              .print\:text-black, span, div, p, h1, h2, h3, h4, th, td {
                 color: black !important;
              }
              /* Hide scrollbars during print */
              ::-webkit-scrollbar { display: none; }
            }
          `}</style>

 
 {/* MODAL OVERLAY */}
 <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/90 backdrop-blur-sm overflow-hidden print:bg-white print:block print:static print:top-0 print:left-0 print:w-full print:h-auto print:z-[9999]">
 
 {/* MODAL HEADER - HIDDEN ON PRINT */}
 <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-2xl print:hidden z-10 gap-4">
 <div className="flex items-center space-x-4">
 <button
 onClick={onClose}
 className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
 title="Close Preview"
 >
 <X className="w-5 h-5" />
 </button>
 <div>
 <h2 className="text-base sm:text-lg font-black text-white">Print Preview: 155 UASU BAF</h2>
 <p className="text-xs font-medium text-slate-400">Review document before printing</p>
 </div>
 </div>
 <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
 
            {onDownloadDocx && (
              <button
                onClick={onDownloadDocx}
                className="flex items-center space-x-2 px-3 sm:px-6 py-2 sm:py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-900/20 transition-all cursor-pointer"
                title="Export Document"
              >
                <FileDown className="w-5 h-5" />
                <span>Export Doc</span>
              </button>
            )}
<button
 onClick={() => { document.title = getPdfTitle(); window.print(); }}
 className="flex items-center space-x-2 px-3 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
 >
 <Printer className="w-5 h-5" />
 <span>Official Export / Print</span>
 </button>
 </div>
 </div>

 {/* SCROLLABLE DOCUMENT CONTAINER */}
 <div className="flex-1 overflow-auto p-4 sm:p-8 md:flex md:justify-center print:p-0 print:overflow-visible print:block">
 {/* THE ACTUAL DOCUMENT */}
 <div className="bg-white dark:bg-slate-900 text-black dark:text-white shadow-2xl print:shadow-none w-[297mm] min-h-[210mm] relative mx-auto print:mx-0 print:w-full print:min-h-0 shrink-0">
{/* OFFICIAL PARADE DOCUMENT SHEET (DISPLAYED ON SCREEN & IN PRINT) */}
 <div
 id="official-parade-document"
 className="bg-white dark:bg-slate-900 text-black dark:text-white border border-slate-300 dark:border-slate-700 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:border-none print:p-0"
 >
 {loading ? (
 <div className="py-20 text-center text-slate-400">
 <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
 <p className="text-sm font-bold">Loading Official Parade State...</p>
 </div>
 ) : isMultiDay ? (
 /* ========================================================================= */
 /* 1. MULTI-DAY PARADE & DUTY DISPOSAL TABLE */
 /* ========================================================================= */
 <div>
 {/* DOCUMENT TOP HEADER */}
 <div className="relative mb-3 text-center" style={{ fontFamily: 'Arial, sans-serif' }}>
 <div className="text-center">
 <h1 className="font-bold tracking-wide text-black dark:text-white underline inline-block text-base uppercase">
 {isPtDocument ? 'NT COUNT STATE: AIRMEN' : 'NT COUNT STATE: AIRMEN'}
 </h1>
 <br />
 <h2 className="font-bold tracking-wide text-black dark:text-white mt-0.5 underline inline-block text-sm uppercase">
 155 UASU BAF {selectedFlight !== 'Overall' ? `(${selectedFlight.toUpperCase()} FLIGHT)` : ''}
 </h2>
 </div>
 <div className="text-right font-normal text-black dark:text-white pr-1 text-xs mt-1">
 Period: {formatDateShort(fromDate)} To {formatDateShort(toDate)}
 </div>
 </div>

 
 <div className="overflow-x-auto border border-black dark:border-slate-300 mb-8">
 <table className="no-zebra w-full min-w-[700px] print:min-w-0 text-center border-collapse text-[11px] text-black dark:text-white table-auto">
 <thead>
 <tr className="border-b border-black dark:border-slate-300">
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold w-[120px] text-center">Sqn/Unit</th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Total Str</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Det/Tdy</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Eff Str</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Leave</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Course</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Class/Exam</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">AWOL/Detention</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Sick report</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">ED/ EX PPGF</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">CMH/ BNS/ BSH/Qrnt</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">U/C, U/Board</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Office Duty</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Aft/Ni flg/Ni Duty</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">GD/TF/Airfield Duty</div></th>
    <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Driving</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Games /Guard of Honor</div></th>
 {Object.keys(customDisposalsMap).map(key => (
 <th key={key} className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">{key}</div></th>
 ))}
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Total Out Parade</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">On Parade</div></th>
 <th className="p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Remarks</div></th>
 </tr>
 </thead>
 <tbody>
 {(() => {
 
 
 // For the custom missing columns not in getFlightStats, we derive them locally.
 // We need to use `singleParadeData?.personnelStatusList || []` since we don't pass pList.
 let tempPList = (singleParadeData?.personnelStatusList || []).filter(item => {
 const a = item.airman;
 if (!['CPL', 'Cpl', 'LAC', 'AC'].includes(a.rank)) return false;
 const block = (a.addressBlock || '').toLowerCase();
 const isLOut = block.includes('qtr') || 
                   block.includes('quarter') || 
                   block.includes('outside') || block.includes('maizpara') ||
                   block.includes('l/o') ||
                   block.includes('l/out') ||
                   block.includes('living out') ||
                   block.includes('dhaka') ||
                   block.includes('mirpur') ||
                   block.includes('cantt') ||
                   block.includes('ghat') ||
                   block === 'lo' || 
                   block === 'l o';
 return !isLOut;
 });
 if (selectedFlight !== 'Overall') {
 tempPList = tempPList.filter(p => p.airman.flightName === selectedFlight);
 }
 
 const officeDutyCount = tempPList.filter(s => {
 const c = (s.dutyCode || '').toUpperCase();
 const n = (s.notes || '').toLowerCase();
 const isOffice = c === 'OFFICE' || n.includes('office');
 const isIdacB = c === 'IDAC' && s.idaShift === 'Afternoon';
 const isIdacC = c === 'IDAC' && s.idaShift === 'Night';
 const isBake = ['BAKE_BITE', 'BAKE_N_BITE'].includes(c) || s.statusCategory === 'BAKE_N_BITE';
 return isOffice || isIdacB || isIdacC || isBake;
 }).length;
 const aftNiFlgCount = tempPList.filter(s => s.dutyCode === 'NIGHT_FLYING' || s.notes?.toLowerCase().includes('night')).length;
 const offDutyCount = tempPList.filter(s => s.dutyCode === 'OFF_DUTY' || s.notes?.toLowerCase().includes('off duty')).length;
 const drivingCount = tempPList.filter(s => s.dutyCode === 'DRIVING' || s.notes?.toLowerCase().includes('driving')).length;
 const ucBoardCount = tempPList.filter(s => s.notes?.toLowerCase().includes('u/c') || s.notes?.toLowerCase().includes('board')).length;

 return (
 <tr className="">
 <td className="border-r border-black dark:border-slate-300 p-2 font-bold whitespace-nowrap min-w-[120px] text-center align-middle">155 UASU BAF</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.totalStr || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.detTdyCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.effStr || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.leaveCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.essnCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.classTrgCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.detentionCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.sickExCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.drillCatCCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.hospitalCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{ucBoardCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{officeDutyCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{aftNiFlgCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.guardDutyCount || stats.airFdDutyCount || '-'}</td>
    <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{drivingCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.gamesCount || '-'}</td>
 {Object.keys(customDisposalsMap).map(key => {
 const count = customDisposalsMap[key].length;
 return <td key={key} className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{count > 0 ? count : '-'}</td>;
 })}
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.totalOutPt || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 font-bold text-center align-middle">{stats.onPtParadeCount || '-'}</td>
 <td className="p-1 text-center align-middle"></td>
 </tr>
 );
 })()}
 </tbody>
 </table>
 </div>


 {/* SPACER ROW: 0.6 INCH HEIGHT TO PROVIDE SIGNATURE HEADROOM */}
 <div className="w-full" style={{ height: '0.6in' }} />

 {/* OFFICIAL SIGNATURE FOOTER FOR MULTI-DAY */}
 <div
 className="hidden print:hidden justify-between items-end pt-1 text-black dark:text-white text-xs min-w-[700px] print:min-w-0"
 style={{ fontFamily: 'Arial, sans-serif' }}
 >
{/* LEFT SIGNATURE BLOCK (Prepared By) */}
 <div className="text-left font-bold min-w-[200px]">
 <div className="border-t border-slate-900 pt-1.5">
 <div className="text-xs uppercase font-black">{preparedBy.name}</div>
 <div className="text-[11px] font-normal">{preparedBy.rank}</div>
 <div className="text-[11px] font-normal">{preparedBy.designation}</div>
 <div className="text-[10px] uppercase font-bold">{preparedBy.unit || '155 UASU BAF'}</div>
 </div>
 </div>

 {/* RIGHT SIGNATURE BLOCK (Authorized By) */}
 <div className="text-left font-bold min-w-[200px]">
 <div className="border-t border-slate-900 pt-1.5">
 <div className="text-xs uppercase font-black">{authorizedBy.name}</div>
 <div className="text-[11px] font-normal">{authorizedBy.rank}</div>
 <div className="text-[11px] font-normal">{authorizedBy.designation}</div>
 <div className="text-[10px] uppercase font-bold">{authorizedBy.unit || '155 UASU BAF'}</div>
                  </div>
                </div>
              </div>
            </div>
 ) : (
 /* ========================================================================= */
 /* 2. SINGLE-DAY OFFICIAL BAF NIGHT COUNT STATE SHEET */
 /* ========================================================================= */
 <div>
 {/* TOP DOCUMENT HEADER */}
 <div className="relative mb-3 text-center" style={{ fontFamily: 'Arial, sans-serif' }}>
 <div className="text-center">
 <h1 className="font-bold tracking-wide text-black dark:text-white underline inline-block text-base uppercase">
 {isPtDocument ? 'NT COUNT STATE: AIRMEN' : 'NT COUNT STATE: AIRMEN'}
 </h1>
 <br />
 <h2 className="font-bold tracking-wide text-black dark:text-white mt-0.5 underline inline-block text-sm uppercase">
 155 UASU BAF {selectedFlight !== 'Overall' ? `(${selectedFlight.toUpperCase()} FLT)` : ''}
 </h2>
 </div>
 <div className="text-right font-normal text-black dark:text-white pr-1 text-xs mt-1">
 Date: {formatDateShort(fromDate)}
 </div>
 </div>

 {/* SUMMARY MATRIX TABLE: EXACT SINGLE-ROW FORMAT FOR SELECTED FLIGHT / OVERALL */}
 
 <div className="overflow-x-auto border border-black dark:border-slate-300 mb-8">
 <table className="no-zebra w-full min-w-[700px] print:min-w-0 text-center border-collapse text-[11px] text-black dark:text-white table-auto">
 <thead>
 <tr className="border-b border-black dark:border-slate-300">
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold w-[120px] text-center">Sqn/Unit</th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Total Str</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Det/Tdy</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Eff Str</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Leave</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Course</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Class/Exam</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">AWOL/Detention</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Sick report</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">ED/ EX PPGF</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">CMH/ BNS/ BSH/Qrnt</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">U/C, U/Board</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Office Duty</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Aft/Ni flg/Ni Duty</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">GD/TF/Airfield Duty</div></th>
    <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Driving</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Games /Guard of Honor</div></th>
 {Object.keys(customDisposalsMap).map(key => (
 <th key={key} className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">{key}</div></th>
 ))}
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Total Out Parade</div></th>
 <th className="border-r border-black dark:border-slate-300 p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">On Parade</div></th>
 <th className="p-2 align-middle font-bold text-center p-0.5"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Remarks</div></th>
 </tr>
 </thead>
 <tbody>
 {(() => {
 
 
 // For the custom missing columns not in getFlightStats, we derive them locally.
 // We need to use `singleParadeData?.personnelStatusList || []` since we don't pass pList.
 let tempPList = (singleParadeData?.personnelStatusList || []).filter(item => {
 const a = item.airman;
 if (!['CPL', 'Cpl', 'LAC', 'AC'].includes(a.rank)) return false;
 const block = (a.addressBlock || '').toLowerCase();
 const isLOut = block.includes('qtr') || 
                   block.includes('quarter') || 
                   block.includes('outside') || block.includes('maizpara') ||
                   block.includes('l/o') ||
                   block.includes('l/out') ||
                   block.includes('living out') ||
                   block.includes('dhaka') ||
                   block.includes('mirpur') ||
                   block.includes('cantt') ||
                   block.includes('ghat') ||
                   block === 'lo' || 
                   block === 'l o';
 return !isLOut;
 });
 if (selectedFlight !== 'Overall') {
 tempPList = tempPList.filter(p => p.airman.flightName === selectedFlight);
 }
 
 const officeDutyCount = tempPList.filter(s => {
 const c = (s.dutyCode || '').toUpperCase();
 const n = (s.notes || '').toLowerCase();
 const isOffice = c === 'OFFICE' || n.includes('office');
 const isIdacB = c === 'IDAC' && s.idaShift === 'Afternoon';
 const isIdacC = c === 'IDAC' && s.idaShift === 'Night';
 const isBake = ['BAKE_BITE', 'BAKE_N_BITE'].includes(c) || s.statusCategory === 'BAKE_N_BITE';
 return isOffice || isIdacB || isIdacC || isBake;
 }).length;
 const aftNiFlgCount = tempPList.filter(s => s.dutyCode === 'NIGHT_FLYING' || s.notes?.toLowerCase().includes('night')).length;
 const offDutyCount = tempPList.filter(s => s.dutyCode === 'OFF_DUTY' || s.notes?.toLowerCase().includes('off duty')).length;
 const drivingCount = tempPList.filter(s => s.dutyCode === 'DRIVING' || s.notes?.toLowerCase().includes('driving')).length;
 const ucBoardCount = tempPList.filter(s => s.notes?.toLowerCase().includes('u/c') || s.notes?.toLowerCase().includes('board')).length;

 return (
 <tr className="">
 <td className="border-r border-black dark:border-slate-300 p-2 font-bold whitespace-nowrap min-w-[120px] text-center align-middle">155 UASU BAF</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.totalStr || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.detTdyCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.effStr || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.leaveCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.essnCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.classTrgCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.detentionCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.sickExCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.drillCatCCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.hospitalCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{ucBoardCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{officeDutyCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{aftNiFlgCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.guardDutyCount || stats.airFdDutyCount || '-'}</td>
    <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{drivingCount || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.gamesCount || '-'}</td>
 {Object.keys(customDisposalsMap).map(key => {
 const count = customDisposalsMap[key].length;
 return <td key={key} className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{count > 0 ? count : '-'}</td>;
 })}
 <td className="border-r border-black dark:border-slate-300 p-1 text-center align-middle">{stats.totalOutPt || '-'}</td>
 <td className="border-r border-black dark:border-slate-300 p-1 font-bold text-center align-middle">{stats.onPtParadeCount || '-'}</td>
 <td className="p-1 text-center align-middle"></td>
 </tr>
 );
 })()}
 </tbody>
 </table>
 </div>


 {/* SPACE BETWEEN 1ST & 2ND TABLE WITH 1PT FONT */}
 <div className="w-full text-center leading-[1px] select-none my-0 py-0" style={{ fontSize: '1px', height: '1px' }}>
 &nbsp;
 </div>

 {/* 2ND TABLE / BOTTOM DISPOSAL SECTION */}
 <div
 className="mt-2 pt-1 text-[11px]"
 style={{ fontFamily: 'Arial, sans-serif' }}
 >
 <div className="flex flex-wrap items-start justify-between gap-6 min-w-[700px] print:min-w-0">
 {/* 1ST COLUMN: ON PARADE / ON PT (1 TO 15 ON LEFT, 16+ ON RIGHT, NIL IF EMPTY) */}
 <div className="min-w-[240px] flex-shrink-0">
 <h3 className="font-bold underline text-black dark:text-white mb-1.5">
 {isPtDocument ? 'On PT' : 'On Parade'}
 </h3>

 {onPtList.length > 0 ? (
 <div className="flex items-start space-x-6">
 {/* Left side: 1 to 15 */}
 <ol className="space-y-0.5 font-normal leading-tight">
 {onPtList.slice(0, 15).map((item, idx) => (
 <li key={item.airman.id} className="whitespace-nowrap">
 {idx + 1}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}
 </li>
 ))}
 </ol>

 {/* Right side: 16+ */}
 {onPtList.length > 15 && (
 <ol className="space-y-0.5 font-normal leading-tight">
 {onPtList.slice(15, 30).map((item, idx) => (
 <li key={item.airman.id} className="whitespace-nowrap">
 {16 + idx}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}
 </li>
 ))}
 </ol>
 )}

 {/* Extra column if > 30 */}
 {onPtList.length > 30 && (
 <ol className="space-y-0.5 font-normal leading-tight">
 {onPtList.slice(30).map((item, idx) => (
 <li key={item.airman.id} className="whitespace-nowrap">
 {31 + idx}. {formatAirmanName(item.airman.rank)} {formatAirmanName(item.airman.name)}
 </li>
 ))}
 </ol>
 )}
 </div>) : (
 <div className="font-bold text-black dark:text-white">Nil</div>
 )}
 </div>

 {/* DISPOSALS (ONLY SHOWN IF NOT EMPTY / >0 AIRMEN, NO EMPTY HEADINGS) */}
 <div className="flex-1 flex flex-wrap gap-5">
 {/* DISPOSAL COL A */}
 {(leaveList.length > 0 || dutyOnList.length > 0 || (!isPtDocument && dutyOffList.length > 0) || bakeBiteList.length > 0 || essnList.length > 0) && (
 <div className="w-48 flex flex-col space-y-3">
 {leaveList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Leave</h3>
 {renderDisposalAirmenList(leaveList, 'LEAVE', 'Leave')}
 </div>
 )}

 {dutyOnList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Duty On</h3>
 {renderDisposalAirmenList(dutyOnList, 'DUTY_ON', 'Duty On')}
 </div>
 )}

 {!isPtDocument && dutyOffList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Duty Off</h3>
 {renderDisposalAirmenList(dutyOffList, 'DUTY_OFF', 'Duty Off')}
 </div>
 )}

 {bakeBiteList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Bake & Bite</h3>
 {renderDisposalAirmenList(bakeBiteList, 'BAKE_N_BITE', 'Bake & Bite')}
 </div>
 )}

 {essnList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">
 ESSN
 </h3>
 {renderDisposalAirmenList(essnList, 'ESSN', 'ESSN')}
 </div>
 )}
 </div>
 )}

 {/* DISPOSAL COL B */}
 {(cmhList.length > 0 || sickReportList.length > 0 || tdyList.length > 0 || receptionList.length > 0) && (
 <div className="w-48 flex flex-col space-y-3">
 {cmhList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">
 CMH
 </h3>
 {renderDisposalAirmenList(cmhList, 'CMH', 'CMH')}
 </div>
 )}

 {sickReportList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Sick Report</h3>
 {renderDisposalAirmenList(sickReportList, 'SICK_REPORT', 'Sick Report')}
 </div>
 )}

 {tdyList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Det/Tdy</h3>
 {renderDisposalAirmenList(tdyList, 'TDY', 'Det/Tdy')}
 </div>
 )}

 {receptionList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Reception</h3>
 {renderDisposalAirmenList(receptionList, 'RECEPTION', 'Reception')}
 </div>
 )}
 </div>
 )}

 {/* DISPOSAL COL C */}
 {(adminOrderList.length > 0 || classTrgList.length > 0 || gamesList.length > 0 || absentList.length > 0 || Object.keys(customDisposalsMap).length > 0) && (
 <div className="w-48 flex flex-col space-y-3">
 

 {adminOrderList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Admin Order</h3>
 {renderDisposalAirmenList(adminOrderList, 'ADMIN_ORDER', 'Admin Order')}
 </div>
 )}

 {classTrgList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Class / Trg</h3>
 {renderDisposalAirmenList(classTrgList, 'CLASS_TRG', 'Class / TRG')}
 </div>
 )}


 {gamesList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">G/H & Games</h3>
 {renderDisposalAirmenList(gamesList, 'GAMES', 'G/H & Games')}
 </div>
 )}

 {absentList.length > 0 && (
 <div>
 <h3 className="font-bold underline text-black dark:text-white mb-1">Absent</h3>
 {renderDisposalAirmenList(absentList, 'ABSENT', 'Absent')}
 </div>
 )}

 {/* Dynamic Custom Disposals / Others */}
 {Object.entries(customDisposalsMap).map(([catName, airmenList]: [string, any]) => {
 if (!airmenList || airmenList.length === 0) return null;
 return (
    <div key={catName}>
 <h3 className="font-bold underline text-black dark:text-white mb-1">
 {catName}
 </h3>
 {renderDisposalAirmenList(airmenList, 'OTHERS', catName)}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* SPACER ROW: 0.9 INCH HEIGHT TO PROVIDE AMPLE SIGNATURE HEADROOM */}
 <div className="w-full" style={{ height: '0.9in' }} />

 {/* OFFICIAL SIGNATURE FOOTER */}
 <div
 className="hidden print:hidden justify-between items-end pt-1 text-black dark:text-white text-xs min-w-[700px] print:min-w-0"
 style={{ fontFamily: 'Arial, sans-serif' }}
 >
{/* LEFT SIGNATURE BLOCK (Prepared By) */}
 <div className="text-left font-bold min-w-[210px]">
 {preparedBy.signDigitally && (
 <div className="mb-1 text-center font-serif italic text-xs text-black dark:text-white select-none">
 <span className="font-bold underline">
 {preparedBy.digitalSignatureText || preparedBy.name}
 </span>
 <span className="block text-[8px] font-mono not-italic text-slate-600">
 [Digitally Signed • BAF Verified]
 </span>
 </div>
 )}
 <div className="border-t border-slate-900 pt-1.5">
 <div className="text-xs uppercase font-black">{preparedBy.name}</div>
 <div className="text-[11px] font-normal">{preparedBy.rank}</div>
 <div className="text-[11px] font-normal">{preparedBy.designation}</div>
 <div className="text-[10px] uppercase font-bold">{preparedBy.unit || '155 UASU BAF'}</div>
 </div>
 </div>

 {/* RIGHT SIGNATURE BLOCK (Authorized By) */}
 <div className="text-left font-bold min-w-[210px]">
 {authorizedBy.signDigitally && (
 <div className="mb-1 text-center font-serif italic text-xs text-black dark:text-white select-none">
 <span className="font-bold underline">
 {authorizedBy.digitalSignatureText || authorizedBy.name}
 </span>
 <span className="block text-[8px] font-mono not-italic text-slate-600">
 [Digitally Signed • BAF Verified]
 </span>
 </div>
 )}
 <div className="border-t border-slate-900 pt-1.5">
 <div className="text-xs uppercase font-black">{authorizedBy.name}</div>
 <div className="text-[11px] font-normal">{authorizedBy.rank}</div>
 <div className="text-[11px] font-normal">{authorizedBy.designation}</div>
 <div className="text-[10px] uppercase font-bold">{authorizedBy.unit || '155 UASU BAF'}</div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Row Edit Popover */}
 {activeEditCell && (
 <DutyCellPopover
 airmanName={`${formatAirmanName(activeEditCell.airman.rank)} ${activeEditCell.airman.name}`}
 airmanFlight={activeEditCell.airman.flightName}
 date={activeEditCell.date}
 currentCode={activeEditCell.dutyCode}
 currentIdaShift={activeEditCell.idaShift}
 currentProxyForFlight={activeEditCell.proxyForFlight}
 currentNotes={activeEditCell.notes}
 onSelectDuty={handleSaveSingleRowDuty}
 onDeleteDuty={handleDeleteRowDuty}
 onClose={() => setActiveEditCell(null)}
 />
 )}

 {/* Add Disposal Modal */}
 {showAddDisposalModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-xl w-full p-6 space-y-5 relative overflow-hidden">
 {/* Modal Header */}
 <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
 <div className="flex items-center space-x-3">
 <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600 border border-purple-200 ">
 <UserPlus className="w-6 h-6" />
 </div>
 <div>
 <h2 className="text-lg font-bold text-black dark:text-white">
 Add Personnel Disposal
 </h2>
 <p className="text-xs text-slate-500 mt-0.5">
 Assign non-routine disposals (ESSN, CMH, Sick Report, Drill Cat C, Leave, Bake & Bite, etc.).
 </p>
 </div>
 </div>

 <button
 onClick={() => setShowAddDisposalModal(false)}
 className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Success Message */}
 {disposalSuccessMsg && (
 <div className="p-3 bg-emerald-100 /90 text-emerald-900 rounded-xl border border-emerald-300 text-xs font-bold animate-fadeIn">
 {disposalSuccessMsg}
 </div>
 )}

 {/* Form */}
 <form onSubmit={handleAddDisposalSubmit} className="space-y-4">
 
 {/* 1. Date Selection */}
 <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700">
 <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      1. Select Date
                    </label>
                    <div className="w-56">
                      <DateNavigator
 value={disposalFromDate}
 onChange={(e) => {
 setDisposalFromDate(e.target.value);
 setDisposalToDate(e.target.value);
 }}
 className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500 shadow-xs"
 required
 />
 </div>
 </div>


 {/* 2. Select Disposal Category */}
 <div className="space-y-2 relative">
 <div className="flex justify-between items-center">
 <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
 2. Select Disposal Category
 </label>
 
 <button
 type="button"
 onClick={() => setIsEditingDisposals(!isEditingDisposals)}
 className={`p-1 rounded-md transition-colors cursor-pointer ${isEditingDisposals ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
 title="Manage Saved Categories"
 >
 <Settings className="w-4 h-4" />
 </button>
 
 </div>
 <div className="flex flex-wrap gap-2">
 {savedDisposals.map((cat) => {
 const isSelected = !isEditingDisposals && disposalCategory === cat.code && (cat.code !== 'OTHERS' || disposalCustomTitle === cat.customTitle);
 return (
    <div key={cat.label} className="relative group">
 <button
 type="button"
 onClick={() => {
 if (isEditingDisposals) return;
 setDisposalCategory(cat.code);
 if (cat.customTitle) setDisposalCustomTitle(cat.customTitle);
 }}
 className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all truncate ${isEditingDisposals ? 'pr-6 opacity-80 cursor-default bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 ' : 'cursor-pointer'} ${
 isSelected
 ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 shadow-xs'
 : (!isEditingDisposals ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600' : '')
 }`}
 >
 {cat.label}
 </button>
 {isEditingDisposals && (
 <button
 type="button"
 onClick={() => handleRemoveDisposalOption(cat.label)}
 className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900 transition-colors cursor-pointer"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </div>
 );
 })}
 {!isEditingDisposals && (
 <div className="relative">
 <button
 type="button"
 onClick={() => setShowDisposalDropdown(!showDisposalDropdown)}
 className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 bg-slate-50 transition-all cursor-pointer flex items-center space-x-1"
 >
 <Plus className="w-3.5 h-3.5" />
 {savedDisposals.length === 0 && <span>Add Category</span>}
 </button>
 {showDisposalDropdown && (
 <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1">
 {ALL_DISPOSAL_OPTIONS.filter(opt => opt.code === 'OTHERS' || !savedDisposals.some(d => d.code === opt.code)).map((opt) => (
 <button
 key={opt.label}
 type="button"
 onClick={() => handleAddDisposalOption(opt)}
 className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
 >
 {opt.label}
 </button>
 ))}
 </div>
 )}
 </div>
 )}
 </div>

 {/* Custom Title Input if OTHERS selected */}
 {disposalCategory === 'OTHERS' && (!ALL_DISPOSAL_OPTIONS.find(o => o.label === disposalCustomTitle) || disposalCustomTitle === '') && !isEditingDisposals && (
 <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1 animate-fadeIn">
 <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
 Specify Custom Disposal Name
 </label>
 <input
 type="text"
 placeholder="e.g. Special Escort, VVIP Detail..."
 value={disposalCustomTitle}
 onChange={(e) => setDisposalCustomTitle(e.target.value)}
 className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-amber-500 shadow-xs"
 required
 />
 </div>
 )}
 </div>

 {/* 3. Flight Filter & Airman Selection */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ">
 3. Select Flight & Personnel
 </label>
 </div>
 <div className="grid grid-cols-4 gap-1.5">
 {(['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[]).map((fl) => {
 const isDisabledFlt = (role === 'ADMIN' && userFlight && fl !== userFlight) || (role === 'ADMIN' && selectedDate < todayStr);
 return (
 <button
 key={fl}
 type="button"
 onClick={() => !isDisabledFlt && setDisposalFlight(fl)}
 disabled={isDisabledFlt}
 className={`py-1 px-2 text-xs font-bold rounded-lg border text-center transition-all ${
 isDisabledFlt ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 ' :
 disposalFlight === fl
 ? 'bg-purple-600 text-white border-purple-600 shadow-xs cursor-pointer'
 : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400 cursor-pointer'
 }`}
 >
 {fl}
 </button>
 );
 })}
 </div>

 {/* Multi-Select Airmen List */}
 {(() => {
 const flightAirmen = airmen.filter((a) => a.flightName === disposalFlight).filter(a => {
 if (!['CPL', 'Cpl', 'LAC', 'AC'].includes(a.rank)) return false;
 const block = (a.addressBlock || '').toLowerCase();
 const isLOut = block.includes('qtr') || 
                   block.includes('quarter') || 
                   block.includes('outside') || block.includes('maizpara') ||
                   block.includes('l/o') ||
                   block.includes('l/out') ||
                   block.includes('living out') ||
                   block.includes('dhaka') ||
                   block.includes('mirpur') ||
                   block.includes('cantt') ||
                   block.includes('ghat') ||
                   block === 'lo' || 
                   block === 'l o';
 return !isLOut;
});

 const getAirmanStatusLabel = (airmanId: string) => {
 const st = disposalPersonnelStatusMap[airmanId];
 if (!st) return { isOnParade: true, label: 'On Parade', dutyCode: 'ON_PARADE', notes: '', dutyName: 'On Parade' };

 const { statusCategory, dutyCode, notes, dutyName } = st;
 const codeUpper = (dutyCode || '').toUpperCase();
 const notesLower = (notes || '').toLowerCase();

 if (codeUpper === 'ON_PARADE' || statusCategory === 'PARADE') {
 return { isOnParade: true, label: 'On Parade', dutyCode: 'ON_PARADE', notes, dutyName: 'On Parade' };
 }
 if (codeUpper === 'LEAVE' || statusCategory === 'LEAVE') {
 return { isOnParade: false, label: 'Leave', dutyCode: 'LEAVE', notes, dutyName: 'Leave' };
 }
 if (['TDY', 'ATT', 'DETT', 'ATTACHMENT', 'DETACHMENT'].includes(codeUpper) || statusCategory === 'TDY') {
 return { isOnParade: false, label: 'TDY', dutyCode: 'TDY', notes, dutyName: 'TDY' };
 }
 if (['BAKE_BITE', 'BAKE_N_BITE'].includes(codeUpper) || statusCategory === 'BAKE_N_BITE') {
 return { isOnParade: false, label: 'Bake & Bite', dutyCode: 'BAKE_N_BITE', notes, dutyName: 'Bake & Bite' };
 }
 if (codeUpper === 'ESSN' || notesLower.includes('essn')) {
 return { isOnParade: false, label: 'ESSN', dutyCode: 'ESSN', notes, dutyName: 'ESSN' };
 }
 if (['CMH', 'BNS', 'BSH', 'HOSPITAL'].includes(codeUpper) || notesLower.includes('cmh') || notesLower.includes('bns') || notesLower.includes('bsh')) {
 return { isOnParade: false, label: 'CMH / Hospital', dutyCode: 'CMH', notes, dutyName: 'CMH / Hospital' };
 }
 if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick')) {
 return { isOnParade: false, label: 'Sick Report', dutyCode: 'SICK_REPORT', notes, dutyName: 'Sick Report' };
 }
 if (['CAT_C', 'DRILL'].includes(codeUpper)) {
 return { isOnParade: false, label: "Drill Cat-C", dutyCode: 'CAT_C', notes, dutyName: "Drill Cat-C" };
 }
 if (codeUpper === 'RECEPTION' || notesLower.includes('reception')) {
 return { isOnParade: false, label: 'Reception / KO', dutyCode: 'RECEPTION', notes, dutyName: 'Reception / KO' };
 }
 if (['ADMIN_ORDER', 'BOI'].includes(codeUpper) || notesLower.includes('admin order')) {
 return { isOnParade: false, label: 'Admin Order', dutyCode: 'ADMIN_ORDER', notes, dutyName: 'Admin Order' };
 }
 if (['CLASS_TRG', 'CLASS', 'TRG'].includes(codeUpper)) {
 return { isOnParade: false, label: 'Class / Trg', dutyCode: 'CLASS_TRG', notes, dutyName: 'Class / Trg' };
 }
 if (['AIRPORT', 'AIR_FD', 'AIRFIELD', 'ATT'].includes(codeUpper)) {
 return { isOnParade: false, label: 'Airfield', dutyCode: 'ATT', notes, dutyName: 'Airfield' };
 }
 if (['GAMES', 'GH', 'GAME_HONOR'].includes(codeUpper)) {
 return { isOnParade: false, label: 'G/H & Games', dutyCode: 'GAMES', notes, dutyName: 'G/H & Games' };
 }
 if (['ABSENT', 'AWL'].includes(codeUpper)) {
 return { isOnParade: false, label: 'Absent', dutyCode: 'ABSENT', notes, dutyName: 'Absent' };
 }
 if (statusCategory === 'OFF' || codeUpper === 'DUTY_OFF') {
 return { isOnParade: false, label: dutyName || notes || 'GD Off', dutyCode: 'DUTY_OFF', notes, dutyName: dutyName || 'GD Off' };
 }
 if (statusCategory === 'DUTY' || ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA'].includes(codeUpper)) {
 return { isOnParade: false, label: notes || dutyCode || 'On Duty', dutyCode: dutyCode || 'DUTY_ON', notes, dutyName: dutyName || 'On Duty' };
 }

 return { isOnParade: false, label: notes || dutyCode || 'Disposal', dutyCode: dutyCode || 'OTHERS', notes, dutyName: dutyName || 'Disposal' };
 };

 const availableOnParade = flightAirmen.filter((a) => getAirmanStatusLabel(a.id).isOnParade);

 const handleSelectAllFlightAvailable = () => {
 const availableIds = availableOnParade.map((a) => a.id);
 setSelectedDisposalAirmenIds((prev) => Array.from(new Set([...prev, ...availableIds])));
 };

 const handleDeselectFlight = () => {
 const flightIds = flightAirmen.map((a) => a.id);
 setSelectedDisposalAirmenIds((prev) => prev.filter((id) => !flightIds.includes(id)));
 };
 
 if (role === 'ADMIN' && selectedDate < todayStr) {
 return (
    <div className="py-8 text-center text-sm font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 ">
 <div className="mb-2">🚫</div>
 Modifications are disabled for past dates.
 </div>
 );
 }

 return (
    <div className="space-y-1.5">
 {/* Selection Toolbar */}
 <div className="flex items-center justify-between px-1 text-xs">
 <span className="text-slate-600 font-medium">
 Available: <strong className="text-emerald-700 font-bold">{availableOnParade.length}</strong> / {flightAirmen.length} in {disposalFlight}
 {selectedDisposalAirmenIds.length > 0 && (
 <span className="ml-2 font-bold text-purple-600 ">
 ({selectedDisposalAirmenIds.length} Selected)
 </span>
 )}
 </span>
 <div className="flex items-center space-x-2">
 <button
 type="button"
 onClick={handleSelectAllFlightAvailable}
 disabled={availableOnParade.length === 0}
 className="text-[11px] font-bold text-purple-600 hover:underline disabled:opacity-40 cursor-pointer"
 >
 Select All Available
 </button>
 <span className="text-slate-300 ">|</span>
 <button
 type="button"
 onClick={handleDeselectFlight}
 className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
 >
 Clear
 </button>
 </div>
 </div>

 {/* Airmen List Scrollbox */}
 <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 /50">
 {flightAirmen.length === 0 ? (
 <div className="py-4 text-center text-xs text-slate-400">
 No airmen registered in {disposalFlight} Flight
 </div>) : (
 flightAirmen.map((a) => {
 const statusInfo = getAirmanStatusLabel(a.id);
 const { isOnParade, label: statusLabel } = statusInfo;
 const isChecked = selectedDisposalAirmenIds.includes(a.id);

 if (isOnParade) {
 return (
 <div onClick={() => { if (isChecked) { setSelectedDisposalAirmenIds((prev) => prev.filter((id) => id !== a.id)); } else { setSelectedDisposalAirmenIds((prev) => [...prev, a.id]); } }}
 key={a.id}
 className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer select-none text-xs ${
 isChecked
 ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 dark:border-purple-700 text-purple-950 dark:text-purple-300 font-bold shadow-xs'
 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 text-slate-800 dark:text-slate-200 font-medium'
 }`}
 >
 <div className="flex items-center space-x-2.5 min-w-0">
 <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border'}`}>
                          {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                        </div>
 <span className="truncate">
 <span className="font-bold">{formatAirmanName(a.rank)}</span> {a.name} <span className="text-[11px] text-slate-400">({a.trade})</span>
 </span>
 </div>
 <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0 ml-2">
 On Parade
 </span>
 </div>
 );
 }

 // Airman with existing disposal / duty - with Edit / Change button
 return (
    <div
 key={a.id}
 className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 /80 bg-slate-100/80 dark:bg-slate-800/60 text-xs select-none"
 >
 <div className="flex items-center space-x-2.5 min-w-0">
 <span className="truncate text-slate-700 dark:text-slate-300">
 <span className="font-bold">{formatAirmanName(a.rank)}</span> {a.name} ({a.trade})
 </span>
 </div>
 <div className="flex items-center space-x-1.5 shrink-0 ml-2">
 <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
 {statusLabel}
 </span>
 <button
 type="button"
 onClick={() => {
 openEditDisposal(a, statusInfo.dutyCode, statusInfo.dutyName, statusInfo.notes);
 }}
 className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-100 text-purple-700 /60 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors cursor-pointer flex items-center space-x-1"
 title="Click to edit, change or remove disposal for this airman"
 >
 <span>✏️ Change</span>
 </button>
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>
 );
 })()}
 </div>

 {/* Submit Buttons */}
 <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 dark:border-slate-700">
 <span className="text-xs font-bold text-slate-600 ">
 {selectedDisposalAirmenIds.length === 0 ? (
 'Select personnel above'
 ) : (
 <span className="text-purple-600 ">
 {selectedDisposalAirmenIds.length} personnel selected
 </span>
 )}
 </span>
 <div className="flex items-center space-x-2">
 <button
 type="button"
 onClick={() => setShowAddDisposalModal(false)}
 className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={disposalLoading || selectedDisposalAirmenIds.length === 0}
 className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
 >
 {disposalLoading ? (
 <RefreshCw className="w-4 h-4 animate-spin" />
 ) : (
 <Check className="w-4 h-4" />
 )}
 <span>
 {selectedDisposalAirmenIds.length > 1
 ? `Add Disposal (${selectedDisposalAirmenIds.length})`
 : selectedDisposalAirmenIds.length === 1
 ? 'Add Disposal (1 Airman)'
 : 'Select Airmen'}
 </span>
 </button>
              <button
                type="submit"
                disabled={selectedDisposalAirmenIds.length === 0 || disposalLoading || (disposalCategory === 'OTHERS' && !disposalCustomTitle.trim())}
                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl disabled:opacity-50 transition-all shadow-md shadow-rose-900/20 cursor-pointer"
              >
                {disposalLoading ? 'Applying...' : 'Apply Disposal'}
              </button>

 </div>
          </div>
        </form>
 </div>
 </div>
 )}

 {/* Edit / Change Disposal Modal */}
 {editDisposalModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn print:hidden">
 <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4">
 <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
 <div>
 <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
 <span>✏️ Edit / Change Disposal</span>
 </h3>
 <p className="text-xs font-semibold text-slate-500 mt-0.5">
 {formatAirmanName(editDisposalModal.airman.rank)} {editDisposalModal.airman.name} • BD/{editDisposalModal.airman.bdNo} • {editDisposalModal.airman.trade} ({editDisposalModal.airman.flightName} Flt)
 </p>
 </div>
 <button
 onClick={() => setEditDisposalModal(null)}
 className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="space-y-4 text-xs">
 {/* Current Status Info */}
 <div className="bg-purple-50 /40 p-3 rounded-xl border border-purple-200 flex items-center justify-between">
 <div>
 <span className="text-[11px] text-purple-700 font-semibold block">Current Assignment:</span>
 <span className="font-bold text-slate-900 dark:text-white text-xs">
 {editDisposalModal.currentDutyName || editDisposalModal.currentDutyCode}
 {editDisposalModal.notes && <span className="text-slate-500 ml-1">({editDisposalModal.notes})</span>}
 </span>
 </div>
 <button
 type="button"
 onClick={() => handleSaveEditDisposal('ON_PARADE')}
 disabled={editDisposalLoading}
 className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-100 /60 hover:bg-rose-200 dark:hover:bg-rose-900 rounded-lg border border-rose-200 transition-colors cursor-pointer"
 >
 Clear Disposal (Set On Parade)
 </button>
 </div>

 {/* Date Range for Edit */}
 <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700">
 <div>
 <label className="text-[11px] font-bold text-slate-700 block mb-1">
 From Date:
 </label>
 <DateNavigator
 
 value={editDisposalFromDate}
 onChange={(e) => setEditDisposalFromDate(e.target.value)}
 className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-purple-500 shadow-xs"
 />
 </div>
 <div>
 <label className="text-[11px] font-bold text-slate-700 block mb-1">
 To Date:
 </label>
 <DateNavigator
 
 value={editDisposalToDate}
 min={editDisposalFromDate}
 onChange={(e) => setEditDisposalToDate(e.target.value)}
 className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-purple-500 shadow-xs"
 />
 </div>
 </div>

 {/* Change Category Selection */}
              <div className="space-y-2 relative">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Change Disposal Category To:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditingDisposals(!isEditingDisposals)}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${isEditingDisposals ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title="Manage Saved Categories"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedDisposals.map((cat) => {
                    const isSelected = !isEditingDisposals && editDisposalCategory === cat.code && (cat.code !== 'OTHERS' || editDisposalCustomTitle === cat.customTitle);
                    return (
                      <div key={cat.label} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingDisposals) return;
                            setEditDisposalCategory(cat.code);
                            if (cat.customTitle) setEditDisposalCustomTitle(cat.customTitle);
                            else if (cat.code === 'OTHERS') setEditDisposalCustomTitle('');
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all truncate ${isEditingDisposals ? 'pr-6 opacity-80 cursor-default bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'cursor-pointer'} ${
                            isSelected
                              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 shadow-xs'
                              : (!isEditingDisposals ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600' : '')
                          }`}
                        >
                          {cat.label}
                        </button>
                        {isEditingDisposals && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDisposalOption(cat.label)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!isEditingDisposals && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowDisposalDropdown(!showDisposalDropdown)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {savedDisposals.length === 0 && <span>Add Category</span>}
                      </button>
                      {showDisposalDropdown && (
                        <div className="absolute bottom-full mb-1 left-0 w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1">
                          {ALL_DISPOSAL_OPTIONS.filter(opt => opt.code === 'OTHERS' || (!savedDisposals.some(d => d.code === opt.code && (d.code !== 'OTHERS' || d.customTitle === opt.customTitle)))).filter((opt, index, self) => index === self.findIndex((t) => t.code === opt.code && t.customTitle === opt.customTitle)).map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => {
                                handleAddDisposalOption(opt);
                                setEditDisposalCategory(opt.code);
                                if (opt.customTitle) setEditDisposalCustomTitle(opt.customTitle);
                                else if (opt.code === 'OTHERS') setEditDisposalCustomTitle('');
                                setShowDisposalDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
                            >
                              {opt.code === 'OTHERS' && opt.customTitle ? opt.customTitle : opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Custom Title Input if OTHERS selected */}
                {editDisposalCategory === 'OTHERS' && (!ALL_DISPOSAL_OPTIONS.find(o => o.label === editDisposalCustomTitle) || editDisposalCustomTitle === '') && !isEditingDisposals && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1 animate-fadeIn mt-2">
                    <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Specify Custom Disposal Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Special Escort, VVIP Detail..."
                      value={editDisposalCustomTitle}
                      onChange={(e) => setEditDisposalCustomTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white print:text-black dark:text-white outline-none focus:border-amber-500 shadow-xs"
                      required
                    />
                  </div>
                )}
              </div>
            </div>
            {/* Modal Action Buttons */}
                        {editDisposalCategory === 'OTHERS' && (
                          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800 dark:border-slate-700">
 <button
 type="button"
 onClick={() => setEditDisposalModal(null)}
 className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
 >
 Cancel
 </button>
              <button
                type="button"
                onClick={() => handleSaveEditDisposal()}
                disabled={editDisposalLoading || !editDisposalCategory || (editDisposalCategory === 'OTHERS' && !editDisposalCustomTitle.trim())}
                className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50 transition-all shadow-md shadow-emerald-900/20 cursor-pointer"
              >
                {editDisposalLoading ? 'Applying...' : 'Apply Changes'}
              </button>
 <button
 type="button"
 onClick={handleSaveEditDisposal}
 disabled={editDisposalLoading}
 className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
 >
 {editDisposalLoading ? (
 <RefreshCw className="w-4 h-4 animate-spin" />
 ) : (
 <Check className="w-4 h-4" />
 )}
 <span>Done</span>
                        </button>
                      </div>
                    )}
 </div>
 </div>
 )}

 {/* Flight Duty Ratio Configurator Modal */}
 {showRatioModal && (
 <FlightDutyRatioModal
 airmen={airmen}
 date={fromDate}
 onClose={() => setShowRatioModal(false)}
 onRatiosUpdated={() => setRatioRefreshTrigger((prev) => prev + 1)}
 />
 )}

 

 {/* Signature Configuration Modal (Prepared By / Authorized By) */}
 <SignatureConfigModal
 isOpen={showSignatureModal}
 onClose={() => setShowSignatureModal(false)}
 initialTab={signatureInitialTab}
 onSignaturesUpdated={(prep, auth) => {
 setPreparedBy(prep);
 setAuthorizedBy(auth);
 }}
 />
 </div>
 </div>
 </div>
 </div>
 );
};