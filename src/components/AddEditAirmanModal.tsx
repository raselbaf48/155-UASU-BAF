import React, { useState, useMemo } from 'react';
import { Airman, FlightName, Rank } from '../types';
import { X, Check, Building2, Home, MapPin, User, Phone, Shield, AlertCircle } from 'lucide-react';
import { getRankSeniorityRange, resolveTargetSeniority, isJcoRank } from '../utils/seniority';

interface AddEditAirmanModalProps {
  variant?: 'nominal' | 'biodata';
  airmanToEdit?: Airman | null;
  existingAirmen?: Airman[];
  onSave: (airmanData: Partial<Airman>) => void;
  onClose: () => void;
}

export const AddEditAirmanModal: React.FC<AddEditAirmanModalProps> = ({
  variant = 'nominal',
  airmanToEdit,
  existingAirmen = [],
  onSave,
  onClose,
}) => {
  const [fullName, setFullName] = useState(airmanToEdit?.fullName || airmanToEdit?.name || '');
  const [name, setName] = useState(airmanToEdit?.name || '');
  const [bdNo, setBdNo] = useState(airmanToEdit?.bdNo || '');
  const [code, setCode] = useState(airmanToEdit?.code || '');
  const [rank, setRank] = useState<Rank | ''>(airmanToEdit?.rank || '');
  const [trade, setTrade] = useState(airmanToEdit?.trade || '');
    const [flightName, setFlightName] = useState<FlightName | ''>(airmanToEdit?.flightName || '');
  const [mobileNo, setMobileNo] = useState(airmanToEdit?.mobileNo || '');
  const [bloodGroup, setBloodGroup] = useState(airmanToEdit?.bloodGroup || '');
  const [seniority, setSeniority] = useState<number | ''>(airmanToEdit?.seniority !== undefined ? airmanToEdit.seniority : '');
  const [permanentAddress, setPermanentAddress] = useState(airmanToEdit?.permanentAddress || '');

  const [isAddressPreset, setIsAddressPreset] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    return addr.includes('Vill:') && addr.includes('P/O:') && addr.includes('P/S:') && addr.includes('Dist:');
  });
  const [addrVill, setAddrVill] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/Vill:\s*(.*?)\s*;/);
    return match ? match[1] : '';
  });
  const [addrPO, setAddrPO] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/P\/O:\s*(.*?)\s*;/);
    return match ? match[1] : '';
  });
  const [addrPS, setAddrPS] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/P\/S:\s*(.*?)\s*;/);
    return match ? match[1] : '';
  });
  const [addrDist, setAddrDist] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/Dist:\s*(.*?)$/);
    return match ? match[1] : '';
  });
  const [remarks, setRemarks] = useState(airmanToEdit?.remarks || '');
  const [dateJoined, setDateJoined] = useState(airmanToEdit?.dateJoined || (!airmanToEdit ? new Date().toISOString().split('T')[0] : ''));
  const [dateLeft, setDateLeft] = useState(airmanToEdit?.dateLeft || '');
  const [leaveReason, setLeaveReason] = useState(airmanToEdit?.leaveReason || '');
  const [customLeaveReason, setCustomLeaveReason] = useState(() => {
    if (airmanToEdit?.leaveReason && !['Posted Out', 'Retired', 'Dismissed'].includes(airmanToEdit.leaveReason)) {
      return airmanToEdit.leaveReason;
    }
    return '';
  });
  const [validationError, setValidationError] = useState<string>('');

  const rankRange = useMemo(() => {
    const effectiveRank = rank || airmanToEdit?.rank || 'LAC';
    return getRankSeniorityRange(existingAirmen || [], effectiveRank);
  }, [existingAirmen, rank, airmanToEdit]);

  const targetResolved = useMemo(() => {
    if (seniority === '' || !rank) return null;
    return resolveTargetSeniority(existingAirmen || [], rank, Number(seniority));
  }, [existingAirmen, rank, seniority]);

  // Address Selection States: L/In vs L/Out
  const [livingType, setLivingType] = useState<'L_IN' | 'L_OUT' | null>(() => {
    if (airmanToEdit?.addressBlock) {
      const lower = airmanToEdit.addressBlock.toLowerCase();
      if (lower.includes('mess') || lower.match(/block/i) || lower === 'l/i' || lower === 'live in') {
        return 'L_IN';
      }
      if (lower.trim() !== '' && lower !== '-' && lower !== 'n/a' && lower !== 'l/o') {
        return 'L_OUT';
      }
    }
    return null;
  });

  // L/In specific state
  const [blockNo, setBlockNo] = useState<string>(() => {
    if (airmanToEdit?.addressBlock) {
      const match = airmanToEdit.addressBlock.match(/Block\s*(?:No[:\s]*)?([^,]+)/i);
      if (match) return match[1].trim();
      return airmanToEdit.addressBlock.replace(/Airmen's Mess|Sgt's Mess|Mess/gi, '').replace(/^[,\s:-]+/, '').trim();
    }
    return '';
  });

  // L/Out specific states
  const [livingOutType, setLivingOutType] = useState<'QUARTER' | 'OUTSIDE_BASE'>(() => {
    if (airmanToEdit?.addressBlock) {
      const lower = airmanToEdit.addressBlock.toLowerCase();
      if (lower.includes('qtr') || lower.includes('quarter')) {
        return 'QUARTER';
      }
      return 'OUTSIDE_BASE';
    }
    return 'QUARTER';
  });

  const [svcQtrNo, setSvcQtrNo] = useState<string>(() => {
    if (airmanToEdit?.addressBlock) {
      if (airmanToEdit.addressBlock.toLowerCase().includes('qtr') || airmanToEdit.addressBlock.toLowerCase().includes('quarter')) {
        const match = airmanToEdit.addressBlock.match(/Svc\s*Qtr\s*(?:No[:\s]*)?([^,]+)/i) || airmanToEdit.addressBlock.match(/Qtr\s*(?:No[:\s]*)?([^,]+)/i);
        if (match) return `Svc Qtr No: ${match[1].trim()}`;
        return airmanToEdit.addressBlock.trim();
      }
    }
    return 'Svc Qtr No: ';
  });

  const [outsideAddress, setOutsideAddress] = useState<string>(() => {
    if (airmanToEdit?.addressBlock) {
      const lower = airmanToEdit.addressBlock.toLowerCase();
      if (!lower.includes('qtr') && !lower.includes('quarter') && !lower.includes('mess') && !lower.match(/block/i)) {
        return airmanToEdit.addressBlock.replace(/Outside\s*Base[:\s]*/gi, '').trim();
      }
    }
    return '';
  });

  const isSgtOrAbove = (r: Rank) => {
    return ['MWO', 'SWO', 'WO', 'Sgt'].includes(r);
  };

  const ranksList: Rank[] = ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];

  const computeFinalAddress = (): string => {
    if (livingType === 'L_IN') {
      const messType = isSgtOrAbove(rank) ? "Sgt's Mess" : "Airmen's Mess";
      if (blockNo.trim()) {
        return `${messType}, Block No: ${blockNo.trim()}`;
      }
      return messType;
    } else {
      if (livingOutType === 'QUARTER') {
        if (svcQtrNo.trim()) {
          return svcQtrNo.trim();
        }
        return 'Svc Qtr No: ';
      } else {
        if (outsideAddress.trim()) {
          return outsideAddress.trim();
        }
        return '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!name.trim()) return setValidationError('Please fill in required field: Surname');
    if (!fullName.trim()) return setValidationError('Please fill in required field: Full Name');
        const rawBd = bdNo.trim().replace(/^BD\/?/i, '').replace(/\s+/g, '');
    if (!/^[4]\d{5}$/.test(rawBd)) return setValidationError('BD Number must be exactly 6 digits and start with 4');
    if (!rank) return setValidationError('Please select a Rank');
    if (!trade.trim()) return setValidationError('Please enter a Trade');
    if (!flightName) return setValidationError('Please select a Flight');
        const rawMobile = mobileNo.trim().replace(/\s+/g, '');
    if (!/^\d{11}$/.test(rawMobile)) return setValidationError('Mobile Number must be exactly 11 digits');
    
    if (!livingType) return setValidationError('Please select Living Status (L/In or L/Out)');
    if (livingType === 'L_IN' && !blockNo.trim()) return setValidationError('Please enter Block No for Live-In address');
    if (livingType === 'L_OUT') {
      if (livingOutType === 'QUARTER' && !svcQtrNo.trim()) return setValidationError('Please enter Service Quarter Number');
      if (livingOutType === 'OUTSIDE_BASE' && !outsideAddress.trim()) return setValidationError('Please enter Outside Base Address');
    }

    if (dateLeft) {
      if (!leaveReason) return setValidationError('Please select a Reason for leaving the unit');
      if (leaveReason === 'Custom' && !customLeaveReason.trim()) return setValidationError('Please enter a custom reason');
    }

    // BD Number Uniqueness check (Part 2)
    const normalizedNewBd = bdNo.trim().replace(/^BD\/?/i, '').replace(/\s+/g, '').toLowerCase();
    const duplicateAirman = existingAirmen.find((a) => {
      if (airmanToEdit && a.id === airmanToEdit.id) return false;
      const existingBd = a.bdNo.trim().replace(/^BD\/?/i, '').replace(/\s+/g, '').toLowerCase();
      return existingBd === normalizedNewBd;
    });

    if (duplicateAirman) {
      setValidationError(`An airman with BD Number ${bdNo.trim()} (${duplicateAirman.rank} ${duplicateAirman.name} - ${duplicateAirman.flightName}) already exists in the Nominal Roll.`);
      return;
    }

    const finalAddress = computeFinalAddress();
    const finalLeaveReason = dateLeft ? (leaveReason === 'Custom' ? customLeaveReason.trim() : leaveReason) : undefined;

    onSave({
      fullName: fullName.trim(),
      name: name.trim(),
      bdNo: bdNo.trim(),
      code: code || `${rank}-${name.slice(0, 3).toUpperCase()}`,
      rank,
      trade: trade.trim() || 'General Tech',
      flightName,
      addressBlock: finalAddress,
      mobileNo: mobileNo.trim() || '01',
      bloodGroup: bloodGroup || '',
      permanentAddress: isAddressPreset ? `Vill: ${addrVill.trim()}; P/O: ${addrPO.trim()}; P/S: ${addrPS.trim()}; Dist: ${addrDist.trim()}` : permanentAddress.trim(),
      remarks: remarks.trim(),
      dateJoined: dateJoined || '',
      dateLeft: dateLeft || '',
      leaveReason: finalLeaveReason || '',
      active: !dateLeft, // Set active to false if dateLeft is provided
      // Only Warrant Officers (MWO, SWO, WO) can have custom seniority order; others are strictly BD-No sorted
      seniority: isJcoRank(rank) && seniority !== '' && targetResolved
        ? targetResolved.resolvedSeniority
        : (isJcoRank(rank) && seniority !== '' ? Number(seniority) : undefined),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden my-0 sm:my-6 h-full sm:h-auto">
        {/* Modal Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {airmanToEdit ? 'Edit Airman Details' : `Add New Airman to ${variant === 'biodata' ? 'Biodata Register' : 'Nominal Roll'}`}
              </h2>
              <p className="text-xs text-emerald-300/80">155 UASU BAF • Personnel Registry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {validationError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl flex items-start space-x-2.5 text-xs text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span className="font-semibold">{validationError}</span>
            </div>
          )}

                    {/* Name & BD No */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder=""
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Surname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  placeholder=""
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  BD No <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bdNo}
                  onChange={(e) => {
                    setBdNo(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  placeholder=""
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Rank & Trade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rank <span className="text-red-500">*</span>
              </label>
              <select
                value={rank}
                onChange={(e) => {
                  setRank(e.target.value as any);
                  if (validationError) setValidationError('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>Select Rank</option>
                {ranksList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Trade <span className="text-red-500">*</span>
              </label>
              <select
                value={trade}
                onChange={(e) => {
                  setTrade(e.target.value);
                  if (validationError) setValidationError('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>Select Trade</option>
                {['Afr Fitt', 'Eng Fitt', 'E&I Fitt', 'Radio Fitt', 'Armt Fitt', 'GS', 'Log Asst', 'Sec Asst (GD)', 'Sec Asst (Accts)', 'Admin Asst', 'ATCA', 'Cy Asst', 'IT Asst'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seniority Order Setting (Synced with Cloud Biodata Register) - only in Biodata Register for MWO, SWO, WO */}
          {variant === 'biodata' && isJcoRank(rank) && (
            <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Seniority / জ্যেষ্ঠতা নম্বর (MWO, SWO, WO)
                </label>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-700">
                    {rank || 'Rank'} Range: #{rankRange.minSeniority} - #{rankRange.maxSeniority}
                  </span>
                  {airmanToEdit && (
                    <span className="text-[10px] font-mono font-bold bg-emerald-200/70 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                      Current: #{airmanToEdit.seniority !== undefined ? airmanToEdit.seniority : 'Auto (BD No)'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-mono font-bold text-sm shrink-0">
                  #
                </div>
                <input
                  type="number"
                  min="1"
                  max={existingAirmen?.length || 999}
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                  placeholder={`e.g. 1 (seniormost of ${rank || 'rank'}) or #${rankRange.minSeniority}`}
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* Dynamic feedback showing resolved position */}
              {targetResolved && (
                <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-900/50 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>
                    লক্ষ্য ক্রম: <strong>#{targetResolved.resolvedSeniority}</strong> ({rank}-এর {targetResolved.relativeRankIndex === 1 ? '১ম (জ্যেষ্ঠতম)' : `${targetResolved.relativeRankIndex}তম`} ব্যক্তি হিসেবে নির্ধারিত হবে)
                  </span>
                </div>
              )}

              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight font-medium">
                MWO, SWO ও WO-দের ক্ষেত্রে পদোন্নতির তারিখ বা জ্যেষ্ঠতা অনুসারে ম্যানুয়ালি ক্রম পরিবর্তন করা যায়।
              </p>
            </div>
          )}

          {/* For Non-JCOs (Sgt, Cpl, LAC, AC), show informative banner */}
          {variant === 'biodata' && rank && !isJcoRank(rank) && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">জ্যেষ্ঠতা ক্রম (Seniority):</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                {rank} পদবির জ্যেষ্ঠতা স্বয়ংক্রিয়ভাবে BD No অনুযায়ী নির্ধারিত
              </span>
            </div>
          )}

          {/* Flight & Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Flight <span className="text-red-500">*</span>
              </label>
              <select
                value={flightName}
                required
                onChange={(e) => {
                  setFlightName(e.target.value as any);
                  if (validationError) setValidationError('');
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer ${!flightName ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300 dark:border-slate-700'}`}
              >
                <option value="" disabled>-- Select Flight --</option>
                <option value="Avionics">Avionics Flight</option>
                <option value="Mechanics">Mechanics Flight</option>
                <option value="GCS">GCS Flight</option>
                <option value="Admin">Admin Flight</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={mobileNo}
                onChange={(e) => {
                  setMobileNo(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder=""
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Blood Group */}
          {variant === 'biodata' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Select --</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          )}

          {/* Permanent Address */}
          {variant === 'biodata' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Permanent Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setIsAddressPreset(false)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${!isAddressPreset ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddressPreset(true)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${isAddressPreset ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Preset
                  </button>
                </div>
              </div>
              
              {isAddressPreset ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Vill</label>
                    <input
                      type="text"
                      value={addrVill}
                      onChange={(e) => setAddrVill(e.target.value)}
                      placeholder="Village Name"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Post Office</label>
                    <input
                      type="text"
                      value={addrPO}
                      onChange={(e) => setAddrPO(e.target.value)}
                      placeholder="Post Office"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Police Station</label>
                    <input
                      type="text"
                      value={addrPS}
                      onChange={(e) => setAddrPS(e.target.value)}
                      placeholder="Police Station"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">District</label>
                    <input
                      type="text"
                      value={addrDist}
                      onChange={(e) => setAddrDist(e.target.value)}
                      placeholder="District Name"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <textarea
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="Village, Post Office, Police Station, District"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                />
              )}
            </div>
          )}

          {/* Address Configuration (L/In vs L/Out) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>{variant === 'biodata' ? 'Living Status & Present Address' : 'Living Status & Address'}</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Official Accommodation</span>
            </div>

            {/* Living Type Buttons: L/In vs L/Out */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLivingType('L_IN')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  livingType === 'L_IN'
                    ? 'bg-emerald-600 text-white shadow-xs border-transparent'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Living In (L/In)</span>
              </button>

              <button
                type="button"
                onClick={() => setLivingType('L_OUT')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  livingType === 'L_OUT'
                    ? 'bg-emerald-600 text-white shadow-xs border-transparent'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Living Out (L/Out)</span>
              </button>
            </div>

            {/* Sub-inputs based on living type */}
            {livingType === 'L_IN' ? (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isSgtOrAbove(rank) ? "Sgt's Mess" : "Airmen's Mess"} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2 whitespace-nowrap">Block No:</span>
                    <input
                      type="text"
                      required
                      value={blockNo}
                      onChange={(e) => {
                        setBlockNo(e.target.value);
                        if (validationError) setValidationError('');
                      }}
                      placeholder=""
                      className="flex-1 bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            ) : livingType === 'L_OUT' ? (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="livingOutType"
                      checked={livingOutType === 'QUARTER'}
                      onChange={() => setLivingOutType('QUARTER')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Service Quarter (Inside Base)</span>
                  </label>

                  <label className="flex items-center space-x-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="livingOutType"
                      checked={livingOutType === 'OUTSIDE_BASE'}
                      onChange={() => setLivingOutType('OUTSIDE_BASE')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Outside Base</span>
                  </label>
                </div>

                {livingOutType === 'QUARTER' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Quarter No: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={svcQtrNo}
                      onChange={(e) => {
                        setSvcQtrNo(e.target.value);
                        if (validationError) setValidationError('');
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Outside Residence Address / Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={outsideAddress}
                      onChange={(e) => {
                        setOutsideAddress(e.target.value);
                        if (validationError) setValidationError('');
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Unit Joining & Posting Out Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {variant === 'biodata' ? 'Dt of Posting' : 'Date Joined Unit'} <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={dateJoined}
                  onChange={(e) => setDateJoined(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 pr-10"
                />
                {dateJoined && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setDateJoined(''); }}
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Clear Date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {variant === 'biodata' ? 'Dt of Leaving' : 'Date Left Unit'} <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={dateLeft}
                  onChange={(e) => {
                    setDateLeft(e.target.value);
                    if (e.target.value && !leaveReason) {
                      setLeaveReason('Posted Out'); // Default selection
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 pr-10"
                />
                {dateLeft && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setDateLeft(''); }}
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Clear Date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {dateLeft && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={leaveReason === 'Custom' || (leaveReason && !['Posted Out', 'Retired', 'Dismissed'].includes(leaveReason)) ? 'Custom' : leaveReason}
                    onChange={(e) => {
                      setLeaveReason(e.target.value);
                      if (e.target.value !== 'Custom') {
                        setCustomLeaveReason('');
                      }
                      if (validationError) setValidationError('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" disabled>Select Reason</option>
                    <option value="Posted Out">Posted Out</option>
                    <option value="Retired">Retired</option>
                    <option value="Dismissed">Dismissed</option>
                    <option value="Custom">Custom...</option>
                  </select>
                  
                  {(leaveReason === 'Custom' || (leaveReason && !['Posted Out', 'Retired', 'Dismissed'].includes(leaveReason) && leaveReason !== 'Custom')) && (
                    <input
                      type="text"
                      placeholder=""
                      value={customLeaveReason}
                      onChange={(e) => {
                        setCustomLeaveReason(e.target.value);
                        if (validationError) setValidationError('');
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{airmanToEdit ? 'Update Airman' : `Add to ${variant === 'biodata' ? 'Biodata Register' : 'Nominal Roll'}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
