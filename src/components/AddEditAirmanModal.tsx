import React, { useState } from 'react';
import { Airman, FlightName, Rank } from '../types';
import { X, Check, Building2, Home, MapPin, User, Phone, Shield, AlertCircle } from 'lucide-react';

interface AddEditAirmanModalProps {
  airmanToEdit?: Airman | null;
  existingAirmen?: Airman[];
  onSave: (airmanData: Partial<Airman>) => void;
  onClose: () => void;
}

export const AddEditAirmanModal: React.FC<AddEditAirmanModalProps> = ({
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
      remarks: remarks.trim(),
      dateJoined: dateJoined || undefined,
      dateLeft: dateLeft || undefined,
      leaveReason: finalLeaveReason,
      active: !dateLeft, // Set active to false if dateLeft is provided
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
                {airmanToEdit ? 'Edit Airman Details' : 'Add New Airman to Nominal Roll'}
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
                {['Afr Fitt', 'Eng Fitt', 'E&I Fitt', 'Radio Fitt', 'Armt Fitt', 'GS', 'Log Asst', 'Sec Asst (GD)', 'Sec Asst (Accts)', 'Admin Asst', 'ATCA'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

          {/* Address Configuration (L/In vs L/Out) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>Living Status & Address</span>
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
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : !livingType ? 'bg-amber-50/40 text-amber-700 dark:text-amber-300 border border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
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
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : !livingType ? 'bg-amber-50/40 text-amber-700 dark:text-amber-300 border border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
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
                Date Joined Unit <span className="text-slate-400 font-normal">(Optional)</span>
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
                Date Left Unit <span className="text-slate-400 font-normal">(Optional)</span>
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
              <span>{airmanToEdit ? 'Update Airman' : 'Add to Nominal Roll'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
