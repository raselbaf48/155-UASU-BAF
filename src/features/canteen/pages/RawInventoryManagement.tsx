import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit2, Trash2, PackagePlus, AlertTriangle, 
  CheckCircle2, RotateCcw, Layers, ArrowDownRight, ArrowUpRight, 
  History, Filter, ShoppingBag, X, Save, AlertCircle, FileSpreadsheet,
  Boxes, ChefHat, Sparkles, Percent, LayoutGrid, List
} from 'lucide-react';
import { formatMoney, formatNumber } from '../i18n';

export interface RawInventoryItem {
  id: string;
  name: string;
  nameBn: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockAlert: number;
  unitCost: number;
  lastRestockedDate: string;
  supplier?: string;
  notes?: string;
  wastagePercentage?: number;
}

export interface RawStockLog {
  id: string;
  itemId: string;
  itemName: string;
  type: 'RESTOCK' | 'ISSUE' | 'WASTAGE';
  quantity: number;
  unit: string;
  previousStock: number;
  newStock: number;
  cost?: number;
  date: string;
  notes?: string;
  recordedBy?: string;
}

const DEFAULT_CATEGORIES = [
  'All',
  'Grains & Pulses',
  'Dairy & Beverages',
  'Dry Food & Snacks',
  'Packaging & Disposables',
  'Oil & Spices',
  'Frozen Foods',
  'Vegetables'
];

const INITIAL_RAW_ITEMS: RawInventoryItem[] = [
  {
    id: 'raw-1',
    name: 'Chicken',
    nameBn: 'ব্রয়লার মুরগির মাংস',
    category: 'Meat & Poultry',
    unit: 'kg',
    currentStock: 35,
    minStockAlert: 12,
    unitCost: 230,
    lastRestockedDate: '2026-09-18',
    supplier: 'Local Poultry Market',
    notes: 'Fresh broiler chicken for daily dishes',
    wastagePercentage: 30
  },
  {
    id: 'raw-2',
    name: 'Rice',
    nameBn: 'মিনিকেট চাল',
    category: 'Grains & Pulses',
    unit: 'kg',
    currentStock: 140,
    minStockAlert: 40,
    unitCost: 75,
    lastRestockedDate: '2026-09-15',
    supplier: 'Base Ration Depot',
    notes: 'Premium Miniket rice 50kg sacks'
  },
  {
    id: 'raw-3',
    name: 'Dal',
    nameBn: 'মসুর ডাল',
    category: 'Grains & Pulses',
    unit: 'kg',
    currentStock: 42,
    minStockAlert: 15,
    unitCost: 135,
    lastRestockedDate: '2026-09-16',
    supplier: 'Base Ration Depot',
    notes: 'Red split lentils'
  },
  {
    id: 'raw-4',
    name: 'Milk Powder',
    nameBn: 'গুঁড়া দুধ (Dano/Diploma)',
    category: 'Dairy & Beverages',
    unit: 'kg',
    currentStock: 18,
    minStockAlert: 6,
    unitCost: 880,
    lastRestockedDate: '2026-09-17',
    supplier: 'City Super Store',
    notes: 'For canteen milk tea and coffee preparation'
  },
  {
    id: 'raw-5',
    name: 'Tea Bag',
    nameBn: 'টি ব্যাগ / চা পাতা',
    category: 'Dairy & Beverages',
    unit: 'packet',
    currentStock: 48,
    minStockAlert: 15,
    unitCost: 165,
    lastRestockedDate: '2026-09-19',
    supplier: 'Ispahani / Taaza Distributor',
    notes: '100 pcs per box'
  },
  {
    id: 'raw-6',
    name: 'Noodles',
    nameBn: 'কাঁচা নুডলস (Raw Maggi/Egg)',
    category: 'Dry Food & Snacks',
    unit: 'packet',
    currentStock: 75,
    minStockAlert: 25,
    unitCost: 45,
    lastRestockedDate: '2026-09-20',
    supplier: 'Wholesale Store',
    notes: 'Standard family pack noodles'
  },
  {
    id: 'raw-7',
    name: 'Egg',
    nameBn: 'মুরগির ডিম (লাল ডিম)',
    category: 'Meat & Poultry',
    unit: 'pcs',
    currentStock: 280,
    minStockAlert: 80,
    unitCost: 12.5,
    lastRestockedDate: '2026-09-20',
    supplier: 'Poultry Farm Direct',
    notes: 'Daily breakfast and snacks omelet supply'
  },
  {
    id: 'raw-8',
    name: 'Biscuit',
    nameBn: 'বিস্কুট প্যাকেট (টোস্ট / ড্রাই কেক)',
    category: 'Dry Food & Snacks',
    unit: 'packet',
    currentStock: 95,
    minStockAlert: 30,
    unitCost: 35,
    lastRestockedDate: '2026-09-18',
    supplier: 'Olympic / Dan Cake',
    notes: 'Canteen counter biscuits'
  },
  {
    id: 'raw-9',
    name: 'One Time Box',
    nameBn: 'ওয়ান টাইম ফুড বক্স ও কাপ',
    category: 'Packaging & Disposables',
    unit: 'pcs',
    currentStock: 420,
    minStockAlert: 100,
    unitCost: 6.5,
    lastRestockedDate: '2026-09-14',
    supplier: 'Packaging Mart',
    notes: 'Food grade disposable boxes for takeaway'
  },
  {
    id: 'raw-10',
    name: 'Pasta',
    nameBn: 'কাঁচা পাস্তা (Macaroni/Spiral)',
    category: 'Dry Food & Snacks',
    unit: 'kg',
    currentStock: 22,
    minStockAlert: 8,
    unitCost: 145,
    lastRestockedDate: '2026-09-15',
    supplier: 'City Grocery',
    notes: 'Evening snacks pasta preparation'
  },
  {
    id: 'raw-11',
    name: 'Frozen Porota',
    nameBn: 'ফ্রোজেন পরোটা (Kazi/CP)',
    category: 'Frozen Foods',
    unit: 'pcs',
    currentStock: 160,
    minStockAlert: 45,
    unitCost: 16,
    lastRestockedDate: '2026-09-19',
    supplier: 'Deep Freezer Store',
    notes: 'Quick breakfast & night snack'
  },
  {
    id: 'raw-12',
    name: 'Soyabin Oil',
    nameBn: 'সয়াবিন তেল (রূপচাঁদা/তীর)',
    category: 'Oil & Spices',
    unit: 'liter',
    currentStock: 52,
    minStockAlert: 18,
    unitCost: 185,
    lastRestockedDate: '2026-09-16',
    supplier: 'City Edible Oil Co',
    notes: 'Cooking oil 5L bottles'
  },
  {
    id: 'raw-13',
    name: 'Sugar',
    nameBn: 'সাদা চিনি',
    category: 'Oil & Spices',
    unit: 'kg',
    currentStock: 38,
    minStockAlert: 12,
    unitCost: 132,
    lastRestockedDate: '2026-09-17',
    supplier: 'Local Wholesale',
    notes: 'For tea, coffee and desserts'
  },
  {
    id: 'raw-14',
    name: 'Onion',
    nameBn: 'পেঁয়াজ (দেশি / আমদানিকৃত)',
    category: 'Vegetables',
    unit: 'kg',
    currentStock: 28,
    minStockAlert: 10,
    unitCost: 78,
    lastRestockedDate: '2026-09-20',
    supplier: 'Local Bazar',
    notes: 'Daily kitchen staple'
  }
];

