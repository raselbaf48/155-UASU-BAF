import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Trash2,
  Clock,
  ArrowRight,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import {
  DutyRatioVersion,
  getDutyRatioHistory,
  deleteDutyRatioVersion,
  getDutyRatioVersionForDate,
  DutyRatioTable,
} from '../data/officialDutyRatioMatrix';
import { formatShortDate } from '../utils/csvExport';

interface RatioHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  onSelectVersion: (version: DutyRatioVersion) => void;
  currentMatrix: DutyRatioTable[];
}

export const RatioHistoryModal: React.FC<RatioHistoryModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  onSelectVersion,
}) => {
  const [history, setHistory] = useState<DutyRatioVersion[]>(() => getDutyRatioHistory());
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<DutyRatioVersion | null>(null);

  // Sync with updates from localStorage or custom events
  useEffect(() => {
    const handleHistoryUpdate = (e: any) => {
      if (e.detail?.history) {
        setHistory(e.detail.history);
      } else {
        setHistory(getDutyRatioHistory());
      }
    };
    window.addEventListener('baf_duty_ratio_history_updated', handleHistoryUpdate);
    return () => window.removeEventListener('baf_duty_ratio_history_updated', handleHistoryUpdate);
  }, []);

  // Update history whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setHistory(getDutyRatioHistory());
      setConfirmDeleteVersion(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const refreshHistory = () => {
    const updated = getDutyRatioHistory();
    setHistory(updated);
    return updated;
  };

  const activeForTarget = getDutyRatioVersionForDate(targetDate);

  const handleExecuteDelete = () => {
    if (!confirmDeleteVersion) return;
    const targetId = confirmDeleteVersion.id;
    setConfirmDeleteVersion(null);

    const ok = deleteDutyRatioVersion(targetId);
    if (ok) {
      const updated = refreshHistory();
      const nextActive = getDutyRatioVersionForDate(targetDate) || updated[0];
      if (nextActive) {
        onSelectVersion(nextActive);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  History
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800">
                  {history.length} {history.length === 1 ? 'Ratio' : 'Ratios'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saved duty ratio versions and effective apply dates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No ratio versions found.
            </div>
          ) : (
            history.map((v, idx) => {
              const isTargetActive = activeForTarget?.id === v.id;
              const totalRequired = (v.matrix || []).reduce((acc, t) => acc + (t.totalRequiredMonth || 0), 0);

              return (
                <div
                  key={v.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isTargetActive
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-400/80 shadow-xs ring-1 ring-emerald-400/50'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    
                    {/* Left: Date & Title Info */}
                    <div className="flex items-start space-x-3.5">
                      <div className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center font-bold shrink-0 border ${
                        isTargetActive
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}>
                        <Calendar className="w-3.5 h-3.5 opacity-80" />
                        <span className="text-[10px] leading-tight mt-0.5">#{idx + 1}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">
                            {v.title === 'Base Duty Ratio' || v.title === 'Base Duty Ratio (Default)' ? 'All Duty Ratio' : v.title}
                          </h3>
                          {isTargetActive && (
                            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500 text-white flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              Active ({formatShortDate(targetDate)})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                            <Clock className="w-3.5 h-3.5" />
                            Apply From: <strong className="underline">{formatShortDate(v.applyFromDate)}</strong>
                          </span>
                          <span>•</span>
                          <span>Duties: <strong className="text-slate-700 dark:text-slate-200">{v.matrix?.length || 0} Tables</strong> ({totalRequired} slots/mo)</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      
                      {/* Load / Select Ratio */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectVersion(v);
                          onClose();
                        }}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          isTargetActive
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <span>{isTargetActive ? 'Currently Loaded' : 'Load Ratio'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button (Triggers In-App Popup) */}
                      <button
                        type="button"
                        title="Delete this ratio version"
                        onClick={() => setConfirmDeleteVersion(v)}
                        className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors cursor-pointer border border-rose-300 dark:border-rose-800 flex items-center gap-1 shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            BAF 155 UASU • Official Unit Duty Ratio System
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Close Window
          </button>
        </div>

      </div>

      {/* IN-APP CONFIRMATION POPUP MODAL BEFORE DELETE (Delete er age Popup asbe) */}
      {confirmDeleteVersion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center border border-rose-200 dark:border-rose-900/60 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete Ratio Version?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action will permanently delete this version.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
              <div>
                <span className="text-slate-500 font-medium">Version Name: </span>
                <strong className="text-slate-900 dark:text-white font-bold">{confirmDeleteVersion.title}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Apply From Date: </span>
                <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{formatShortDate(confirmDeleteVersion.applyFromDate)}</strong> ({confirmDeleteVersion.applyFromDate})
              </div>
              {history.length <= 1 && (
                <div className="text-amber-600 dark:text-amber-400 font-semibold text-[11px] pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  ⚠️ Note: Since this is the only saved ratio, deleting it will reset all unit duties back to the default unit scale.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteVersion(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
