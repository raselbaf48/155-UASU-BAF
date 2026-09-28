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
        className={`relative overflow-hidden flex items-center justify-center space-x-2 py-3 px-5 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-300 ease-out animate-success-pop bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white shadow-2xl shadow-emerald-500/50 ring-4 ring-emerald-400/80 cursor-default ${className}`}
        {...props}
      >
        {/* Shimmer light sweep */}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
        {/* Ambient glow */}
        <span className="absolute -inset-1 bg-emerald-400/20 blur-sm rounded-xl animate-pulse pointer-events-none" />
        <CheckCircle2 className="w-4 h-4 text-emerald-100 animate-in zoom-in-75 spin-in-180 duration-500 shrink-0 drop-shadow-md z-10" />
        <span className="animate-in fade-in slide-in-from-bottom-2 duration-300 tracking-widest font-black drop-shadow-sm text-emerald-50 z-10">
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
