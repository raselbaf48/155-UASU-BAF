import Papa from 'papaparse';
import { getAppConfig, saveAppConfig, AppConfig, getAppConfigHistory, addAppConfigHistory, AppConfigHistoryItem, updateAppConfigHistoryItemActiveStatus, deleteAppConfigHistoryItem, clearAppConfigHistory } from '../utils/appConfig';
import { Megaphone, Wrench, Clock, Trash2 as TrashIcon, Power, PowerOff } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import {   
  X, 
  Cloud,
  Server,

  Settings, 
  Moon, 
  Sun, 
  Monitor, 
  KeyRound, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Database,
  Lock,
  ChevronRight,
  ArrowLeft,
  Info,
  Image as ImageIcon,
  RotateCcw,
  History,
  Search,
  Trash2,
  ShieldCheck,
  Shield,
  Smartphone,
  Laptop,
  Globe,
  ExternalLink,
  Save,
  Palette
, Activity} from 'lucide-react';
import {   Logo155UASU } from './Logo155UASU';
import {   UserManagementTab } from './UserManagementTab';
import {   UserRole, ThemePreference, DetailedUserLogin, UserLoginStatus, UserLoginRole, Rank, FlightName } from '../types';
import { getCustomDuties, saveCustomDuties, addCustomDuty, removeCustomDuty, CustomDutyConfig } from '../utils/customDuties';
import {   subscribeToActiveUsers, subscribeToLoginHistory } from '../services/presenceService';
import {   getLoginHistory, clearLoginHistory, UserLoginLog, getDetailedUsers, toggleUserLoginStatus, saveDetailedUsers, changeUserPassword, changeAdminPassword, changeUserRole, getCurrentUserSession } from '../utils/authSession';
import {   localDb, getSyncLogs, SyncLog } from '../services/localDatabase';

import { CustomDutiesTab } from './CustomDutiesTab';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  userFlight?: string;
  nominalAirmen: any[];
  currentTheme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onOpenAdminLogin: () => void;
  
  onOpenUserManagement?: () => void;
  onRosterUpdated?: () => void;
}

type SettingSection = 'appearance' | 'cloudsync' | 'users' | 'security' | 'database' | 'history' | 'appManagement';

