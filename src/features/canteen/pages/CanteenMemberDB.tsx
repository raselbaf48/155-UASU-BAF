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
  Loader2,
  Save,
  Check,
  FileText,
  LayoutGrid,
  List,
  Award,
  Edit3,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl, getCanteenConfig } from '../utils/canteenSettings';
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
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OFFICER' | 'JCO' | 'AIRMEN' | 'STAFF'>('ALL');
  const [viewMode, setViewMode] = useState<'BOX' | 'TABLE'>('BOX');
  
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

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'excel'>('single');

  // Single Member Form State
  const [singleMember, setSingleMember] = useState({
    bdNo: '',
    rank: 'LAC',
    rankBn: 'এলএসি',
    surname: '',
    nameBn: '',
    contact: '',
    role: 'Member',
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

  // Helper to format & sort members with strictly normalized seniority numbers
  const sortMembers = (data: any[]) => {
    const localSeniorityMap = getLocalSeniorityMap();
    const formatted = data
      .filter((m: any) => {
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
          airman_id: m.airman_id || `airman-${m['BD No']}`,
          "BD No": String(m['BD No'] || '').trim(),
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

    return () => {
      window.removeEventListener('canteen_members_updated', handleSync);
    };
  }, []);

  // Filter members by search and role
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (!searchTerm.trim()) {
        if (roleFilter === 'ALL') return true;
        const weight = getRankWeight(m['Rank']);
        if (roleFilter === 'OFFICER') return weight >= 1 && weight <= 10;
        if (roleFilter === 'JCO') return weight >= 20 && weight <= 29;
        if (roleFilter === 'AIRMEN') return weight >= 30 && weight <= 39;
        if (roleFilter === 'STAFF') {
          const r = String(m['Role'] || '').toLowerCase();
          return r.includes('staff') || r.includes('cook') || r.includes('manager') || r.includes('cashier');
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
      if (roleFilter === 'OFFICER') return weight >= 1 && weight <= 10;
      if (roleFilter === 'JCO') return weight >= 20 && weight <= 29;
      if (roleFilter === 'AIRMEN') return weight >= 30 && weight <= 39;
      if (roleFilter === 'STAFF') {
        const r = String(m['Role'] || '').toLowerCase();
        return r.includes('staff') || r.includes('cook') || r.includes('manager') || r.includes('cashier');
      }
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
    const cleanBd = singleMember.bdNo.replace(/^BD\/?/i, '').trim();
    if (!cleanBd || !singleMember.surname.trim()) {
      alert('Please enter both BD No and Surname.');
      return;
    }

    setIsSavingSingle(true);
    let finalDp = singleMember.dp.trim();
    if (finalDp.includes('photos.app.goo.gl')) {
      finalDp = await fetchDirectImageUrl(finalDp);
    }

    const nameBn = singleMember.nameBn?.trim() || '';
    const rankBn = singleMember.rankBn?.trim() || '';

    const payload = {
      airman_id: `airman-${cleanBd}`,
      "BD No": cleanBd,
      "Rank": singleMember.rank === '-' ? '-' : (singleMember.rank.trim() || 'LAC'),
      "Surname": singleMember.surname.trim(),
      "Contact": singleMember.contact.trim(),
      "Role": singleMember.role || 'Member',
      DP: finalDp || null,
      Due: 0,
      Name_BN: nameBn,
      name_bn: nameBn,
      Rank_BN: rankBn,
      rank_bn: rankBn
    };

    try {
      if (nameBn) {
        await saveMemberBanglaName(
          payload.airman_id || cleanBd,
          nameBn,
          [cleanBd, singleMember.surname.trim()]
        );
      }
      if (rankBn) {
        await saveMemberBanglaRank(
          payload.airman_id || cleanBd,
          rankBn,
          [cleanBd]
        );
      }
      const { error } = await supabase.from('Canteen_Member').upsert([payload], { onConflict: 'airman_id' });
      if (error) throw error;

      setIsSavedSingle(true);
      showToast(`Member #${cleanBd} (${payload.Surname}) saved to Cloud!`);

      // Update local cache and global in-memory cache
      const updated = sortMembers([payload, ...members.filter(m => m.airman_id !== payload.airman_id)]);
      setMembers(updated);
      setCanteenMembersCache(updated);
      localStorage.setItem('canteen_members_cache', JSON.stringify(updated));
      localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
        dp: payload.DP || '',
        due: 0,
        rank: payload.Rank,
        surname: payload.Surname,
        contact: payload.Contact,
        bdNo: cleanBd
      }));
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));

      setTimeout(() => {
        setIsSavedSingle(false);
        setIsSavingSingle(false);
        setShowAddModal(false);
        setSingleMember({ bdNo: '', rank: 'LAC', rankBn: 'এলএসি', surname: '', nameBn: '', contact: '', role: 'Member', dp: '' });
      }, 900);
    } catch (err: any) {
      alert('Error saving to Supabase Cloud: ' + (err.message || err));
      setIsSavingSingle(false);
    }
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

      const bdNo = findVal(['bd no', 'bdno', 'bd', 'id', 'service no']).replace(/^BD\/?/i, '').trim();
      const rank = findVal(['rank', 'designation']) || 'LAC';
      const surname = findVal(['surname', 'name', 'full name', 'member name']) || '';
      const contact = findVal(['contact', 'mobile', 'phone', 'mobile no']) || '';
      const role = findVal(['role', 'type']) || 'Member';

      const isValid = Boolean(bdNo && surname);
      const error = !bdNo ? 'Missing BD No' : !surname ? 'Missing Surname/Name' : undefined;

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

  // Save Edited Member
  const handleSaveEditMember = async () => {
    if (!editMember) return;
    const cleanBd = String(editMember['BD No'] || '').replace(/^BD\/?/i, '').trim();
    if (!cleanBd || !editMember['Surname']) {
      alert('BD No and Surname are required.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const originalAirmanId = editMember.originalAirmanId || editMember.airman_id;
      const originalBdClean = String(editMember.originalBdNo || originalAirmanId || '').replace(/\D/g, '');
      const isBdChanged = Boolean(originalBdClean && cleanBd && originalBdClean !== cleanBd);

      // Preserve existing airman_id (e.g. BD/473431) unless BD No was deliberately changed
      const targetAirmanId = isBdChanged ? `airman-${cleanBd}` : (originalAirmanId || `airman-${cleanBd}`);

      const memberSeniority = editMember.Seniority !== undefined ? editMember.Seniority : editMember.seniority;
      // Persist Bengali Name & Rank
      const nameBn = String(editMember.nameBn !== undefined ? editMember.nameBn : (getMemberBanglaName(editMember) ?? '')).trim();
      const rankBn = String(editMember.rankBn !== undefined ? editMember.rankBn : (getMemberBanglaRank(editMember) ?? '')).trim();

      const payload: any = {
        ...editMember,
        airman_id: targetAirmanId,
        "BD No": cleanBd,
        "Rank": editMember['Rank'] || 'LAC',
        "Surname": String(editMember['Surname'] || '').trim(),
        "Contact": String(editMember['Contact'] || '').trim(),
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
      delete payload.originalAirmanId;
      delete payload.originalBdNo;

      // If BD No was actually modified, remove old airman_id record to prevent duplicates
      if (isBdChanged && originalAirmanId && originalAirmanId !== targetAirmanId) {
        try {
          await supabase.from('Canteen_Member').delete().eq('airman_id', originalAirmanId);
        } catch (e) {
          console.warn('Note deleting old member row:', e);
        }
      }

      if (nameBn) {
        await saveMemberBanglaName(
          targetAirmanId,
          nameBn,
          [cleanBd, payload.Surname]
        );
      }
      if (rankBn) {
        await saveMemberBanglaRank(
          targetAirmanId,
          rankBn,
          [cleanBd]
        );
      }

      // Persist Seniority if available
      if (memberSeniority !== undefined && memberSeniority !== null) {
        try {
          await saveMemberSeniority(cleanBd, Number(memberSeniority));
        } catch (e) {
          console.warn('Note saving seniority:', e);
        }
      }

      // Upsert to Supabase Cloud
      const { error } = await supabase.from('Canteen_Member').upsert([payload], { onConflict: 'airman_id' });
      if (error) throw error;

      // Close Edit modal immediately
      setIsSavedEdit(true);
      setEditMember(null);

      // Play audio feedback chime
      playCelebrationSound();

      // Trigger dynamic celebration animation
      setSaveSuccessBanner({
        bdNo: cleanBd,
        name: payload.Surname,
        rank: payload.Rank,
        nameBn: nameBn || undefined
      });
      setTimeout(() => setSaveSuccessBanner(null), 4000);

      // Update local state and global in-memory cache
      const updated = sortMembers(members.map(m => {
        const mKey = String(m.airman_id || m['BD No']).trim();
        const origKey = String(originalAirmanId || '').trim();
        const targetKey = String(targetAirmanId).trim();
        if (mKey === origKey || mKey === targetKey || String(m['BD No']).replace(/\D/g, '') === cleanBd) {
          return { ...m, ...payload };
        }
        return m;
      }));
      setMembers(updated);
      setCanteenMembersCache(updated);
      localStorage.setItem('canteen_members_cache', JSON.stringify(updated));
      localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
        dp: payload.DP || '',
        due: payload.Due,
        rank: payload.Rank,
        surname: payload.Surname,
        contact: payload.Contact,
        bdNo: cleanBd
      }));

      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));
    } catch (err: any) {
      alert('Error updating member: ' + (err.message || err));
    } finally {
      setIsSavingEdit(false);
      setIsSavedEdit(false);
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

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {(['ALL', 'OFFICER', 'JCO', 'AIRMEN', 'STAFF'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400/50'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 border border-slate-700/60'
                }`}
              >
                {r === 'ALL' ? 'All' : r === 'OFFICER' ? 'Officers' : r === 'JCO' ? 'JCOs' : r === 'AIRMEN' ? 'Airmen' : 'Staff'}
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
                key={member.airman_id}
                className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 rounded-3xl p-5 border border-slate-800/80 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start">
                  <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-13 h-13 rounded-2xl bg-slate-950 border border-slate-700/80 flex items-center justify-center font-black text-xl text-cyan-400 overflow-hidden shrink-0 shadow-inner">
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

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSeniorityEditMember(member);
                          }}
                          className="font-mono text-emerald-400 font-black text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs"
                          title="Seniority / জ্যেষ্ঠতা নম্বর (Click to edit)"
                        >
                          #{member.seniority || member.Seniority || (i + 1)}
                        </button>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                          {member['Rank']}
                          {getMemberBanglaRank(member) ? ` (${getMemberBanglaRank(member)})` : ''}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          BD: {member['BD No']}
                        </span>
                        {member.Role && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                            member.Role.toLowerCase() === 'manager'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : member.Role.toLowerCase() === 'staff' || member.Role.toLowerCase() === 'cook'
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {member.Role}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-1.5 flex-wrap">
                        <h3 className="font-black text-white text-base leading-snug group-hover:text-cyan-300 transition-colors">
                          {member['Surname']}
                        </h3>
                        {(() => {
                          const bn = getMemberBanglaName(member);
                          return bn ? (
                            <span className="text-emerald-400 font-bold text-xs font-sans">
                              ({bn})
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {member['Contact'] && (
                        <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{member['Contact']}</span>
                        </p>
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
                      key={member.airman_id || i}
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
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                          member.Role?.toLowerCase() === 'manager'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : member.Role?.toLowerCase() === 'staff' || member.Role?.toLowerCase() === 'cook'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {member.Role || 'Member'}
                        </span>
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

                {/* Line 2: BD No on Left, Role on Right - SIDE BY SIDE */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      BD No / সার্ভিস নং <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 474455"
                      value={singleMember.bdNo}
                      onChange={(e) => setSingleMember({ ...singleMember, bdNo: e.target.value })}
                      className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold font-mono border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      Role in Canteen
                    </label>
                    <select
                      value={singleMember.role}
                      onChange={(e) => setSingleMember({ ...singleMember, role: e.target.value })}
                      className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      {['Member', 'Manager', 'Staff', 'Cook', 'Cashier'].map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
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

                {/* Line 4: Contact */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Contact / Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 01712345678"
                    value={singleMember.contact}
                    onChange={(e) => setSingleMember({ ...singleMember, contact: e.target.value })}
                    className="w-full bg-slate-950 text-white rounded-xl px-3 py-2.5 text-xs font-bold border border-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
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
                      isSaving={isSavingSingle}
                      isSaved={isSavedSingle}
                      idleText="Save Member to Cloud"
                      savingText="Saving to Cloud..."
                      savedText="Member Saved to Cloud! ✓"
                      className="w-full py-3.5 text-xs font-black tracking-widest cursor-pointer"
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
              <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                <span>Edit Member #{editMember['BD No']}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditMember(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
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
                    value={editMember['Rank'] ?? '-'}
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

              {/* Line 2: BD No on Left, Role on Right - SIDE BY SIDE */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    BD No / সার্ভিস নং
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 17, 9241, 474455..."
                    value={editMember['BD No'] || ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/^BD\/?/i, '').trim();
                      setEditMember({ 
                        ...editMember, 
                        "BD No": clean,
                        airman_id: `airman-${clean}`
                      });
                    }}
                    className="w-full bg-slate-950 text-white placeholder-slate-600 rounded-xl px-2.5 py-2.5 text-xs font-bold font-mono border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Role / ভূমিকা
                  </label>
                  <select
                    value={editMember['Role'] || 'Member'}
                    onChange={(e) => setEditMember({ ...editMember, Role: e.target.value })}
                    className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {['Member', 'Manager', 'Staff', 'Cook', 'Cashier'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
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

              {/* Line 4: Contact */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Contact / মোবাইল নং
                </label>
                <input
                  type="text"
                  placeholder="e.g. 017xxxxxxxx, 018xxxxxxxx..."
                  value={editMember['Contact'] || ''}
                  onChange={(e) => setEditMember({ ...editMember, Contact: e.target.value })}
                  className="w-full bg-slate-950 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-xs font-bold border border-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
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
                isSaving={isSavingEdit}
                isSaved={isSavedEdit}
                idleText="Save Changes to Cloud"
                savingText="Saving to Cloud..."
                savedText="Saved to Cloud! ✓"
                className="w-full py-3 text-xs font-black tracking-widest cursor-pointer"
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
                  <span>Saved successfully to Cloud! {saveSuccessBanner.nameBn ? `(${saveSuccessBanner.nameBn})` : ''}</span>
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
    </div>
  );
};
