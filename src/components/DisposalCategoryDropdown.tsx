import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Trash } from 'lucide-react';
import { getSavedCustomDisposals, saveCustomDisposal, removeSavedCustomDisposal } from '../utils/customDisposalStore';

export interface DisposalOption {
  code: string;
  label: string;
  customTitle?: string;
}

interface DisposalCategoryDropdownProps {
  options: DisposalOption[];
  savedDisposals: DisposalOption[];
  onSelectOption: (option: DisposalOption) => void;
  dropUp?: boolean;
  buttonLabel?: string;
}

export const DisposalCategoryDropdown: React.FC<DisposalCategoryDropdownProps> = ({
  options,
  savedDisposals,
  onSelectOption,
  dropUp = false,
  buttonLabel = 'Add Category',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isWritingCustom, setIsWritingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [customList, setCustomList] = useState<string[]>([]);
  const [deletingCustomName, setDeletingCustomName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomList(getSavedCustomDisposals());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      setCustomList(getSavedCustomDisposals());
    };
    window.addEventListener('baf_custom_disposals_updated', handleUpdate);
    return () => window.removeEventListener('baf_custom_disposals_updated', handleUpdate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsWritingCustom(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectStandard = (opt: DisposalOption) => {
    onSelectOption(opt);
    setIsOpen(false);
    setIsWritingCustom(false);
  };

  const handleSelectCustom = (customName: string) => {
    saveCustomDisposal(customName);
    onSelectOption({
      code: 'OTHERS',
      label: customName,
      customTitle: customName,
    });
    setIsOpen(false);
    setIsWritingCustom(false);
  };

  const submitCustom = () => {
    const trimmed = newCustomName.trim();
    if (!trimmed) return;
    saveCustomDisposal(trimmed, true);
    setCustomList(getSavedCustomDisposals());
    onSelectOption({
      code: 'OTHERS',
      label: trimmed,
      customTitle: trimmed,
    });
    setNewCustomName('');
    setIsWritingCustom(false);
    setIsOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deletingCustomName) return;
    const updated = removeSavedCustomDisposal(deletingCustomName);
    setCustomList(updated);
    setDeletingCustomName(null);
  };

  // Filter standard options excluding raw OTHERS (Custom is handled specially at bottom)
  const standardOptions = options
    .filter(opt => !(opt.code === 'OTHERS' && (!opt.customTitle || opt.label.includes('Custom'))))
    .filter(opt => !savedDisposals.some(d => d.code === opt.code && (d.code !== 'OTHERS' || d.customTitle === opt.customTitle)))
    .filter((opt, index, self) => index === self.findIndex(t => t.code === opt.code && t.customTitle === opt.customTitle));

  // Custom options saved in storage that are not already active
  const availableCustoms = customList.filter(
    cName => !savedDisposals.some(d => d.code === 'OTHERS' && (d.customTitle === cName || d.label === cName))
  );

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setIsWritingCustom(false);
        }}
        className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer flex items-center space-x-1"
      >
        <Plus className="w-3.5 h-3.5" />
        {savedDisposals.length === 0 && <span>{buttonLabel}</span>}
      </button>

      {isOpen && (
        <>
          {/* Transparent full-screen overlay for reliable outside clicks */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setIsWritingCustom(false);
            }}
          />

          {/* Dropdown Menu */}
          <div
            className={`absolute ${
              dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
            } left-0 w-60 max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 py-1 flex flex-col`}
          >
            {/* Standard Options */}
            <div className="flex-1 overflow-y-auto">
              {standardOptions.map((opt) => (
                <button
                  key={`${opt.code}-${opt.label}-${opt.customTitle || ''}`}
                  type="button"
                  onClick={() => handleSelectStandard(opt)}
                  className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
                >
                  {opt.code === 'OTHERS' && opt.customTitle ? opt.customTitle : opt.label}
                </button>
              ))}

              {/* Saved Custom Categories (rendered directly ABOVE Custom...) */}
              {availableCustoms.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 my-1 pt-1">
                  <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Custom Categories
                  </div>
                  {availableCustoms.map((customName) => (
                    <div
                      key={`custom-${customName}`}
                      className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectCustom(customName)}
                        className="flex-1 text-left truncate flex items-center justify-between cursor-pointer mr-1"
                      >
                        <span className="truncate">{customName}</span>
                        <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-normal shrink-0">
                          Custom
                        </span>
                      </button>
                      <button
                        type="button"
                        title={`Remove ${customName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingCustomName(customName);
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/60 rounded cursor-pointer shrink-0 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Input / Button at Bottom */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-900/90 sticky bottom-0 z-10">
              {!isWritingCustom ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsWritingCustom(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>✨ Custom...</span>
                  <span className="text-[10px] text-slate-400 font-normal">Write custom</span>
                </button>
              ) : (
                <div
                  className="flex items-center space-x-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    type="text"
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    placeholder="Write custom name..."
                    className="flex-1 px-2 py-1 text-xs rounded-lg border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitCustom();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      submitCustom();
                    }}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-xs"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Popup */}
      {deletingCustomName && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  কাস্টম ক্যাটাগরি মুছে ফেলতে চান?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  "{deletingCustomName}" তালিকা থেকে অপসারণ করা হবে।
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCustomName(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                মুছে ফেলুন (Remove)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
