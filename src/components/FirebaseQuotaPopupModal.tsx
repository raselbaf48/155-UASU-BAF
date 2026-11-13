import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudOff, Database, ExternalLink, X, CheckCircle2, Layers } from 'lucide-react';
import { getQuotaConsoleUpgradeUrl, isFirestoreQuotaExceeded } from '../firebase';
import { getPendingDeltaCount } from '../services/firebaseFirestoreService';

interface QuotaPopupState {
  isOpen: boolean;
  source?: string;
  message?: string;
  upgradeUrl?: string;
}

interface FirebaseQuotaPopupModalProps {
  /** Check immediately on mount if Firebase quota is already exceeded at login time */
  checkOnMount?: boolean;
}

export const FirebaseQuotaPopupModal: React.FC<FirebaseQuotaPopupModalProps> = ({
  checkOnMount = false,
}) => {
  const [popup, setPopup] = useState<QuotaPopupState>({ isOpen: false });
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingDeltaCount());

  useEffect(() => {
    if (checkOnMount && isFirestoreQuotaExceeded()) {
      setPendingCount(getPendingDeltaCount());
      setPopup({
        isOpen: true,
        source: 'login',
        message: 'Firebase এর ফ্রি দৈনিক Quota শেষ হয়ে গেছে। অ্যাপ এখন Local Cloud Storage ব্যবহার করছে।',
        upgradeUrl: getQuotaConsoleUpgradeUrl(),
      });
    }
  }, [checkOnMount]);

  useEffect(() => {
    const handleLoginQuotaPopup = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setPendingCount(getPendingDeltaCount());
      setPopup({
        isOpen: true,
        source: detail.source || 'login',
        message:
          detail.message ||
          'Firebase এর ফ্রি দৈনিক Quota শেষ হয়ে গেছে। এখন Local Cloud Storage ব্যবহার করা হচ্ছে।',
        upgradeUrl: detail.upgradeUrl || getQuotaConsoleUpgradeUrl(),
      });
    };

    const handleRuntimeQuotaExceeded = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setPendingCount(getPendingDeltaCount());
      setPopup((prev) =>
        prev.isOpen
          ? prev
          : {
              isOpen: true,
              source: 'runtime',
              message:
                detail.errorMsg ||
                'Firebase ফ্রি Quota পূর্ণ হয়ে গেছে। আপনার পরিবর্তন Local Cloud Storage-এ সংরক্ষিত হচ্ছে।',
              upgradeUrl: detail.upgradeUrl || getQuotaConsoleUpgradeUrl(),
            }
      );
    };

    const handleDeltaChange = () => {
      setPendingCount(getPendingDeltaCount());
    };

    const handleQuotaRecovered = () => {
      setPopup({ isOpen: false });
      setPendingCount(getPendingDeltaCount());
    };

    window.addEventListener('baf_login_quota_exceeded_popup', handleLoginQuotaPopup);
    window.addEventListener('baf_firebase_quota_exceeded', handleRuntimeQuotaExceeded);
    window.addEventListener('baf_pending_delta_updated', handleDeltaChange);
    window.addEventListener('baf_firebase_quota_recovered', handleQuotaRecovered);

    return () => {
      window.removeEventListener('baf_login_quota_exceeded_popup', handleLoginQuotaPopup);
      window.removeEventListener('baf_firebase_quota_exceeded', handleRuntimeQuotaExceeded);
      window.removeEventListener('baf_pending_delta_updated', handleDeltaChange);
      window.removeEventListener('baf_firebase_quota_recovered', handleQuotaRecovered);
    };
  }, []);

  if (!popup.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/40 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="firebase-quota-modal-title"
      >
        {/* Top Accent Header */}
        <div className="bg-amber-500/10 dark:bg-amber-950/50 border-b border-amber-500/25 px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <CloudOff className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3" />
                Firebase Quota Exceeded
              </span>
              <h2
                id="firebase-quota-modal-title"
                className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight mt-0.5"
              >
                Firebase Quota শেষ হয়ে গেছে
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPopup((p) => ({ ...p, isOpen: false }))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 flex items-start gap-3">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm mb-0.5">
                এখন Local Cloud Storage চালু আছে
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Firebase থেকে সর্বশেষ ডাটা ডাউনলোড করা যায়নি কারণ ফ্রি দৈনিক কোটা পূর্ণ হয়েছে। অ্যাপ এখন{' '}
                <strong className="text-slate-900 dark:text-white">Local Cloud Storage</strong>{' '}
                ব্যবহার করছে যাতে আপনার সব কাজ নির্বিঘ্নে চালু থাকে।
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                আপনার ও অন্যান্য ইউজারদের প্রতিটি পরিবর্তন টাইমস্ট্যাম্পসহ স্থানীয়ভাবে নিরাপদ থাকবে।
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Layers className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Firebase Quota রিসেট হলে সবার পরিবর্তিত অংশ (যেমন আলাদা ফ্লাইটের ডিউটি) স্বয়ংক্রিয়ভাবে মার্জ হয়ে আপলোড হবে।
              </span>
            </div>
            {pendingCount > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-300">
                <span>সিঙ্ক করার জন্য অপেক্ষমাণ পরিবর্তন:</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 font-mono">
                  {pendingCount} items
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setPopup((p) => ({ ...p, isOpen: false }))}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-colors shadow-sm cursor-pointer"
            >
              ঠিক আছে, Local Cloud ব্যবহার করুন
            </button>
            {popup.upgradeUrl && (
              <a
                href={popup.upgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
              >
                <span>Firebase Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
