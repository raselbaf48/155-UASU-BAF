import React, { useState, useEffect } from 'react';
import { PenTool, Check, X, Shield, FileCheck, RotateCcw } from 'lucide-react';

export interface IdacSignatureDetails {
  name: string;
  rank: string;
  designation: string;
  unit: string;
  signDigitally?: boolean;
  digitalSignatureText?: string;
}

export const DEFAULT_IDAC_SIGNATURE: IdacSignatureDetails = {
  name: 'MAHIM RAAD SADAT',
  rank: 'Flt Lt',
  designation: 'Adjutant',
  unit: '155 UASU BAF',
  signDigitally: false,
  digitalSignatureText: '',
};

export function getSavedIdacSignature(): IdacSignatureDetails {
  try {
    const saved = localStorage.getItem('baf_idac_sign_authorized_by');
    if (saved) return { ...DEFAULT_IDAC_SIGNATURE, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_IDAC_SIGNATURE;
}

export function saveIdacSignature(details: IdacSignatureDetails): void {
  try {
    localStorage.setItem('baf_idac_sign_authorized_by', JSON.stringify(details));
    window.dispatchEvent(new CustomEvent('baf_idac_signature_updated'));
  } catch (e) {}
}

interface IdacSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  rosterMonthDisplay?: string; // e.g. "Sep 26"
  onSignatureUpdated?: (details: IdacSignatureDetails) => void;
}

export const IdacSignatureModal: React.FC<IdacSignatureModalProps> = ({
  isOpen,
  onClose,
  rosterMonthDisplay = 'Sep 26',
  onSignatureUpdated,
}) => {
  const [details, setDetails] = useState<IdacSignatureDetails>(getSavedIdacSignature);
  const [savedSuccess, setSavedSuccess] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setDetails(getSavedIdacSignature());
      setSavedSuccess('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const cleanDetails: IdacSignatureDetails = {
      ...details,
      name: details.name.toUpperCase().trim(),
      rank: details.rank.trim(),
      designation: details.designation.trim(),
      unit: details.unit.trim() || '155 UASU BAF',
      digitalSignatureText: details.signDigitally ? (details.digitalSignatureText?.trim() || details.name.trim()) : '',
    };

    saveIdacSignature(cleanDetails);
    setDetails(cleanDetails);

    if (onSignatureUpdated) {
      onSignatureUpdated(cleanDetails);
    }

    setSavedSuccess('IDAC Duty signature saved! (Independent of Parade & PT State)');
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleReset = () => {
    setDetails({ ...DEFAULT_IDAC_SIGNATURE });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">IDAC Duty Signature Authority</h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                  IDAC Duty Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure signing officer exclusively for IDAC Duty Roster (Parade State remains untouched)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 text-xs text-slate-300 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Note:</strong> This signature is strictly isolated for <strong>IDAC Duty Roster</strong>. Changing it will <strong>NOT</strong> change Parade or PT State signatures.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              NAME <span className="text-slate-400 font-normal">(Block Capital)</span>
            </label>
            <input
              type="text"
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.target.value })}
              placeholder="e.g. MAHIM RAAD SADAT"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono uppercase tracking-wide focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Rank <span className="text-slate-400 font-normal">(e.g. Flt Lt, Sqn Ldr)</span>
              </label>
              <input
                type="text"
                value={details.rank}
                onChange={(e) => setDetails({ ...details, rank: e.target.value })}
                placeholder="Flt Lt"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Designation <span className="text-slate-400 font-normal">(e.g. Adjutant, OC)</span>
              </label>
              <input
                type="text"
                value={details.designation}
                onChange={(e) => setDetails({ ...details, designation: e.target.value })}
                placeholder="Adjutant"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Unit <span className="text-slate-400 font-normal">(Default: 155 UASU BAF)</span>
            </label>
            <input
              type="text"
              value={details.unit}
              onChange={(e) => setDetails({ ...details, unit: e.target.value })}
              placeholder="155 UASU BAF"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Digital Signature Option */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!details.signDigitally}
                onChange={(e) => setDetails({ ...details, signDigitally: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">
                Sign Digitally (Digital Script in Preview & Print)
              </span>
            </label>

            {details.signDigitally && (
              <div className="pt-1 pl-6.5">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Digital Signature Text (Script Style)
                </label>
                <input
                  type="text"
                  value={details.digitalSignatureText || ''}
                  onChange={(e) => setDetails({ ...details, digitalSignatureText: e.target.value })}
                  placeholder={details.name || 'Signature Script'}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-serif italic text-amber-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Live Document Preview Card */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center justify-between">
              <span>Live IDAC Duty Signature Preview (Bottom-Right)</span>
              <span className="text-blue-400 font-mono">155 UASU BAF</span>
            </div>
            <div className="flex justify-end p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <div className="text-left font-bold min-w-[190px]">
                {details.signDigitally ? (
                  <div className="mb-1 text-left font-serif italic text-xs text-amber-300">
                    <span className="font-bold underline">
                      {details.digitalSignatureText || details.name || 'MAHIM RAAD SADAT'}
                    </span>
                    <span className="block text-[8px] font-mono not-italic text-slate-400">
                      [Digitally Signed • BAF Verified]
                    </span>
                  </div>
                ) : (
                  <div className="h-6 text-[10px] text-slate-400 font-normal italic flex items-center">
                    (Signature Space)
                  </div>
                )}
                <div className="border-t border-slate-400 pt-1 text-white">
                  <div className="text-xs uppercase font-black">{details.name || 'MAHIM RAAD SADAT'}</div>
                  <div className="text-[11px] font-normal">{details.rank || 'Flt Lt'}</div>
                  <div className="text-[11px] font-normal">{details.designation || 'Adjutant'}</div>
                  <div className="text-[10px] uppercase font-bold">{details.unit || '155 UASU BAF'}</div>
                  <div className="text-[11px] font-bold text-amber-300 mt-0.5">{rosterMonthDisplay}</div>
                </div>
              </div>
            </div>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{savedSuccess}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
