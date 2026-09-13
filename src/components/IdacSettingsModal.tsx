import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, Trash2, Edit2, CheckCircle2, Search, CheckSquare, 
  Square, ShieldCheck, Phone, Filter, Clock, RotateCcw, ChevronDown, BookOpen, ArrowLeft
} from 'lucide-react';
import { 
  IdacResponsibility, IdacEmergencyContact, IdacShiftTimeConfig,
  getIdacResponsibilities, saveIdacResponsibilities,
  getIdacEmergencyContacts, saveIdacEmergencyContacts,
  getIdacShiftTimes, saveIdacShiftTimes, DEFAULT_SHIFT_TIMES,
  getRankSeniorityWeight
} from '../data/idacSettings';

import { Airman } from '../types';
import { UserRole } from '../types';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface IdacSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  airmen: Airman[];
}

export const IdacSettingsModal: React.FC<IdacSettingsModalProps> = ({ isOpen, onClose, role, airmen }) => {
  const [activeTab, setActiveTab] = useState<'CONTACTS' | 'SHIFT_TIMES' | 'RESPONSIBILITIES' | null>(null);

  // --- Responsibilities State ---
  const [responsibilities, setResponsibilities] = useState<IdacResponsibility[]>([]);
  const [newRespText, setNewRespText] = useState('');
  const [editingRespId, setEditingRespId] = useState<string | null>(null);
  const [editingRespText, setEditingRespText] = useState('');

  // --- Contacts State ---
  const [contacts, setContacts] = useState<IdacEmergencyContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [allAirmen, setAllAirmen] = useState<Airman[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactFilter, setContactFilter] = useState<'ALL' | 'OFFICERS' | 'NCO'>('ALL');

  // --- Shift Times State ---
  const [shiftTimes, setShiftTimes] = useState<IdacShiftTimeConfig[]>([]);

  // Load Data
  useEffect(() => {
    setResponsibilities(getIdacResponsibilities());
    setContacts(getIdacEmergencyContacts());
    const times = getIdacShiftTimes();
    if (times.length === 0) {
      setShiftTimes(DEFAULT_SHIFT_TIMES);
      saveIdacShiftTimes(DEFAULT_SHIFT_TIMES);
    } else {
      setShiftTimes(times);
    }
    setAllAirmen([...airmen].sort((a, b) => getRankSeniorityWeight(a.rank) - getRankSeniorityWeight(b.rank)));
  }, []);

  // --- Responsibilities Handlers ---
  const handleAddResponsibility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRespText.trim()) return;
    const newResp: IdacResponsibility = {
      id: Date.now().toString(),
      text: newRespText.trim(),
      
    };
    const updated = [...responsibilities, newResp];
    setResponsibilities(updated);
    saveIdacResponsibilities(updated);
    setNewRespText('');
  };

  const handleSaveEditResponsibility = (id: string) => {
    if (!editingRespText.trim()) return;
    const updated = responsibilities.map(r => 
      r.id === id ? { ...r, text: editingRespText.trim() } : r
    );
    setResponsibilities(updated);
    saveIdacResponsibilities(updated);
    setEditingRespId(null);
    setEditingRespText('');
  };

  const handleDeleteResponsibility = (id: string) => {
    const updated = responsibilities.filter(r => r.id !== id);
    setResponsibilities(updated);
    saveIdacResponsibilities(updated);
  };

  // --- Contacts Handlers ---
  const handleToggleAirman = (airman: Airman) => {
    const isAlreadyContact = contacts.some(c => c.id === airman.id);
    let updated: IdacEmergencyContact[];
    
    if (isAlreadyContact) {
      updated = contacts.filter(c => c.id !== airman.id);
    } else {
      const newContact: IdacEmergencyContact = {
        id: airman.id,
        name: airman.name,
        rank: airman.rank,
        phone: airman.mobileNo || 'N/A',
        whatsappPhone: airman.mobileNo || 'N/A',
        remark: 'Standard',
        airmanId: airman.id,
      };
      updated = [...contacts, newContact];
    }
    
    // Sort contacts by seniority
    updated.sort((a, b) => getRankSeniorityWeight(a.rank) - getRankSeniorityWeight(b.rank));
    setContacts(updated);
    saveIdacEmergencyContacts(updated);
  };

  const handleToggleCriticalContact = (id: string) => {
    const updated = contacts.map(c => 
      c.id === id ? { ...c, isCritical: !(c.remark === 'Critical') } : c
    );
    setContacts(updated);
    saveIdacEmergencyContacts(updated);
  };

  // Filtered Airmen for Directory
  const filteredAirmen = useMemo(() => {
    return allAirmen.filter(a => {
      if (contactFilter === 'OFFICERS') {
        if (!['Fg Off', 'Flt Lt', 'Sqn Ldr', 'Wg Cdr', 'Gp Capt'].includes(a.rank)) return false;
      } else if (contactFilter === 'NCO') {
        if (['Fg Off', 'Flt Lt', 'Sqn Ldr', 'Wg Cdr', 'Gp Capt'].includes(a.rank)) return false;
      }
      if (!contactSearchQuery) return true;
      const q = contactSearchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || 
             a.bdNo.toString().includes(q) || 
             (a.mobileNo && a.mobileNo.includes(q));
    });
  }, [allAirmen, contactSearchQuery, contactFilter]);

  // --- Shift Times Handlers ---
  const handleShiftTimeChange = (shift: string, field: 'startTime' | 'endTime', value: string) => {
    const updated = shiftTimes.map(st => 
      st.shift === shift ? { ...st, [field]: value } : st
    );
    setShiftTimes(updated);
    saveIdacShiftTimes(updated);
  };

  const handleResetShiftTimes = () => {
    if (window.confirm('Reset all shift times to official defaults?')) {
      setShiftTimes(DEFAULT_SHIFT_TIMES);
      saveIdacShiftTimes(DEFAULT_SHIFT_TIMES);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden sm:p-6 sm:justify-center sm:items-center animate-fadeIn">
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-slate-50 dark:bg-slate-950 sm:rounded-3xl sm:shadow-2xl flex flex-col overflow-hidden relative">
        
        <div className="flex items-center px-4 py-3 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 shrink-0 border-b border-slate-200 dark:border-slate-800">
          {activeTab ? (
            <button 
              onClick={() => setActiveTab(null)} 
              className="mr-3 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={onClose} 
              className="mr-3 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-lg font-semibold tracking-wide flex-1 pr-10">
            {activeTab === 'CONTACTS' ? 'Emergency Contacts' : activeTab === 'SHIFT_TIMES' ? 'Shift Times' : activeTab === 'RESPONSIBILITIES' ? 'Responsibilities' : 'IDAC Settings'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!activeTab && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div onClick={() => setActiveTab('CONTACTS')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl text-amber-500 bg-amber-100 dark:bg-amber-950 dark:text-amber-400"><Phone className="w-5 h-5" /></div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Emergency Contacts</span>
                </div>
              </div>
              <div onClick={() => setActiveTab('SHIFT_TIMES')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl text-indigo-500 bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400"><Clock className="w-5 h-5" /></div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Shift Times Config</span>
                </div>
              </div>
              <div onClick={() => setActiveTab('RESPONSIBILITIES')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:bg-slate-100">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl text-emerald-500 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400"><BookOpen className="w-5 h-5" /></div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Responsibilities</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CONTACTS' && (
            <div className="space-y-4">
              {!showAddContact ? (
                <>
                  <button
                    onClick={() => setShowAddContact(true)}
                    className="w-full py-3 border-2 border-dashed border-emerald-300 dark:border-emerald-800/60 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Select from Nominal Roll</span>
                  </button>

                  <div className="space-y-2">
                    {contacts.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        No emergency contacts configured.
                      </div>
                    ) : (
                      contacts.map((contact) => (
                        <div key={contact.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between shadow-xs">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${(contact.remark === 'Critical') ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                              <Phone className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{contact.rank} {contact.name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{contact.phone}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleToggleCriticalContact(contact.id)}
                              className={`p-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                (contact.remark === 'Critical') 
                                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/60 dark:text-red-400' 
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'
                              }`}
                            >
                              {(contact.remark === 'Critical') ? 'Critical' : 'Standard'}
                            </button>
                            <button
                              onClick={() => handleToggleAirman(contact as Airman)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Directory Search</h4>
                    <button
                      onClick={() => setShowAddContact(false)}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Done Selecting
                    </button>
                  </div>
                  
                  {/* Search Box */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, BD No, or phone..."
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex space-x-2">
                    {(['ALL', 'OFFICERS', 'NCO'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setContactFilter(f)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                          contactFilter === f 
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Results */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 max-h-64 overflow-y-auto">
                    {filteredAirmen.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">No personnel found.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredAirmen.map(airman => {
                          const isSelected = contacts.some(c => c.id === airman.id);
                          return (
                            <div
                              key={airman.id}
                              onClick={() => handleToggleAirman(airman)}
                              className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                )}
                                <div>
                                  <div className={`font-bold ${isSelected ? 'text-emerald-900 dark:text-emerald-200' : 'text-slate-900 dark:text-slate-100'}`}>
                                    {formatAirmanName(airman.rank)} {airman.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500">BD/{airman.bdNo} • 📞 {airman.mobileNo || 'N/A'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'SHIFT_TIMES' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleResetShiftTimes}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Defaults</span>
                </button>
              </div>

              <div className="space-y-3">
                {shiftTimes.map(st => (
                  <div key={st.shift} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {st.shift} Shift
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        {st.startTime} - {st.endTime}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={st.startTime}
                          onChange={(e) => handleShiftTimeChange(st.shift, 'startTime', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                        <input
                          type="time"
                          value={st.endTime}
                          onChange={(e) => handleShiftTimeChange(st.shift, 'endTime', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'RESPONSIBILITIES' && (
            <div className="space-y-4">
              <form onSubmit={handleAddResponsibility} className="flex gap-2">
                <input
                  type="text"
                  value={newRespText}
                  onChange={(e) => setNewRespText(e.target.value)}
                  placeholder="Enter new duty responsibility bullet point..."
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </form>

              <div className="space-y-2">
                {responsibilities.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No duty responsibilities configured.
                  </div>
                ) : (
                  responsibilities.map(r => (
                    <div key={r.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start justify-between gap-3 text-xs shadow-sm">
                      {editingRespId === r.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editingRespText}
                            onChange={(e) => setEditingRespText(e.target.value)}
                            className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none"
                          />
                          <button
                            onClick={() => handleSaveEditResponsibility(r.id)}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingRespId(null)}
                            className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start space-x-2 font-medium text-slate-800 dark:text-slate-200">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{r.text}</span>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingRespId(r.id);
                                setEditingRespText(r.text);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteResponsibility(r.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
