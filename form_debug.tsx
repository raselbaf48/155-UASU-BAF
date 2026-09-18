
            {/* Form */}
            <form onSubmit={handleAddDisposalSubmit} className="space-y-4">
              
              {/* 1. Date Selection */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      1. Select Date
                    </label>
                    <div className="w-56">
                      <DateNavigator
                    value={disposalFromDate}
                    onChange={(e) => {
                      setDisposalFromDate(e.target.value);
                      setDisposalToDate(e.target.value);
                    }}
                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white print:text-black outline-none focus:border-emerald-500 shadow-xs"
                    required
                  />
                </div>
              </div>


              {/* 2. Select Disposal Category */}
              <div className="space-y-2 relative">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    2. Select Disposal Category
                  </label>
                  
                    <button
                      type="button"
                      onClick={() => setIsEditingDisposals(!isEditingDisposals)}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${isEditingDisposals ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                      title="Manage Saved Categories"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedDisposals.map((cat) => {
                    const isSelected = !isEditingDisposals && disposalCategory === cat.code && (cat.code !== 'OTHERS' || disposalCustomTitle === cat.customTitle);
                    return (
                      <div key={cat.label} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingDisposals) return;
                            setDisposalCategory(cat.code);
                            if (cat.customTitle) setDisposalCustomTitle(cat.customTitle);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all truncate ${isEditingDisposals ? 'pr-6 opacity-80 cursor-default bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'cursor-pointer'} ${
                            isSelected
                              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 shadow-xs'
                              : (!isEditingDisposals ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600' : '')
                          }`}
                        >
                          {cat.label}
                        </button>
                        {isEditingDisposals && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDisposalOption(cat.label)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!isEditingDisposals && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowDisposalDropdown(!showDisposalDropdown)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {savedDisposals.length === 0 && <span>Add Category</span>}
                      </button>
                      {showDisposalDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1">
                          {[...ALL_DISPOSAL_OPTIONS, ...historicalCustomCats].filter(opt => opt.code === 'OTHERS' || (!savedDisposals.some(d => d.code === opt.code && (d.code !== 'OTHERS' || d.customTitle === opt.customTitle)))).filter((opt, index, self) => index === self.findIndex((t) => t.code === opt.code && t.customTitle === opt.customTitle)).map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => handleAddDisposalOption(opt)}
                              className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
                            >
                              {opt.code === 'OTHERS' && opt.customTitle ? opt.customTitle : opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                
                {/* Sub Category Dropdown */}
                
                </div>

                {/* Multi-Select Airmen List */}
                {(() => {
                  const flightAirmen = airmen.filter((a) => a.flightName === disposalFlight).filter(a => {
    if (!['CPL', 'Cpl', 'LAC', 'AC'].includes(a.rank)) return false;
    const block = (a.addressBlock || '').toLowerCase();
    const isLOut = block.includes('qtr') || 
                   block.includes('quarter') || 
                   block.includes('outside') || block.includes('maizpara') ||
                   block.includes('l/o') ||
                   block.includes('l/out') ||
                   block.includes('living out') ||
                   block.includes('dhaka') ||
                   block.includes('mirpur') ||
                   block.includes('cantt') ||
                   block.includes('ghat') ||
                   block === 'lo' || 
                   block === 'l o';
    return !isLOut;
});

                  const getAirmanStatusLabel = (airmanId: string) => {
                    const st = disposalPersonnelStatusMap[airmanId];
                    if (!st) return { isOnParade: true, label: 'On Parade', dutyCode: 'ON_PARADE', notes: '', dutyName: 'On Parade' };

                    const { statusCategory, dutyCode, notes, dutyName } = st;
                    const codeUpper = (dutyCode || '').toUpperCase();
                    const notesLower = (notes || '').toLowerCase();

                    if (codeUpper === 'ON_PARADE' || statusCategory === 'PARADE') {
                      return { isOnParade: true, label: 'On Parade', dutyCode: 'ON_PARADE', notes, dutyName: 'On Parade' };
                    }
                    if (statusCategory === 'OFF' || codeUpper === 'DUTY_OFF' || codeUpper === 'OFF_DUTY' || notesLower.includes('off duty') || notesLower.includes('nt off') || notesLower.includes('night off')) {
                      return { isOnParade: true, label: 'On Parade', dutyCode: 'ON_PARADE', notes: '', dutyName: 'On Parade' };
                    }
                    if (codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {
                      return { isOnParade: true, label: 'On Parade', dutyCode: 'ON_PARADE', notes: '', dutyName: 'On Parade' };
                    }
                    if (codeUpper === 'LEAVE' || statusCategory === 'LEAVE') {
                      return { isOnParade: false, label: 'Leave', dutyCode: 'LEAVE', notes, dutyName: 'Leave' };
                    }
                    if (['TDY', 'ATT', 'DETT', 'ATTACHMENT', 'DETACHMENT'].includes(codeUpper) || statusCategory === 'TDY') {
                      return { isOnParade: false, label: 'TDY', dutyCode: 'TDY', notes, dutyName: 'TDY' };
                    }
                    if (['BAKE_BITE', 'BAKE_N_BITE'].includes(codeUpper) || statusCategory === 'BAKE_N_BITE') {
                      return { isOnParade: false, label: 'Bake & Bite', dutyCode: 'BAKE_N_BITE', notes, dutyName: 'Bake & Bite' };
                    }
                    if (codeUpper === 'ESSN' || notesLower.includes('essn')) {
                      return { isOnParade: false, label: 'ESSN', dutyCode: 'ESSN', notes, dutyName: 'ESSN' };
                    }
                    if (['CMH', 'BNS', 'BSH', 'HOSPITAL'].includes(codeUpper) || notesLower.includes('cmh') || notesLower.includes('bns') || notesLower.includes('bsh')) {
                      return { isOnParade: false, label: 'CMH / Hospital', dutyCode: 'CMH', notes, dutyName: 'CMH / Hospital' };
                    }
                    if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick')) {
                      return { isOnParade: false, label: 'Sick Report', dutyCode: 'SICK_REPORT', notes, dutyName: 'Sick Report' };
                    }
                    if (['ADMIN_ORDER', 'CAT_C', 'DRILL'].includes(codeUpper)) {
                      return { isOnParade: false, label: "Admin Order", dutyCode: 'ADMIN_ORDER', notes, dutyName: "Admin Order" };
                    }
                    if (codeUpper === 'RECEPTION' || notesLower.includes('reception')) {
                      return { isOnParade: false, label: 'Reception / KO', dutyCode: 'RECEPTION', notes, dutyName: 'Reception / KO' };
                    }
                    if (['ADMIN_ORDER', 'BOI'].includes(codeUpper) || notesLower.includes('admin order')) {
                      return { isOnParade: false, label: 'Admin Order', dutyCode: 'ADMIN_ORDER', notes, dutyName: 'Admin Order' };
                    }
                    if (['CLASS_TRG', 'CLASS', 'TRG'].includes(codeUpper)) {
                      return { isOnParade: false, label: 'Class / Trg', dutyCode: 'CLASS_TRG', notes, dutyName: 'Class / Trg' };
                    }
                    if (['AIRPORT', 'AIR_FD', 'AIRFIELD', 'ATT'].includes(codeUpper)) {
                      return { isOnParade: false, label: 'Airfield', dutyCode: 'ATT', notes, dutyName: 'Airfield' };
                    }
                    if (['GAMES', 'GH', 'GAME_HONOR'].includes(codeUpper)) {
                      return { isOnParade: false, label: 'G/H & Games', dutyCode: 'GAMES', notes, dutyName: 'G/H & Games' };
                    }
                    if (['ABSENT', 'AWL'].includes(codeUpper)) {
                      return { isOnParade: false, label: 'Absent', dutyCode: 'ABSENT', notes, dutyName: 'Absent' };
                    }
                    if (statusCategory === 'DUTY' || ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA'].includes(codeUpper)) {
                      const displayDuty = formatDutyOnShortName(codeUpper, st.idaShift, notes, dutyName);
                      return { isOnParade: false, label: displayDuty || 'On Duty', dutyCode: dutyCode || 'DUTY_ON', notes, dutyName: dutyName || 'On Duty' };
                    }

                    return { isOnParade: false, label: notes || dutyCode || 'Disposal', dutyCode: dutyCode || 'OTHERS', notes, dutyName: dutyName || 'Disposal' };
                  };

                  const availableOnParade = flightAirmen.filter((a) => getAirmanStatusLabel(a.id).isOnParade);

                  const handleSelectAllFlightAvailable = () => {
                    const availableIds = availableOnParade.map((a) => a.id);
                    setSelectedDisposalAirmenIds((prev) => Array.from(new Set([...prev, ...availableIds])));
                  };

                  const handleDeselectFlight = () => {
                    const flightIds = flightAirmen.map((a) => a.id);
                    setSelectedDisposalAirmenIds((prev) => prev.filter((id) => !flightIds.includes(id)));
                  };
                  
                  if (disposalFromDate < todayStr && !isSuperAdmin) {
                    return (
                      <div className="py-8 text-center text-sm font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="mb-2">🚫</div>
                        Modifications are disabled for past dates.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5">
                      {/* Selection Toolbar */}
                      <div className="flex items-center justify-between px-1 text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          Available: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{availableOnParade.length}</strong> / {flightAirmen.length} in {disposalFlight}
                          {selectedDisposalAirmenIds.length > 0 && (
                            <span className="ml-2 font-bold text-emerald-600 dark:text-emerald-400">
                              ({selectedDisposalAirmenIds.length} Selected)
                            </span>
                          )}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleSelectAllFlightAvailable}
                            disabled={availableOnParade.length === 0}
                            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-40 cursor-pointer"
                          >
                            Select All Available
                          </button>
                          <span className="text-slate-300 ">|</span>
                          <button
                            type="button"
                            onClick={handleDeselectFlight}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700  cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Airmen List Scrollbox */}
                      <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50">
                        {flightAirmen.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-400">
                            No airmen registered in {disposalFlight} Flight
                          </div>
                        ) : (
                          flightAirmen.map((a) => {
                            const statusInfo = getAirmanStatusLabel(a.id);
                            const { isOnParade, label: statusLabel } = statusInfo;
                            const isChecked = selectedDisposalAirmenIds.includes(a.id);

                            if (isOnParade) {
                              return (
                                <div onClick={() => { if (isChecked) { setSelectedDisposalAirmenIds((prev) => prev.filter((id) => id !== a.id)); } else { setSelectedDisposalAirmenIds((prev) => [...prev, a.id]); } }}
                                  key={a.id}
                                  className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer select-none text-xs ${isChecked ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-800 dark:text-slate-200 font-medium'}`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0">
                                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border'}`}>
                          {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                        </div>
                                    <span className="truncate">
                                      <span className="font-bold">{formatAirmanName(a.rank)}</span> {a.name} <span className="text-[11px] text-slate-400">({a.trade})</span>
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0 ml-2">
                                    On Parade
                                  </span>
                                </div>
                              );
                            }

                            // Airman with existing disposal / duty - with Edit / Change button
                            return (
                              <div
                                key={a.id}
                                className="flex items-center justify-between p-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-800/60 text-xs select-none"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <span className="truncate text-slate-700 dark:text-slate-300">
                                    <span className="font-bold">{formatAirmanName(a.rank)}</span> {a.name} ({a.trade})
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-200 dark:bg-slate-800 print:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 ">
                                    {statusLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openEditDisposal(a, statusInfo.dutyCode, statusInfo.dutyName, statusInfo.notes);
                                    }}
                                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300  hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors cursor-pointer flex items-center space-x-1"
                                    title="Click to edit, change or remove disposal for this airman"
                                  >
                                    <span>✏️ Change</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-600 ">
                  {selectedDisposalAirmenIds.length === 0 ? (
                    'Select personnel above'
