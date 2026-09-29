import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

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
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-colors shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      
      <div className="relative flex-1 flex items-center justify-center">
        <div className={className || "px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm whitespace-nowrap bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center shadow-xs flex items-center justify-center gap-1.5"}>
          <span>{displayDate || 'Select Date'}</span>
          {showCalendarIcon && (
            <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 pointer-events-none" />
          )}
        </div>
        <input
          type="date"
          value={value}
          disabled={disabled}
          onChange={onChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          {...props}
        />
      </div>

      {!hideArrows && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.preventDefault(); addDays(1); }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-colors shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
