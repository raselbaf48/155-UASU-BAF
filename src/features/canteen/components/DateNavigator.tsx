import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { CalendarPickerModal } from '../../../components/CalendarPickerModal';

interface DateNavigatorProps {
  value: string; // YYYY-MM-DD or empty for ALL
  onChange: (val: string) => void;
  allowAll?: boolean;
  label?: string;
  format?: 'dd_mm_yy' | 'dd_mm' | 'day_only';
  className?: string;
  compact?: boolean;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export const formatDisplayDate = (val: string, format: string = 'dd_mm_yy'): string => {
  if (!val) return '';
  const parts = val.split('-');
  if (parts.length === 3) {
    const y = parts[0].slice(-2);
    const mIdx = parseInt(parts[1], 10) - 1;
    const rawDay = parts[2];
    const dayNumber = String(parseInt(rawDay, 10));
    const day = rawDay.padStart(2, '0');
    const mon = MONTH_NAMES[mIdx] || parts[1];
    if (format === 'day_only') return dayNumber;
    return format === 'dd_mm' ? `${day} ${mon}` : `${day} ${mon} ${y}`;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const dayNumber = String(d.getDate());
    const day = String(d.getDate()).padStart(2, '0');
    const mon = MONTH_NAMES[d.getMonth()];
    const y = String(d.getFullYear()).slice(-2);
    if (format === 'day_only') return dayNumber;
    return format === 'dd_mm' ? `${day} ${mon}` : `${day} ${mon} ${y}`;
  }
  return val;
};

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  value,
  onChange,
  allowAll = false,
  label,
  format = 'dd_mm_yy',
  className = '',
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const todayYMD = getTodayYMD();
  const isAll = allowAll && !value;

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

  const handleToggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAll) {
      onChange(todayYMD);
    } else {
      onChange('');
    }
  };

  const activeDateYMD = value || todayYMD;
  const displayFormatted = formatDisplayDate(activeDateYMD, format);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && (
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 select-none mr-0.5">
          {label}:
        </span>
      )}

      {/* All Dates toggle placed BEFORE Date Navigation Pill */}
      {allowAll && (
        <button
          type="button"
          onClick={handleToggleAll}
          className={`h-8 min-h-[32px] px-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border shrink-0 flex items-center justify-center ${
            isAll
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs ring-1 ring-indigo-400/50'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title={isAll ? 'Filter by date' : 'Show all dates'}
        >
          All
        </button>
      )}

      {/* Date Navigation Pill - Snug, compact with Left Arrow, Date + Calendar Icon, Right Arrow */}
      <div className={`inline-flex items-center bg-slate-950 border rounded-xl p-0.5 shadow-xs shrink-0 transition-colors h-8 min-h-[32px] ${
        !isAll ? 'border-indigo-500/60 bg-indigo-950/20' : 'border-slate-800 hover:border-slate-700'
      }`}>
        {/* Left Arrow (Previous Day) - 3D Tactile Button */}
        <button
          type="button"
          onClick={handlePrev}
          title="Previous day"
          className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
        >
          <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
        </button>

        {/* Center Date Display - Clicking opens rich CalendarPickerModal */}
        <div
          data-date-box="true"
          title="Click to select specific date from calendar"
          onClick={() => setIsCalendarOpen(true)}
          className="relative flex items-center justify-center space-x-1.5 px-2.5 h-7 min-h-[28px] rounded-lg hover:bg-slate-900 cursor-pointer transition-colors group select-none min-w-[36px]"
        >
          <span className={`text-xs font-mono font-bold tracking-tight whitespace-nowrap pointer-events-none ${
            !isAll ? 'text-white' : 'text-slate-300'
          }`}>
            {displayFormatted || '—'}
          </span>
          <Calendar className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform shrink-0 pointer-events-none" />
        </div>

        {/* Right Arrow (Next Day) - 3D Tactile Button */}
        <button
          type="button"
          onClick={handleNext}
          title="Next day"
          className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
        >
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
        </button>
      </div>

      {/* Interactive Calendar Picker Modal */}
      {isCalendarOpen && (
        <CalendarPickerModal
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          value={activeDateYMD}
          onChange={(newDateStr) => {
            onChange(newDateStr);
            setIsCalendarOpen(false);
          }}
        />
      )}
    </div>
  );
};
