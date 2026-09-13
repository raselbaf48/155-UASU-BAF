import React from 'react';
import { DutyCategoryCode, IDAShift, FlightName } from '../types';
import { DUTY_TYPES } from '../data/dutyTypes';
import { getIdacShiftsForDateAndFlight } from '../data/officialDutyRatioMatrix';
import { X, Check } from 'lucide-react';

interface DutyCellPopoverProps {
  airmanName: string;
  airmanFlight?: FlightName;
  flightName?: FlightName;
  date: string;
  currentCode: DutyCategoryCode;
  currentIdaShift?: IDAShift;
  currentProxyForFlight?: FlightName;
  currentNotes?: string;
  onSelectDuty: (code: DutyCategoryCode, idaShift?: IDAShift, notes?: string, proxyForFlight?: FlightName) => void;
  onDeleteDuty?: () => void;
  onClose: () => void;
}

export const DutyCellPopover: React.FC<DutyCellPopoverProps> = ({
  airmanName,
  airmanFlight,
  flightName,
  date,
  currentCode,
  currentIdaShift = 'None',
  currentProxyForFlight,
  currentNotes = '',
  onSelectDuty,
  onDeleteDuty,
  onClose,
}) => {
  const [selectedCode, setSelectedCode] = React.useState<DutyCategoryCode>(currentCode);
  const [proxyForFlight, setProxyForFlight] = React.useState<FlightName | ''>(currentProxyForFlight || '');
  const availableShifts = React.useMemo(() => {
    return getIdacShiftsForDateAndFlight(date, flightName);
  }, [date, flightName]);

  const [idaShift, setIdaShift] = React.useState<IDAShift>(() => {
    if (currentIdaShift && currentIdaShift !== 'None' && availableShifts.includes(currentIdaShift)) {
      return currentIdaShift;
    }
    return availableShifts[0] || 'Morning';
  });

  React.useEffect(() => {
    if (!availableShifts.includes(idaShift)) {
      setIdaShift(availableShifts[0] || 'Morning');
    }
  }, [availableShifts, idaShift]);

  const handleSave = () => {
    onSelectDuty(
      selectedCode,
      selectedCode === 'IDAC' || selectedCode === 'IDA' ? idaShift : undefined,
      undefined,
      proxyForFlight ? proxyForFlight : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Assign Duty: {airmanName}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Date: {date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Duty Types Grid */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Select Duty Category
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
            {DUTY_TYPES.map((dt) => {
              const isSelected = selectedCode === dt.code;
              return (
                <button
                  key={dt.code}
                  type="button"
                  onClick={() => setSelectedCode(dt.code)}
                  className={`p-2.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold mb-1 ${dt.badgeBg} ${dt.badgeText}`}>
                      {dt.shortName}
                    </span>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {dt.name}
                    </p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Security Duty (GD) Rank Restriction Warning for Sgt / WO */}
        {selectedCode === 'GD' && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-300 space-y-1">
            <div className="font-extrabold flex items-center space-x-1.5 text-red-700 dark:text-red-400">
              <span>⚠️ Security Duty (GD) Rank Protocol:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Under military regulations, <span className="font-bold underline">Sgt, WO, SWO, and MWO</span> personnel are strictly prohibited from Guard / Security Duty (GD). GD is reserved exclusively for <span className="font-bold">Cpl and LAC</span> ranks.
            </p>
          </div>
        )}

        {/* IDAC Duty Shift options if selected */}
        {(selectedCode === 'IDAC' || selectedCode === 'IDA') && (
          <div className="space-y-1.5 bg-teal-50/50 dark:bg-teal-950/30 p-3 rounded-xl border border-teal-200 dark:border-teal-800">
            <label className="text-xs font-bold text-teal-800 dark:text-teal-300">
              IDAC Duty Shift
            </label>
            <div className="flex space-x-2">
              {availableShifts.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setIdaShift(s)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border text-center transition-all ${
                    idaShift === s
                      ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Proxy Duty Option (If covering for another flight) */}
        <div className="space-y-1.5 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1.5">
              <span>Proxy Duty</span>
              {proxyForFlight && (
                <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-extrabold px-1.5 py-0.2 rounded">
                  For {proxyForFlight}
                </span>
              )}
            </label>
            {proxyForFlight ? (
              <button
                type="button"
                onClick={() => setProxyForFlight('')}
                className="text-[10px] text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
              >
                Clear Proxy
              </button>
            ) : (
              <span className="text-[10px] text-amber-700 dark:text-amber-400">
                Cover other flight
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[])
              .filter((fl) => fl !== (airmanFlight || flightName))
              .map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setProxyForFlight(proxyForFlight === fl ? '' : fl)}
                  className={`py-1 px-1.5 text-[11px] font-bold rounded-lg border text-center transition-all cursor-pointer ${
                    proxyForFlight === fl
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                  }`}
                >
                  {fl}
                </button>
              ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          {onDeleteDuty ? (
            <button
              type="button"
              onClick={() => {
                onDeleteDuty();
                onClose();
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 rounded-xl border border-red-200 dark:border-red-800 transition-all flex items-center gap-1"
            >
              🗑️ Delete / Clear Entry
            </button>
          ) : <div />}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all"
            >
              Save Duty
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
