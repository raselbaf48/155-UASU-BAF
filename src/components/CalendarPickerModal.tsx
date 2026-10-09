import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock } from 'lucide-react';

interface CalendarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (newDateStr: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
}) => {
  // Parse initial date or default to today
  const getInitialState = () => {
    if (value && typeof value === 'string') {
      const parts = value.trim().split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, selectedDay: d, selectedFull: value.trim() };
        }
      }
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const formatted = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { year: y, month: m, selectedDay: d, selectedFull: formatted };
  };

  const initial = getInitialState();
  const [currentYear, setCurrentYear] = useState<number>(initial.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initial.month);

  // Sync state whenever modal opens or value changes
  useEffect(() => {
    if (isOpen) {
      const state = getInitialState();
      setCurrentYear(state.year);
      setCurrentMonth(state.month);
    }
  }, [isOpen, value]);

  if (!isOpen) return null;

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const y = currentYear;
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const fullDate = `${y}-${m}-${d}`;
    onChange(fullDate);
    onClose();
  };

  const handleSetToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const fullDate = `${y}-${m}-${d}`;
    onChange(fullDate);
    onClose();
  };

  // Calculate days for the calendar grid
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Selected date components for comparison
  let selectedY: number | null = null;
  let selectedM: number | null = null;
  let selectedD: number | null = null;
  if (value && typeof value === 'string') {
    const parts = value.trim().split('-');
    if (parts.length === 3) {
      selectedY = parseInt(parts[0], 10);
      selectedM = parseInt(parts[1], 10) - 1;
      selectedD = parseInt(parts[2], 10);
    }
  }

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  // Year options for the dropdown (e.g., 2020 to 2035)
  const years = Array.from({ length: 16 }, (_, i) => 2020 + i);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden transform transition-all animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Select Date
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold">
                তারিখ, মাস ও বছর পরিবর্তন করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month & Year Selectors with Prev/Next buttons */}
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 flex items-center justify-center bg-gradient-to-b from-white via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 hover:from-slate-50 hover:to-slate-200 dark:hover:from-slate-650 dark:hover:to-slate-800 text-slate-700 dark:text-indigo-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all cursor-pointer border-t border-white dark:border-t-slate-600/80 border-x border-slate-250 dark:border-slate-700/80 border-b-[2.5px] border-b-slate-400 dark:border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.5)]"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
            </button>

            <div className="flex items-center space-x-1.5">
              {/* Month Dropdown */}
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
                className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
                className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 flex items-center justify-center bg-gradient-to-b from-white via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 hover:from-slate-50 hover:to-slate-200 dark:hover:from-slate-650 dark:hover:to-slate-800 text-slate-700 dark:text-indigo-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all cursor-pointer border-t border-white dark:border-t-slate-600/80 border-x border-slate-250 dark:border-slate-700/80 border-b-[2.5px] border-b-slate-400 dark:border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.5)]"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((wd, i) => (
              <div 
                key={wd} 
                className={`text-[11px] font-black py-1 ${i === 5 || i === 6 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank cells before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-8 w-8" />
            ))}

            {/* Days 1..N */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isSelected = selectedY === currentYear && selectedM === currentMonth && selectedD === day;
              const isToday = todayY === currentYear && todayM === currentMonth && todayD === day;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 mx-auto rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md scale-105'
                      : isToday
                      ? 'border border-indigo-500 text-indigo-600 dark:text-indigo-400 font-black hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSetToday}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
