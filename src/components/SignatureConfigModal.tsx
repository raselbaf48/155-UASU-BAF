import React, { useState, useEffect } from 'react';
import { PenTool, Check, X, Shield, FileCheck, RotateCcw } from 'lucide-react';

export interface SignatureDetails {
  name: string;
  rank: string;
  designation: string;
  unit: string;
  signDigitally?: boolean;
  digitalSignatureText?: string;
}

export const DEFAULT_PREPARED_BY: SignatureDetails = {
  name: 'MD NAHID HASAN KHAN',
  rank: 'Sgt',
  designation: 'UWO',
  unit: '155 UASU BAF',
  signDigitally: false,
  digitalSignatureText: '',
};

export const DEFAULT_AUTHORIZED_BY: SignatureDetails = {
  name: 'MAHIM RAAD SADAT',
  rank: 'FLT LT',
  designation: 'Adjutant',
  unit: '155 UASU BAF',
  signDigitally: false,
  digitalSignatureText: '',
};

// Storage helper functions
export function getSavedPreparedBy(): SignatureDetails {
  try {
    const saved = localStorage.getItem('baf_sign_prepared_by');
    if (saved) return { ...DEFAULT_PREPARED_BY, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_PREPARED_BY;
}

export function getSavedAuthorizedBy(): SignatureDetails {
  try {
    const saved = localStorage.getItem('baf_sign_authorized_by');
    if (saved) return { ...DEFAULT_AUTHORIZED_BY, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_AUTHORIZED_BY;
}

export function savePreparedBy(details: SignatureDetails): void {
  try {
    localStorage.setItem('baf_sign_prepared_by', JSON.stringify(details));
    window.dispatchEvent(new CustomEvent('baf_signatures_updated'));
  } catch (e) {}
}

export function saveAuthorizedBy(details: SignatureDetails): void {
  try {
    localStorage.setItem('baf_sign_authorized_by', JSON.stringify(details));
    window.dispatchEvent(new CustomEvent('baf_signatures_updated'));
  } catch (e) {}
}

interface SignatureConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'PREPARED_BY' | 'AUTHORIZED_BY';
  onSignaturesUpdated?: (prepared: SignatureDetails, authorized: SignatureDetails) => void;
}

export const SignatureConfigModal: React.FC<SignatureConfigModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'PREPARED_BY',
  onSignaturesUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'PREPARED_BY' | 'AUTHORIZED_BY'>(initialTab);

  const [prepared, setPrepared] = useState<SignatureDetails>(getSavedPreparedBy);
  const [authorized, setAuthorized] = useState<SignatureDetails>(getSavedAuthorizedBy);
  const [savedSuccess, setSavedSuccess] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setPrepared(getSavedPreparedBy());
      setAuthorized(getSavedAuthorizedBy());
      setSavedSuccess('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Ensure Block Capital for Name
    const cleanPrepared = {
      ...prepared,
      name: prepared.name.toUpperCase().trim(),
      unit: prepared.unit.trim() || '155 UASU BAF',
    };
    const cleanAuthorized = {
      ...authorized,
      name: authorized.name.toUpperCase().trim(),
      unit: authorized.unit.trim() || '155 UASU BAF',
    };

    savePreparedBy(cleanPrepared);
    saveAuthorizedBy(cleanAuthorized);
    setPrepared(cleanPrepared);
    setAuthorized(cleanAuthorized);

    if (onSignaturesUpdated) {
      onSignaturesUpdated(cleanPrepared, cleanAuthorized);
    }

    setSavedSuccess('Signatures saved successfully! (Auto-saved as last used)');
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const handleResetDefaults = () => {
    if (activeTab === 'PREPARED_BY') {
      setPrepared(DEFAULT_PREPARED_BY);
      savePreparedBy(DEFAULT_PREPARED_BY);
    } else {
      setAuthorized(DEFAULT_AUTHORIZED_BY);
      saveAuthorizedBy(DEFAULT_AUTHORIZED_BY);
    }
    setSavedSuccess('Reset to official default.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 relative overflow-hidden h-full sm:h-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Signature Authority & Sign-Off
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure Prepared By & Authorized By for Parade & PT State documents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Option Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setActiveTab('PREPARED_BY')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'PREPARED_BY'
                ? 'bg-white dark:bg-emerald-600 text-emerald-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Prepared By (Left)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUTHORIZED_BY')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'AUTHORIZED_BY'
                ? 'bg-white dark:bg-emerald-600 text-emerald-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Authorized By (Right)</span>
          </button>
        </div>

        {/* Tab 1: Prepared By Form */}
        {activeTab === 'PREPARED_BY' ? (
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                NAME <span className="text-[10px] text-emerald-600 font-semibold">(Block Capital)</span>
              </label>
              <input
                type="text"
                value={prepared.name}
                onChange={(e) => setPrepared({ ...prepared, name: e.target.value.toUpperCase() })}
                placeholder="e.g. MD NAHID HASAN KHAN"
                className="w-full px-3.5 py-2 text-xs uppercase font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rank <span className="text-[10px] text-slate-400">(Block / Running)</span>
                </label>
                <input
                  type="text"
                  value={prepared.rank}
                  onChange={(e) => setPrepared({ ...prepared, rank: e.target.value })}
                  placeholder="e.g. SGT or Sgt"
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Designation <span className="text-[10px] text-slate-400">(Normal)</span>
                </label>
                <input
                  type="text"
                  value={prepared.designation}
                  onChange={(e) => setPrepared({ ...prepared, designation: e.target.value })}
                  placeholder="e.g. Admin SNCO or UWO"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Unit <span className="text-[10px] text-slate-400">(Default: 155 UASU BAF)</span>
              </label>
              <input
                type="text"
                value={prepared.unit}
                onChange={(e) => setPrepared({ ...prepared, unit: e.target.value })}
                placeholder="155 UASU BAF"
                className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Sign Digitally Option */}
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!prepared.signDigitally}
                  onChange={(e) => setPrepared({ ...prepared, signDigitally: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Sign Digitally (Prepared By)
                </span>
              </label>
              {prepared.signDigitally && (
                <div className="pl-6 space-y-1 text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="text-[11px] font-medium">
                    Digital signature will be stamped above the name in official documents.
                  </p>
                  <input
                    type="text"
                    value={prepared.digitalSignatureText || ''}
                    onChange={(e) => setPrepared({ ...prepared, digitalSignatureText: e.target.value })}
                    placeholder={`Custom Signature Text (Defaults to "${prepared.name || 'MD NAHID HASAN KHAN'}")`}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tab 2: Authorized By Form */
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                NAME <span className="text-[10px] text-emerald-600 font-semibold">(Block Capital)</span>
              </label>
              <input
                type="text"
                value={authorized.name}
                onChange={(e) => setAuthorized({ ...authorized, name: e.target.value.toUpperCase() })}
                placeholder="e.g. MD SHAHINUZZAMAN"
                className="w-full px-3.5 py-2 text-xs uppercase font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rank <span className="text-[10px] text-slate-400">(Block / Running)</span>
                </label>
                <input
                  type="text"
                  value={authorized.rank}
                  onChange={(e) => setAuthorized({ ...authorized, rank: e.target.value })}
                  placeholder="e.g. WO or MWO"
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Designation <span className="text-[10px] text-slate-400">(Normal)</span>
                </label>
                <input
                  type="text"
                  value={authorized.designation}
                  onChange={(e) => setAuthorized({ ...authorized, designation: e.target.value })}
                  placeholder="e.g. WOIC Orderly Room or OC"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Unit <span className="text-[10px] text-slate-400">(Default: 155 UASU BAF)</span>
              </label>
              <input
                type="text"
                value={authorized.unit}
                onChange={(e) => setAuthorized({ ...authorized, unit: e.target.value })}
                placeholder="155 UASU BAF"
                className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Sign Digitally Option */}
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!authorized.signDigitally}
                  onChange={(e) => setAuthorized({ ...authorized, signDigitally: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Sign Digitally (Authorized By)
                </span>
              </label>
              {authorized.signDigitally && (
                <div className="pl-6 space-y-1 text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="text-[11px] font-medium">
                    Digital signature will be stamped above the name in official documents.
                  </p>
                  <input
                    type="text"
                    value={authorized.digitalSignatureText || ''}
                    onChange={(e) => setAuthorized({ ...authorized, digitalSignatureText: e.target.value })}
                    placeholder={`Custom Signature Text (Defaults to "${authorized.name || 'MD SHAHINUZZAMAN'}")`}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Alignment Preview Box with Extra Spacing */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Live Document Signature Layout</div>
          <div className="flex justify-between items-end text-slate-900 dark:text-slate-100 text-[11px] font-sans px-2">
            {/* Left Preview */}
            <div className="text-center min-w-[150px]">
              {prepared.signDigitally ? (
                <div className="h-10 flex flex-col items-center justify-end pb-1 font-serif italic text-sm text-emerald-800 dark:text-emerald-300 select-none">
                  <span>{prepared.digitalSignatureText || prepared.name}</span>
                  <span className="text-[9px] font-mono not-italic text-emerald-600 dark:text-emerald-400">
                    [Digitally Signed]
                  </span>
                </div>
              ) : (
                <div className="h-10 flex items-end justify-center pb-1 text-[10px] text-slate-400 italic">
                  (Signature Space)
                </div>
              )}
              <div className="border-t border-slate-400 dark:border-slate-600 pt-1 leading-tight space-y-[2px]">
                <div className="text-xs font-black uppercase text-slate-900 dark:text-white">
                  {prepared.name || 'NAME'}
                </div>
                <div className="text-[11px] font-bold">{prepared.rank || 'RANK'}</div>
                <div className="text-[10px] font-normal">{prepared.designation || 'Designation'}</div>
                <div className="text-[9px] text-slate-500">{prepared.unit || '155 UASU BAF'}</div>
              </div>
            </div>

            {/* Right Preview */}
            <div className="text-center min-w-[150px]">
              {authorized.signDigitally ? (
                <div className="h-10 flex flex-col items-center justify-end pb-1 font-serif italic text-sm text-emerald-800 dark:text-emerald-300 select-none">
                  <span>{authorized.digitalSignatureText || authorized.name}</span>
                  <span className="text-[9px] font-mono not-italic text-emerald-600 dark:text-emerald-400">
                    [Digitally Signed]
                  </span>
                </div>
              ) : (
                <div className="h-10 flex items-end justify-center pb-1 text-[10px] text-slate-400 italic">
                  (Signature Space)
                </div>
              )}
              <div className="border-t border-slate-400 dark:border-slate-600 pt-1 leading-tight space-y-[2px]">
                <div className="text-xs font-black uppercase text-slate-900 dark:text-white">
                  {authorized.name || 'NAME'}
                </div>
                <div className="text-[11px] font-bold">{authorized.rank || 'RANK'}</div>
                <div className="text-[10px] font-normal">{authorized.designation || 'Designation'}</div>
                <div className="text-[9px] text-slate-500">{authorized.unit || '155 UASU BAF'}</div>
              </div>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
            <Check className="w-4 h-4" />
            <span>{savedSuccess}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