const INITIAL_RAW_STOCK_LOGS: RawStockLog[] = [
  {
    id: 'log-seed-chicken-restock-1',
    itemId: 'raw-1',
    itemName: 'Chicken (ব্রয়লার মুরগির মাংস)',
    type: 'RESTOCK',
    quantity: 0.7,
    unit: 'kg',
    previousStock: 35,
    newStock: 35.7,
    cost: 230,
    date: '22 Sep 26, 12:40 PM',
    notes: 'Purchased 1 kg (30% Wastage deducted: -0.3 kg, Net stock: +0.7 kg)',
    recordedBy: 'Canteen Expenditure'
  },
  {
    id: 'log-seed-chicken-waste-1',
    itemId: 'raw-1',
    itemName: 'Chicken (ব্রয়লার মুরগির মাংস)',
    type: 'WASTAGE',
    quantity: 0.3,
    unit: 'kg',
    previousStock: 36,
    newStock: 35.7,
    cost: 69,
    date: '22 Sep 26, 12:40 PM',
    notes: '30% processing loss from 1 kg purchased (Wastage Log)',
    recordedBy: 'Auto Wastage Calculation'
  }
];

const STORAGE_KEY = 'canteen_raw_inventory_items_v2';
const LOGS_STORAGE_KEY = 'canteen_raw_stock_logs_v2';

