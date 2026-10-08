import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Image as ImageIcon,
  Shield,
  ShieldCheck,
  Loader2,
  Save,
  Check,
  FileText,
  LayoutGrid,
  List,
  Award,
  Edit3,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl, getCanteenConfig, saveCanteenConfig, CanteenConfig } from '../utils/canteenSettings';
import { processGalleryImage } from '../utils/imageUpload';
import { SaveButton } from '../components/SaveButton';
import { sortCanteenMembersByOfficeSeniority, normalizeCanteenMembersSeniority, getRankWeight } from '../utils/canteenSeniority';
import { EditMemberSeniorityModal } from '../components/EditMemberSeniorityModal';
import { saveMemberSeniority, getLocalSeniorityMap } from '../utils/memberSeniority';
import { 
  getMemberBanglaName, 
  saveMemberBanglaName,
  getMemberBanglaRank,
  saveMemberBanglaRank,
  BAF_RANKS_WITH_BN 
} from '../utils/memberBanglaNames';
import { getCanteenMembersCache, fetchCanteenMembersOnce, setCanteenMembersCache } from '../utils/canteenMenuData';
import { playCelebrationSound } from '../utils/audioFeedback';
import { queuePushKeyToCloud } from '../utils/canteenCloudSync';

// Export getRankWeight from canteenSeniority
export { getRankWeight };

export interface ExcelMemberRow {
  bdNo: string;
  rank: string;
  surname: string;
  contact: string;
  role: string;
  isValid: boolean;
  error?: string;
}

