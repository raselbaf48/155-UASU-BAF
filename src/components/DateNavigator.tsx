import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DateNavigatorProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  hideArrows?: boolean;
}

export function DateNavigator({ hideArrows, className, value, disabled, onChange, ...props }: DateNavigatorProps) {
  const addDays = (days: number) => {
    if (!value || typeof value !== 'string') return;
    const d = new Date(value);
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + days);
    
    if (onChange) {
      // Simulate event
      onChange({ target: { value: d.toISOString().split('T')[0] } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Format the date for display (e.g., "12 Aug")
    const displayDate = value && typeof value === 'string'
    ? (() => {
        const d = new Date(value);
        if(isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' }).replace(/Sept/gi, 'Sep');
        const year = String(d.getFullYear()).slice(-2);
        return `${day} ${month}`;
      })()
    : '';

  return (
    <div className="flex items-center space-x-1">
      {!hideArrows && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.preventDefault(); addDays(-1); }}
          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-colors shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      
      <div className="relative flex-1 flex items-center justify-center">
        <div className={className || "px-3 py-1 font-semibold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center shadow-xs"}>
          {displayDate || 'Select Date'}
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
          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-colors shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
