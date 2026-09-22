import React, { useState, useEffect } from 'react';
import { Airman, FlightName, Rank, UserRole } from '../types';
import { Search, UserPlus, Edit3, Trash2, Filter, Phone, MapPin, Shield, CheckCircle, RefreshCw, Printer, FileDown, FileSpreadsheet, Upload, KeyRound, UserCheck, AlertTriangle, Calendar } from 'lucide-react';
import { handleSafePrint } from "../utils/printUtils";
import { sortAirmenBySeniority } from '../utils/seniority';
import { PrintableNominalRollModal } from './PrintableNominalRollModal';
import { exportNominalRollDocx } from '../utils/docxExport';
import { BulkImportAirmenModal } from './BulkImportAirmenModal';
import { EntryHistoryModal } from './EntryHistoryModal';
import { History } from 'lucide-react';
import { localDb } from '../services/localDatabase';
import { formatShortDate, normalizeDateToISO } from '../utils/csvExport';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface NominalRollProps {
  variant?: 'nominal' | 'biodata';
  airmen: Airman[];
  role?: UserRole;
  userFlight?: string;
  onRefresh: () => void;
  onAddAirman: () => void;
  onEditAirman: (airman: Airman) => void;
  onDeleteAirman: (airmanId: string) => void;
  onViewProfile: (airman: Airman, config?: any) => void;
  onSyncGoogleSheet?: () => Promise<void>;
  initialFlightFilter?: FlightName | 'All' | '';
}