export const RawInventoryManagement: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [items, setItems] = useState<RawInventoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load raw items from localStorage:', e);
    }
    return INITIAL_RAW_ITEMS;
  });

  const [logs, setLogs] = useState<RawStockLog[]>(() => {
    try {
      const stored = localStorage.getItem(LOGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // If logs are present but don't have wastage log for chicken, merge initial seed
          const hasWastage = parsed.some(l => l.type === 'WASTAGE');
          if (!hasWastage) {
            return [...parsed, ...INITIAL_RAW_STOCK_LOGS];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load raw stock logs:', e);
    }
    return INITIAL_RAW_STOCK_LOGS;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'NORMAL'>('ALL');
  const [logFilter, setLogFilter] = useState<'ALL' | 'RESTOCK' | 'ISSUE' | 'WASTAGE'>('ALL');
  const [viewMode, setViewMode] = useState<'BOX' | 'TABLE'>('BOX');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RawInventoryItem | null>(null);
  const [editModalTab, setEditModalTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');

  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [restockQty, setRestockQty] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  const [issueQty, setIssueQty] = useState('');
  const [issueType, setIssueType] = useState<'ISSUE' | 'WASTAGE'>('ISSUE');
  const [issueNotes, setIssueNotes] = useState('');

  const [newItemData, setNewItemData] = useState<Partial<RawInventoryItem>>({
    name: '',
    nameBn: '',
    category: 'Grains & Pulses',
    unit: 'kg',
    currentStock: 10,
    minStockAlert: 5,
    unitCost: 100,
    supplier: '',
    notes: '',
    wastagePercentage: 0
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save raw items:', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save raw stock logs:', e);
    }
  }, [logs]);

  // Real-time synchronization when raw inventory is updated (e.g. from POS sales or other tabs)
  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
          }
        }
      } catch (e) {}

      try {
        const storedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
        if (storedLogs) {
          const parsedLogs = JSON.parse(storedLogs);
          if (Array.isArray(parsedLogs)) {
            setLogs(parsedLogs);
          }
        }
      } catch (e) {}
    };

    window.addEventListener('canteen_raw_inventory_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('canteen_raw_inventory_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0);
    const lowStockItems = items.filter(item => item.currentStock <= item.minStockAlert);
    const outOfStockItems = items.filter(item => item.currentStock <= 0);
    const healthyCount = items.filter(item => item.currentStock > item.minStockAlert).length;
    const healthPercent = totalItems > 0 ? Math.round((healthyCount / totalItems) * 100) : 100;

    return {
      totalItems,
      totalValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      healthPercent
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Exclude 'Meat & Poultry' category
      if (item.category === 'Meat & Poultry') {
        return false;
      }

      // Search
      const q = searchTerm.trim().toLowerCase();
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesNameBn = item.nameBn.toLowerCase().includes(q);
        const matchesSupplier = item.supplier?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesNameBn && !matchesSupplier) {
          return false;
        }
      }

      // Stock status filter
      if (stockStatusFilter === 'LOW') {
        return item.currentStock <= item.minStockAlert;
      } else if (stockStatusFilter === 'NORMAL') {
        return item.currentStock > item.minStockAlert;
      }

      return true;
    });
  }, [items, searchTerm, stockStatusFilter]);

  // Open Restock Modal for specific item
  const handleOpenRestock = (item?: RawInventoryItem) => {
    if (item) {
      setSelectedItemId(item.id);
      setRestockCost(String(item.unitCost));
      setRestockSupplier(item.supplier || '');
    } else if (items.length > 0) {
      setSelectedItemId(items[0].id);
      setRestockCost(String(items[0].unitCost));
      setRestockSupplier(items[0].supplier || '');
    }
    setRestockQty('');
    setRestockNotes('');
    setShowRestockModal(true);
  };

  // Open Issue / Kitchen usage Modal
  const handleOpenIssue = (item?: RawInventoryItem) => {
    if (item) {
      setSelectedItemId(item.id);
    } else if (items.length > 0) {
      setSelectedItemId(items[0].id);
    }
    setIssueQty('');
    setIssueType('ISSUE');
    setIssueNotes('');
    setShowIssueModal(true);
  };

  // Submit Restock
  const handleSaveRestock = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(restockQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid restock quantity');
      return;
    }

    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    const wastagePct = Number(item.wastagePercentage) || 0;
    let netQty = qty;
    let wasteQty = 0;
    if (wastagePct > 0 && wastagePct < 100) {
      wasteQty = Math.round((qty * (wastagePct / 100)) * 1000) / 1000;
      netQty = Math.round((qty - wasteQty) * 1000) / 1000;
    }

    const prevStock = item.currentStock;
    const newStock = Math.round((prevStock + netQty) * 100) / 100;
    const today = new Date().toISOString().split('T')[0];
    const cost = parseFloat(restockCost) || item.unitCost;

    // Update item
    setItems(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          currentStock: newStock,
          unitCost: cost,
          lastRestockedDate: today,
          supplier: restockSupplier || i.supplier
        };
      }
      return i;
    }));

    // Add logs
    const newLogsToAdd: RawStockLog[] = [];
    newLogsToAdd.push({
      id: `log-${Date.now()}`,
      itemId: item.id,
      itemName: `${item.name} (${item.nameBn})`,
      type: 'RESTOCK',
      quantity: netQty,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      cost: qty * cost,
      date: new Date().toLocaleString(),
      notes: wastagePct > 0 
        ? `Purchased: ${qty} ${item.unit} (${wastagePct}% Wastage deducted: -${wasteQty} ${item.unit}, Net: +${netQty} ${item.unit})${restockNotes ? ` • ${restockNotes}` : ''}`
        : restockNotes || (restockSupplier ? `Supplier: ${restockSupplier}` : 'Regular Restock'),
      recordedBy: 'Canteen Manager'
    });

    if (wasteQty > 0) {
      newLogsToAdd.push({
        id: `log-waste-${Date.now()}`,
        itemId: item.id,
        itemName: `${item.name} (${item.nameBn})`,
        type: 'WASTAGE',
        quantity: wasteQty,
        unit: item.unit,
        previousStock: Math.round((prevStock + qty) * 100) / 100,
        newStock,
        cost: (qty * cost) * (wastagePct / 100),
        date: new Date().toLocaleString(),
        notes: `${wastagePct}% processing loss from ${qty} ${item.unit} purchased`,
        recordedBy: 'Auto Wastage Calculation'
      });
    }

    setLogs(prev => [...newLogsToAdd, ...prev]);

    setShowRestockModal(false);
  };

  // Submit Issue / Kitchen Usage
  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(issueQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    if (qty > item.currentStock) {
      const confirmProceed = window.confirm(
        `Quantity (${qty} ${item.unit}) exceeds current available stock (${item.currentStock} ${item.unit}). Do you still want to record this deduction?`
      );
      if (!confirmProceed) return;
    }

    const prevStock = item.currentStock;
    const newStock = Math.max(0, prevStock - qty);

    // Update item
    setItems(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          currentStock: Math.round(newStock * 100) / 100
        };
      }
      return i;
    }));

    // Add log
    const newLog: RawStockLog = {
      id: `log-${Date.now()}`,
      itemId: item.id,
      itemName: `${item.name} (${item.nameBn})`,
      type: issueType,
      quantity: qty,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      date: new Date().toLocaleString(),
      notes: issueNotes || (issueType === 'WASTAGE' ? 'Damaged / Wastage' : 'Kitchen Daily Preparation'),
      recordedBy: 'Canteen Manager'
    };
    setLogs(prev => [newLog, ...prev]);

    setShowIssueModal(false);
  };

  // Add / Edit Item
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemData.name || !newItemData.name?.trim()) {
      alert('Item English name is required');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (editingItem) {
      // Edit mode
      setItems(prev => prev.map(i => {
        if (i.id === editingItem.id) {
          return {
            ...i,
            name: newItemData.name!.trim(),
            nameBn: newItemData.nameBn?.trim() || newItemData.name!.trim(),
            category: newItemData.category || 'Grains & Pulses',
            unit: newItemData.unit || 'kg',
            currentStock: Number(newItemData.currentStock) || 0,
            minStockAlert: Number(newItemData.minStockAlert) || 5,
            unitCost: Number(newItemData.unitCost) || 0,
            supplier: newItemData.supplier?.trim(),
            notes: newItemData.notes?.trim(),
            wastagePercentage: newItemData.wastagePercentage !== undefined ? Number(newItemData.wastagePercentage) : 0
          };
        }
        return i;
      }));
      setEditingItem(null);
    } else {
      // Add new
      const inputStock = Number(newItemData.currentStock) || 0;
      const wastagePct = newItemData.wastagePercentage !== undefined ? Number(newItemData.wastagePercentage) : 0;
      let effectiveStock = inputStock;
      let wasteQty = 0;

      if (inputStock > 0 && wastagePct > 0 && wastagePct < 100) {
        wasteQty = Math.round((inputStock * (wastagePct / 100)) * 1000) / 1000;
        effectiveStock = Math.round((inputStock - wasteQty) * 1000) / 1000;
      }

      const newItem: RawInventoryItem = {
        id: `raw-${Date.now()}`,
        name: newItemData.name.trim(),
        nameBn: newItemData.nameBn?.trim() || newItemData.name.trim(),
        category: newItemData.category || 'Grains & Pulses',
        unit: newItemData.unit || 'kg',
        currentStock: effectiveStock,
        minStockAlert: Number(newItemData.minStockAlert) || 5,
        unitCost: Number(newItemData.unitCost) || 0,
        lastRestockedDate: today,
        supplier: newItemData.supplier?.trim(),
        notes: newItemData.notes?.trim(),
        wastagePercentage: wastagePct
      };
      setItems(prev => [newItem, ...prev]);

      // Add log
      const initialLogs: RawStockLog[] = [];
      initialLogs.push({
        id: `log-${Date.now()}`,
        itemId: newItem.id,
        itemName: `${newItem.name} (${newItem.nameBn})`,
        type: 'RESTOCK',
        quantity: effectiveStock,
        unit: newItem.unit,
        previousStock: 0,
        newStock: effectiveStock,
        cost: inputStock * newItem.unitCost,
        date: new Date().toLocaleString(),
        notes: wastagePct > 0 
          ? `Initial Stock: ${inputStock} ${newItem.unit} (${wastagePct}% Wastage deducted: -${wasteQty} ${newItem.unit}, Net: +${effectiveStock} ${newItem.unit})`
          : 'Initial Stock Registration',
        recordedBy: 'Canteen Manager'
      });

      if (wasteQty > 0) {
        initialLogs.push({
          id: `log-waste-${Date.now()}`,
          itemId: newItem.id,
          itemName: `${newItem.name} (${newItem.nameBn})`,
          type: 'WASTAGE',
          quantity: wasteQty,
          unit: newItem.unit,
          previousStock: inputStock,
          newStock: effectiveStock,
          cost: (inputStock * newItem.unitCost) * (wastagePct / 100),
          date: new Date().toLocaleString(),
          notes: `${wastagePct}% initial processing loss from ${inputStock} ${newItem.unit}`,
          recordedBy: 'Auto Wastage Calculation'
        });
      }

      setLogs(prev => [...initialLogs, ...prev]);
    }

    setShowAddModal(false);
  };

  const handleEditItem = (item: RawInventoryItem) => {
    setEditingItem(item);
    setEditModalTab('DETAILS');
    setNewItemData({
      name: item.name,
      nameBn: item.nameBn,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      minStockAlert: item.minStockAlert,
      unitCost: item.unitCost,
      supplier: item.supplier || '',
      notes: item.notes || '',
      wastagePercentage: item.wastagePercentage || 0
    });
    setShowAddModal(true);
  };

  const handleDeleteItem = (item: RawInventoryItem) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete ${item.name} (${item.nameBn})?`);
    if (confirmDelete) {
      setItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    const confirmReset = window.confirm('Reset raw inventory items to original list? This will restore standard items (Chicken, Rice, Dal, Milk Powder, etc.).');
    if (confirmReset) {
      setItems(INITIAL_RAW_ITEMS);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span>RAW INVENTORY</span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase tracking-wider">
                  কাঁচামাল স্টক
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Kitchen ingredients, packaging & essential canteen raw stock management
              </p>
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setEditingItem(null);
                setEditModalTab('DETAILS');
                setNewItemData({
                  name: '',
                  nameBn: '',
                  category: 'General',
                  unit: 'kg',
                  currentStock: 10,
                  minStockAlert: 5,
                  unitCost: 100,
                  supplier: '',
                  notes: '',
                  wastagePercentage: 0
                });
                setShowAddModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>NEW RAW ITEM</span>
            </button>

            <button
              onClick={() => setShowLogsModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              title="View Stock In / Out Log History"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span>LOGS / হিস্ট্রি</span>
            </button>
          </div>
        )}
      </div>

      {/* Automated Sync Information Banner */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/30 border border-indigo-500/25 rounded-2xl p-4 flex items-start gap-3.5 text-xs shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <div className="font-extrabold text-white flex items-center gap-2">
            <span>স্বয়ংক্রিয় কাঁচামাল স্টক সিস্টেম সক্রিয়</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Automated Restock & Issue Active
            </span>
          </div>
          <div className="text-slate-300 leading-relaxed grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
            <div className="flex items-center gap-2 bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span><strong>Auto-Restock:</strong> Expenditures এ কেনাকাটার সাথে সাথে স্টক স্বয়ংক্রিয়ভাবে বৃদ্ধি পায়।</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
              <span><strong>Auto-Issue:</strong> POS Sales এ মেনু বিক্রি হলে প্রয়োজনীয় কাঁচামাল স্বয়ংক্রিয়ভাবে বিয়োগ হয়।</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
            Total Raw Items
          </div>
          <div className="text-3xl font-black text-white mt-1">
            {stats.totalItems} <span className="text-xs font-bold text-slate-500 uppercase">Items</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span>Kitchen raw stock items</span>
          </div>
        </div>

        {/* Card 2: Total Stock Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
            Total Stock Value
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            {formatMoney(stats.totalValue, 'en')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Current warehouse valuation</span>
          </div>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div 
          onClick={() => setStockStatusFilter(stockStatusFilter === 'LOW' ? 'ALL' : 'LOW')}
          className={`bg-slate-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
            stats.lowStockCount > 0 
              ? 'border-amber-500/40 bg-amber-950/10 hover:border-amber-400' 
              : 'border-slate-800 hover:border-slate-700'
          } ${stockStatusFilter === 'LOW' ? 'ring-2 ring-amber-500' : ''}`}
        >
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center justify-between">
            <span>Low Stock Alert</span>
            {stats.lowStockCount > 0 && (
              <span className="animate-pulse flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </div>
          <div className="text-3xl font-black text-amber-400 mt-1">
            {stats.lowStockCount} <span className="text-xs font-bold text-slate-500 uppercase">Items</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats.lowStockCount > 0 ? 'Click to filter reorder items' : 'All items sufficiently stocked'}
          </div>
        </div>

        {/* Card 4: Inventory Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
            Stock Availability
          </div>
          <div className="text-3xl font-black text-indigo-400 mt-1">
            {stats.healthPercent}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-full rounded-full ${stats.healthPercent > 80 ? 'bg-emerald-500' : stats.healthPercent > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${stats.healthPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Search, Filter Tabs & Reset */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search raw items (e.g. Chicken, Rice, Dal, Milk Powder, Oil, Egg)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick status filters */}
          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shrink-0">
            <button
              onClick={() => setStockStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                stockStatusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setStockStatusFilter('LOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                stockStatusFilter === 'LOW'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-400 hover:bg-slate-700/50'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low ({stats.lowStockCount})</span>
            </button>
            <button
              onClick={() => setStockStatusFilter('NORMAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                stockStatusFilter === 'NORMAL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-400 hover:bg-slate-700/50'
              }`}
            >
              Normal ({items.length - stats.lowStockCount})
            </button>
          </div>

          {/* View Mode Toggle: Box vs Table */}
          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shrink-0">
            <button
              onClick={() => setViewMode('BOX')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'BOX'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Box / Card View (Member DB style)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Box View</span>
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'TABLE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Classic Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          {!readOnly && (
            <button
              onClick={handleResetToDefault}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl transition-colors flex items-center space-x-1.5"
              title="Reset default raw ingredients list"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Reset Defaults</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Inventory Content: Box View or Table View */}
      {viewMode === 'BOX' ? (
        /* Box / Card Grid View (Like Member DB) */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>আইটেমের বক্সে ক্লিক করে সরাসরি তথ্য এডিট বা অপচয় % পরিবর্তন করতে পারেন</span>
            </span>
            <span className="font-mono text-slate-500">Showing {filteredItems.length} items</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-bold">
              <Boxes className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-60" />
              <p className="text-base text-slate-400">No raw items found matching your criteria</p>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="mt-3 px-4 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-xl text-xs font-bold transition-colors inline-block"
                >
                  Clear search filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => {
                const isLow = item.currentStock <= item.minStockAlert;
                const isZero = item.currentStock <= 0;
                const itemValue = item.currentStock * item.unitCost;
                const ratio = item.minStockAlert > 0 ? (item.currentStock / (item.minStockAlert * 2)) * 100 : 100;
                const stockFill = Math.min(100, Math.max(5, ratio));
                const wastagePct = Number(item.wastagePercentage) || 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!readOnly) handleEditItem(item);
                    }}
                    className={`bg-slate-900 border rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all duration-200 relative group flex flex-col justify-between ${
                      !readOnly ? 'cursor-pointer hover:border-indigo-500/70 hover:scale-[1.01] active:scale-[0.99]' : ''
                    } ${
                      isZero
                        ? 'border-rose-500/40 bg-rose-950/10'
                        : isLow
                        ? 'border-amber-500/40 bg-amber-950/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Icon, Names & Status Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                            isZero 
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                              : isLow 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          }`}>
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-white text-base truncate flex items-center gap-1.5" title={item.name}>
                              <span>{item.name}</span>
                            </h4>
                            <p className="text-xs text-slate-400 font-medium truncate" title={item.nameBn}>
                              {item.nameBn}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isZero ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Out
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Low
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Category & Wastage Tag Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60">
                          {item.category}
                        </span>

                        {wastagePct > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Percent className="w-2.5 h-2.5 text-amber-400" />
                            <span>Wastage: {wastagePct}%</span>
                          </span>
                        )}
                      </div>

                      {/* Stock Level Display & Progress Bar */}
                      <div className="mt-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Available Stock
                          </span>
                          <div>
                            <span className={`text-xl font-black ${
                              isZero ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {item.currentStock}
                            </span>
                            <span className="text-xs font-bold text-slate-400 ml-1 uppercase">
                              {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isZero ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${stockFill}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1.5">
                          <span>Min: {item.minStockAlert} {item.unit}</span>
                          <span>Value: ৳{Math.round(itemValue).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Details: Unit Cost & Supplier */}
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Unit Price:</span>
                          <span className="font-bold text-slate-200">৳{item.unitCost} / {item.unit}</span>
                        </div>
                        {item.supplier && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="text-slate-500">Supplier:</span>
                            <span className="text-slate-300 truncate max-w-[150px]" title={item.supplier}>
                              {item.supplier}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Classic Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Edit2 className="w-3 h-3 text-indigo-400" />
              <span className="font-semibold text-slate-300">তথ্য এডিট বা মুছে ফেলতে যে কোনো আইটেমের রো (Row)-তে ক্লিক করুন</span>
              <span className="hidden sm:inline text-slate-500">(Click any row to edit or delete item)</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Total: {filteredItems.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/70 border-b border-slate-800 text-slate-400 text-xs font-black uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">Item & Details</th>
                  <th className="px-4 py-4 text-center">Current Stock</th>
                  <th className="px-4 py-4 text-center">Wastage %</th>
                  <th className="px-4 py-4 text-center">Min Threshold</th>
                  <th className="px-4 py-4 text-right">Unit Cost</th>
                  <th className="px-4 py-4 text-right">Total Value</th>
                  <th className="px-4 py-4 text-center">Stock Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-bold">
                      <Boxes className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-60" />
                      <p>No raw items found matching your criteria</p>
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')} 
                          className="mt-2 text-xs text-indigo-400 hover:underline"
                        >
                          Clear search filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const isLow = item.currentStock <= item.minStockAlert;
                    const isZero = item.currentStock <= 0;
                    const itemValue = item.currentStock * item.unitCost;
                    const ratio = item.minStockAlert > 0 ? (item.currentStock / (item.minStockAlert * 2)) * 100 : 100;
                    const stockFill = Math.min(100, Math.max(5, ratio));
                    const wastagePct = Number(item.wastagePercentage) || 0;

                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => {
                          if (!readOnly) handleEditItem(item);
                        }}
                        className={`hover:bg-slate-800/60 transition-colors ${!readOnly ? 'cursor-pointer' : ''} ${
                          isLow ? 'bg-amber-500/[0.02]' : ''
                        }`}
                        title={!readOnly ? "Click this row to edit item details / তথ্য এডিট করতে ক্লিক করুন" : undefined}
                      >
                        {/* Item Name & Details */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center space-x-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                              isZero 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                : isLow 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                : 'bg-slate-800 text-indigo-400 border border-slate-700'
                            }`}>
                              {item.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                                <span>{item.name}</span>
                                {isLow && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Low
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-medium">
                                {item.nameBn}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Current Stock */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-block text-center">
                            <span className={`text-base font-black ${
                              isZero ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {item.currentStock}
                            </span>
                            <span className="text-xs font-bold text-slate-400 ml-1 uppercase">
                              {item.unit}
                            </span>
                            <div className="w-20 bg-slate-800 h-1.5 rounded-full mt-1 mx-auto overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  isZero ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${stockFill}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* Wastage % */}
                        <td className="px-4 py-3.5 text-center">
                          {wastagePct > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-0.5">
                              {wastagePct}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>

                        {/* Min Threshold */}
                        <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-400">
                          {item.minStockAlert} {item.unit}
                        </td>

                        {/* Unit Cost */}
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-300 text-xs">
                          ৳ {item.unitCost} / {item.unit}
                        </td>

                        {/* Total Value */}
                        <td className="px-4 py-3.5 text-right font-black text-slate-100 text-xs">
                          ৳ {Math.round(itemValue).toLocaleString()}
                        </td>

                        {/* Stock Status Badge */}
                        <td className="px-4 py-3.5 text-center">
                          {isZero ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Stock Out
                            </span>
                          ) : isLow ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Reorder
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer info */}
          <div className="p-3 bg-slate-850 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 px-5">
            <span>Showing {filteredItems.length} of {items.length} raw inventory records</span>
            <span className="text-[11px] text-slate-500 font-medium">Automatic balance check & threshold alerting active</span>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Raw Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    {editingItem ? 'Edit Raw Item' : 'Add New Raw Item'}
                  </h3>
                  {editingItem && (
                    <p className="text-xs text-slate-400">
                      {editingItem.name} <span className="text-slate-500">({editingItem.nameBn})</span>
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If editing item, show Tabs for Details vs Transaction History */}
            {editingItem && (
              <div className="flex items-center gap-2 pt-3 pb-1 border-b border-slate-800/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditModalTab('DETAILS')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    editModalTab === 'DETAILS'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Item Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditModalTab('HISTORY')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    editModalTab === 'HISTORY'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    editModalTab === 'HISTORY' ? 'bg-indigo-700 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {logs.filter(l => l.itemId === editingItem.id).length}
                  </span>
                </button>
              </div>
            )}

            {/* TAB CONTENT */}
            {(!editingItem || editModalTab === 'DETAILS') ? (
              <form onSubmit={handleSaveItem} className="space-y-4 pt-4 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Item Name (English) *</label>
                    <input
                      type="text"
                      required
                      value={newItemData.name || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                      placeholder="e.g. Chicken, Rice, Dal"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Item Name (বাংলা)</label>
                    <input
                      type="text"
                      value={newItemData.nameBn || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, nameBn: e.target.value })}
                      placeholder="যেমন: মুরগির মাংস, মিনিকেট চাল"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
                    <select
                      value={newItemData.category || 'Grains & Pulses'}
                      onChange={(e) => setNewItemData({ ...newItemData, category: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {DEFAULT_CATEGORIES.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Unit of Measure</label>
                    <select
                      value={newItemData.unit || 'kg'}
                      onChange={(e) => setNewItemData({ ...newItemData, unit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="kg">kg (Kilogram)</option>
                      <option value="gm">gm (Gram)</option>
                      <option value="liter">liter (Liter)</option>
                      <option value="pcs">pcs (Pieces)</option>
                      <option value="packet">packet (Packet)</option>
                      <option value="box">box (Box)</option>
                      <option value="bag">bag (Sack/Bag)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Current Stock *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newItemData.currentStock ?? 0}
                      onChange={(e) => setNewItemData({ ...newItemData, currentStock: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Min Alert Level *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newItemData.minStockAlert ?? 5}
                      onChange={(e) => setNewItemData({ ...newItemData, minStockAlert: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Unit Cost (৳) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newItemData.unitCost ?? 0}
                      onChange={(e) => setNewItemData({ ...newItemData, unitCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-amber-400" />
                        <span>Wastage % (অপচয়)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">যেমন: মুরগি ৩০%</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="99"
                        value={newItemData.wastagePercentage ?? 0}
                        onChange={(e) => setNewItemData({ ...newItemData, wastagePercentage: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 30"
                        className="w-full px-3 py-2 bg-slate-800 border border-amber-500/40 rounded-xl text-amber-300 font-bold text-sm focus:outline-none focus:border-amber-400 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400/80">%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      কেনার সময় এই % বাদ দিয়ে নিট স্টক ইনভেন্টরিতে ঢুকবে এবং অপচয় লগে যাবে
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    value={newItemData.supplier || ''}
                    onChange={(e) => setNewItemData({ ...newItemData, supplier: e.target.value })}
                    placeholder="e.g. Base Depot, Kawran Bazar, Aarong Dairy"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Notes / Description</label>
                  <textarea
                    rows={2}
                    value={newItemData.notes || ''}
                    onChange={(e) => setNewItemData({ ...newItemData, notes: e.target.value })}
                    placeholder="Optional notes or specifications..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  ></textarea>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  {editingItem ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteItem(editingItem);
                        setShowAddModal(false);
                      }}
                      className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-bold transition-colors border border-rose-500/20 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Item</span>
                    </button>
                  ) : (
                    <div></div>
                  )}
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-indigo-500/20 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingItem ? 'Update Item' : 'Save Item'}</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* TAB: History (With Restock, Issue & Wastage) */
              <div className="pt-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span>Transaction History (তালিকায় Wastage সহ তারিখ অনুযায়ী)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        handleOpenRestock(editingItem);
                      }}
                      className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-[11px] font-bold transition-colors border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <PackagePlus className="w-3 h-3" />
                      <span>+ Restock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        handleOpenIssue(editingItem);
                      }}
                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg text-[11px] font-bold transition-colors border border-amber-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowDownRight className="w-3 h-3" />
                      <span>- Issue</span>
                    </button>
                  </div>
                </div>

                {/* History Log List */}
                <div className="overflow-y-auto flex-1 max-h-[50vh] space-y-2 pr-1 divide-y divide-slate-800/40">
                  {logs.filter(l => l.itemId === editingItem.id).length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl">
                      <History className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-60" />
                      <p className="text-slate-400 text-xs font-semibold">এই আইটেমের এখনো কোনো হিস্ট্রি (Restock, Issue বা Wastage) নেই</p>
                      <p className="text-slate-500 text-[11px] mt-1">রেস্টক, ইস্যু বা অপচয় হলে স্বয়ংক্রিয়ভাবে তারিখসহ এখানে হিস্ট্রি যুক্ত হবে।</p>
                    </div>
                  ) : (
                    logs
                      .filter(l => l.itemId === editingItem.id)
                      .map(log => {
                        const isRestock = log.type === 'RESTOCK';
                        const isIssue = log.type === 'ISSUE';
                        const isWastage = log.type === 'WASTAGE';

                        return (
                          <div 
                            key={log.id} 
                            className="pt-2 pb-2.5 px-3 rounded-xl bg-slate-950/30 border border-slate-800/60 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 mt-0.5 ${
                                isRestock 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isIssue
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {isRestock && <ArrowUpRight className="w-4 h-4" />}
                                {isIssue && <ArrowDownRight className="w-4 h-4" />}
                                {isWastage && <Percent className="w-4 h-4" />}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-black text-xs uppercase px-2 py-0.5 rounded-md ${
                                    isRestock 
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                      : isIssue
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}>
                                    {log.type}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {log.date}
                                  </span>
                                </div>

                                <div className="mt-1 text-slate-300 text-xs font-semibold">
                                  {isRestock && (
                                    <span className="text-emerald-400 font-black mr-1">+{log.quantity} {log.unit}</span>
                                  )}
                                  {isIssue && (
                                    <span className="text-amber-400 font-black mr-1">-{log.quantity} {log.unit}</span>
                                  )}
                                  {isWastage && (
                                    <span className="text-rose-400 font-black mr-1">-{log.quantity} {log.unit} (Wastage)</span>
                                  )}
                                  <span className="text-slate-400 font-normal">
                                    (Stock: {log.previousStock} → {log.newStock} {log.unit})
                                  </span>
                                </div>

                                {log.notes && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 italic">
                                    Note: {log.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {log.cost ? (
                                <div className="font-mono font-bold text-slate-200 text-xs">
                                  ৳{Math.round(log.cost).toLocaleString()}
                                </div>
                              ) : null}
                              {log.recordedBy && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                  by {log.recordedBy}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Stock Transaction Logs */}
      {showLogsModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <span>Raw Stock Movement Logs</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                      স্টক আদান-প্রদান হিস্ট্রি
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    খরচ (Expenditure) থেকে স্বয়ংক্রিয় রিস্টক ও সেল (POS Sales) থেকে স্বয়ংক্রিয় কাঁচামাল ইস্যুর লগ রেকর্ড
                  </p>
                </div>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter buttons */}
            <div className="py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center space-x-1.5 overflow-x-auto">
                <button
                  onClick={() => setLogFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    logFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  সকল লগ ({logs.length})
                </button>
                <button
                  onClick={() => setLogFilter('RESTOCK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    logFilter === 'RESTOCK'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 text-emerald-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Auto Restock ({logs.filter(l => l.type === 'RESTOCK').length})</span>
                </button>
                <button
                  onClick={() => setLogFilter('ISSUE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    logFilter === 'ISSUE'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-800 text-amber-400 hover:text-white'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Auto Issue ({logs.filter(l => l.type === 'ISSUE').length})</span>
                </button>
                <button
                  onClick={() => setLogFilter('WASTAGE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    logFilter === 'WASTAGE'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-800 text-rose-400 hover:text-white'
                  }`}
                >
                  Wastage ({logs.filter(l => l.type === 'WASTAGE').length})
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                মোট সংরক্ষিত: <span className="font-bold text-white">{logs.length}</span> টি লেনদেন
              </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
              {(() => {
                const filteredLogs = logs.filter(l => {
                  if (logFilter === 'ALL') return true;
                  return l.type === logFilter;
                });

                if (filteredLogs.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 font-bold">
                      <Boxes className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                      <p>কোনো স্টক লগ পাওয়া যায়নি (No logs found)</p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-800/60">
                    {filteredLogs.map(log => {
                      const isRestock = log.type === 'RESTOCK';
                      const isAutoRestock = log.notes?.includes('AUTO RESTOCK') || log.notes?.includes('Expenditure') || log.recordedBy?.includes('Expenditure');
                      const isAutoIssue = log.notes?.includes('AUTO ISSUE') || log.notes?.includes('POS') || log.recordedBy?.includes('POS');

                      return (
                        <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-3 rounded-xl transition-colors">
                          <div className="flex items-start space-x-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isRestock 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : log.type === 'WASTAGE' 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {isRestock ? (
                                <ArrowUpRight className="w-5 h-5" />
                              ) : (
                                <ArrowDownRight className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="font-extrabold text-sm text-white">
                                  {log.itemName}
                                </span>
                                {isAutoRestock && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    [AUTO RESTOCK - EXPENDITURE]
                                  </span>
                                )}
                                {isAutoIssue && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    [AUTO ISSUE - MENU SALE]
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>পূর্ববর্তী: <strong className="text-slate-300">{log.previousStock} {log.unit}</strong></span>
                                <span>→</span>
                                <span>নতুন ব্যালেন্স: <strong className={isRestock ? 'text-emerald-400' : 'text-amber-400'}>{log.newStock} {log.unit}</strong></span>
                                {log.cost ? (
                                  <span>• খরচ: <strong className="text-emerald-400">৳ {Math.round(log.cost).toLocaleString()}</strong></span>
                                ) : null}
                              </div>

                              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3">
                                <span>রেফারেন্স: {log.notes || log.type}</span>
                                <span>• বাই: {log.recordedBy || 'System Auto'}</span>
                                <span>• {log.date}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 sm:self-center pl-12 sm:pl-0">
                            <div className={`font-black text-base ${
                              isRestock ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                              {isRestock ? '+' : '-'}{log.quantity} <span className="text-xs uppercase">{log.unit}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Bal: {log.newStock} {log.unit}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-800 shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                স্বয়ংক্রিয় স্টক লগিং সক্রিয়
              </span>
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                বন্ধ করুন (Close)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
