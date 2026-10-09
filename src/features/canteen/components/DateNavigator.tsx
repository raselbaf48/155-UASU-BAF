import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';

interface DateNavigatorProps {
  value: string; // YYYY-MM-DD or empty for ALL
  onChange: (val: string) => void;
  allowAll?: boolean;
  label?: string;
  className?: string;
  compact?: boolean;
}

export const parseYMD = (str: string): Date => {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
};

export const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getTodayYMD = (): string => toYMD(new Date());

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  value,
  onChange,
  allowAll = false,
  label,
  className = '',
  compact = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const todayYMD = getTodayYMD();
  const isAll = allowAll && !value;
  const isToday = value === todayYMD;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const base = value ? parseYMD(value) : new Date();
    base.setDate(base.getDate() - 1);
    onChange(toYMD(base));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const base = value ? parseYMD(value) : new Date();
    base.setDate(base.getDate() + 1);
    onChange(toYMD(base));
  };

  const handleResetToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(todayYMD);
  };

  const handleToggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAll) {
      onChange(todayYMD);
    } else {
      onChange('');
    }
  };

  const triggerPicker = () => {
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
        } catch {
          inputRef.current.focus();
        }
      } else {
        inputRef.current.focus();
      }
    }
  };

  const displayFormatted = isAll
    ? 'All Dates'
    : formatCanteenDate(value ? parseYMD(value) : new Date());

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && (
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 select-none mr-1">
          {label}:
        </span>
      )}

      {/* Date Navigation Pill */}
      <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 shadow-sm">
        {/* Left Arrow (Previous Day) */}
        <button
          type="button"
          onClick={handlePrev}
          title="Previous day"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Center Date Display + Native Picker trigger */}
        <div
          title="Click to select specific date from calendar"
          onClick={triggerPicker}
          className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors group select-none"
        >
          <Calendar className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
          <span className="text-xs font-mono font-bold text-white tracking-wide">
            {displayFormatted}
          </span>

          {/* Native input for datepicker */}
          <input
            ref={inputRef}
            type="date"
            value={value || todayYMD}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof (e.currentTarget as any).showPicker === 'function') {
                try {
                  (e.currentTarget as any).showPicker();
                } catch {}
              }
            }}
          />
        </div>

        {/* Right Arrow (Next Day) */}
        <button
          type="button"
          onClick={handleNext}
          title="Next day"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Today jump button if not today and not in all mode */}
      {!isToday && !isAll && (
        <button
          type="button"
          onClick={handleResetToday}
          className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
          title="Jump to today"
        >
          Today
        </button>
      )}

      {/* All Dates toggle if allowAll is true */}
      {allowAll && (
        <button
          type="button"
          onClick={handleToggleAll}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
            isAll
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={isAll ? 'Filter by date' : 'Show all dates'}
        >
          {isAll ? 'Filtered: ALL' : 'ALL'}
        </button>
      )}
    </div>
  );
};