export const NominalRoll: React.FC<NominalRollProps> = ({
  variant = 'nominal',
  initialFlightFilter = 'All',
  airmen,
  role,
  onRefresh,
  onAddAirman,
  onEditAirman,
  onDeleteAirman,
  onViewProfile,
  onSyncGoogleSheet,
}) => {
  const [search, setSearch] = useState('');
  const [flightFilter, setFlightFilter] = useState<FlightName | 'All' | ''>(initialFlightFilter);
  const [rankFilter, setRankFilter] = useState<Rank | 'All' | ''>('All');
  const [statusFilter, setStatusFilter] = useState<'Total' | 'Active' | 'Previous Airmen'>('Active');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  

  const [airmanToDelete, setAirmanToDelete] = useState<Airman | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeContactMenu, setActiveContactMenu] = useState<string | null>(null);
  const [editingDateAirmanId, setEditingDateAirmanId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>('');

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveContactMenu(null);
    if (activeContactMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeContactMenu]);

  const handleSync = async () => {
    if (!onSyncGoogleSheet) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      await onSyncGoogleSheet();
      setSyncStatus('Synced successfully from Google Sheet!');
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setSyncStatus('Sync failed. Please check internet connection.');
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const flightsList: (FlightName | 'All')[] = [
    'All',
    'Avionics',
    'Mechanics',
    'GCS',
    'Admin',
  ];

  const ranksList: (Rank | 'All')[] = ['All', 'MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];

  // Sort airmen strictly by BAF Seniority
  const sortedAirmen = sortAirmenBySeniority(airmen);

  // Filter airmen
  const filteredAirmen = sortedAirmen.filter((airman) => {
    let matchesStatus = true;
    if (variant === 'nominal') {
      matchesStatus = airman.active !== false;
    } else if (statusFilter === 'Active') {
      matchesStatus = airman.active !== false;
    } else if (statusFilter === 'Previous Airmen') {
      matchesStatus = airman.active === false;
    }
    
    const matchesFlight = flightFilter === '' ? true : (flightFilter === 'All' || airman.flightName === flightFilter);
    const matchesRank = rankFilter === '' ? true : (rankFilter === 'All' || airman.rank === rankFilter);
    const q = search.toLowerCase();
    const matchesSearch =
      (airman.fullName || '').toLowerCase().includes(q) ||
      airman.name.toLowerCase().includes(q) ||
      airman.bdNo.toLowerCase().includes(q) ||
      airman.code.toLowerCase().includes(q) ||
      airman.trade.toLowerCase().includes(q) ||
      airman.addressBlock.toLowerCase().includes(q);

    return matchesStatus && matchesFlight && matchesRank && matchesSearch;
  });

  const handlePrint = () => {
    handleSafePrint();
  };

  return (
    <div className="space-y-6">
      <div className={isPrintModalOpen ? "hidden" : "space-y-6 print:hidden"}>
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <span>{variant === 'biodata' ? 'Biodata Register' : 'Nominal Roll'}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300">
              {filteredAirmen.length} Airmen{variant === 'biodata' ? ' (Seniority Order)' : ''}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete Airmen list for 155 UASU BAF • Sorted by Rank Seniority & BD Number.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
            title="Print Preview / Export"
          >
            <Printer className="w-4 h-4" />
            <span>Official Export/Print</span>
          </button>

          {variant === 'biodata' && (
            <button
              type="button"
              onClick={() => setIsBulkImportOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="Import Airmen via Excel (.xlsx)"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
          )}

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl font-bold text-xs shadow-xs transition-colors"
            title="View Activity History"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>History</span>
          </button>

          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <button
              onClick={onAddAirman}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Airman</span>
            </button>
          )}
        </div>
      </div>

      {syncStatus && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-xs animate-fadeIn">
          <span className="font-semibold">{syncStatus}</span>
          <span className="font-mono text-[10px] text-emerald-400 opacity-80">155 UASU BAF Sheet Connected</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search Name, BD No, Trade, Flight..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Flight Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-medium">Flight:</span>
            <select
              value={flightFilter}
              onChange={(e) => setFlightFilter(e.target.value as any)}
              className="bg-transparent font-black outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              {flightsList.map((fl) => (
                <option key={fl} value={fl} className="bg-white dark:bg-slate-900">
                  {fl === 'All' ? 'All Flights' : `${fl} Flight`}
                </option>
              ))}
            </select>
          </div>

          {/* Rank Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-medium">Rank:</span>
            <select
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value as any)}
              className="bg-transparent font-black outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              {ranksList.map((rk) => (
                <option key={rk} value={rk} className="bg-white dark:bg-slate-900">
                  {rk === 'All' ? 'All Ranks' : rk}
                </option>
              ))}
            </select>
          </div>
          
          {/* Status Filter */}
          {variant === 'biodata' && (
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-black outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              <option value="Total">Total</option>
              <option value="Active">Active</option>
              <option value="Previous Airmen">Previous Airmen</option>
            </select>
          </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4 w-12 text-center">Ser</th>
                <th className="py-3 px-4">BD No</th>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Trade</th>
                <th className="py-3 px-4">Flight</th>
                {variant === 'biodata' && <th className="py-3 px-4">Blood Group</th>}
                <th className="py-3 px-4">{variant === 'biodata' ? 'Present Address' : 'Address'}</th>
                {variant === 'biodata' && <th className="py-3 px-4 text-center">Permanent Address</th>}
                <th className="py-3 px-4">Contact</th>
                {variant === 'biodata' && <th className="py-3 px-4 text-center">Dt of Posting</th>}
                {variant === 'biodata' && <th className="py-3 px-4 text-center">Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredAirmen.map((airman, idx) => (
                <tr
                  key={airman.id}
                  onClick={() => onViewProfile(airman)}
                  className="hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors even:bg-slate-50 odd:bg-white dark:even:bg-slate-800/20 dark:odd:bg-slate-900 cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-400 text-center">
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-4 font-mono font-black text-slate-900 dark:text-slate-100">
                    {airman.bdNo}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-black px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono border border-slate-300 dark:border-slate-700">
                      {formatAirmanName(airman.rank)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-slate-900 dark:text-slate-100 text-left">
                        {airman.fullName || airman.name}
                      </span>
                      {(!airman.bdNo?.trim() || !airman.rank?.trim() || !airman.name?.trim() || !airman.trade?.trim() || ['General Tech', '-', 'N/A'].includes(airman.trade) || !airman.addressBlock?.trim() || ['-', 'N/A', 'L/O', 'L/I', "Sgt's Mess", "Airmen's Mess", "Live Out", "Live In"].includes(airman.addressBlock) || !airman.mobileNo?.trim() || ['01', '01700000000', '-'].includes(airman.mobileNo) || !airman.flightName?.trim()) && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Missing or incomplete information (Trade, Address, or Mobile). Click to update." />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                    {airman.trade}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {airman.flightName}
                    </span>
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      {airman.bloodGroup || '-'}
                    </td>
                  )}
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    <div className="flex items-start space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <div className="text-left leading-tight" title={airman.addressBlock}>
                        {airman.addressBlock ? (
                          airman.addressBlock.includes("Mess, Block No:") ? (
                            <>
                              <span className="block">{airman.addressBlock.split(", Block No:")[0]},</span>
                              <span className="block text-[10px] text-slate-500 font-bold">Block No:{airman.addressBlock.split(", Block No:")[1]}</span>
                            </>
                          ) : (
                            <span className="block whitespace-normal min-w-[120px]">{airman.addressBlock}</span>
                          )
                        ) : '-'}
                      </div>
                    </div>
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div className="text-center leading-tight text-[11px] whitespace-normal min-w-[150px]" title={airman.permanentAddress}>
                        {airman.permanentAddress ? (
                          airman.permanentAddress.includes(';') ? (
                            (() => {
                              const parts = airman.permanentAddress.split(';').map(x => x.trim()).filter(Boolean);
                              const rows = [];
                              for (let i = 0; i < parts.length; i += 2) {
                                rows.push(parts.slice(i, i + 2).join('; '));
                              }
                              return rows.map((r, i) => <span key={i} className="block">{r}</span>);
                            })()
                          ) : (
                            <span className="block">{airman.permanentAddress}</span>
                          )
                        ) : '-'}
                      </div>
                    </td>
                  )}
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 relative">
                    <div 
                      className="flex items-center space-x-1 cursor-pointer hover:text-emerald-600 transition-colors py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveContactMenu(activeContactMenu === airman.id ? null : airman.id);
                      }}
                    >
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{airman.mobileNo}</span>
                    </div>
                    {activeContactMenu === airman.id && (
                      <div 
                        className="absolute z-10 left-4 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 px-1.5 overflow-hidden animate-in fade-in zoom-in-95 flex items-center space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a 
                          href={`tel:${airman.mobileNo.replace(/\D/g, '')}`}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                          title="Normal Call"
                        >
                          <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </a>
                        <a 
                          href={`https://wa.me/88${airman.mobileNo.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 transition-colors"
                          title="WhatsApp"
                        >
                          <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                          </svg>
                        </a>
                      </div>
                    )}
                  </td>
                  {variant === 'biodata' && (
                    <td 
                      className="py-3 px-4 whitespace-nowrap text-center text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editingDateAirmanId === airman.id ? (
                        <div 
                          className="inline-flex items-center space-x-1"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="date"
                            autoFocus
                            ref={(el) => {
                              if (el) {
                                try {
                                  if (typeof el.showPicker === 'function') {
                                    el.showPicker();
                                  }
                                } catch (err) {}
                              }
                            }}
                            value={editingDateValue}
                            onChange={(e) => setEditingDateValue(e.target.value)}
                            onBlur={async () => {
                              const prevIso = airman.dateJoined ? normalizeDateToISO(airman.dateJoined) : '';
                              if (editingDateValue !== prevIso) {
                                localDb.updateAirman(airman.id, { dateJoined: editingDateValue });
                                if (onRefresh) await onRefresh();
                              }
                              setEditingDateAirmanId(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const prevIso = airman.dateJoined ? normalizeDateToISO(airman.dateJoined) : '';
                                if (editingDateValue !== prevIso) {
                                  localDb.updateAirman(airman.id, { dateJoined: editingDateValue });
                                  if (onRefresh) await onRefresh();
                                }
                                setEditingDateAirmanId(null);
                              } else if (e.key === 'Escape') {
                                setEditingDateAirmanId(null);
                              }
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-lg text-xs font-semibold text-slate-900 dark:text-white shadow-md focus:outline-hidden"
                          />
                        </div>
                      ) : (
                        <div 
                          className="group/date inline-flex items-center justify-center space-x-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 transition-all select-none"
                          title="Double-click to open calendar & edit date"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingDateAirmanId(airman.id);
                            setEditingDateValue(airman.dateJoined ? normalizeDateToISO(airman.dateJoined) : '');
                          }}
                        >
                          <span className="font-mono text-slate-700 dark:text-slate-200 group-hover/date:text-emerald-700 dark:group-hover/date:text-emerald-300 font-bold transition-colors">
                            {formatShortDate(airman.dateJoined)}
                          </span>
                          <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover/date:text-emerald-600 dark:group-hover/date:text-emerald-400 transition-colors shrink-0" />
                        </div>
                      )}
                    </td>
                  )}
                  {variant === 'biodata' && (
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${airman.active !== false ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'}`}>
                      {airman.active !== false ? 'Active' : (airman.leaveReason || 'Inactive')}
                    </span>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom In-App Delete Airman Confirmation Modal */}
      {airmanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Remove Airman Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action removes the personnel from the active nominal roll.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">BD Number:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">{airmanToDelete.bdNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rank & Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{airmanToDelete.rank} {airmanToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Flight & Trade:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{airmanToDelete.flightName} Flight • {airmanToDelete.trade}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setAirmanToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDeleteAirman(airmanToDelete.id);
                    setAirmanToDelete(null);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-md shadow-rose-900/20 transition-all cursor-pointer flex items-center space-x-1.5"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Airmen Modal */}
      <BulkImportAirmenModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        existingAirmen={airmen}
        onImportComplete={() => {
          onRefresh();
          window.dispatchEvent(new CustomEvent('baf_state_updated'));
        }}
      />

      

      {isHistoryModalOpen && (
        <EntryHistoryModal
          airmen={airmen}
          filterType="SYSTEM"
          onClose={() => setIsHistoryModalOpen(false)}
          onRefreshData={onRefresh}
        />
      )}

      </div>
      {isPrintModalOpen && (
        <PrintableNominalRollModal variant={variant}
          airmen={filteredAirmen}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
};
