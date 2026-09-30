import React, { useState } from 'react';
import { X, Sparkles, Calendar, Package, ArrowRight } from 'lucide-react';
import { AllocationMode } from '../utils/dutyDistribution';

interface AutoAllocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: AllocationMode) => void;
}

export const AutoAllocateModal: React.FC<AutoAllocateModalProps> = ({
  isOpen,
  onClose,
  onSelectMode,
}) => {
  const [confirmingMode, setConfirmingMode] = useState<AllocationMode | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setConfirmingMode(null);
    onClose();
  };

  const handleConfirm = () => {
    if (confirmingMode) {
      onSelectMode(confirmingMode);
      setConfirmingMode(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
        <div 
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all animate-scaleUp"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-800 dark:to-indigo-950/30">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Auto Allocate Daily Duties
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select Allocation Method
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body / Options */}
          <div className="p-6 space-y-3">
            {/* Option 1: Single */}
            <button
              type="button"
              onClick={() => setConfirmingMode('SINGLE')}
              className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all group cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-base">1. Single</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      Gap System
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </button>

            {/* Option 2: Package */}
            <button
              type="button"
              onClick={() => setConfirmingMode('PACKAGE')}
              className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-all group cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-base">2. Package</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                      Min 2 - Max 3 Consecutive
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Popup Modal */}
      {confirmingMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50 to-indigo-50/40 dark:from-slate-800 dark:to-indigo-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Confirm Auto Allocation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    বরাদ্দ নিশ্চিতকরণ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className={`p-2.5 rounded-xl ${confirmingMode === 'SINGLE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300'}`}>
                  {confirmingMode === 'SINGLE' ? <Calendar className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {confirmingMode === 'SINGLE' ? '1. Single (Gap System)' : '2. Package (Consecutive Block)'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {confirmingMode === 'SINGLE' ? 'গ্যাপ দিয়ে দিয়ে আলাদা দিনে বণ্টন' : 'টানা ২-৩ দিনের ব্লকে বণ্টন'}
                  </div>
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Are you sure you want to run auto allocation with this method?
              </p>
              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60">
                এটি নিশ্চিত করলে নির্বাচিত মাস জুড়ে সকল ফ্লাইটের দৈনিক ডিউটি রেশিও অনুযায়ী স্বয়ংক্রিয়ভাবে পুনর্নির্ধারণ করা হবে।
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingMode(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Confirm & Allocate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
