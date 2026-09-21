import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit2, Trash2, PackagePlus, AlertTriangle, 
  CheckCircle2, RotateCcw, Layers, ArrowDownRight, ArrowUpRight, 
  History, Filter, ShoppingBag, X, Save, AlertCircle, FileSpreadsheet,
  Boxes, ChefHat
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
  'Meat & Poultry',
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
    notes: 'Fresh broiler chicken for daily dishes'
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
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load raw stock logs:', e);
    }
    return [];
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'NORMAL'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RawInventoryItem | null>(null);

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
    notes: ''
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
      // Search
      const q = searchTerm.trim().toLowerCase();
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesNameBn = item.nameBn.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        const matchesSupplier = item.supplier?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesNameBn && !matchesCategory && !matchesSupplier) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Stock status filter
      if (stockStatusFilter === 'LOW') {
        return item.currentStock <= item.minStockAlert;
      } else if (stockStatusFilter === 'NORMAL') {
        return item.currentStock > item.minStockAlert;
      }

      return true;
    });
  }, [items, searchTerm, selectedCategory, stockStatusFilter]);

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

    const prevStock = item.currentStock;
    const newStock = prevStock + qty;
    const today = new Date().toISOString().split('T')[0];
    const cost = parseFloat(restockCost) || item.unitCost;

    // Update item
    setItems(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          currentStock: Math.round(newStock * 100) / 100,
          unitCost: cost,
          lastRestockedDate: today,
          supplier: restockSupplier || i.supplier
        };
      }
      return i;
    }));

    // Add log
    const newLog: RawStockLog = {
      id: `log-${Date.now()}`,
      itemId: item.id,
      itemName: `${item.name} (${item.nameBn})`,
      type: 'RESTOCK',
      quantity: qty,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      cost: qty * cost,
      date: new Date().toLocaleString(),
      notes: restockNotes || (restockSupplier ? `Supplier: ${restockSupplier}` : 'Regular Restock'),
      recordedBy: 'Canteen Manager'
    };
    setLogs(prev => [newLog, ...prev]);

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
            notes: newItemData.notes?.trim()
          };
        }
        return i;
      }));
      setEditingItem(null);
    } else {
      // Add new
      const newItem: RawInventoryItem = {
        id: `raw-${Date.now()}`,
        name: newItemData.name.trim(),
        nameBn: newItemData.nameBn?.trim() || newItemData.name.trim(),
        category: newItemData.category || 'Grains & Pulses',
        unit: newItemData.unit || 'kg',
        currentStock: Number(newItemData.currentStock) || 0,
        minStockAlert: Number(newItemData.minStockAlert) || 5,
        unitCost: Number(newItemData.unitCost) || 0,
        lastRestockedDate: today,
        supplier: newItemData.supplier?.trim(),
        notes: newItemData.notes?.trim()
      };
      setItems(prev => [newItem, ...prev]);

      // Add log
      const newLog: RawStockLog = {
        id: `log-${Date.now()}`,
        itemId: newItem.id,
        itemName: `${newItem.name} (${newItem.nameBn})`,
        type: 'RESTOCK',
        quantity: newItem.currentStock,
        unit: newItem.unit,
        previousStock: 0,
        newStock: newItem.currentStock,
        cost: newItem.currentStock * newItem.unitCost,
        date: new Date().toLocaleString(),
        notes: 'Initial Stock Registration',
        recordedBy: 'Canteen Manager'
      };
      setLogs(prev => [newLog, ...prev]);
    }

    setShowAddModal(false);
  };

  const handleEditItem = (item: RawInventoryItem) => {
    setEditingItem(item);
    setNewItemData({
      name: item.name,
      nameBn: item.nameBn,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      minStockAlert: item.minStockAlert,
      unitCost: item.unitCost,
      supplier: item.supplier || '',
      notes: item.notes || ''
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
              onClick={() => handleOpenRestock()}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>+ RESTOCK</span>
            </button>

            <button
              onClick={() => handleOpenIssue()}
              className="flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-amber-600/20 active:scale-95 cursor-pointer"
            >
              <ChefHat className="w-4 h-4" />
              <span>ISSUE / COOKING</span>
            </button>

            <button
              onClick={() => {
                setEditingItem(null);
                setNewItemData({
                  name: '',
                  nameBn: '',
                  category: 'Grains & Pulses',
                  unit: 'kg',
                  currentStock: 10,
                  minStockAlert: 5,
                  unitCost: 100,
                  supplier: '',
                  notes: ''
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
              className="flex items-center space-x-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              title="View Stock In / Out Log History"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">LOGS</span>
            </button>
          </div>
        )}
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
            <span>Across 8 kitchen categories</span>
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

        {/* Category horizontal scrolling tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {DEFAULT_CATEGORIES.map(cat => {
            const count = cat === 'All' 
              ? items.length 
              : items.filter(i => i.category === cat).length;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-[#4f46e5] text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-750 border border-slate-750'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-700 text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Raw Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/70 border-b border-slate-800 text-slate-400 text-xs font-black uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Item & Details</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4 text-center">Current Stock</th>
                <th className="px-4 py-4 text-center">Min Threshold</th>
                <th className="px-4 py-4 text-right">Unit Cost</th>
                <th className="px-4 py-4 text-right">Total Value</th>
                <th className="px-4 py-4 text-center">Stock Status</th>
                {!readOnly && (
                  <th className="px-5 py-4 text-right">Quick Actions</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 7 : 8} className="px-6 py-12 text-center text-slate-500 font-bold">
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

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isLow ? 'bg-amber-500/[0.02]' : ''
                      }`}
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

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60 inline-block">
                          {item.category}
                        </span>
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

                      {/* Quick Actions */}
                      {!readOnly && (
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleOpenRestock(item)}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-black transition-all"
                              title="Restock this item"
                            >
                              + In
                            </button>

                            <button
                              onClick={() => handleOpenIssue(item)}
                              className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 rounded-lg text-xs font-black transition-all"
                              title="Issue / Deduct for cooking"
                            >
                              - Out
                            </button>

                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                              title="Edit item details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg transition-colors border border-rose-500/20"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
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

      {/* MODAL: Add / Edit Raw Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-400" />
                <span>{editingItem ? 'Edit Raw Item' : 'Add New Raw Item'}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 pt-4">
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
                    {DEFAULT_CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
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

              <div className="grid grid-cols-3 gap-3">
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

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-indigo-500/20 flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingItem ? 'Update Item' : 'Save Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Restock / Stock In */}
      {showRestockModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-emerald-400" />
                <span>Restock Raw Inventory</span>
              </h3>
              <button onClick={() => setShowRestockModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRestock} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Select Raw Item *</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    const it = items.find(i => i.id === e.target.value);
                    setSelectedItemId(e.target.value);
                    if (it) {
                      setRestockCost(String(it.unitCost));
                      setRestockSupplier(it.supplier || '');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 font-medium"
                >
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.nameBn}) - Current: {i.currentStock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Quantity Added * ({items.find(i => i.id === selectedItemId)?.unit || 'unit'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.1"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Unit Cost (৳)</label>
                  <input
                    type="number"
                    step="any"
                    value={restockCost}
                    onChange={(e) => setRestockCost(e.target.value)}
                    placeholder="e.g. 230"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {restockQty && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold flex justify-between">
                  <span>Total Purchase Cost:</span>
                  <span className="font-black">
                    ৳ {Math.round((parseFloat(restockQty) || 0) * (parseFloat(restockCost) || 0)).toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Supplier / Market</label>
                <input
                  type="text"
                  value={restockSupplier}
                  onChange={(e) => setRestockSupplier(e.target.value)}
                  placeholder="e.g. Base Supplier, Kawran Bazar"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Notes / Invoice Ref</label>
                <input
                  type="text"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="e.g. Chalan #4102, Fresh lot"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-emerald-600/20 flex items-center space-x-1.5"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Confirm Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Issue / Kitchen Cooking Deduction */}
      {showIssueModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-400" />
                <span>Issue for Cooking / Use</span>
              </h3>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIssue} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Select Raw Item *</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 font-medium"
                >
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.nameBn}) - Stock: {i.currentStock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Deduct Quantity * ({items.find(i => i.id === selectedItemId)?.unit || 'unit'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.1"
                    value={issueQty}
                    onChange={(e) => setIssueQty(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Reason / Type</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="ISSUE">Kitchen Cooking</option>
                    <option value="WASTAGE">Wastage / Spoiled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Dish / Purpose</label>
                <input
                  type="text"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="e.g. Lunch Biryani, Evening Tea, Snacks"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-amber-600/20 flex items-center space-x-1.5"
                >
                  <ChefHat className="w-4 h-4" />
                  <span>Deduct Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Stock Transaction Logs */}
      {showLogsModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Raw Stock Movements History
                </h3>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {logs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-bold">
                  No stock transactions recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {logs.map(log => (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          log.type === 'RESTOCK' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : log.type === 'WASTAGE' 
                            ? 'bg-rose-500/20 text-rose-400' 
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {log.type === 'RESTOCK' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white truncate">
                            {log.itemName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {log.notes || log.type} • {log.date}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`font-black text-sm ${
                          log.type === 'RESTOCK' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {log.type === 'RESTOCK' ? '+' : '-'}{log.quantity} {log.unit}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Bal: {log.newStock} {log.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-400">{logs.length} Total Logs</span>
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
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
