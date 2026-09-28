import React from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';

export interface SaveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isSaving?: boolean;
  isSaved?: boolean;
  idleText?: React.ReactNode;
  savingText?: React.ReactNode;
  savedText?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'primary' | 'emerald' | 'indigo' | 'amber';
}

export const SaveButton: React.FC<SaveButtonProps> = ({
  isSaving = false,
  isSaved = false,
  idleText = 'Save Changes',
  savingText = 'Saving...',
  savedText = 'SAVED SUCCESSFULLY! ✓',
  icon = <Save className="w-4 h-4" />,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}) => {
  let baseColor = 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25';
  if (variant === 'emerald') {
    baseColor = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25';
  } else if (variant === 'amber') {
    baseColor = 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25';
  }

  if (isSaved) {
    return (
      <button
        type="button"
        disabled
        className={`relative overflow-hidden flex items-center justify-center space-x-2 py-3 px-5 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-300 ease-out transform scale-[1.02] bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-400/60 cursor-default ${className}`}
        {...props}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
        <CheckCircle2 className="w-4 h-4 text-emerald-100 animate-in zoom-in-75 spin-in-180 duration-400 shrink-0" />
        <span className="animate-in fade-in slide-in-from-bottom-1 duration-200 tracking-widest font-black">
          {savedText}
        </span>
      </button>
    );
  }

  if (isSaving) {
    return (
      <button
        type="button"
        disabled
        className={`relative flex items-center justify-center space-x-2 py-3 px-5 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-200 opacity-90 cursor-wait ${baseColor} ${className}`}
        {...props}
      >
        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
        <span className="tracking-widest font-bold">{savingText}</span>
      </button>
    );
  }

  return (
    <button
      disabled={disabled}
      className={`relative flex items-center justify-center space-x-2 py-3 px-5 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${baseColor} ${className}`}
      {...props}
    >
      <span className="shrink-0">{icon}</span>
      <span className="tracking-wider">{idleText}</span>
    </button>
  );
};
