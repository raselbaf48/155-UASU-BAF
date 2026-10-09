import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { CalendarPickerModal } from './CalendarPickerModal';

interface DateNavigatorProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  hideArrows?: boolean;
  format?: 'dd_mm_yy' | 'dd_mm';
  showCalendarIcon?: boolean;
}

export function DateNavigator({ 
  hideArrows, 
  className, 
  value, 
  disabled, 
  onChange, 
  format = 'dd_mm_yy',
  showCalendarIcon = true,
  ...props 
}: DateNavigatorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const openCalendarPicker = () => {
    if (disabled) return;
    setIsModalOpen(true);
  };

  const addDays = (days: number) => {
    if (!value || typeof value !== 'string') return;
    const parts = value.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const nextVal = `${y}-${m}-${day}`;
      if (onChange) {
        onChange({ target: { value: nextVal } } as React.ChangeEvent<HTMLInputElement>);
      }
      return;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + days);
    
    if (onChange) {
      onChange({ target: { value: d.toISOString().split('T')[0] } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Format the date for display (e.g., "29 Sep 26" or "29 Sep")
  const displayDate = value && typeof value === 'string'
    ? (() => {
        const parts = value.trim().split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          const year = parts[0].slice(-2);
          const monthNum = parseInt(parts[1], 10);
          const day = parts[2].padStart(2, '0');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = months[monthNum - 1] || parts[1];
          return format === 'dd_mm' ? `${day} ${month}` : `${day} ${month} ${year}`;
        }
        const d = new Date(value);
        if(isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' }).replace(/Sept/gi, 'Sep');
        const year = String(d.getFullYear()).slice(-2);
        return format === 'dd_mm' ? `${day} ${month}` : `${day} ${month} ${year}`;
      })()
    : '';

  return (
    <div className="flex items-center space-x-1">
      {!hideArrows && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.preventDefault(); addDays(-1); }}
          className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 hover:from-white hover:to-slate-250 dark:hover:from-slate-600 dark:hover:to-slate-750 text-slate-700 dark:text-indigo-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all cursor-pointer disabled:opacity-50 shrink-0 border-t border-white/60 dark:border-t-slate-600/80 border-x border-slate-300 dark:border-slate-700/80 border-b-[2.5px] border-b-slate-400 dark:border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.5)]"
        >
          <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
        </button>
      )}
      
      <div 
        onClick={openCalendarPicker}
        className="relative flex-1 flex items-center justify-center cursor-pointer group"
      >
        <div className={`flex flex-row items-center justify-center gap-1.5 whitespace-nowrap flex-nowrap ${className || "px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center shadow-xs"}`}>
          <span className="whitespace-nowrap">{displayDate || 'Select Date'}</span>
          {showCalendarIcon && (
            <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 pointer-events-none group-hover:scale-110 transition-transform" />
          )}
        </div>
        <input
          ref={inputRef}
          type="date"
          value={value}
          disabled={disabled}
          onChange={onChange}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openCalendarPicker();
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          {...props}
        />
      </div>

      {!hideArrows && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.preventDefault(); addDays(1); }}
          className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 hover:from-white hover:to-slate-250 dark:hover:from-slate-600 dark:hover:to-slate-750 text-slate-700 dark:text-indigo-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all cursor-pointer disabled:opacity-50 shrink-0 border-t border-white/60 dark:border-t-slate-600/80 border-x border-slate-300 dark:border-slate-700/80 border-b-[2.5px] border-b-slate-400 dark:border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.5)]"
        >
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
        </button>
      )}

      {isModalOpen && (
        <CalendarPickerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          value={String(value || '')}
          onChange={(newDateStr) => {
            if (onChange) {
              onChange({ target: { value: newDateStr } } as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        />
      )}
    </div>
  );
}