export 
const Countdown = ({ endTime }: { endTime: string }) => {
  const [timeLeft, setTimeLeft] = React.useState('');
  
  React.useEffect(() => {
    if (!endTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const distance = end - now;
      
      if (distance < 0) {
        setTimeLeft('Expired');
        clearInterval(interval);
        return;
      }
      
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);


  return () => clearInterval(interval);
  }, [endTime]);

  return <span className="ml-2 font-mono bg-emerald-200 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded text-[10px] text-emerald-800 dark:text-emerald-300">Remaining: {timeLeft || '...'}</span>;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  nominalAirmen,
  onOpenUserManagement,
  isOpen,
  onClose,
  role,
  userFlight,
  currentTheme,
  onThemeChange,
  onOpenAdminLogin,
  onRosterUpdated,
}) => {
  const [activeSection, setActiveSection] = useState<SettingSection | null>(null);
  const [appManagementTab, setAppManagementTab] = useState<'notice' | 'maintenance'>('notice');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Security Tab State
  const [adminCurrentPasscode, setAdminCurrentPasscode] = useState('');
  const [adminNewPasscode, setAdminNewPasscode] = useState('');
  const [adminConfirmPasscode, setAdminConfirmPasscode] = useState('');
  const [adminPasscodeError, setAdminPasscodeError] = useState('');
  const [adminPasscodeSuccess, setAdminPasscodeSuccess] = useState('');
  const [isUpdatingAdminPasscode, setIsUpdatingAdminPasscode] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [passcodeSuccess, setPasscodeSuccess] = useState('');
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);

  
  const [syncLogsState, setSyncLogsState] = useState<SyncLog[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  useEffect(() => {
    if (isOpen) {
      setSyncLogsState(getSyncLogs());
    }
  }, [isOpen]);
  useEffect(() => {
    const handleSyncLog = (e: any) => {
      setSyncLogsState(e.detail);
    };
    const handleProgress = (e: any) => {
      setSyncProgress(e.detail.percentage);
      setSyncMessage(e.detail.message);
    };
    window.addEventListener('baf_sync_logs_updated', handleSyncLog);
    window.addEventListener('baf_sync_progress', handleProgress);
    return () => {
       window.removeEventListener('baf_sync_logs_updated', handleSyncLog);
       window.removeEventListener('baf_sync_progress', handleProgress);
    };
  }, []);

  // Login History State
  const [loginHistory, setLoginHistory] = useState<UserLoginLog[]>([]);
  
    const [appConfig, setAppConfig] = useState<AppConfig>(getAppConfig());
  const [appConfigHistory, setAppConfigHistory] = useState<AppConfigHistoryItem[]>([]);
  
  // Draft states for forms
  const formatDateForInput = (date: Date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  };
  
  const [noticeDraft, setNoticeDraft] = useState({
    heading: '',
    message: '',
    isScheduled: false,
    startTime: formatDateForInput(new Date()),
    endTime: ''
  });
  
  const [maintDraft, setMaintDraft] = useState({
    message: '',
    isScheduled: false,
    startTime: formatDateForInput(new Date()),
    endTime: ''
  });
  
  useEffect(() => {
    setAppConfigHistory(getAppConfigHistory());
  }, []);
  
  const applyTimePreset = (setter: any, currentDraft: any, minutes: number) => {
    const start = new Date();
    const end = new Date(start.getTime() + minutes * 60000);
    setter({
      ...currentDraft,
      isScheduled: true,
      startTime: formatDateForInput(start),
      endTime: formatDateForInput(end)
    });
  };
  
  const handleSaveNotice = () => {
    const updatedConfig = {
      ...appConfig,
      notice: {
        isActive: true,
        heading: noticeDraft.heading || 'Important Notice',
        message: noticeDraft.message,
        isScheduled: noticeDraft.isScheduled,
        startTime: noticeDraft.isScheduled ? noticeDraft.startTime : undefined,
        endTime: noticeDraft.isScheduled ? noticeDraft.endTime : undefined,
      }
    };
    saveAppConfig(updatedConfig);
    setAppConfig(updatedConfig);
    localStorage.removeItem('baf_dismissed_notice_sig');
    
    const history = addAppConfigHistory({
      type: 'NOTICE',
      heading: noticeDraft.heading || 'Important Notice',
      message: noticeDraft.message,
      startTime: noticeDraft.isScheduled ? noticeDraft.startTime : undefined,
      endTime: noticeDraft.isScheduled ? noticeDraft.endTime : undefined,
      isActive: true
    });
    setAppConfigHistory(history);
    
    // Reset draft
    setNoticeDraft({
      heading: '',
      message: '',
      isScheduled: false,
      startTime: formatDateForInput(new Date()),
      endTime: ''
    });
  };
  
  const handleSaveMaintenance = () => {
    const updatedConfig = {
      ...appConfig,
      maintenance: {
        isActive: true,
        message: maintDraft.message,
        isScheduled: maintDraft.isScheduled,
        startTime: maintDraft.isScheduled ? maintDraft.startTime : undefined,
        endTime: maintDraft.isScheduled ? maintDraft.endTime : undefined,
      }
    };
    saveAppConfig(updatedConfig);
    setAppConfig(updatedConfig);
    
    const history = addAppConfigHistory({
      type: 'MAINTENANCE',
      message: maintDraft.message,
      startTime: maintDraft.isScheduled ? maintDraft.startTime : undefined,
      endTime: maintDraft.isScheduled ? maintDraft.endTime : undefined,
      isActive: true
    });
    setAppConfigHistory(history);
    
    // Reset draft
    setMaintDraft({
      message: '',
      isScheduled: false,
      startTime: formatDateForInput(new Date()),
      endTime: ''
    });
  };
  
  const handleStopFeature = (type: 'NOTICE' | 'MAINTENANCE', historyId: string) => {
    if (type === 'NOTICE') {
      const updatedConfig = { ...appConfig, notice: { ...appConfig.notice, isActive: false } };
      saveAppConfig(updatedConfig);
      setAppConfig(updatedConfig);
    } else {
      const updatedConfig = { ...appConfig, maintenance: { ...appConfig.maintenance, isActive: false } };
      saveAppConfig(updatedConfig);
      setAppConfig(updatedConfig);
    }
    const history = updateAppConfigHistoryItemActiveStatus(historyId, false);
    setAppConfigHistory(history);
  };
  
  const confirmDeleteHistory = (id: string) => {
    const itemToDelete = appConfigHistory.find(item => item.id === id);
    if (itemToDelete) {
      if (itemToDelete.type === 'NOTICE' && appConfig.notice.isActive && appConfig.notice.message === itemToDelete.message) {
         const updatedConfig = { ...appConfig, notice: { ...appConfig.notice, isActive: false } };
         saveAppConfig(updatedConfig);
         setAppConfig(updatedConfig);
      }
      if (itemToDelete.type === 'MAINTENANCE' && appConfig.maintenance.isActive && appConfig.maintenance.message === itemToDelete.message) {
         const updatedConfig = { ...appConfig, maintenance: { ...appConfig.maintenance, isActive: false } };
         saveAppConfig(updatedConfig);
         setAppConfig(updatedConfig);
      }
    }
    const history = deleteAppConfigHistoryItem(id);
    setAppConfigHistory(history);
  };
  

  
  const [historySearch, setHistorySearch] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirmType, setClearAllConfirmType] = useState<'NOTICE' | 'MAINTENANCE' | null>(null);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [realtimeHistory, setRealtimeHistory] = useState<any[]>([]);
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<any>(null);

  // Detailed Users State
  const [detailedUsersList, setDetailedUsersList] = useState<DetailedUserLogin[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState<string>('');

  // Database Backup State
  const [restoreStatus, setRestoreStatus] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [editingPasswordType, setEditingPasswordType] = useState<'portal' | 'admin' | null>(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  useEffect(() => {
    if (true) {
      const unsubUsers = subscribeToActiveUsers((users) => {
        setActiveUsers(users);
      });
      const unsubHistory = subscribeToLoginHistory((logs) => {
        setRealtimeHistory(logs);
      });
      return () => {
        unsubUsers();
        unsubHistory();
      };
    }
  }, [role]);

  useEffect(() => {
    if (isOpen) {
      setPasscodeError('');
      setPasscodeSuccess('');
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setRestoreStatus('');
      setLoginHistory(getLoginHistory());
      setDetailedUsersList(getDetailedUsers());
      setActiveSection(null);
    }
  }, [isOpen]);

  const handleUpdateAdminPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasscodeError('');
    setAdminPasscodeSuccess('');

    if (!adminCurrentPasscode) {
      setAdminPasscodeError('Please enter your current admin password.');
      return;
    }
    if (!adminNewPasscode) {
      setAdminPasscodeError('Please enter a new admin password.');
      return;
    }
    if (adminNewPasscode !== adminConfirmPasscode) {
      setAdminPasscodeError('New admin password and confirm password do not match.');
      return;
    }

    setIsUpdatingAdminPasscode(true);
    try {
      const session = getCurrentUserSession();
      if (!session) {
        setAdminPasscodeError('You are not logged in.');
        return;
      }
      
      const res = changeAdminPassword(session.bdNo, adminCurrentPasscode, adminNewPasscode, false);
      
      if (res.success) {
        setAdminPasscodeSuccess('Admin PIN successfully updated!');
        setAdminCurrentPasscode('');
        setAdminNewPasscode('');
        setAdminConfirmPasscode('');
        setTimeout(() => {
          onClose(); // Auto-close on success
        }, 1000);
      } else {
        setAdminPasscodeError(res.message);
      }
    } catch (err: any) {
      setAdminPasscodeError('Error updating admin password.');
    } finally {
      setIsUpdatingAdminPasscode(false);
    }
  };

  const handleUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    setPasscodeSuccess('');

    if (!currentPasscode) {
      setPasscodeError('Please enter your current password.');
      return;
    }
    if (!newPasscode) {
      setPasscodeError('Please enter a new password.');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setPasscodeError('New password and confirm password do not match.');
      return;
    }

    setIsUpdatingPasscode(true);
    try {
      const session = getCurrentUserSession();
      if (!session) {
        setPasscodeError('You are not logged in.');
        return;
      }
      
      const res = changeUserPassword(session.bdNo, currentPasscode, newPasscode, false);
      
      if (res.success) {
        setPasscodeSuccess('Password successfully updated!');
        setCurrentPasscode('');
        setNewPasscode('');
        setConfirmPasscode('');
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setPasscodeError(res.message);
      }
    } catch (err: any) {
      setPasscodeError('Error updating password.');
    } finally {
      setIsUpdatingPasscode(false);
    }
  };


  const handleDownloadCSV = async () => {
    setIsBackingUp(true);
    try {
      const backupData = typeof localDb.exportDatabase === 'function' 
        ? JSON.parse(localDb.exportDatabase()) 
        : (localDb as any).db;

      const downloadFile = (csvString: string, filename: string) => {
         const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = filename;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
      };

      // Export Airmen
      if (backupData.airmen && backupData.airmen.length > 0) {
         downloadFile(Papa.unparse(backupData.airmen), `155_UASU_Airmen_${new Date().toISOString().split('T')[0]}.csv`);
      }
      
      // Export Users
      const usersToExport = backupData.detailedUsers || (localDb as any).db.detailedUsers;
      if (usersToExport && usersToExport.length > 0) {
         downloadFile(Papa.unparse(usersToExport), `155_UASU_Users_${new Date().toISOString().split('T')[0]}.csv`);
      }

      // Export Assignments
      const allAssignments: any[] = [];
      const assignmentsObj = backupData.assignments || (localDb as any).db.assignments || {};
      for (const month in assignmentsObj) {
         assignmentsObj[month].forEach((a: any) => allAssignments.push({ month, ...a }));
      }
      if (allAssignments.length > 0) {
         downloadFile(Papa.unparse(allAssignments), `155_UASU_Assignments_${new Date().toISOString().split('T')[0]}.csv`);
      }
      
    } catch (err: any) {
      console.error('CSV Backup failed:', err);
      alert('Failed to generate CSV backup: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const backupData = await localDb.exportDatabase();
      const backupJson = typeof backupData === 'string' ? backupData : JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `155_UASU_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Backup failed:', err);
      alert('Failed to generate backup: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      alert("No file selected.");
      return;
    }

    setPendingRestoreFile(file);
    e.target.value = ''; // Reset input
  };

  const executeRestore = (file: File) => {
    setPendingRestoreFile(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let rawText = event.target?.result as string;
        
        if (file.name.toLowerCase().endsWith('.csv')) {
           setRestoreStatus('Importing CSV...');
           Papa.parse(rawText, {
             header: true,
             skipEmptyLines: true,
             complete: async (results) => {
                let backupData: any = { database: {} };
                const data = results.data as any[];
                const fields = results.meta.fields || [];
                
                if (fields.includes('bdNo') && fields.includes('rank') && fields.includes('name')) {
                   if (fields.includes('role') && fields.includes('password')) {
                      backupData.database.detailedUsers = data;
                   } else {
                      const parsedAirmen = data.map((d: any) => ({
                         ...d,
                         active: d.active === 'true' || d.active === 'TRUE' || d.active === true,
                         serNo: Number(d.serNo) || 0
                      }));
                      backupData.database.airmen = parsedAirmen;
                   }
                } else if (fields.includes('airmanId') && fields.includes('dutyCode')) {
                   const assignmentsObj: any = {};
                   data.forEach((d: any) => {
                      const month = d.month || d.date.substring(0, 7);
                      if (!assignmentsObj[month]) assignmentsObj[month] = [];
                      assignmentsObj[month].push(d);
                   });
                   backupData.database.assignments = assignmentsObj;
                } else {
                   setRestoreStatus('❌ Unknown CSV format. Cannot identify data table.');
                   return;
                }
                
                const success = await localDb.restoreDatabase(backupData);
                if (success) {
                  setRestoreStatus(`✅ CSV Restore complete! Please refresh the page to apply changes.`);
                  if (onRosterUpdated) onRosterUpdated();
                } else {
                  setRestoreStatus('❌ CSV Restore failed.');
                }
             }
           });
           return;
        }

        // Clean up markdown code blocks if any
        rawText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
        
        let backupData;
        try {
          backupData = JSON.parse(rawText);
          while (typeof backupData === 'string') {
            backupData = JSON.parse(backupData);
          }
        } catch (err) {
          // Fallback: If it's literally escaped characters pasted into a text file
          let unescaped = rawText.replace(/\\n/g, '').replace(/\\"/g, '"').trim();
          if (unescaped.startsWith('"') && unescaped.endsWith('"')) {
            unescaped = unescaped.substring(1, unescaped.length - 1);
          }
          try {
            backupData = JSON.parse(unescaped);
          } catch(e2) {
            throw new Error('Could not parse file content. Please ensure it is a valid JSON file.');
          }
        }

        setRestoreStatus('Importing backup to local database...');
        
        const success = await localDb.restoreDatabase(backupData);
        if (success) {
          setRestoreStatus('✅ Database restore complete! Please refresh the page to apply changes.');
          if (onRosterUpdated) {
            onRosterUpdated();
          }
        } else {
          setRestoreStatus('❌ Invalid backup file format. Missing required data.');
          alert('Invalid backup file format. Missing required data (e.g. airmen, assignments).');
        }
      } catch (err: any) {
        console.error('Restore failed:', err);
        setRestoreStatus(`❌ Error restoring database: ${err.message}`);
        alert(`Restore Error: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setRestoreStatus('❌ Error reading the file.');
      alert('Error reading the file.');
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const sections = [
    { id: 'appearance', label: 'Theme & Appearance', icon: <Palette className="w-5 h-5" />, color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400' },
    ...((role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN') ? [{ id: 'cloudsync', label: 'Database Cloud Sync', icon: <Cloud className="w-5 h-5" />, color: 'text-blue-500 bg-blue-100 dark:bg-blue-950 dark:text-blue-400' }] : []),
    ...((role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN') ? [
      { id: 'appNotice', label: 'App Notice', icon: <Megaphone className="w-5 h-5" />, color: 'text-orange-500 bg-orange-100 dark:bg-orange-950 dark:text-orange-400' },
      { id: 'maintenanceMode', label: 'Maintenance Mode', icon: <Wrench className="w-5 h-5" />, color: 'text-red-500 bg-red-100 dark:bg-red-950 dark:text-red-400' }
    ] : []),
    ...((role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN') ? [{ id: 'users', label: 'User Management', icon: <ShieldCheck className="w-5 h-5" />, color: 'text-purple-500 bg-purple-100 dark:bg-purple-950 dark:text-purple-400' }] : []),
    { id: 'security', label: 'Security & Passcode', icon: <Lock className="w-5 h-5" />, color: 'text-amber-500 bg-amber-100 dark:bg-amber-950 dark:text-amber-400' },
    ...((role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN') ? [{ id: 'database', label: 'Backup & Restore', icon: <Database className="w-5 h-5" />, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400' }] : []),
    ...((role === 'SUPER_ADMIN' || role === 'OWNER') ? [{ id: 'history', label: 'Login History', icon: <History className="w-5 h-5" />, color: 'text-sky-500 bg-sky-100 dark:bg-sky-950 dark:text-sky-400' }] : []),
  ];

  const getSectionTitle = (id: SettingSection) => {
    return sections.find(s => s.id === id)?.label || 'Settings';
  };

  const handleDeleteHistoryItem = (item: any) => {
    const updated = appConfigHistory.filter(h => h.id !== item.id);
    setAppConfigHistory(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-8">
      {pendingRestoreFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 animate-fadeIn">
            <h3 className="text-xl font-black text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" /> Warning: Data Overwrite
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
              Restoring from this backup file will <strong>OVERWRITE</strong> the current database completely. All recent unsynced changes will be lost.
              <br /><br />
              Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPendingRestoreFile(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => executeRestore(pendingRestoreFile)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer shadow-md shadow-red-500/20"
              >
                Yes, Overwrite Data
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Single Pane View for All Screens */}
      <div className="w-full max-w-3xl h-full sm:h-[85vh] bg-white dark:bg-[#1e293b] border-0 sm:border border-slate-200 dark:border-slate-700 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Menu View (Shown when no activeSection is selected) */}
        <div className={`w-full h-full bg-slate-50 dark:bg-slate-900 flex-col shrink-0 ${!activeSection ? 'flex' : 'hidden'}`}>
          <div className="p-6 pb-2 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-500" />
              Settings
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-col overflow-y-auto flex-1 px-4 pb-4 sm:pb-6 gap-2 sm:gap-3 mt-4 scrollbar-hide">
            {sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => {
                  if (sec.id === 'users' && onOpenUserManagement) {
                    onOpenUserManagement();
                  } else {
                    setActiveSection(sec.id as SettingSection);
                  }
                }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer text-left mb-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm font-medium hover:shadow-md`}
              >
                <div className="text-slate-500 dark:text-slate-400">
                  {sec.icon}
                </div>
                <span className="text-base flex-1">{sec.label}</span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Detail View (Shown when an activeSection is selected) */}
        <div className={`flex-1 w-full h-full bg-white dark:bg-[#1e293b] flex-col relative overflow-hidden ${!activeSection ? 'hidden' : 'flex'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1e293b]">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveSection(null)}
                className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {getSectionTitle(activeSection || 'appearance')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 h-full overflow-hidden flex flex-col bg-white dark:bg-[#1e293b]">
            {activeSection !== 'users' ? (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <div className="max-w-3xl mx-auto space-y-8">
                  {/* Appearance */}
                  {activeSection === 'appearance' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                          <Palette className="w-5 h-5 text-indigo-500" />
                          Theme Preference
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {[
                            { id: 'system', label: 'System Theme', icon: <Monitor className="w-5 h-5" /> },
                            { id: 'light', label: 'Light Mode', icon: <Sun className="w-5 h-5" /> },
                            { id: 'dark', label: 'Dark Mode', icon: <Moon className="w-5 h-5" /> }
                          ].map((themeOpt) => (
                            <button
                              key={themeOpt.id}
                              onClick={() => onThemeChange(themeOpt.id)}
                              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${currentTheme === themeOpt.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
                            >
                              {themeOpt.icon}
                              <span className="mt-2 text-sm font-bold">{themeOpt.label}</span>
                            </button>
                          ))}
                        </div>
</div>
</div>)}

                  {/* Cloud Sync */}
                  {activeSection === 'cloudsync' && (role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN') && (
                    <div className="space-y-6 animate-fadeIn max-w-md mx-auto">
                      <div className="flex flex-col items-center justify-center p-8 text-center bg-transparent">
                        <div className="w-16 h-16 rounded-full bg-[#1e2b4d] flex items-center justify-center mb-6">
                          <Cloud className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Database Cloud Sync</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
                          Manually push your local changes or pull updates from the central Firebase database.
                        </p>

                        {(restoreStatus === 'Uploading...' || restoreStatus === 'Downloading...') && syncProgress >= 0 && syncProgress <= 100 && (
                          <div className="w-full mb-6 max-w-sm mx-auto">
                             <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{syncMessage || 'Processing...'}</span>
                               <span className="text-xs font-bold text-slate-300">{syncProgress}%</span>
                             </div>
                             <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                               <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${syncProgress}%` }}></div>
                             </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={async () => {
                              setRestoreStatus('Uploading...');
                              setSyncProgress(1);
                              setSyncMessage('Preparing data...');
                              
                              const success = await localDb.saveToFirebase(localDb.getDb(), true);
                              
                              if (success) {
                                setSyncProgress(100);
                                setSyncMessage('Upload Completed!');
                                setSyncLogsState(getSyncLogs());
                                setTimeout(() => {
                                   setRestoreStatus('');
                                   setSyncProgress(0);
                                   if (onRosterUpdated) onRosterUpdated();
                                }, 1500);
                              } else {
                                const logs = getSyncLogs();
                                const lastLog = logs.find(l => l.type === 'PUSH' && l.status === 'ERROR');
                                alert('Upload Failed: ' + (lastLog?.message || 'Unknown error.'));
                                setSyncMessage('Upload Failed!');
                                setSyncLogsState(logs);
                                setTimeout(() => {
                                   setRestoreStatus('');
                                   setSyncProgress(0);
                                }, 2000);
                              }
                            }} 
                            disabled={restoreStatus === 'Uploading...' || restoreStatus === 'Downloading...'}
                            className="relative group w-full overflow-hidden rounded-xl p-[1px] transition-all hover:shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/40 to-indigo-600/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="relative flex flex-row items-center justify-center gap-2 w-full h-full bg-[#1e293b] px-4 py-3.5 rounded-xl border border-slate-700/50 transition-colors group-hover:bg-[#1e293b]/80">
                               <Upload className={`w-4 h-4 text-blue-400 ${restoreStatus === 'Uploading...' ? 'animate-bounce' : ''}`} />
                               <span className="text-sm font-medium tracking-wide text-slate-200 group-hover:text-white transition-colors">
                                  {restoreStatus === 'Uploading...' && syncProgress === 100 ? 'Success!' : restoreStatus === 'Uploading...' ? 'Uploading...' : 'Push to Cloud'}
                               </span>
                            </div>
                          </button>
                          <button 
                            onClick={async () => {
                              setRestoreStatus('Downloading...');
                              setSyncProgress(10);
                              setSyncMessage('Pulling updates from Cloud...');
                              
                              const success = await localDb.syncFromFirebase();
                              
                              if (success) {
                                setSyncProgress(100);
                                setSyncMessage('Download Completed!');
                                setSyncLogsState(getSyncLogs());
                                setTimeout(() => {
                                   setRestoreStatus('');
                                   setSyncProgress(0);
                                   if (onRosterUpdated) onRosterUpdated();
                                   window.location.reload();
                                }, 1500);
                              } else {
                                setSyncMessage('Download Failed!');
                                setSyncLogsState(getSyncLogs());
                                setTimeout(() => {
                                   setRestoreStatus('');
                                   setSyncProgress(0);
                                }, 2000);
                              }
                            }} 
                            disabled={restoreStatus === 'Uploading...' || restoreStatus === 'Downloading...'}
                            className="relative group w-full overflow-hidden rounded-xl p-[1px] transition-all hover:shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/40 to-teal-600/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="relative flex flex-row items-center justify-center gap-2 w-full h-full bg-[#1e293b] px-4 py-3.5 rounded-xl border border-slate-700/50 transition-colors group-hover:bg-[#1e293b]/80">
                               <Download className={`w-4 h-4 text-emerald-400 ${restoreStatus === 'Downloading...' ? 'animate-bounce' : ''}`} />
                               <span className="text-sm font-medium tracking-wide text-slate-200 group-hover:text-white transition-colors">
                                  {restoreStatus === 'Downloading...' && syncProgress === 100 ? 'Success!' : restoreStatus === 'Downloading...' ? 'Downloading...' : 'Pull from Cloud'}
                               </span>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="mt-8">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 px-2">Recent Sync Logs</h4>
                        {syncLogsState.length === 0 ? (
                          <div className="text-center py-8 bg-slate-800/30 rounded-2xl">
                            <p className="text-sm font-bold text-slate-500">No recent logs.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {syncLogsState.map((log: any) => (
                              <div key={log.id} className="p-4 bg-[#1b2234] border border-slate-700/50 rounded-xl flex justify-between items-start">
                                <div className="flex gap-3">
                                  <div className="pt-1.5 shrink-0">
                                    <div className={`w-2.5 h-2.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-white mb-1">
                                      {log.type === 'PULL' ? 'Downloaded from Cloud' : 'Uploaded to Cloud'}
                                    </p>
                                    <p className="text-xs text-slate-400">{log.message}</p>
                                  </div>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono text-right shrink-0 mt-1">
                                  {new Date(log.timestamp).toLocaleDateString()}<br/>
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}


              
              
              
              
              {activeSection === 'appNotice' && (role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <div className="space-y-6 animate-fadeIn max-w-2xl">
                    {appConfig.notice.isActive && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fadeIn">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Megaphone className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Notice is Currently Live</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                Active
                              </span>
                              {appConfig.notice.isScheduled && appConfig.notice.endTime && (
                                <Countdown endTime={appConfig.notice.endTime} />
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                              {appConfig.notice.heading ? `${appConfig.notice.heading}: ` : ''}{appConfig.notice.message}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedConfig = { ...appConfig, notice: { ...appConfig.notice, isActive: false } };
                            saveAppConfig(updatedConfig);
                            setAppConfig(updatedConfig);
                            const activeItem = appConfigHistory.find(i => i.type === 'NOTICE' && i.isActive);
                            if (activeItem) {
                              setAppConfigHistory(updateAppConfigHistoryItemActiveStatus(activeItem.id, false));
                            }
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                        >
                          <PowerOff className="w-3.5 h-3.5" /> Stop Notice
                        </button>
                      </div>
                    )}

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Create New Notice</h3>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">Notice Heading</label>
                        <input type="text" value={noticeDraft.heading} onChange={(e) => setNoticeDraft({...noticeDraft, heading: e.target.value})} placeholder="e.g. Scheduled Maintenance" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">Notice Message <span className="text-rose-500">*</span></label>
                        <textarea value={noticeDraft.message} onChange={(e) => setNoticeDraft({...noticeDraft, message: e.target.value})} placeholder="Enter the detailed notice message here..." rows={4} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none" />
                      </div>

                      <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={noticeDraft.isScheduled} onChange={(e) => setNoticeDraft({...noticeDraft, isScheduled: e.target.checked})} className="w-5 h-5 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Schedule this notice (auto-expire)</span>
                        </label>
                      </div>

                      {noticeDraft.isScheduled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                           <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-500">Start Time</label>
                              <input type="datetime-local" value={noticeDraft.startTime} onChange={(e) => setNoticeDraft({...noticeDraft, startTime: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-500">End Time</label>
                              <input type="datetime-local" value={noticeDraft.endTime} onChange={(e) => setNoticeDraft({...noticeDraft, endTime: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                           </div>
                        </div>
                      )}

                      <div className="pt-4 flex justify-end">
                        <button disabled={!noticeDraft.message.trim()} onClick={handleSaveNotice} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center gap-2">
                          <Megaphone className="w-4 h-4" /> Publish Notice
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">Notice History</h3>
                      {appConfigHistory.filter(h => h.type === 'NOTICE').length === 0 ? (
                        <p className="text-sm text-slate-500">No notices in history.</p>
                      ) : (
                        <div className="space-y-3">
                          {appConfigHistory.filter(h => h.type === 'NOTICE').map(h => (
                            <div key={h.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{h.heading || 'Notice'}</p>
                                <p className="text-xs text-slate-500 line-clamp-1">{h.message}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{new Date(h.timestamp).toLocaleString()}</p>
                              </div>
                              <button onClick={() => handleDeleteHistoryItem(h)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>)}


        
        {activeSection === 'maintenanceMode' && (role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <div className="space-y-6 animate-fadeIn max-w-2xl">
                    {appConfig.maintenance.isActive && (
                      <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fadeIn">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Wrench className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-red-800 dark:text-red-300">Maintenance Mode is Active</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                                Live
                              </span>
                              {appConfig.maintenance.isScheduled && appConfig.maintenance.endTime && (
                                <Countdown endTime={appConfig.maintenance.endTime} />
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                              {appConfig.maintenance.message}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedConfig = { ...appConfig, maintenance: { ...appConfig.maintenance, isActive: false } };
                            saveAppConfig(updatedConfig);
                            setAppConfig(updatedConfig);
                            const activeItem = appConfigHistory.find(i => i.type === 'MAINTENANCE' && i.isActive);
                            if (activeItem) {
                              setAppConfigHistory(updateAppConfigHistoryItemActiveStatus(activeItem.id, false));
                            }
                          }}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                        >
                          <PowerOff className="w-3.5 h-3.5" /> Deactivate
                        </button>
                      </div>
                    )}

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">Activate Maintenance Mode</h3>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500">Maintenance Message <span className="text-rose-500">*</span></label>
                        <textarea value={maintDraft.message} onChange={(e) => setMaintDraft({...maintDraft, message: e.target.value})} placeholder="e.g. System is down for scheduled upgrades." rows={4} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none" />
                      </div>

                      <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={maintDraft.isScheduled} onChange={(e) => setMaintDraft({...maintDraft, isScheduled: e.target.checked})} className="w-5 h-5 text-red-600 rounded-md border-slate-300 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-900" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Schedule maintenance window</span>
                        </label>
                      </div>

                      {maintDraft.isScheduled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                           <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-500">Start Time</label>
                              <input type="datetime-local" value={maintDraft.startTime} onChange={(e) => setMaintDraft({...maintDraft, startTime: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-500">End Time</label>
                              <input type="datetime-local" value={maintDraft.endTime} onChange={(e) => setMaintDraft({...maintDraft, endTime: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white" />
                           </div>
                        </div>
                      )}

                      <div className="pt-4 flex justify-end">
                        <button disabled={!maintDraft.message.trim()} onClick={handleSaveMaintenance} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center gap-2">
                          <Wrench className="w-4 h-4" /> Enable Maintenance Mode
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">Maintenance History</h3>
                      {appConfigHistory.filter(h => h.type === 'MAINTENANCE').length === 0 ? (
                        <p className="text-sm text-slate-500">No maintenance records.</p>
                      ) : (
                        <div className="space-y-3">
                          {appConfigHistory.filter(h => h.type === 'MAINTENANCE').map(h => (
                            <div key={h.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Maintenance Mode</p>
                                <p className="text-xs text-slate-500 line-clamp-1">{h.message}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{new Date(h.timestamp).toLocaleString()}</p>
                              </div>
                              <button onClick={() => handleDeleteHistoryItem(h)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>)}


        
        


              {activeSection === 'security' && (
                <div className="space-y-6">
                  

                  {/* Passwords */}
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
                    
                    {/* Portal PIN Item */}
                    <div className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                          <KeyRound className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">Portal Login Password</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Used to access your account</p>
                        </div>
                      </div>
                      {editingPasswordType === 'portal' ? (
                        <form onSubmit={handleUpdatePasscode} className="flex flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                          <input type="password" placeholder="Current Password" value={currentPasscode} onChange={e => setCurrentPasscode(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm dark:text-white" />
                          <input type="password" placeholder="New Password" value={newPasscode} onChange={e => setNewPasscode(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm dark:text-white" />
                          <input type="password" placeholder="Confirm Password" value={confirmPasscode} onChange={e => setConfirmPasscode(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm dark:text-white" />
                          {passcodeError && <span className="text-rose-500 text-xs">{passcodeError}</span>}
                          {passcodeSuccess && <span className="text-emerald-500 text-xs">{passcodeSuccess}</span>}
                          <div className="flex gap-2">
                            <button type="submit" disabled={isUpdatingPasscode} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-1.5 text-sm font-bold transition-colors disabled:opacity-50">Save</button>
                            <button type="button" onClick={() => setEditingPasswordType(null)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg py-1.5 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <button onClick={() => setEditingPasswordType('portal')} className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                          Update
                        </button>
                      )}
                    </div>

                    {/* Admin PIN Item */}
                    {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
                      <div className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">Admin Access Password</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Used for elevated operations</p>
                          </div>
                        </div>
                        {editingPasswordType === 'admin' ? (
                          <form onSubmit={handleUpdateAdminPasscode} className="flex flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                            <input type="password" placeholder="Current Admin PIN" value={adminCurrentPasscode} onChange={e => setAdminCurrentPasscode(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm dark:text-white" />
                            <input type="password" placeholder="New Admin PIN" value={adminNewPasscode} onChange={e => setAdminNewPasscode(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm dark:text-white" />
                            <input type="password" placeholder="Confirm Admin PIN" value={adminConfirmPasscode} onChange={e => setAdminConfirmPasscode(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm dark:text-white" />
                            {adminPasscodeError && <span className="text-rose-500 text-xs">{adminPasscodeError}</span>}
                            {adminPasscodeSuccess && <span className="text-emerald-500 text-xs">{adminPasscodeSuccess}</span>}
                            <div className="flex gap-2">
                              <button type="submit" disabled={isUpdatingAdminPasscode} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg py-1.5 text-sm font-bold transition-colors disabled:opacity-50">Save</button>
                              <button type="button" onClick={() => setEditingPasswordType(null)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg py-1.5 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <button onClick={() => setEditingPasswordType('admin')} className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                            Update
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}

{activeSection === 'database' && (
            <div className="space-y-4">
              
              {restoreStatus && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 shadow-sm animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {restoreStatus}
                </div>
              )}

              <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Download className="w-4 h-4 text-amber-500" />
                    Export Local Backup
                  </h3>
                  <p className="text-xs text-slate-500">
                    Download complete roster, TDY, and leave records as a JSON file.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={isBackingUp}
                    className="w-full sm:flex-1 py-3 text-sm font-bold text-slate-800 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                  >
                    {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download JSON Backup
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    disabled={isBackingUp}
                    className="w-full sm:flex-1 py-3 text-sm font-bold text-slate-800 bg-emerald-400 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                  >
                    {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download CSV Backup
                  </button>
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Upload className="w-4 h-4 text-indigo-500" />
                    Restore Database
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload a JSON or CSV backup file. WARNING: This will overwrite current data.
                  </p>
                </div>
                <label className="w-full py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Upload Backup (JSON/CSV)
                  <input
                    type="file"
                    accept=".json,.csv"
                    onClick={(e) => { (e.target as any).value = null; }}
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}



{activeSection === 'history' && (role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <div className="space-y-6">
              
              {selectedHistoryUser ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 animate-fadeIn">
                  <div className="flex items-center justify-between mb-6">
                    <button 
                      onClick={() => setSelectedHistoryUser(null)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">User Activity</h3>
                    <div className="w-9"></div>
                  </div>

                  <div className="flex items-center gap-4 mb-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        {selectedHistoryUser.rank} {selectedHistoryUser.name}
                      </div>
                      <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {selectedHistoryUser.bdNo}
                      </div>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Timeline
                  </h4>
                  <div className="space-y-6">
                    <div className="relative pl-6 border-l-2 border-emerald-200 dark:border-emerald-900/50">
                      <div className="absolute w-3 h-3 bg-emerald-500 rounded-full -left-[7px] top-1 border-2 border-white dark:border-slate-800"></div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">Logged In</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">System Login</p>
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                        {new Date(selectedHistoryUser.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                      <div className="absolute w-3 h-3 bg-slate-400 rounded-full -left-[7px] top-1 border-2 border-white dark:border-slate-800"></div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">System Access</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Only View Dashboard</p>
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                        {new Date(new Date(selectedHistoryUser.timestamp).getTime() + 60000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Users Section */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      Currently Active ({activeUsers.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {activeUsers.length === 0 ? (
                        <span className="text-xs text-slate-500 italic">No other active users</span>
                      ) : (
                        activeUsers.map(u => (
                          <div key={u.bdNo} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              {formatAirmanName(u.rank)} {u.name} - ({u.page || 'Dashboard'}) - {u.role === 'OWNER' ? 'Owner' : u.role === 'SUPER_ADMIN' ? 'Super Admin' : u.role === 'ADMIN' ? 'Admin' : 'User'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Realtime Login History Section */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 flex items-center bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <Search className="w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search realtime logs..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full bg-transparent border-none text-xs font-bold text-slate-900 dark:text-white px-3 py-1 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 max-h-[60vh] overflow-y-auto shadow-sm">
                    {(() => {
                      const filtered = realtimeHistory.filter(log => {
                        if (!historySearch.trim()) return true;
                        const q = historySearch.toLowerCase();
                        return (
                          log.bdNo?.toLowerCase().includes(q) ||
                          log.name?.toLowerCase().includes(q) ||
                          log.rank?.toLowerCase().includes(q) ||
                          log.flightName?.toLowerCase().includes(q)
                        );
                      });
                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-bold">No realtime login history found</p>
                          </div>
                        );
                      }
                      return filtered.map(log => (
                        <div 
                          key={log.id} 
                          onClick={() => setSelectedHistoryUser(log)}
                          className="p-4 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex justify-between items-center cursor-pointer"
                        >
                          <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                              {log.rank} {log.name}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 font-bold uppercase tracking-wider">
                                {log.role === 'OWNER' ? 'Owner' : log.role === 'SUPER_ADMIN' ? 'Super Admin' : log.role === 'ADMIN' ? 'Admin' : 'User'}
                              </span>
                            </div>
                            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                              {log.bdNo} • {log.flightName}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-medium">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="flex-1 h-full overflow-hidden">
        {activeSection === "users" && (role === "SUPER_ADMIN" || role === "ADMIN" || role === "OWNER") && (
          <UserManagementTab nominalAirmen={nominalAirmen} userSessionRole={role} userFlight={userFlight} />
        )}
      </div>
    )}
  </div>
</div>
        {/* Modals */}
        
        {/* Delete Single History Item Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Delete Record?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Are you sure you want to delete this record from history? If this notice or maintenance is currently live, it will also be stopped.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    confirmDeleteHistory(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Confirmation Modal */}
        {clearAllConfirmType && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                Clear All {clearAllConfirmType === 'NOTICE' ? 'Notices' : 'Maintenance Records'}?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                This will delete all {clearAllConfirmType === 'NOTICE' ? 'notice' : 'maintenance'} history items and immediately deactivate any live {clearAllConfirmType === 'NOTICE' ? 'notice' : 'maintenance'} popup.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setClearAllConfirmType(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (clearAllConfirmType === 'NOTICE') {
                      const updatedConfig = { ...appConfig, notice: { ...appConfig.notice, isActive: false, message: '' } };
                      saveAppConfig(updatedConfig);
                      setAppConfig(updatedConfig);
                    } else {
                      const updatedConfig = { ...appConfig, maintenance: { ...appConfig.maintenance, isActive: false, message: '' } };
                      saveAppConfig(updatedConfig);
                      setAppConfig(updatedConfig);
                    }
                    const remaining = appConfigHistory.filter(i => i.type !== clearAllConfirmType);
                    localStorage.setItem('baf_app_config_history', JSON.stringify(remaining));
                    setAppConfigHistory(remaining);
                    setClearAllConfirmType(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