export const CanteenMemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OFFICER' | 'AIRMEN' | 'CIV'>('ALL');
  const [viewMode, setViewMode] = useState<'BOX' | 'TABLE'>('BOX');
  
  // Active Canteen Manager State (Managed directly from Member DB)
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerSearchTerm, setManagerSearchTerm] = useState('');
  const [systemKeyInput, setSystemKeyInput] = useState<string>(() => (getCanteenConfig()?.password || '1111'));
  const [showSystemKeyInModal, setShowSystemKeyInModal] = useState<boolean>(false);
  const [keySaveSuccess, setKeySaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (showManagerModal) {
      setSystemKeyInput(canteenConfig?.password || '1111');
      setKeySaveSuccess(false);
    }
  }, [showManagerModal, canteenConfig?.password]);

  const handleSaveSystemKey = () => {
    const cleanKey = systemKeyInput.trim();
    if (!cleanKey || cleanKey.length < 4) {
      alert('সিস্টেম কি অবশ্যই কমপক্ষে ৪ ডিজিটের হতে হবে (System Key must be at least 4 digits)');
      return;
    }
    const updated: CanteenConfig = {
      ...canteenConfig,
      password: cleanKey
    };
    setCanteenConfig(updated);
    saveCanteenConfig(updated);
    setKeySaveSuccess(true);
    showToast(`ম্যানেজার সিস্টেম কি সফলভাবে পরিবর্তন করা হয়েছে: ${cleanKey}`);
    setTimeout(() => setKeySaveSuccess(false), 3000);
  };

  const [members, setMembers] = useState<any[]>(() => {
    const cached = getCanteenMembersCache();
    if (cached && cached.length > 0) return cached;
    try {
      const stored = localStorage.getItem('canteen_members_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getCanteenMembersCache();
    return !(cached && cached.length > 0);
  });

  // Calculate total counts for filter pills: All, Officer, Airmen, Civ
  const roleCounts = useMemo(() => {
    let officerCount = 0;
    let airmenCount = 0;
    let civCount = 0;
    members.forEach((m) => {
      const weight = getRankWeight(m['Rank']);
      if (weight >= 1 && weight <= 11) {
        officerCount++;
      } else if (weight >= 20 && weight <= 39) {
        airmenCount++;
      } else {
        civCount++;
      }
    });
    return {
      ALL: members.length,
      OFFICER: officerCount,
      AIRMEN: airmenCount,
      CIV: civCount,
    };
  }, [members]);

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'excel'>('single');

  // Single Member Form State (No role required - all are members except selected manager)
  const [singleMember, setSingleMember] = useState({
    bdNo: '',
    rank: 'LAC',
    rankBn: 'এলএসি',
    surname: '',
    nameBn: '',
    contact: '',
    dp: ''
  });
  const [isSavingSingle, setIsSavingSingle] = useState(false);
  const [isSavedSingle, setIsSavedSingle] = useState(false);
  const [resolvingDp, setResolvingDp] = useState(false);

  // Excel Bulk Import State
  const [excelRows, setExcelRows] = useState<ExcelMemberRow[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelPasteText, setExcelPasteText] = useState('');
  const [isSavingExcel, setIsSavingExcel] = useState(false);
  const [excelSaveSuccess, setExcelSaveSuccess] = useState(false);
  const [excelSaveProgress, setExcelSaveProgress] = useState({ saved: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Member Modal State
  const [editMember, setEditMember] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavedEdit, setIsSavedEdit] = useState(false);

  // Seniority Management Modal State
  const [seniorityEditMember, setSeniorityEditMember] = useState<any | null>(null);

  // Delete Member Confirm State
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<{
    bdNo: string;
    name: string;
    rank: string;
    nameBn?: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real-time checks for BD Number Uniqueness
  const isDuplicateAddBd = useMemo(() => {
    const clean = String(singleMember.bdNo || '').replace(/\D/g, '').trim();
    if (!clean) return false;
    return members.some(m => String(m['BD No'] || '').replace(/\D/g, '') === clean);
  }, [singleMember.bdNo, members]);

  const isDuplicateEditBd = useMemo(() => {
    if (!editMember) return false;
    const clean = String(editMember['BD No'] || '').replace(/\D/g, '').trim();
    if (!clean) return false;
    const originalAirmanId = editMember.originalAirmanId || editMember.airman_id;
    const originalBdClean = String(editMember.originalBdNo || originalAirmanId || '').replace(/\D/g, '');
    return members.some(m => {
      const origAid = String(originalAirmanId || '').toLowerCase();
      const mAid = String(m.airman_id || '').toLowerCase();
      if (origAid && mAid && origAid === mAid) return false;
      const mBd = String(m['BD No'] || '').replace(/\D/g, '');
      if (originalBdClean && mBd === originalBdClean) return false;
      return mBd === clean;
    });
  }, [editMember, members]);

  // Helper to format & sort members with strictly normalized seniority numbers
  const sortMembers = (data: any[]) => {
    const localSeniorityMap = getLocalSeniorityMap();
    const formatted = (data || [])
      .filter((m: any) => {
        if (!m) return false;
        const bd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
        return bd !== '48456';
      })
      .map((m: any) => {
        const cleanBd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
        const cloudSen = (m.Seniority !== undefined && m.Seniority !== null && !isNaN(Number(m.Seniority)))
          ? Number(m.Seniority)
          : ((m.seniority !== undefined && m.seniority !== null && !isNaN(Number(m.seniority)))
            ? Number(m.seniority)
            : undefined);
        const manualSen = cloudSen !== undefined ? cloudSen : (cleanBd ? localSeniorityMap[cleanBd] : undefined);
        const cloudRankBn = String(m.Rank_BN || m['Rank_BN'] || m.rank_bn || m.rankBn || '').trim();
        const rankBn = cloudRankBn || getMemberBanglaRank(m);
        return {
          ...m,
          airman_id: m.airman_id || (cleanBd ? `airman-${cleanBd}` : `mem_${Math.random().toString(36).slice(2)}`),
          "BD No": String(m['BD No'] || cleanBd || '').trim(),
          "Rank": String(m['Rank'] || 'LAC').trim(),
          "Surname": String(m['Surname'] || '').trim(),
          "Contact": String(m['Contact'] || m['Mobile No'] || '').trim(),
          Role: m.Role ?? m.role ?? 'Member',
          Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
          DP: m.DP || '',
          seniority: manualSen,
          Seniority: manualSen,
          Rank_BN: rankBn,
          rank_bn: rankBn,
          rankBn: rankBn
        };
      });

    return normalizeCanteenMembersSeniority(sortCanteenMembersByOfficeSeniority(formatted));
  };

  // Fetch Members from Supabase Cloud (Protected against infinite loops)
  const isFetchingRef = useRef(false);
  const fetchMembersFromCloud = async (showLoader = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (showLoader && members.length === 0) setLoading(true);
    try {
      const data = await fetchCanteenMembersOnce(showLoader);
      if (data && data.length > 0) {
        setMembers((prevMembers) => {
          const currentContactMap = new Map<string, string>();
          (prevMembers || []).forEach(m => {
            const k = String(m.airman_id || m['BD No'] || '').trim();
            const c = String(m.Contact || m['Mobile No'] || '').trim();
            if (k && c) currentContactMap.set(k, c);
          });

          const mergedData = data.map((cloudM: any) => {
            const k = String(cloudM.airman_id || cloudM['BD No'] || '').trim();
            const existingContact = currentContactMap.get(k) || '';
            const cloudContact = String(cloudM.Contact || cloudM['Mobile No'] || '').trim();
            return {
              ...cloudM,
              Contact: cloudContact || existingContact || ''
            };
          });

          const sorted = sortMembers(mergedData);
          try {
            localStorage.setItem('canteen_members_cache', JSON.stringify(sorted));
          } catch {}
          return sorted;
        });
      }
    } catch (err) {
      console.warn('Error fetching Canteen members:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembersFromCloud();

    const handleSync = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setMembers(sortMembers(e.detail));
        setLoading(false);
      }
    };
    window.addEventListener('canteen_members_updated', handleSync);

    const handleSettingsUpdate = (e: any) => {
      if (e?.detail) setCanteenConfig(e.detail);
      else setCanteenConfig(getCanteenConfig());
    };
    window.addEventListener('canteen_settings_updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('canteen_members_updated', handleSync);
      window.removeEventListener('canteen_settings_updated', handleSettingsUpdate);
    };
  }, []);

  const handleAssignManager = (targetMember: any) => {
    const rank = targetMember['Rank'] || 'LAC';
    const surname = targetMember['Surname'] || '';
    const fullName = `${rank && rank !== '-' ? rank + ' ' : ''}${surname}`.trim();
    const bd = String(targetMember['BD No'] || targetMember.airman_id?.replace(/\D/g, '') || '').trim();
    const contact = String(targetMember['Contact'] || targetMember['Mobile No'] || canteenConfig?.phone || '').trim();
    const dp = targetMember.DP || canteenConfig?.adminImage || '';

    const updated: CanteenConfig = {
      ...canteenConfig,
      managerName: fullName,
      managerBdNo: bd,
      phone: contact || canteenConfig?.phone,
      adminImage: dp || canteenConfig?.adminImage
    };

    setCanteenConfig(updated);
    saveCanteenConfig(updated);
    showToast(`${fullName} (${bd ? `BD: ${bd}` : ''}) কে সক্রিয় ক্যান্টিন ম্যানেজার নির্ধারণ করা হয়েছে!`);
  };

  // Filter members by search and role (All, Officer, Airmen, Civ)
  const filteredMembers = useMemo(() => {
    const list = members.filter((m) => {
      if (!searchTerm.trim()) {
        if (roleFilter === 'ALL') return true;
        const weight = getRankWeight(m['Rank']);
        if (roleFilter === 'OFFICER') return weight >= 1 && weight <= 11;
        if (roleFilter === 'AIRMEN') return weight >= 20 && weight <= 39;
        if (roleFilter === 'CIV') {
          const r = String(m['Role'] || '').toLowerCase();
          const rk = String(m['Rank'] || '').toLowerCase();
          return weight >= 40 || r.includes('civ') || r.includes('staff') || r.includes('cook') || rk.includes('civ');
        }
        return true;
      }

      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        (m['BD No'] || '').toLowerCase().includes(term) ||
        (m['Rank'] || '').toLowerCase().includes(term) ||
        (m['Surname'] || '').toLowerCase().includes(term) ||
        (m['Contact'] || '').toLowerCase().includes(term) ||
        (m['Role'] || '').toLowerCase().includes(term) ||
        getMemberBanglaName(m).toLowerCase().includes(term);

      // Support bill search
      const normalizedDigits = term.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
      const cleanNum = normalizedDigits.replace(/[^0-9.]/g, '');
      const totalDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
      const matchBill = cleanNum.length > 0 && (
        cleanNum === '0' ? totalDue === 0 : (String(totalDue) === cleanNum || String(totalDue).includes(cleanNum))
      );

      if (!matchSearch && !matchBill) return false;

      if (roleFilter === 'ALL') return true;
      const weight = getRankWeight(m['Rank']);
      if (roleFilter === 'OFFICER') return weight >= 1 && weight <= 11;
      if (roleFilter === 'AIRMEN') return weight >= 20 && weight <= 39;
      if (roleFilter === 'CIV') {
        const r = String(m['Role'] || '').toLowerCase();
        const rk = String(m['Rank'] || '').toLowerCase();
        return weight >= 40 || r.includes('civ') || r.includes('staff') || r.includes('cook') || rk.includes('civ');
      }
      return true;
    });

    // Enforce 100% strictly unique keys in filtered list
    const seenKeys = new Set<string>();
    return list.filter((m) => {
      const cleanBd = String(m['BD No'] || '').replace(/\D/g, '');
      const aid = String(m.airman_id || (cleanBd ? `airman-${cleanBd}` : '')).trim().toLowerCase();
      const key = aid || (cleanBd ? `bd_${cleanBd}` : `s_${m.Surname}`);
      if (!key) return true;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }, [members, searchTerm, roleFilter]);

  // Handle single member image URL resolution
  const handleResolveImageUrl = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes('photos.app.goo.gl') || trimmed.includes('drive.google.com')) {
      setResolvingDp(true);
      try {
        const direct = await fetchDirectImageUrl(trimmed);
        if (direct) {
          setSingleMember(prev => ({ ...prev, dp: direct }));
        }
      } catch (err) {
        console.warn('Failed to resolve URL:', err);
      } finally {
        setResolvingDp(false);
      }
    }
  };

  // Save Single Member to Cloud
  const handleSaveSingleMember = async () => {
    const cleanBd = singleMember.bdNo.replace(/\D/g, '').trim();
    if (!cleanBd) {
      alert('অনুগ্রহ করে সঠিক বিডি নম্বর দিন (শুধুমাত্র সংখ্যা)।');
      return;
    }
    if (!singleMember.surname.trim()) {
      alert('সদস্যের নাম (Surname) প্রদান করা বাধ্যতামূলক।');
      return;
    }

    // Check BD Uniqueness: No 2 members can have the same BD number
    const isDuplicate = members.some(m => String(m['BD No'] || '').replace(/\D/g, '') === cleanBd);
    if (isDuplicate) {
      alert(`বিডি নম্বর #${cleanBd} ইতিমধ্যে একজন সদস্যের জন্য নিবন্ধিত আছে! একই BD নম্বর দুইবার ব্যবহার করা যাবে না।`);
      return;
    }

    // Check Mobile Number: Optional, but if provided must be exactly 11 numeric digits
    const cleanContact = String(singleMember.contact || '').replace(/\D/g, '').trim();
    if (cleanContact.length > 0 && cleanContact.length !== 11) {
      alert(`মোবাইল নম্বর প্রদান করলে অবশ্যই সঠিক ১১ ডিজিটের হতে হবে (যেমন: 017xxxxxxxx)। বর্তমানে ${cleanContact.length} ডিজিট রয়েছে।`);
      return;
    }

    setIsSavingSingle(true);
    let finalDp = singleMember.dp.trim();
    if (finalDp.includes('photos.app.goo.gl')) {
      finalDp = await fetchDirectImageUrl(finalDp);
    }

    const nameBn = singleMember.nameBn?.trim() || '';
    const rankBn = singleMember.rankBn?.trim() || '';

    const newLocalMember = {
      airman_id: `airman-${cleanBd}`,
      "BD No": cleanBd,
      "Rank": singleMember.rank === '-' ? '-' : (singleMember.rank.trim() || 'LAC'),
      "Surname": singleMember.surname.trim(),
      "Contact": cleanContact,
      "Role": 'Member',
      DP: finalDp || null,
      Due: 0,
      Name_BN: nameBn,
      Rank_BN: rankBn,
      active: true
    };

    // 1. Immediate Local Save
    const updated = sortMembers([
      newLocalMember,
      ...members.filter(m => {
        const mBd = String(m['BD No'] || '').replace(/\D/g, '');
        const mAid = String(m.airman_id || '').trim().toLowerCase();
        return mAid !== newLocalMember.airman_id.toLowerCase() && (!cleanBd || mBd !== cleanBd);
      })
    ]);
    setMembers(updated);
    setCanteenMembersCache(updated);
    localStorage.setItem('canteen_members_cache', JSON.stringify(updated));
    localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
      dp: newLocalMember.DP || '',
      due: 0,
      rank: newLocalMember.Rank,
      surname: newLocalMember.Surname,
      contact: newLocalMember.Contact,
      bdNo: cleanBd
    }));
    queuePushKeyToCloud('canteen_members_cache', updated);
    window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: updated }));
    window.dispatchEvent(new Event('canteen_state_updated'));

    setIsSavedSingle(true);
    showToast(`Member #${cleanBd} (${newLocalMember.Surname}) saved successfully!`);

    setTimeout(() => {
      setIsSavedSingle(false);
      setIsSavingSingle(false);
      setShowAddModal(false);
      setSingleMember({ bdNo: '', rank: 'LAC', rankBn: 'এলএসি', surname: '', nameBn: '', contact: '', dp: '' });
    }, 600);

    // 2. Background Cloud Sync (sanitized payload only)
    (async () => {
      try {
        if (nameBn) {
          await saveMemberBanglaName(newLocalMember.airman_id, nameBn, [cleanBd, singleMember.surname.trim()]);
        }
        if (rankBn) {
          await saveMemberBanglaRank(newLocalMember.airman_id, rankBn, [cleanBd]);
        }
        const supabaseRecord = {
          airman_id: newLocalMember.airman_id,
          "BD No": cleanBd,
          Rank: newLocalMember.Rank,
          Surname: newLocalMember.Surname,
          Contact: newLocalMember.Contact,
          Role: newLocalMember.Role,
          DP: newLocalMember.DP,
          Due: 0,
          Name_BN: nameBn || null,
          Rank_BN: rankBn || null,
          active: true
        };
        await supabase.from('Canteen_Member').upsert([supabaseRecord], { onConflict: 'airman_id' });
      } catch (cloudErr) {
        console.warn('Background sync note for new member:', cloudErr);
      }
    })();
  };

  // Download Sample Excel Template
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      { 'BD No': '474455', 'Rank': 'LAC', 'Surname': 'Nishad', 'Contact': '01712345678', 'Role': 'Member' },
      { 'BD No': '482100', 'Rank': 'Cpl', 'Surname': 'Rahman', 'Contact': '01812345678', 'Role': 'Member' },
      { 'BD No': '491500', 'Rank': 'Sgt', 'Surname': 'Hossain', 'Contact': '01912345678', 'Role': 'Staff' },
      { 'BD No': '495800', 'Rank': 'WO', 'Surname': 'Karim', 'Contact': '01612345678', 'Role': 'Member' },
      { 'BD No': '501200', 'Rank': 'Flt Lt', 'Surname': 'Ahmed', 'Contact': '01512345678', 'Role': 'Member' }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Column widths
    ws['!cols'] = [
      { wch: 12 }, // BD No
      { wch: 10 }, // Rank
      { wch: 20 }, // Surname
      { wch: 16 }, // Contact
      { wch: 14 }  // Role
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'Canteen_Members_Template.xlsx');
  };

  // Parse Excel / CSV File
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        processRawRows(data);
      } catch (err: any) {
        alert('Failed to parse Excel file: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Parse Text Pasted from Excel
  const handleParsePastedText = () => {
    if (!excelPasteText.trim()) return;

    const lines = excelPasteText.trim().split('\n');
    const rowsData: any[] = [];

    // Check if first line contains header
    const firstTokens = lines[0].split(/\t|,/).map(t => t.trim().toLowerCase());
    const hasHeader = firstTokens.some(t => t.includes('bd') || t.includes('rank') || t.includes('name') || t.includes('surname'));

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/\t|,/).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length >= 2) {
        rowsData.push({
          'BD No': cols[0] || '',
          'Rank': cols[1] || 'LAC',
          'Surname': cols[2] || cols[1] || '',
          'Contact': cols[3] || '',
          'Role': cols[4] || 'Member'
        });
      }
    }

    processRawRows(rowsData);
  };

  // Normalize raw parsed rows from Excel
  const processRawRows = (data: any[]) => {
    const parsed: ExcelMemberRow[] = [];
    const seenBdsInFile = new Set<string>();

    data.forEach((row, idx) => {
      // Find keys case-insensitively
      const findVal = (keys: string[]) => {
        for (const k of Object.keys(row)) {
          const lk = k.trim().toLowerCase();
          if (keys.some(candidate => lk === candidate || lk.includes(candidate))) {
            return String(row[k]).trim();
          }
        }
        return '';
      };

      const bdNo = findVal(['bd no', 'bdno', 'bd', 'id', 'service no']).replace(/\D/g, '').trim();
      const rank = findVal(['rank', 'designation']) || 'LAC';
      const surname = findVal(['surname', 'name', 'full name', 'member name']) || '';
      const contact = findVal(['contact', 'mobile', 'phone', 'mobile no']).replace(/\D/g, '').trim();
      const role = findVal(['role', 'type']) || 'Member';

      let error: string | undefined = undefined;
      if (!bdNo) {
        error = 'সঠিক নিউমেরিক BD নম্বর আবশ্যক';
      } else if (!surname) {
        error = 'সদস্যের নাম (Surname) আবশ্যক';
      } else if (contact && contact.length !== 11) {
        error = `মোবাইল নম্বর ১১ ডিজিটের হতে হবে (রয়েছে ${contact.length})`;
      } else if (seenBdsInFile.has(bdNo)) {
        error = `ফাইলে একই BD নম্বর (#${bdNo}) একাধিকবার রয়েছে`;
      } else if (members.some(m => String(m['BD No'] || '').replace(/\D/g, '') === bdNo)) {
        error = `বিডি নম্বর #${bdNo} ইতিমধ্যে সিস্টেমে নিবন্ধিত আছে`;
      }

      if (bdNo) seenBdsInFile.add(bdNo);

      const isValid = !error;

      parsed.push({
        bdNo,
        rank,
        surname,
        contact,
        role,
        isValid,
        error
      });
    });

    setExcelRows(parsed);
  };

  // Upload parsed Excel members to Supabase Cloud
  const handleSaveExcelMembersToCloud = async () => {
    const validRows = excelRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('No valid member records found to upload.');
      return;
    }

    setIsSavingExcel(true);
    setExcelSaveProgress({ saved: 0, total: validRows.length });

    try {
      const payloads = validRows.map(r => ({
        airman_id: `airman-${r.bdNo}`,
        "BD No": r.bdNo,
        "Rank": r.rank || 'LAC',
        "Surname": r.surname,
        "Contact": r.contact || '',
        "Role": r.role || 'Member',
        Due: 0
      }));

      // Chunk in batches of 50 to prevent Supabase payload limits
      const chunkSize = 50;
      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize);
        const { error } = await supabase.from('Canteen_Member').upsert(chunk, { onConflict: 'airman_id' });
        if (error) throw error;
        setExcelSaveProgress({ saved: Math.min(i + chunkSize, payloads.length), total: payloads.length });
      }

      setExcelSaveSuccess(true);
      showToast(`Successfully added ${validRows.length} members to Supabase Cloud!`);

      // Refresh members
      await fetchMembersFromCloud();
      window.dispatchEvent(new Event('canteen_members_updated'));

      setTimeout(() => {
        setIsSavingExcel(false);
        setExcelSaveSuccess(false);
        setShowAddModal(false);
        setExcelRows([]);
        setExcelFileName('');
        setExcelPasteText('');
      }, 1200);
    } catch (err: any) {
      alert('Error uploading to Cloud: ' + (err.message || err));
      setIsSavingExcel(false);
    }
  };

  // Save Edited Member (Local-First, then Cloud sync)
  const handleSaveEditMember = async () => {
    if (!editMember) return;
    const cleanBd = String(editMember['BD No'] || '').replace(/\D/g, '').trim();
    if (!cleanBd) {
      alert('অনুগ্রহ করে সঠিক বিডি নম্বর দিন (শুধুমাত্র সংখ্যা)।');
      return;
    }
    if (!editMember['Surname']) {
      alert('সদস্যের নাম (Surname) প্রদান করা বাধ্যতামূলক।');
      return;
    }

    const originalAirmanId = editMember.originalAirmanId || editMember.airman_id;
    const originalBdClean = String(editMember.originalBdNo || originalAirmanId || '').replace(/\D/g, '');

    // Check BD Uniqueness: cannot conflict with another member's BD No
    const isDuplicate = members.some(m => {
      const origAid = String(originalAirmanId || '').toLowerCase();
      const mAid = String(m.airman_id || '').toLowerCase();
      if (origAid && mAid && origAid === mAid) return false;
      const mBd = String(m['BD No'] || '').replace(/\D/g, '');
      if (originalBdClean && mBd === originalBdClean) return false;
      return mBd === cleanBd;
    });
    if (isDuplicate) {
      alert(`বিডি নম্বর #${cleanBd} ইতিমধ্যে অন্য একজন সদস্যের জন্য নিবন্ধিত আছে! একই BD নম্বর দুইবার ব্যবহার করা যাবে না।`);
      return;
    }

    // Check Mobile Number: Optional, but if provided must be exactly 11 numeric digits
    const cleanContact = String(editMember['Contact'] || '').replace(/\D/g, '').trim();
    if (cleanContact.length > 0 && cleanContact.length !== 11) {
      alert(`মোবাইল নম্বর প্রদান করলে অবশ্যই সঠিক ১১ ডিজিটের হতে হবে (যেমন: 017xxxxxxxx)। বর্তমানে ${cleanContact.length} ডিজিট রয়েছে।`);
      return;
    }

    setIsSavingEdit(true);
    try {
      const isBdChanged = Boolean(originalBdClean && cleanBd && originalBdClean !== cleanBd);

      // Preserve existing airman_id unless BD No was deliberately changed
      const targetAirmanId = isBdChanged ? `airman-${cleanBd}` : (originalAirmanId || `airman-${cleanBd}`);

      const memberSeniority = editMember.Seniority !== undefined ? editMember.Seniority : editMember.seniority;
      const nameBn = String(editMember.nameBn !== undefined ? editMember.nameBn : (getMemberBanglaName(editMember) ?? '')).trim();
      const rankBn = String(editMember.rankBn !== undefined ? editMember.rankBn : (getMemberBanglaRank(editMember) ?? '')).trim();

      // 1. Prepare clean local member object with all metadata
      const updatedLocalMember: any = {
        ...editMember,
        airman_id: targetAirmanId,
        "BD No": cleanBd,
        "Rank": editMember['Rank'] || 'LAC',
        "Surname": String(editMember['Surname'] || '').trim(),
        "Contact": cleanContact,
        "Role": editMember['Role'] || 'Member',
        Due: Number(editMember.Due ?? editMember.due ?? editMember.baki ?? 0),
        DP: editMember.DP || null,
        Seniority: memberSeniority,
        seniority: memberSeniority,
        Name_BN: nameBn,
        name_bn: nameBn,
        nameBn: nameBn,
        Rank_BN: rankBn,
        rank_bn: rankBn,
        rankBn: rankBn,
        active: editMember.active ?? true
      };
      delete updatedLocalMember.originalAirmanId;
      delete updatedLocalMember.originalBdNo;

      // 2. IMMEDIATE LOCAL SAVE (First save to local / cache immediately!)
      // Ensure the old record is completely removed when BD No or ID changes
      const remainingMembers = members.filter(m => {
        const mAid = String(m.airman_id || '').trim().toLowerCase();
        const mBd = String(m['BD No'] || '').replace(/\D/g, '');
        if (originalAirmanId && mAid === String(originalAirmanId).toLowerCase()) return false;
        if (originalBdClean && (mBd === originalBdClean || mAid === `airman-${originalBdClean}`)) return false;
        if (cleanBd && (mBd === cleanBd || mAid === `airman-${cleanBd}`)) return false;
        return true;
      });

      const finalLocalList = sortMembers([updatedLocalMember, ...remainingMembers]);

      setMembers(finalLocalList);
      setCanteenMembersCache(finalLocalList);
      localStorage.setItem('canteen_members_cache', JSON.stringify(finalLocalList));
      localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
        dp: updatedLocalMember.DP || '',
        due: updatedLocalMember.Due,
        rank: updatedLocalMember.Rank,
        surname: updatedLocalMember.Surname,
        contact: updatedLocalMember.Contact,
        bdNo: cleanBd
      }));

      // If BD changed, remove obsolete local storage keys of the old BD No
      if (isBdChanged && originalBdClean) {
        localStorage.removeItem(`canteen_member_${originalBdClean}`);
        localStorage.removeItem(`member_bangla_name_${originalBdClean}`);
        localStorage.removeItem(`member_bangla_rank_${originalBdClean}`);
        localStorage.removeItem(`member_seniority_${originalBdClean}`);
      }

      // Queue push to cloud app_settings cache
      queuePushKeyToCloud('canteen_members_cache', finalLocalList);

      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: finalLocalList }));
      window.dispatchEvent(new Event('canteen_state_updated'));

      // Close modal and show feedback immediately
      setIsSavedEdit(true);
      setEditMember(null);
      playCelebrationSound();
      setSaveSuccessBanner({
        bdNo: cleanBd,
        name: updatedLocalMember.Surname,
        rank: updatedLocalMember.Rank,
        nameBn: nameBn || undefined
      });
      setTimeout(() => setSaveSuccessBanner(null), 4000);

      // 3. BACKGROUND CLOUD SYNC (Pore niyom onujayi cloud e save hbe)
      // Prepare strictly sanitized payload matching ONLY the Supabase Canteen_Member columns!
      const supabasePayload: any = {
        airman_id: targetAirmanId,
        "BD No": cleanBd,
        Rank: String(updatedLocalMember.Rank || 'LAC').trim(),
        Surname: String(updatedLocalMember.Surname || '').trim(),
        Contact: String(updatedLocalMember.Contact || '').trim(),
        Role: String(updatedLocalMember.Role || 'Member').trim(),
        Due: Number(updatedLocalMember.Due ?? 0),
        DP: updatedLocalMember.DP || null,
        Seniority: memberSeniority !== undefined && memberSeniority !== null ? Number(memberSeniority) : null,
        Name_BN: nameBn || null,
        Rank_BN: rankBn || null,
        Flight: updatedLocalMember.Flight || updatedLocalMember.flight || 'Admin',
        Trade: updatedLocalMember.Trade || updatedLocalMember.trade || '',
        Address: updatedLocalMember.Address || updatedLocalMember.address || '',
        is_officer: Boolean(updatedLocalMember.is_officer),
        active: updatedLocalMember.active ?? true
      };

      // Execute Cloud Save asynchronously
      (async () => {
        try {
          // If BD was changed, DELETE the obsolete old member from Supabase first
          if (isBdChanged) {
            try {
              if (originalAirmanId) {
                await supabase.from('Canteen_Member').delete().eq('airman_id', originalAirmanId);
                await supabase.from('Canteen').delete().eq('airman_id', originalAirmanId);
              }
              if (originalBdClean) {
                await supabase.from('Canteen_Member').delete().eq('BD No', originalBdClean);
                await supabase.from('Canteen_Member').delete().eq('airman_id', `airman-${originalBdClean}`);
                await supabase.from('Canteen').delete().eq('BD No', originalBdClean);
                await supabase.from('Canteen').delete().eq('airman_id', `airman-${originalBdClean}`);
              }
            } catch (delErr) {
              console.warn('Note deleting old member row on BD change:', delErr);
            }
          }

          if (nameBn) {
            await saveMemberBanglaName(targetAirmanId, nameBn, [cleanBd, updatedLocalMember.Surname]);
          }
          if (rankBn) {
            await saveMemberBanglaRank(targetAirmanId, rankBn, [cleanBd]);
          }
          if (memberSeniority !== undefined && memberSeniority !== null) {
            await saveMemberSeniority(cleanBd, Number(memberSeniority));
          }

          // Upsert to Supabase FIRST
          const { error: upsertErr } = await supabase
            .from('Canteen_Member')
            .upsert([supabasePayload], { onConflict: 'airman_id' });

          if (upsertErr) {
            console.error('Supabase Canteen_Member background sync error:', upsertErr);
          }

          // Also keep Canteen table in sync if present
          try {
            await supabase
              .from('Canteen')
              .upsert([{
                airman_id: targetAirmanId,
                "BD No": cleanBd,
                Rank: supabasePayload.Rank,
                Surname: supabasePayload.Surname,
                Name: supabasePayload.Surname,
                Contact: supabasePayload.Contact,
                Role: supabasePayload.Role,
                Due: supabasePayload.Due,
                DP: supabasePayload.DP
              }], { onConflict: 'airman_id' });
          } catch {}
        } catch (cloudErr) {
          console.warn('Background cloud sync note:', cloudErr);
        }
      })();

    } catch (err: any) {
      console.error('Error saving member:', err);
      alert('Error updating member: ' + (err.message || err));
    } finally {
      setIsSavingEdit(false);
      setTimeout(() => setIsSavedEdit(false), 2000);
    }
  };

  // Delete Member from Cloud
  const handleConfirmDeleteMember = async () => {
    if (!deleteConfirmMember) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase.from('Canteen_Member').delete().eq('airman_id', deleteConfirmMember.airman_id);
      if (error) throw error;

      showToast(`Member #${deleteConfirmMember['BD No']} removed from Cloud.`);
      const updated = members.filter(m => m.airman_id !== deleteConfirmMember.airman_id);
      setMembers(updated);
      setCanteenMembersCache(updated);
      localStorage.setItem('canteen_members_cache', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));

      setDeleteConfirmMember(null);
    } catch (err: any) {
      alert('Error deleting member: ' + (err.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[300] bg-emerald-600 text-white font-black px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-md">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
              <span>MEMBER DATABASE</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                {members.length} Members
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage member records, roles, contacts & bulk import via Excel (Cloud Synced)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          {/* Reload from Cloud */}
          <button
            type="button"
            onClick={() => fetchMembersFromCloud(true)}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700 transition-colors cursor-pointer shrink-0"
            title="Refresh from Supabase Cloud"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Add Member Button */}
          <button
            type="button"
            onClick={() => {
              setAddMode('single');
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-3.5 bg-gradient-to-r from-cyan-600 via-indigo-600 to-indigo-700 hover:from-cyan-500 hover:to-indigo-600 text-white rounded-2xl text-xs font-black tracking-wider uppercase transition-all shadow-lg shadow-cyan-600/20 active:translate-y-0.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>ADD MEMBER</span>
          </button>
        </div>
      </div>

      {/* Current Manager Banner Card (Only place to view & change Canteen Manager) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
          {/* Manager Avatar */}
          <div className="w-13 h-13 rounded-2xl bg-slate-950 border-2 border-indigo-500/50 flex items-center justify-center font-black text-xl text-indigo-400 overflow-hidden shrink-0 shadow-md">
            {canteenConfig?.adminImage ? (
              <img
                src={resolveImageUrl(canteenConfig.adminImage)}
                alt={canteenConfig.managerName || 'Manager'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span>{(canteenConfig?.managerName || 'M').charAt(0)}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-500/25 border border-indigo-400/40 text-indigo-300">
                CURRENT MANAGER
              </span>
              {canteenConfig?.managerBdNo && (
                <span className="text-xs font-mono font-bold text-slate-300">
                  BD: {canteenConfig.managerBdNo}
                </span>
              )}
            </div>
            <h3 className="text-base font-black text-white truncate leading-tight mt-0.5">
              {canteenConfig?.managerName || 'No Manager Assigned Yet'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {canteenConfig?.phone && (
                <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>{canteenConfig.phone}</span>
                </p>
              )}
              <span className="text-[10px] text-slate-500">•</span>
              <span className="text-[11px] text-amber-400 font-mono font-bold flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span>System Key: {canteenConfig?.password || '1111'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Change Manager Button */}
        <button
          type="button"
          onClick={() => {
            setManagerSearchTerm('');
            setShowManagerModal(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md shadow-indigo-950 transition-all cursor-pointer active:scale-95 shrink-0 border border-indigo-400/30"
          title="Change Active Canteen Manager"
        >
          <ShieldCheck className="w-4 h-4 text-indigo-200" />
          <span>Change Manager</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 md:p-4 space-y-3 shadow-md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by BD No, Rank, Surname, Due Bill, Role, or Contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-11 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Role Filter Pills: All, Officer, Airmen, Civ with Total Numbers */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {([
              { id: 'ALL', label: 'All', count: roleCounts.ALL },
              { id: 'OFFICER', label: 'Officer', count: roleCounts.OFFICER },
              { id: 'AIRMEN', label: 'Airmen', count: roleCounts.AIRMEN },
              { id: 'CIV', label: 'Civ', count: roleCounts.CIV },
            ] as const).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleFilter(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                  roleFilter === r.id
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400/50'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 border border-slate-700/60'
                }`}
              >
                <span>{r.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                  roleFilter === r.id ? 'bg-black/30 text-white font-bold' : 'bg-slate-900/80 text-slate-400 font-bold'
                }`}>
                  {r.count}
                </span>
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Box vs Table */}
          <div className="flex items-center bg-slate-950 rounded-xl p-0.5 border border-slate-800 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('BOX')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center space-x-1.5 transition-all cursor-pointer ${
                viewMode === 'BOX'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Box / Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Box View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center space-x-1.5 transition-all cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Member Cards Grid */}
      {loading && members.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <p className="text-slate-400 font-bold text-sm">No members found matching your search</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('ALL');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : viewMode === 'BOX' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMembers.map((member, i) => {
            const memberDp = resolveImageUrl(member.DP);
            const totalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);

            return (
              <div
                key={member.airman_id || `box-${member['BD No'] || i}-${i}`}
                className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 rounded-3xl p-5 border border-slate-800/80 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start">
                  <div className="flex items-start space-x-4 flex-1 min-w-0">
                    {/* Left Column: Pic with #1 directly under it */}
                    <div className="flex flex-col items-center shrink-0 space-y-1.5">
                      {/* Avatar / Picture */}
                      <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700/80 flex items-center justify-center font-black text-xl text-cyan-400 overflow-hidden shrink-0 shadow-inner">
                        {memberDp ? (
                          <img
                            src={memberDp}
                            alt={member['Surname']}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span>{(member['Surname'] || 'U').charAt(0)}</span>
                        )}
                      </div>

                      {/* #1 (Pic er niche) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSeniorityEditMember(member);
                        }}
                        className="font-mono text-emerald-400 font-black text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 hover:bg-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs"
                        title="Seniority / জ্যেষ্ঠতা নম্বর (Click to edit)"
                      >
                        #{member.seniority || member.Seniority || (i + 1)}
                      </button>
                    </div>

                    {/* Right Column: Member Information */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                      {/* Line 1: OIC / Manager er dan pase BD/9241 (NEVER show "MEMBER" badge) */}
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        {(() => {
                          const mBd = String(member['BD No'] || '').replace(/\D/g, '').trim();
                          const isMgr = mBd && mBd === String(canteenConfig?.managerBdNo || '').replace(/\D/g, '').trim();
                          const roleStr = String(member.Role || '').trim().toLowerCase();
                          const isOic = roleStr === 'oic';

                          if (isMgr) {
                            return (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/25 text-purple-300 border border-purple-400/50 shadow-xs shrink-0">
                                Manager
                              </span>
                            );
                          }
                          if (isOic) {
                            return (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-xs shrink-0">
                                OIC
                              </span>
                            );
                          }
                          // Never show "Member" badge!
                          return null;
                        })()}
                        <span className="text-xs font-mono font-black text-slate-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                          BD/{String(member['BD No'] || '').replace(/\D/g, '') || member['BD No'] || '-'}
                        </span>
                      </div>

                      {/* Line 2: er niche Wg Crd Aftab (Rank & English Surname) */}
                      <div className="text-sm md:text-base font-black text-white leading-tight group-hover:text-cyan-300 transition-colors truncate">
                        {member['Rank'] && member['Rank'] !== '-' ? `${member['Rank']} ` : ''}{member['Surname']}
                      </div>

                      {/* Line 3: tar niche bangla te উইং কমাঃ আফতাব */}
                      <div className="text-xs font-bold text-emerald-400 font-sans leading-tight truncate">
                        {(() => {
                          const bnRank = getMemberBanglaRank(member);
                          const bnName = getMemberBanglaName(member);
                          if (bnRank && bnName) return `${bnRank} ${bnName}`;
                          if (bnName) return bnName;
                          if (bnRank) return bnRank;
                          return <span className="text-slate-600 text-[11px]">-</span>;
                        })()}
                      </div>

                      {/* Line 4: er niche Number */}
                      {member['Contact'] ? (
                        <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 pt-0.5">
                          <Phone className="w-3 h-3 text-cyan-400/70 shrink-0" />
                          <span className="truncate">{member['Contact']}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-600 font-mono pt-0.5">-</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions: Edit & Delete */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const bnName = getMemberBanglaName(member);
                      const bnRank = getMemberBanglaRank(member);
                      setEditMember({ 
                        ...member, 
                        originalAirmanId: member.airman_id || `airman-${member['BD No']}`,
                        originalBdNo: member['BD No'] || member.bdNo,
                        nameBn: bnName,
                        rankBn: bnRank
                      });
                    }}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer border border-slate-700/60"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmMember(member)}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
                    title="Delete member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-3.5 text-center font-mono w-20">Seniority</th>
                  <th className="px-4 py-3.5">Rank & Name</th>
                  <th className="px-4 py-3.5 font-mono">BD No</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5 text-right font-mono">Current Due</th>
                  <th className="px-4 py-3.5 text-center w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredMembers.map((member, i) => {
                  const memberDp = resolveImageUrl(member.DP);
                  const totalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);

                  return (
                    <tr 
                      key={member.airman_id || `row-${member['BD No'] || i}-${i}`}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSeniorityEditMember(member);
                          }}
                          className="font-mono text-emerald-400 font-black text-xs px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs"
                          title="Click to Edit Seniority / জ্যেষ্ঠতা নম্বর পরিবর্তন করুন"
                        >
                          #{member.seniority || member.Seniority || (i + 1)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center font-black text-xs text-cyan-400 overflow-hidden shrink-0 shadow-inner">
                            {memberDp ? (
                              <img src={memberDp} alt={member['Surname']} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <span>{(member['Surname'] || 'U').charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 shrink-0">
                              {member['Rank']}
                              {getMemberBanglaRank(member) ? ` (${getMemberBanglaRank(member)})` : ''}
                            </span>
                            <span className="font-black text-white group-hover:text-cyan-300 transition-colors text-sm">
                              {member['Surname']}
                            </span>
                            {(() => {
                              const bn = getMemberBanglaName(member);
                              return bn ? (
                                <span className="text-emerald-400 font-bold text-xs font-sans">
                                  ({bn})
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono text-slate-300 bg-slate-950/70 border border-slate-700/60 inline-block shadow-inner">
                          #{member['BD No']}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const mBd = String(member['BD No'] || '').replace(/\D/g, '').trim();
                          const isMgr = mBd && mBd === String(canteenConfig?.managerBdNo || '').replace(/\D/g, '').trim();
                          const roleStr = String(member.Role || '').trim().toLowerCase();
                          const isOic = roleStr === 'oic';

                          if (isMgr) {
                            return (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-purple-500/25 text-purple-300 border border-purple-400/50">
                                Manager
                              </span>
                            );
                          }
                          if (isOic) {
                            return (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-400/50">
                                OIC
                              </span>
                            );
                          }
                          return <span className="text-slate-600 font-mono text-xs">-</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                        {member['Contact'] || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2.5 py-1 rounded-xl border text-sm font-black font-mono inline-block ${
                          totalDue === 0 
                            ? 'bg-slate-950/80 border-slate-700/80 text-emerald-400' 
                            : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                        }`}>
                          ৳{totalDue.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const bnName = getMemberBanglaName(member);
                              const bnRank = getMemberBanglaRank(member);
                              setEditMember({ 
                                ...member, 
                                originalAirmanId: member.airman_id || `airman-${member['BD No']}`,
                                originalBdNo: member['BD No'] || member.bdNo,
                                nameBn: bnName,
                                rankBn: bnRank
                              });
                            }}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-lg text-[11px] font-black uppercase flex items-center space-x-1 border border-slate-700 transition-all cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3 h-3 text-cyan-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmMember(member)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-all cursor-pointer"
                            title="Delete Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL (Single + Excel Format) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-slate-800 max-h-[92vh] overflow-y-auto space-y-6 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">ADD NEW MEMBER</h3>
                  <p className="text-xs text-slate-400">Add single member or multiple members via Excel (.xlsx / .csv)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setExcelRows([]);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch Tabs: Single vs Multiple (Excel) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  addMode === 'single'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Single Member</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMode('excel')}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  addMode === 'excel'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Multiple Members (Excel)</span>
              </button>
            </div>

            {/* TAB 1: SINGLE MEMBER FORM */}
            {addMode === 'single' && (
              <div className="space-y-3.5">
                {/* Line 1: Rank (English) on Left, Rank in Bangla on Right - SIDE BY SIDE */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      Rank / পদবি (English) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={singleMember.rank}
                      onChange={(e) => {
                        const newRank = e.target.value;
                        setSingleMember({ 
                          ...singleMember, 
                          rank: newRank,
                          rankBn: getMemberBanglaRank(newRank)
                        });
                      }}
                      className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      {BAF_RANKS_WITH_BN.map(item => (
                        <option key={item.rank} value={item.rank}>
                          {item.rank === '-' ? '- (পদবি ছাড়া / Without Rank)' : `${item.rank} — ${item.bn}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block mb-1">
                      পদবি বাংলায় (Rank in BN)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. উইং কমাঃ..."
                      value={singleMember.rankBn}
                      onChange={(e) => setSingleMember({ ...singleMember, rankBn: e.target.value })}
                      className="w-full bg-slate-950 text-emerald-300 placeholder-slate-600 rounded-xl px-2.5 py-2.5 text-xs font-bold border border-emerald-500/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner font-sans"
                    />
                  </div>
                </div>

                {/* Line 2: BD No (Only numeric digits, no role input needed) */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    BD No / সার্ভিস নং <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 474455 (শুধুমাত্র সংখ্যা)"
                    value={singleMember.bdNo}
                    onChange={(e) => setSingleMember({ ...singleMember, bdNo: e.target.value.replace(/\D/g, '') })}
                    className={`w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold font-mono border focus:outline-none focus:ring-1 ${
                      isDuplicateAddBd 
                        ? 'border-rose-500/80 focus:ring-rose-500' 
                        : 'border-slate-700 focus:ring-cyan-500'
                    }`}
                  />
                  {isDuplicateAddBd && (
                    <p className="text-[10px] font-bold text-rose-400 mt-1 flex items-center gap-1 animate-pulse">
                      ⚠️ এই BD নম্বর (#{singleMember.bdNo}) ইতিমধ্যে ব্যবহৃত হয়েছে!
                    </p>
                  )}
                </div>

                {/* Line 3: Surname / Name (English) on Left, Bangla Name on Right - SIDE BY SIDE */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      Surname / Name (EN) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nishad, Sonia..."
                      value={singleMember.surname}
                      onChange={(e) => {
                        const newSurname = e.target.value;
                        const autoBn = getMemberBanglaName({ Surname: newSurname, "BD No": singleMember.bdNo });
                        setSingleMember({ 
                          ...singleMember, 
                          surname: newSurname,
                          nameBn: (!singleMember.nameBn || singleMember.nameBn === getMemberBanglaName({ Surname: singleMember.surname })) ? (autoBn || singleMember.nameBn || '') : singleMember.nameBn
                        });
                      }}
                      className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block mb-1">
                      বাংলা নাম (Bangla Name)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. নিশাদ, সোনিয়া..."
                      value={singleMember.nameBn}
                      onChange={(e) => setSingleMember({ ...singleMember, nameBn: e.target.value })}
                      className="w-full bg-slate-950 text-emerald-300 placeholder-slate-600 rounded-xl px-2.5 py-2.5 text-xs font-bold border border-emerald-500/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner font-sans"
                    />
                  </div>
                </div>

                {/* Line 4: Contact (Optional, but if given must be 11 numeric digits) */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Contact / মোবাইল নং <span className="text-slate-500 font-normal text-[10px]">(ঐচ্ছিক / Optional)</span></span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {singleMember.contact ? `${singleMember.contact.length}/11` : 'Optional'}
                    </span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="e.g. 01712345678 (প্রদান করলে ১১ ডিজিট)"
                    value={singleMember.contact}
                    onChange={(e) => setSingleMember({ ...singleMember, contact: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    className={`w-full bg-slate-950 text-white rounded-xl px-3 py-2.5 text-xs font-bold border font-mono focus:outline-none focus:ring-1 ${
                      singleMember.contact.length === 11
                        ? 'border-emerald-500/60 focus:ring-emerald-500 text-emerald-300'
                        : singleMember.contact.length > 0
                        ? 'border-amber-500/60 focus:ring-amber-500'
                        : 'border-slate-700 focus:ring-cyan-500'
                    }`}
                  />
                  {singleMember.contact.length > 0 && singleMember.contact.length < 11 && (
                    <p className="text-[10px] font-bold text-amber-400 mt-1 flex items-center gap-1">
                      ⚠️ মোবাইল নম্বর অবশ্যই ১১ ডিজিটের হতে হবে (বর্তমানে {singleMember.contact.length} ডিজিট)
                    </p>
                  )}
                  {singleMember.contact.length === 11 && (
                    <p className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
                      ✓ সঠিক ১১ ডিজিটের মোবাইল নম্বর
                    </p>
                  )}
                </div>

                  {/* Photo Import / Upload (No URL box) */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                      Member Profile Photo
                    </label>
                    <div className="flex items-center space-x-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                        {singleMember.dp ? (
                          <img src={resolveImageUrl(singleMember.dp)} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      
                      <label className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border border-cyan-500/50 flex items-center space-x-1.5 shadow-md shadow-cyan-950 transition-all active:scale-95">
                        <Upload className="w-4 h-4" />
                        <span>Import Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const base64 = await processGalleryImage(file);
                                setSingleMember(prev => ({ ...prev, dp: base64 }));
                              } catch (err) {
                                console.error('Image load failed:', err);
                              }
                            }
                          }}
                        />
                      </label>

                      {singleMember.dp && (
                        <button
                          type="button"
                          onClick={() => setSingleMember(prev => ({ ...prev, dp: '' }))}
                          className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <SaveButton
                      type="button"
                      onClick={handleSaveSingleMember}
                      disabled={isSavingSingle || isDuplicateAddBd || !singleMember.surname.trim() || !singleMember.bdNo || (singleMember.contact.trim().length > 0 && singleMember.contact.replace(/\D/g, '').length !== 11)}
                      isSaving={isSavingSingle}
                      isSaved={isSavedSingle}
                      idleText="Save Member to Cloud"
                      savingText="Saving to Cloud..."
                      savedText="Member Saved to Cloud! ✓"
                      className="w-full py-3.5 text-xs font-black tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

            {/* TAB 2: MULTIPLE MEMBERS (EXCEL FORMAT) */}
            {addMode === 'excel' && (
              <div className="space-y-5">
                {/* Excel Info & Download Template Strip */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Excel Format (.xlsx, .xls, .csv)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Columns: <strong>BD No, Rank, Surname, Contact, Role</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black uppercase transition-all cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Template</span>
                  </button>
                </div>

                {/* Upload or Paste Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* File Upload Box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/70 flex flex-col items-center justify-center space-y-2"
                  >
                    <Upload className="w-8 h-8 text-indigo-400" />
                    <p className="text-xs font-black text-white uppercase">Upload Excel / CSV File</p>
                    <p className="text-[10px] text-slate-400">Click to browse .xlsx, .xls, or .csv</p>
                    {excelFileName && (
                      <span className="text-[11px] font-mono text-emerald-400 font-bold mt-1 bg-emerald-950/80 px-2 py-0.5 rounded-md">
                        {excelFileName}
                      </span>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleExcelFileUpload}
                    />
                  </div>

                  {/* Paste from Excel Clipboard Box */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                      Or Paste directly from Excel
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Copy rows from Excel and paste here (tab-separated)..."
                      value={excelPasteText}
                      onChange={(e) => setExcelPasteText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      disabled={!excelPasteText.trim()}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                    >
                      Parse Pasted Rows
                    </button>
                  </div>
                </div>

                {/* Parsed Preview Table */}
                {excelRows.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>
                        Parsed Records: <strong className="text-white">{excelRows.length}</strong> (Valid: <strong className="text-emerald-400">{excelRows.filter(r => r.isValid).length}</strong>, Invalid: <strong className="text-rose-400">{excelRows.filter(r => !r.isValid).length}</strong>)
                      </span>
                      <button
                        type="button"
                        onClick={() => setExcelRows([])}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Clear List
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">BD No</th>
                            <th className="px-3 py-2">Rank</th>
                            <th className="px-3 py-2">Surname</th>
                            <th className="px-3 py-2">Contact</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {excelRows.map((row, idx) => (
                            <tr key={idx} className={row.isValid ? 'hover:bg-slate-900/50' : 'bg-rose-950/20 text-rose-300'}>
                              <td className="px-3 py-1.5">{idx + 1}</td>
                              <td className="px-3 py-1.5 font-bold text-white">#{row.bdNo || '-'}</td>
                              <td className="px-3 py-1.5 font-sans font-bold">{row.rank}</td>
                              <td className="px-3 py-1.5 font-sans font-bold text-slate-200">{row.surname || '-'}</td>
                              <td className="px-3 py-1.5">{row.contact || '-'}</td>
                              <td className="px-3 py-1.5 font-sans">{row.role}</td>
                              <td className="px-3 py-1.5 text-center font-sans">
                                {row.isValid ? (
                                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded">
                                    Valid
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded" title={row.error}>
                                    {row.error}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Progress Bar when uploading to Cloud */}
                    {isSavingExcel && (
                      <div className="space-y-1.5 py-2">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>Uploading to Supabase Cloud...</span>
                          <span>{excelSaveProgress.saved} / {excelSaveProgress.total}</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-700">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${(excelSaveProgress.saved / Math.max(1, excelSaveProgress.total)) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Save All to Cloud Button */}
                    <button
                      type="button"
                      onClick={handleSaveExcelMembersToCloud}
                      disabled={isSavingExcel || excelRows.filter(r => r.isValid).length === 0}
                      className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      {isSavingExcel ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving to Cloud ({excelSaveProgress.saved}/{excelSaveProgress.total})...</span>
                        </>
                      ) : excelSaveSuccess ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Successfully Saved to Cloud! ✓</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save {excelRows.filter(r => r.isValid).length} Members to Cloud</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT MEMBER MODAL */}
      {editMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-slate-800 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      Edit Member:
                    </span>
                    <span className="text-sm font-black text-white truncate">
                      {editMember['Rank'] && editMember['Rank'] !== '-' ? `${editMember['Rank']} ` : ''}
                      {editMember['Surname'] || ''}
                    </span>
                    {(() => {
                      const bn = editMember.nameBn || getMemberBanglaName(editMember);
                      return bn ? (
                        <span className="text-xs font-bold text-emerald-400 font-sans">
                          ({bn})
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    BD No: BD/{String(editMember['BD No'] || '').replace(/\D/g, '') || editMember['BD No'] || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditMember(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Seniority Order Setting Card (Synced with Cloud & Office Biodata Register) */}
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-2.5 shadow-inner">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                        Seniority Number:
                      </label>
                      <span className="font-mono text-emerald-400 font-black text-sm px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30">
                        #{editMember.seniority || editMember.Seniority || '-'}
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-300/80 font-medium mt-0.5">
                      Synced with Office Biodata Register and Canteen database.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSeniorityEditMember(editMember)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Change Seniority</span>
                </button>
              </div>

              {/* Line 1: Rank (English) on Left, Rank in Bangla on Right - SIDE BY SIDE */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Rank / পদবি (English)
                  </label>
                  <select
                    value={editMember['Rank'] === 'Civilian' || editMember['Rank'] === 'CIV' ? 'Civ' : (editMember['Rank'] ?? '-')}
                    onChange={(e) => {
                      const newRank = e.target.value;
                      setEditMember({ 
                        ...editMember, 
                        Rank: newRank,
                        rankBn: getMemberBanglaRank(newRank)
                      });
                    }}
                    className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {BAF_RANKS_WITH_BN.map(item => (
                      <option key={item.rank} value={item.rank}>
                        {item.rank === '-' ? '- (পদবি ছাড়া / Without Rank)' : `${item.rank} — ${item.bn}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>পদবি বাংলায় (Rank in Bangla)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. উইং কমাঃ..."
                    value={editMember.rankBn ?? getMemberBanglaRank(editMember)}
                    onChange={(e) => setEditMember({ ...editMember, rankBn: e.target.value })}
                    className="w-full bg-slate-950 text-emerald-300 placeholder-slate-600 rounded-xl px-2.5 py-2.5 text-xs font-bold border border-emerald-500/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner font-sans"
                  />
                </div>
              </div>

              {/* Line 2: BD No (Only numeric digits) */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  BD No / সার্ভিস নং <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 10580 (শুধুমাত্র সংখ্যা)"
                  value={editMember['BD No'] || ''}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setEditMember({ 
                      ...editMember, 
                      "BD No": clean,
                      airman_id: `airman-${clean}`
                    });
                  }}
                  className={`w-full bg-slate-950 text-white placeholder-slate-600 rounded-xl px-2.5 py-2.5 text-xs font-bold font-mono border focus:outline-none focus:ring-1 ${
                    isDuplicateEditBd 
                      ? 'border-rose-500/80 focus:ring-rose-500' 
                      : 'border-slate-700 focus:ring-cyan-500'
                  }`}
                />
                {isDuplicateEditBd && (
                  <p className="text-[10px] font-bold text-rose-400 mt-1 flex items-center gap-1 animate-pulse">
                    ⚠️ এই BD নম্বর (#{editMember['BD No']}) অন্য একজন সদস্যের রয়েছে!
                  </p>
                )}
              </div>

              {/* Line 3: Surname / Name (English) on Left, Bangla Name on Right - SIDE BY SIDE */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Surname / Name (EN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sonia, Shohana..."
                    value={editMember['Surname'] || ''}
                    onChange={(e) => {
                      const newSurname = e.target.value;
                      const autoBn = getMemberBanglaName({ ...editMember, Surname: newSurname });
                      setEditMember({ 
                        ...editMember, 
                        Surname: newSurname,
                        nameBn: (!editMember.nameBn || editMember.nameBn === getMemberBanglaName(editMember)) ? (autoBn || editMember.nameBn || '') : editMember.nameBn
                      });
                    }}
                    className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block mb-1">
                    নাম বাংলায় (Name in BN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. সোনিয়া, শোহানা..."
                    value={editMember.nameBn ?? getMemberBanglaName(editMember)}
                    onChange={(e) => setEditMember({ ...editMember, nameBn: e.target.value })}
                    className="w-full bg-slate-950 text-emerald-300 placeholder-slate-600 rounded-xl px-2.5 py-2.5 text-xs font-bold border border-emerald-500/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner font-sans"
                  />
                </div>
              </div>

              {/* Line 4: Contact (Optional, but if given must be 11 numeric digits) */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Contact / মোবাইল নং <span className="text-slate-500 font-normal text-[10px]">(ঐচ্ছিক / Optional)</span></span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {editMember['Contact'] ? `${String(editMember['Contact']).replace(/\D/g, '').length}/11` : 'Optional'}
                  </span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="e.g. 017xxxxxxxx (প্রদান করলে ১১ ডিজিট)"
                  value={editMember['Contact'] || ''}
                  onChange={(e) => {
                    const cleanNum = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setEditMember({ ...editMember, Contact: cleanNum });
                  }}
                  className={`w-full bg-slate-950 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-xs font-bold border font-mono focus:outline-none focus:ring-1 ${
                    String(editMember['Contact'] || '').replace(/\D/g, '').length === 11
                      ? 'border-emerald-500/60 focus:ring-emerald-500 text-emerald-300'
                      : String(editMember['Contact'] || '').length > 0
                      ? 'border-amber-500/60 focus:ring-amber-500'
                      : 'border-slate-700 focus:ring-cyan-500'
                  }`}
                />
                {String(editMember['Contact'] || '').replace(/\D/g, '').length > 0 && String(editMember['Contact'] || '').replace(/\D/g, '').length < 11 && (
                  <p className="text-[10px] font-bold text-amber-400 mt-1 flex items-center gap-1">
                    ⚠️ মোবাইল নম্বর অবশ্যই ১১ ডিজিটের হতে হবে (বর্তমানে {String(editMember['Contact'] || '').replace(/\D/g, '').length} ডিজিট)
                  </p>
                )}
                {String(editMember['Contact'] || '').replace(/\D/g, '').length === 11 && (
                  <p className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
                    ✓ সঠিক ১১ ডিজিটের মোবাইল নম্বর
                  </p>
                )}
              </div>

              {/* Photo: Import Icon only, NO URL box */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Photo</label>
                <div className="flex items-center space-x-3 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {editMember.DP ? (
                      <img src={resolveImageUrl(editMember.DP)} alt="DP" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black uppercase cursor-pointer flex items-center space-x-1.5 shadow-md shadow-cyan-950 transition-all active:scale-95">
                      <Upload className="w-4 h-4" />
                      <span>Import Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const b64 = await processGalleryImage(file);
                              setEditMember(prev => prev ? ({ ...prev, DP: b64 }) : null);
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                      />
                    </label>

                    {editMember.DP && (
                      <button
                        type="button"
                        onClick={() => setEditMember(prev => prev ? ({ ...prev, DP: null }) : null)}
                        className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <SaveButton
                type="button"
                onClick={handleSaveEditMember}
                disabled={isSavingEdit || isDuplicateEditBd || !editMember['Surname']?.trim() || !editMember['BD No'] || (String(editMember['Contact'] || '').trim().length > 0 && String(editMember['Contact'] || '').replace(/\D/g, '').length !== 11)}
                isSaving={isSavingEdit}
                isSaved={isSavedEdit}
                idleText="Save"
                savingText="Saving..."
                savedText="Saved! ✓"
                className="w-full py-3 text-xs font-black tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC CELEBRATION ANIMATION BANNER WITH SOUND */}
      <AnimatePresence>
        {saveSuccessBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-teal-950/95 border-2 border-emerald-400 rounded-3xl p-4 shadow-2xl shadow-emerald-950/80 flex items-center justify-between gap-3 overflow-hidden backdrop-blur-xl ring-2 ring-emerald-500/30"
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/25 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/50 shadow-inner">
                <Check className="w-6 h-6 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                    #{saveSuccessBanner.bdNo}
                  </span>
                  <span className="text-xs font-black text-white truncate">
                    {saveSuccessBanner.rank} {saveSuccessBanner.name}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-emerald-300 mt-1 flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-spin" />
                  <span>Saved successfully! {saveSuccessBanner.nameBn ? `(${saveSuccessBanner.nameBn})` : ''}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSaveSuccessBanner(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRM MODAL */}
      <AnimatePresence>
        {deleteConfirmMember && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.88, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800 text-center space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-rose-500" />
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30 shadow-inner">
                <Trash2 className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase">Delete Member?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete <strong>{deleteConfirmMember['Rank']} {deleteConfirmMember['Surname']}</strong> (#{deleteConfirmMember['BD No']}) from the Cloud Database?
                </p>
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmMember(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteMember}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase transition-all cursor-pointer shadow-md shadow-rose-600/30 active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Member Seniority Modal (Office App Biodata Register Style) */}
      {seniorityEditMember && (
        <EditMemberSeniorityModal
          isOpen={!!seniorityEditMember}
          onClose={() => setSeniorityEditMember(null)}
          member={seniorityEditMember}
          allMembers={members}
          onSuccess={(updatedMembers) => {
            setMembers(updatedMembers);
            setCanteenMembersCache(updatedMembers);
            window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: updatedMembers }));
            window.dispatchEvent(new Event('canteen_state_updated'));
            window.dispatchEvent(new Event('storage'));
            if (editMember) {
              const fresh = updatedMembers.find((m: any) => 
                (editMember['BD No'] && m['BD No'] === editMember['BD No']) || 
                (editMember.airman_id && m.airman_id === editMember.airman_id)
              );
              if (fresh) {
                setEditMember(fresh);
              }
            }
          }}
        />
      )}

      {/* CANTEEN MANAGER SELECTION MODAL */}
      {showManagerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    CANTEEN MANAGER SELECTION
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select active Canteen Manager from member list
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Active Manager Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                {canteenConfig?.adminImage ? (
                  <img
                    src={resolveImageUrl(canteenConfig.adminImage)}
                    alt={canteenConfig.managerName || 'Manager'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="font-black text-white text-xl">
                    {(canteenConfig?.managerName || 'M').charAt(0)}
                  </span>
                )}
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase tracking-wider">
                    CURRENT ACTIVE MANAGER
                  </span>
                  {canteenConfig?.managerBdNo && (
                    <span className="text-[10px] font-mono text-slate-400">
                      BD: {canteenConfig.managerBdNo}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-black text-white truncate">
                  {canteenConfig?.managerName || 'No Manager Set Yet'}
                </h4>
                <div className="text-xs text-slate-300 font-mono">
                  {canteenConfig?.phone ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>{canteenConfig.phone}</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">No contact phone</span>
                  )}
                </div>
              </div>
            </div>

            {/* System Key Settings Section */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <label className="text-xs font-black text-white uppercase tracking-wider">
                    MANAGER SYSTEM KEY (ম্যানেজার সিস্টেম কি)
                  </label>
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                  Default: 1111
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <input
                    type={showSystemKeyInModal ? "text" : "password"}
                    value={systemKeyInput}
                    onChange={(e) => setSystemKeyInput(e.target.value)}
                    maxLength={10}
                    placeholder="1111"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-10 py-2 text-xs font-mono font-bold text-white tracking-widest focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSystemKeyInModal(!showSystemKeyInModal)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                    title={showSystemKeyInModal ? "Hide Key" : "Show Key"}
                  >
                    {showSystemKeyInModal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveSystemKey}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Update Key</span>
                </button>
              </div>

              {keySaveSuccess && (
                <p className="text-xs font-bold text-emerald-400 flex items-center space-x-1 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>সিস্টেম কি সফলভাবে পরিবর্তন ও সেভ করা হয়েছে!</span>
                </p>
              )}
              <p className="text-[10px] text-slate-400 leading-relaxed">
                এই System Key ব্যবহার করে সাইডবার থেকে যে কেউ ম্যানেজার মোডে প্রবেশ করতে পারবে।
              </p>
            </div>

            {/* Member Selection Section */}
            <div className="flex-1 overflow-hidden flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-300 uppercase tracking-wider">
                  SELECT NEW MANAGER FROM MEMBER DATABASE
                </label>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  {members.length} Members
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={managerSearchTerm}
                  onChange={(e) => setManagerSearchTerm(e.target.value)}
                  placeholder="Search by BD No, Rank, or Surname..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-bold"
                />
                {managerSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setManagerSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filtered Members List */}
              <div className="flex-1 overflow-y-auto max-h-60 divide-y divide-slate-800/80 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-2 space-y-1">
                {members
                  .filter((m) => {
                    if (!managerSearchTerm.trim()) return true;
                    const term = managerSearchTerm.toLowerCase().trim();
                    const bd = String(m['BD No'] || '').toLowerCase();
                    const name = String(m['Surname'] || '').toLowerCase();
                    const rank = String(m['Rank'] || '').toLowerCase();
                    return bd.includes(term) || name.includes(term) || rank.includes(term);
                  })
                  .slice(0, 60)
                  .map((m, i) => {
                    const isCurrent = String(m['BD No']).trim() === String(canteenConfig?.managerBdNo).trim();
                    return (
                      <div key={m.airman_id || `mgr_m_${m['BD No'] || i}_${i}`} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/70 rounded-xl transition-colors">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 overflow-hidden shrink-0">
                            {m.DP ? (
                              <img src={resolveImageUrl(m.DP)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (m['Surname'] || 'U').charAt(0)
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {m['Rank'] && m['Rank'] !== '-' ? `${m['Rank']} ` : ''}{m['Surname']}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              BD: {m['BD No']} {m.Contact ? `• ${m.Contact}` : ''}
                            </p>
                          </div>
                        </div>

                        {isCurrent ? (
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase shrink-0">
                            Active Manager
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleAssignManager(m);
                              setShowManagerModal(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                          >
                            Set as Manager
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
              <span>Manager change will sync in real-time across the app.</span>
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
