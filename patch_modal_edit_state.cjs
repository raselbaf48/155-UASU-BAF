const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const stateCode = `
  const [editSelectedPresetDays, setEditSelectedPresetDays] = useState<number | null>(null);
  const [editCustomLeaveDays, setEditCustomLeaveDays] = useState<number>(1);
  const [editIsCustomPresetActive, setEditIsCustomPresetActive] = useState<boolean>(false);
  const [editTdyPresetDays, setEditTdyPresetDays] = useState<number | null>(null);
  const [editDepPresetDays, setEditDepPresetDays] = useState<number | null>(null);

  const editLeaveDurationDays = useMemo(() => {
    if (!editFromDate || !editToDate) return 0;
    const f = new Date(editFromDate);
    const t = new Date(editToDate);
    return Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)) + 1;
  }, [editFromDate, editToDate]);

  useEffect(() => {
    if (editingGroup && editingGroup[0].dutyCode === 'LEAVE') {
      if (editLeaveDurationDays <= 10 && !['Sick', 'Recreation', 'Annual'].includes(editLeaveType)) {
        setEditLeaveType('Casual');
      }
    }
  }, [editLeaveDurationDays, editingGroup, editLeaveType]);

  const getEditF295Days = (checked: boolean, opt: string, customVal: number) => {
    return checked ? (opt === '2' ? 2 : opt === '3' ? 3 : customVal) : 0;
  };

  const updateEditToDateWithBase = (baseDays: number, f295Days: number) => {
    if (editFromDate) {
      const d = new Date(editFromDate);
      d.setDate(d.getDate() + baseDays + f295Days - 1);
      setEditToDate(d.toISOString().split('T')[0]);
    }
  };

  const handleEditPresetToggle = (days: number) => {
    if (editSelectedPresetDays === days) {
      setEditSelectedPresetDays(null);
      setEditToDate(editFromDate);
    } else {
      setEditSelectedPresetDays(days);
      setEditIsCustomPresetActive(false);
      updateEditToDateWithBase(days, getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays));
    }
  };

  const handleEditCustomLeaveDaysChange = (days: number) => {
    setEditCustomLeaveDays(days);
    setEditSelectedPresetDays(null);
    setEditIsCustomPresetActive(true);
    updateEditToDateWithBase(days, getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays));
  };

  const handleEditF295Toggle = (checked: boolean) => {
    setEditIncludeF295(checked);
    let currentCustom = editF295CustomDays;
    if (checked && editF295Option === 'custom' && editF295CustomDays === 0) {
      currentCustom = 1;
      setEditF295CustomDays(1);
    }
    
    if (editSelectedPresetDays !== null) {
      updateEditToDateWithBase(editSelectedPresetDays, getEditF295Days(checked, editF295Option, currentCustom));
    } else if (editIsCustomPresetActive) {
      updateEditToDateWithBase(editCustomLeaveDays, getEditF295Days(checked, editF295Option, currentCustom));
    } else {
      const oldF295 = getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays);
      const base = Math.max(1, editLeaveDurationDays - oldF295);
      updateEditToDateWithBase(base, getEditF295Days(checked, editF295Option, currentCustom));
    }
  };

  const handleEditF295OptionChange = (opt: '2' | '3' | 'custom', customVal?: number) => {
    setEditF295Option(opt);
    let currentCustom = editF295CustomDays;
    if (opt === 'custom') {
      currentCustom = customVal ?? Math.max(1, editF295CustomDays);
      setEditF295CustomDays(currentCustom);
    }
    
    if (editSelectedPresetDays !== null) {
      updateEditToDateWithBase(editSelectedPresetDays, getEditF295Days(editIncludeF295, opt, currentCustom));
    } else if (editIsCustomPresetActive) {
      updateEditToDateWithBase(editCustomLeaveDays, getEditF295Days(editIncludeF295, opt, currentCustom));
    } else {
      const oldF295 = getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays);
      const base = Math.max(1, editLeaveDurationDays - oldF295);
      updateEditToDateWithBase(base, getEditF295Days(editIncludeF295, opt, currentCustom));
    }
  };

  const editModalDaysCalc = useMemo(() => {
    const f295Extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
    
    if (!editFromDate || !editToDate) return { grossDays: 0, netLeaveDays: 0, f295Days: 0, totalCalendarDays: 0 };
    const f = new Date(editFromDate);
    const t = new Date(editToDate);
    const gross = Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)) + 1;
    return {
      grossDays: gross,
      netLeaveDays: Math.max(0, gross - f295Extra),
      f295Days: f295Extra,
      totalCalendarDays: gross
    };
  }, [editFromDate, editToDate, editIncludeF295, editF295Option, editF295CustomDays]);
`;

content = content.replace(/const \[refreshKey, setRefreshKey\] = useState<number>\(0\);/, 'const [refreshKey, setRefreshKey] = useState<number>(0);\n' + stateCode);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);
