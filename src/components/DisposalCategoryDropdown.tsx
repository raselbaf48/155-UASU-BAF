import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { getSavedCustomDisposals, saveCustomDisposal } from '../utils/customDisposalStore';

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomList(getSavedCustomDisposals());
    }
  }, [isOpen]);

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
    saveCustomDisposal(trimmed);
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
                    <button
                      key={`custom-${customName}`}
                      type="button"
                      onClick={() => handleSelectCustom(customName)}
                      className="w-full text-left px-4 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors flex items-center justify-between"
                    >
                      <span className="truncate">{customName}</span>
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-normal">
                        Custom
                      </span>
                    </button>
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
    </div>
  );
};
