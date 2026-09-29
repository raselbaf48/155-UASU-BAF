import React from 'react';
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
  if (!isOpen) return null;

  return (
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
                ডিউটি বণ্টনের পদ্ধতি নির্বাচন করুন (Select Allocation Method)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Options */}
        <div className="p-6 space-y-4">
          {/* Option 1: Single */}
          <button
            type="button"
            onClick={() => onSelectMode('SINGLE')}
            className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all group cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span>1. Single</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      Gap System
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  গ্যাপ দিয়ে দিয়ে আলাদা আলাদা দিনে ডিউটি বণ্টন করবে
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                  <div>• প্রতিটি ডিউটির মাঝে পর্যাপ্ত বিরতি (Gap) থাকবে।</div>
                  <div>• অপ্রয়োজনীয় টানা ডিউটি পরিহার করে সারা মাসে সুষমভাবে বণ্টন হবে।</div>
                </div>
              </div>
            </div>
          </button>

          {/* Option 2: Package */}
          <button
            type="button"
            onClick={() => onSelectMode('PACKAGE')}
            className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-all group cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span>2. Package</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                      Min 2 - Max 3 Consecutive
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  টানা ২টা করে (সর্বোচ্চ ৩টা) প্যাকেজ বা ব্লকে ডিউটি বণ্টন করবে
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                  <div>• প্রতি প্যাকেজে ন্যূনতম ২ দিন থেকে সর্বোচ্চ ৩ দিন টানা ডিউটি থাকবে।</div>
                  <div>• বিচ্ছিন্ন ১ দিনের ডিউটি যথাসম্ভব পরিহার করা হবে।</div>
                  <div>• ৩ দিনের বেশি অতিরিক্ত একটানা ডিউটি হবে না।</div>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Target ও Manpower Quota অবিকল সংরক্ষিত থাকবে</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
