import React, { useState, useEffect } from 'react';
import { DutyPerson, AirfieldStaffType, DutyStatusType } from '../types';
import { localDb } from '../../../services/localDatabase';
import { X, User, Phone, Crosshair, Radio, Shield, Check, Clock, UserCheck, Coffee } from 'lucide-react';

interface AddEditPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: DutyPerson) => void;
  initialPerson?: DutyPerson | null;
  postName: string;
  defaultDutyTime?: string;
  defaultDutyStatus?: DutyStatusType;
}

const COMMON_RANKS = ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2', 'WO', 'SWO', 'MWO'];

export const AddEditPersonModal: React.FC<AddEditPersonModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPerson,
  postName,
  defaultDutyTime = '0600F - 1400F',
  defaultDutyStatus = 'Active',
}) => {
  const [rank, setRank] = useState('LAC');
  const [name, setName] = useState('');
  const [bdNo, setBdNo] = useState('');
  const [type, setType] = useState<AirfieldStaffType>('Permanent');
  const [dutyStatus, setDutyStatus] = useState<DutyStatusType>(defaultDutyStatus);
  const [dutyTime, setDutyTime] = useState(defaultDutyTime);
  const [armsCount, setArmsCount] = useState<number>(0);
  const [rtCount, setRtCount] = useState<number>(0);
  const [mobileNo, setMobileNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Airmen suggestion list from localDb
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (initialPerson) {
      setRank(initialPerson.rank || 'LAC');
      setName(initialPerson.name || '');
      setBdNo(initialPerson.bdNo || '');
      setType(initialPerson.type || 'Permanent');
      setDutyStatus(initialPerson.dutyStatus || defaultDutyStatus);
      setDutyTime(initialPerson.dutyTime || defaultDutyTime);
      setArmsCount(initialPerson.armsCount || 0);
      setRtCount(initialPerson.rtCount || 0);
      setMobileNo(initialPerson.mobileNo || '');
      setRemarks(initialPerson.remarks || '');
    } else {
      setRank('LAC');
      setName('');
      setBdNo('');
      setType('Permanent');
      setDutyStatus(defaultDutyStatus);
      setDutyTime(defaultDutyTime);
      setArmsCount(0);
      setRtCount(0);
      setMobileNo('');
      setRemarks('');
    }
  }, [initialPerson, isOpen, defaultDutyStatus, defaultDutyTime]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.trim().length >= 2) {
      try {
        const airmen = localDb.getAirmen();
        const q = val.toLowerCase().trim();
        const matches = airmen.filter(
          (a) =>
            a.name?.toLowerCase().includes(q) ||
            a.fullName?.toLowerCase().includes(q) ||
            a.bdNo?.toLowerCase().includes(q)
        ).slice(0, 5);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } catch {
        setSuggestions([]);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (airman: any) => {
    setName(airman.name || airman.fullName || '');
    if (airman.rank) setRank(airman.rank);
    if (airman.bdNo) setBdNo(airman.bdNo);
    if (airman.mobileNo) setMobileNo(airman.mobileNo);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const person: DutyPerson = {
      id: initialPerson ? initialPerson.id : `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      rank: rank.trim(),
      name: name.trim(),
      bdNo: bdNo.trim() || undefined,
      type,
      dutyStatus,
      dutyTime: dutyTime.trim() || defaultDutyTime,
      armsCount: Number(armsCount) || 0,
      rtCount: Number(rtCount) || 0,
      mobileNo: mobileNo.trim() || undefined,
      remarks: remarks.trim() || undefined,
    };

    onSave(person);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
              {postName}
            </span>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>{initialPerson ? 'Edit Duty Person' : 'Assign Duty Person'}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* Duty Status Selector: Active Duty vs Standby Duty */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Deployment Status (ডিউটি স্ট্যাটাস)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDutyStatus('Active')}
                className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  dutyStatus === 'Active'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Active (অন-ডিউটি)</span>
              </button>

              <button
                type="button"
                onClick={() => setDutyStatus('Standby')}
                className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  dutyStatus === 'Standby'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Standby (স্ট্যান্ডবাই)</span>
              </button>

              <button
                type="button"
                onClick={() => setDutyStatus('Rest')}
                className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  dutyStatus === 'Rest'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Rest (বিশ্রাম/রিলিফ)</span>
              </button>
            </div>
          </div>

          {/* Name & Autocomplete */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Airman Name *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Type name (auto-suggests from database)..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl z-30 overflow-hidden divide-y divide-slate-800">
                {suggestions.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => selectSuggestion(item)}
                    className="p-2.5 px-4 hover:bg-indigo-950/60 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-indigo-400 font-bold">{item.rank}</span>
                      <span className="font-bold text-white">{item.fullName || item.name}</span>
                    </div>
                    {item.bdNo && (
                      <span className="font-mono text-slate-400 text-[11px]">BD/{item.bdNo}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rank & BD No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Rank
              </label>
              <select
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {COMMON_RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                BD No (Optional)
              </label>
              <input
                type="text"
                value={bdNo}
                onChange={(e) => setBdNo(e.target.value)}
                placeholder="e.g. 50432"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Staff Type & Duty Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Staff Category
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setType('Permanent')}
                  className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    type === 'Permanent'
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  Permanent (P)
                </button>
                <button
                  type="button"
                  onClick={() => setType('Additional')}
                  className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    type === 'Additional'
                      ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  Additional
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Duty Time</span>
              </label>
              <input
                type="text"
                value={dutyTime}
                onChange={(e) => setDutyTime(e.target.value)}
                placeholder="e.g. 0600F - 1400F"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Equipment Counts: Arms & RT Comms */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 text-rose-400">
                <Crosshair className="w-3.5 h-3.5" />
                <span>Arms Count</span>
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={armsCount}
                onChange={(e) => setArmsCount(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 text-sky-400">
                <Radio className="w-3.5 h-3.5" />
                <span>RT Comms Count</span>
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={rtCount}
                onChange={(e) => setRtCount(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Mobile No */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contact / Mobile No</span>
            </label>
            <input
              type="tel"
              value={mobileNo}
              onChange={(e) => setMobileNo(e.target.value)}
              placeholder="e.g. 01700000000"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. In charge, Relief, Key holder..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{initialPerson ? 'Update Person' : 'Assign to Post'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
