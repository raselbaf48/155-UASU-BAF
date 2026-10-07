import React, { useState } from 'react';
import {
  Download,
  X,
  Sparkles,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { AppVersionRecord, downloadAppUpdate, skipVersionCode, isRunningInApk } from '../services/appUpdateService';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestVersion: AppVersionRecord | null;
  currentVersionCode: number;
  currentVersionName: string;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  isOpen,
  onClose,
  latestVersion,
  currentVersionCode,
  currentVersionName,
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Strictly do not show update modal on Website, only inside installed APK
  if (!isOpen || !latestVersion || !isRunningInApk()) return null;

  const handleDownload = async () => {
    setIsOpening(true);
    const success = await downloadAppUpdate(latestVersion.apk_url);
    setIsOpening(false);
    if (success) {
      setDownloadSuccess(true);
    }
  };

  const handleSkip = () => {
    skipVersionCode(latestVersion.version_code);
    onClose();
  };

  const formattedDate = latestVersion.created_at
    ? new Date(latestVersion.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Glowing Top Banner */}
        <div className="relative bg-linear-to-r from-emerald-950 via-teal-900 to-slate-950 p-6 border-b border-emerald-500/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50">
                <Download className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Capacitor In-App Update
                </span>
                <h3 className="text-xl font-black text-white tracking-tight mt-1">
                  New Update Available!
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Version Comparison Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">CURRENT VERSION</span>
              <span className="font-mono font-bold text-slate-300">
                v{currentVersionName} <span className="text-slate-500">({currentVersionCode})</span>
              </span>
            </div>

            <div className="text-emerald-400 font-black text-lg">➔</div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">LATEST VERSION</span>
              <span className="font-mono font-black text-emerald-300 text-sm">
                v{latestVersion.version_name} <span className="text-emerald-500/80">({latestVersion.version_code})</span>
              </span>
            </div>
          </div>

          {/* Release Notes */}
          {latestVersion.release_notes ? (
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Release Notes & Changes:</span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line pl-1 border-l-2 border-emerald-500/40 font-sans">
                {latestVersion.release_notes}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>This update includes security improvements and bug fixes.</span>
            </div>
          )}

          {/* Metadata badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono px-1">
            {formattedDate && (
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Release Date: {formattedDate}</span>
              </span>
            )}
            <span className="flex items-center space-x-1 text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase Verified</span>
            </span>
          </div>

          {downloadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>APK download started! Please check your browser or notification bar.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800/80 bg-slate-950 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleSkip}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Skip This Version
          </button>

          <div className="flex items-center space-x-2 w-full sm:w-auto sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Later
            </button>

            <button
              type="button"
              disabled={isOpening}
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/40 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isOpening ? 'Opening...' : 'Download APK Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
