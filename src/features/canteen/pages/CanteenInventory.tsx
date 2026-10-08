import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Edit2, Trash2, ImageIcon, Save, X, Loader2, 
  AlertTriangle, CheckCircle2, ChefHat, Sparkles, AlertCircle, 
  ShoppingBag, History, TrendingUp, DollarSign, Calendar, User, 
  Percent, ArrowRight, UtensilsCrossed, Info, Lock, Eye, EyeOff,
  Upload
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl, getCanteenConfig, getItemDisplayName, CanteenConfig } from '../utils/canteenSettings';
import { getCanteenMenuCache, fetchCanteenMenuOnce } from '../utils/canteenMenuData';
import { processGalleryImage } from '../utils/imageUpload';
import { SaveButton } from '../components/SaveButton';
import { 
  RecipeIngredient, 
  getRecipeForMenuItem, 
  saveRecipeForMenuItem, 
  getRawInventoryItems, 
  RawInventoryItem, 
  getMenuRecipes,
  calculateMenuItemCost,
  getEffectiveRawUnitCost,
  ensureCookingIngredients,
  formatRecipeRawItemsString,
  getIngredientToInventoryRatio,
  getRawItemSubUnitInfo,
  decodeNotesMeta,
  RAW_ITEMS_STORAGE_KEY,
  deduplicateRawItems,
  calculateMenuItemStockInfo,
  isReadymadeItem
} from '../utils/recipeManager';
import {
  get20PaxRecipes,
  calculateMenuPortionCostFrom20Pax,
  Recipe20PaxMap
} from './RawDistributionPage';
import {
  getMenuItemBanglaName,
  saveMenuItemBanglaName,
  fetchMenuBanglaNamesFromCloud
} from '../utils/menuBanglaNames';

export const CanteenInventory: React.FC<{readOnly?: boolean}> = ({readOnly = false}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());

  useEffect(() => {
    const handleCfgUpdate = (e: any) => {
      setCanteenConfig(e.detail || getCanteenConfig());
    };
    window.addEventListener('canteen_settings_updated', handleCfgUpdate);
    window.addEventListener('storage', handleCfgUpdate);
    return () => {
      window.removeEventListener('canteen_settings_updated', handleCfgUpdate);
      window.removeEventListener('storage', handleCfgUpdate);
    };
  }, []);

  const [items, setItems] = useState<any[]>(() => {
    const cached = getCanteenMenuCache();
    return cached.map(it => ({
      ...it,
      nameBn: it.nameBn || it.name_bn || it['Name (BN)'] || getMenuItemBanglaName(it) || '',
      name_bn: it.nameBn || it.name_bn || it['Name (BN)'] || getMenuItemBanglaName(it) || ''
    }));
  });
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [isSavedAdd, setIsSavedAdd] = useState(false);
  const [isSavingModal, setIsSavingModal] = useState(false);
  const [isSavedModal, setIsSavedModal] = useState(false);
  const [isSavingQuick, setIsSavingQuick] = useState(false);
  const [isSavedQuick, setIsSavedQuick] = useState(false);
  
  const [newItem, setNewItem] = useState({
    name: '',
    nameBn: '',
    category: 'SNACKS',
    price: 0,
    cost: 0,
    rawItem: '',
    DP: ''
  });
  const [resolvingItemDp, setResolvingItemDp] = useState(false);

  const handleAutoResolveItemDp = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes('photos.app.goo.gl') || trimmed.includes('photos.google.com/share') || trimmed.includes('drive.google.com')) {
      setResolvingItemDp(true);
      try {
        const direct = await fetchDirectImageUrl(trimmed);
        if (direct && direct !== trimmed) {
          setNewItem(prev => ({ ...prev, DP: direct }));
        }
      } catch (e) {
        console.warn('Item DP resolution failed:', e);
      } finally {
        setResolvingItemDp(false);
      }
    }
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Recipe & Raw Inventory states
  const [recipes, setRecipes] = useState<Record<string, RecipeIngredient[]>>(() => getMenuRecipes());
  const [recipes20Pax, setRecipes20Pax] = useState<Recipe20PaxMap>(() => get20PaxRecipes());
  const [availableRawItems, setAvailableRawItems] = useState<RawInventoryItem[]>(() => getRawInventoryItems());
  const [itemRecipe, setItemRecipe] = useState<RecipeIngredient[]>([]);
  const [showCostAndRawItem, setShowCostAndRawItem] = useState(false);

  const fetchRawItems = async () => {
    try {
      const { data, error } = await supabase.from('Canteen_Inventory').select('*');
      if (!error && data && data.length > 0) {
        const parsedRaw = data.map((r: any) => {
          const meta = decodeNotesMeta(r.notes);
          const sub = r['Sub Unit'] ?? r.subUnit ?? r.sub_unit ?? meta.subUnit;
          const pSize = Number(r.packSize) || Number(meta.packSize) || (['kg', 'কেজি'].includes((r.unit || '').toLowerCase()) ? 1000 : (['liter', 'ltr', 'লিটার'].includes((r.unit || '').toLowerCase()) ? 1000 : 1));
          const dpUrl = r.DP || r.dp || meta.dp || r.image || undefined;
          const resolvedType = r.itemType || meta.itemType || (isReadymadeItem(r) ? 'READY_MADE' : 'RAW');
          return {
            ...r,
            itemType: resolvedType,
            dp: dpUrl,
            DP: dpUrl,
            image: dpUrl,
            subUnit: sub,
            packSize: pSize,
            hasSubUnits: r.hasSubUnits ?? meta.hasSubUnits ?? Boolean(sub && sub !== r.unit)
          };
        });
        const currentLocal = getRawInventoryItems();
        const combined = [...currentLocal, ...parsedRaw];
        const { deduplicated } = deduplicateRawItems(combined);
        const sortedRaw = deduplicated.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        setAvailableRawItems(sortedRaw);
        try {
          localStorage.setItem(RAW_ITEMS_STORAGE_KEY, JSON.stringify(sortedRaw));
        } catch {}
      } else {
        const local = getRawInventoryItems();
        setAvailableRawItems(local);
      }
    } catch (e) {
      console.warn('Failed to load raw items from DB in CanteenInventory:', e);
      const local = getRawInventoryItems();
      setAvailableRawItems(local);
    }
  };

  const fetchItems = async () => {
    setLoading(false); // Instant load
    try {
        const data = await fetchCanteenMenuOnce();
        const error = null;
        if (!error && data && data.length > 0) {
            const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
            const formatted = data.map((it: any) => {
              const itemRec = getRecipeForMenuItem(it.id, it.name);
              const costRes = calculateMenuItemCost(itemRec, rawList);
              const prodCost = costRes.totalCost;
              const resolvedCost = (itemRec.length > 0 || prodCost > 0) ? prodCost : Number(it.Cost ?? it.cost ?? 0);
              const resolvedRawItem = itemRec.length > 0 ? formatRecipeRawItemsString(itemRec, rawList) : (it['Raw Item'] ?? it.rawItem ?? it.raw_item ?? '');
              
              // Real-time DB sync: if DB Cost or Raw Item differs from resolved recipe calculation, sync back to DB silently
              if (itemRec.length > 0 && (Number(it.Cost) !== resolvedCost || it['Raw Item'] !== resolvedRawItem)) {
                supabase.from('Canteen_Menu').update({
                  Cost: resolvedCost,
                  'Raw Item': resolvedRawItem
                }).eq('id', it.id).then();
              }

              return {
                ...it,
                price: Number(it.price) || 0,
                cost: resolvedCost,
                Cost: resolvedCost,
                rawItem: resolvedRawItem,
                'Raw Item': resolvedRawItem
              };
            });
            const sorted = formatted.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
            setItems(sorted);
        } else {
            console.error('Failed or empty fetch:', error);
        }
    } catch (err) {
        console.error('Exception fetching items:', err);
    }
  };

  useEffect(() => {
    // Run both immediately in parallel without sequential delay
    fetchRawItems();
    fetchItems();

    // Listen to local/tab raw inventory updates for instant REALTIME reflection across tabs & modals
    const handleRawSync = () => {
      const fresh = getRawInventoryItems();
      setAvailableRawItems(fresh);
    };
    window.addEventListener('canteen_raw_inventory_updated', handleRawSync);
    window.addEventListener('storage', handleRawSync);

    // Realtime channel for Canteen_Menu with unique channel name
    const menuChannel = supabase
      .channel(`canteen_menu_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Menu' }, () => {
        fetchItems();
      })
      .subscribe();

    // Realtime channel for Canteen_Inventory with unique channel name
    const inventoryChannel = supabase
      .channel(`canteen_inv_catalog_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Inventory' }, () => {
        fetchRawItems().then(() => fetchItems());
      })
      .subscribe();

    return () => {
      window.removeEventListener('canteen_raw_inventory_updated', handleRawSync);
      window.removeEventListener('storage', handleRawSync);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, []);

  // Quick Recipe Modal for an individual menu item
  const [quickRecipeItem, setQuickRecipeItem] = useState<any | null>(null);
  const [quickRecipeIngredients, setQuickRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeNotice, setRecipeNotice] = useState<string>('');

  // Unified Item Details Modal (Tab 1: Edit & Recipe, Tab 2: Sales History)
  const [selectedItemForModal, setSelectedItemForModal] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<'EDIT' | 'HISTORY'>('EDIT');
  const [modalFormData, setModalFormData] = useState({
    name: '',
    nameBn: '',
    category: 'SNACKS',
    price: 0,
    cost: 0,
    rawItem: '',
    DP: ''
  });
  const [modalRecipe, setModalRecipe] = useState<RecipeIngredient[]>([]);
  const [itemSalesHistory, setItemSalesHistory] = useState<any[]>([]);
  const [resolvingModalDp, setResolvingModalDp] = useState(false);
  const [modalNotice, setModalNotice] = useState<string>('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const handleOpenItemModal = (item: any) => {
    if (readOnly) return;
    const rawList = getRawInventoryItems();
    setAvailableRawItems(rawList);
    setSelectedItemForModal(item);
    setModalTab('EDIT');
    setModalNotice('');
    setHistorySearchTerm('');
    const existingRecipe = getRecipeForMenuItem(item.id, item.name);
    const normalizedRecipe = existingRecipe.map(ing => {
      const raw = rawList.find(r => r.id === ing.rawItemId || (r.name && ing.rawItemName && r.name.toLowerCase() === ing.rawItemName.toLowerCase()));
      if (raw) {
        const sub = getRawItemSubUnitInfo(raw);
        const validUnits = [
          ...(sub.hasSubUnit && sub.subUnit ? [sub.subUnit.toLowerCase()] : []),
          ...(raw.unit ? [raw.unit.toLowerCase()] : [])
        ];
        let unit = (ing.unit || '').trim();
        if (sub.hasSubUnit && sub.subUnit) {
          if (!unit || !validUnits.includes(unit.toLowerCase()) || unit.toLowerCase() === (raw.unit || '').toLowerCase()) {
            unit = sub.subUnit;
          }
        } else if (!unit && raw.unit) {
          unit = raw.unit;
        }
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit
        };
      }
      return ing;
    });

    const recipeCost = calculateMenuItemCost(normalizedRecipe, rawList).totalCost;
    const initialCost = normalizedRecipe.length > 0 ? recipeCost : Number(item.Cost ?? item.cost ?? 0);
    const initialRawItem = normalizedRecipe.length > 0 
      ? formatRecipeRawItemsString(normalizedRecipe, rawList) 
      : (item['Raw Item'] ?? item.rawItem ?? '');
    const initialBnName = item.nameBn || item.name_bn || item['Name (BN)'] || getMenuItemBanglaName(item) || '';
    setModalFormData({
      name: item.name || '',
      nameBn: initialBnName,
      category: item.category || 'SNACKS',
      price: Number(item.price) || 0,
      cost: initialCost,
      rawItem: initialRawItem,
      DP: item.DP || ''
    });
    setModalRecipe(normalizedRecipe);

    // Load matching transaction records from canteen_txs
    try {
      const allTxs: any[] = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const itemNameLower = (item.name || '').trim().toLowerCase();
      const filtered = allTxs.filter(tx => {
        if (Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
          return tx.soldItems.some((s: any) => 
            s.menuItemId === item.id || 
            (s.menuItemName && s.menuItemName.trim().toLowerCase() === itemNameLower)
          );
        }
        if (typeof tx.items === 'string') {
          return tx.items.toLowerCase().includes(itemNameLower);
        }
        return false;
      });
      setItemSalesHistory(filtered);
    } catch (e) {
      setItemSalesHistory([]);
    }
  };

  const handleAutoResolveModalDp = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes('photos.app.goo.gl') || trimmed.includes('photos.google.com/share') || trimmed.includes('drive.google.com')) {
      setResolvingModalDp(true);
      try {
        const direct = await fetchDirectImageUrl(trimmed);
        if (direct && direct !== trimmed) {
          setModalFormData(prev => ({ ...prev, DP: direct }));
        }
      } catch (e) {
        console.warn('Item DP resolution failed:', e);
      } finally {
        setResolvingModalDp(false);
      }
    }
  };

  const handleAddModalIngredientRow = () => {
    setModalRecipe(prev => [
      ...prev,
      {
        rawItemId: '',
        rawItemName: '',
        quantity: '' as any,
        unit: 'pcs'
      }
    ]);
  };

  const handleRemoveModalIngredientRow = (index: number) => {
    setModalRecipe(prev => prev.filter((_, i) => i !== index));
  };

  const handleModalIngredientRawChange = (index: number, rawId: string) => {
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    const raw = rawList.find(r => r.id === rawId);
    if (!raw) return;
    const sub = getRawItemSubUnitInfo(raw);
    const defaultUnit = sub.hasSubUnit && sub.subUnit ? sub.subUnit : (raw.unit || 'pcs');
    setModalRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit: defaultUnit
        };
      }
      return ing;
    }));
  };

  const handleModalIngredientUnitChange = (index: number, newUnit: string) => {
    setModalRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return { ...ing, unit: newUnit };
      }
      return ing;
    }));
  };

  const handleModalIngredientQtyChange = (index: number, qty: number | string) => {
    setModalRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return { ...ing, quantity: qty as any };
      }
      return ing;
    }));
  };

  const handleSaveModalChanges = async () => {
    const parsedPrice = Number(modalFormData.price) || 0;
    if (!selectedItemForModal || !modalFormData.name.trim() || parsedPrice < 0) return;

    let finalDp = (modalFormData.DP || '').trim();
    if (finalDp.includes('photos.app.goo.gl') || finalDp.includes('photos.google.com/share')) {
      setResolvingModalDp(true);
      finalDp = await fetchDirectImageUrl(finalDp);
      setResolvingModalDp(false);
    }

    const formulationCost = calculateMenuPortionCostFrom20Pax(
      { id: selectedItemForModal.id, name: modalFormData.name },
      recipes20Pax,
      availableRawItems
    );
    const parsedCost = formulationCost > 0 
      ? formulationCost 
      : (Number(modalFormData.cost) >= 0 ? Number(modalFormData.cost) : 0);
    const payload: any = {
      name: modalFormData.name.trim(),
      category: modalFormData.category,
      price: parsedPrice,
      Cost: parsedCost,
      DP: finalDp || null
    };

    if (modalFormData.nameBn && modalFormData.nameBn.trim()) {
      payload.name_bn = modalFormData.nameBn.trim();
    }

    setIsSavingModal(true);

    try {
      await supabase.from('Canteen_Menu').update(payload).eq('id', selectedItemForModal.id);
    } catch (e) {
      console.warn('Supabase update warning:', e);
    }

    // Save Bengali name to dictionary, cloud sync & localStorage
    if (modalFormData.nameBn !== undefined) {
      saveMenuItemBanglaName(
        { id: selectedItemForModal.id, name: modalFormData.name.trim() },
        modalFormData.nameBn.trim()
      );
    }

    setItems(prev => prev.map(i => i.id === selectedItemForModal.id ? { 
      ...i, 
      ...payload,
      nameBn: modalFormData.nameBn?.trim(),
      name_bn: modalFormData.nameBn?.trim(),
      cost: parsedCost
    } : i));

    setIsSavedModal(true);
    setTimeout(() => {
      setIsSavedModal(false);
      setIsSavingModal(false);
      setSelectedItemForModal(null);
    }, 1050);
  };


  // Sync recipes and raw inventory
  useEffect(() => {
    const handleSync = (e?: any) => {
      setRecipes(getMenuRecipes());
      setAvailableRawItems(getRawInventoryItems());
      if (e?.detail && typeof e.detail === 'object') {
        setRecipes20Pax(e.detail);
      } else {
        setRecipes20Pax(get20PaxRecipes());
      }
    };
    window.addEventListener('canteen_recipes_20pax_updated', handleSync);
    window.addEventListener('canteen_menu_recipes_updated', handleSync);
    window.addEventListener('canteen_raw_inventory_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('canteen_recipes_20pax_updated', handleSync);
      window.removeEventListener('canteen_menu_recipes_updated', handleSync);
      window.removeEventListener('canteen_raw_inventory_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleEdit = (item: any) => {
    setIsEditMode(true);
    setEditingId(item.id);
    const existingRec = getRecipeForMenuItem(item.id, item.name);
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    const recipeCost = calculateMenuItemCost(existingRec, rawList).totalCost;
    const initialBnName = item.nameBn || item.name_bn || item['Name (BN)'] || getMenuItemBanglaName(item) || '';
    setNewItem({
      name: item.name,
      nameBn: initialBnName,
      category: item.category,
      price: item.price,
      cost: existingRec.length > 0 ? recipeCost : Number(item.Cost ?? item.cost ?? 0),
      rawItem: existingRec.length > 0 ? formatRecipeRawItemsString(existingRec, rawList) : (item['Raw Item'] ?? item.rawItem ?? ''),
      DP: item.DP || ''
    });
    setItemRecipe(existingRec);
    setShowAddModal(true);
  };

  const handleAddItem = async () => {
      const parsedPrice = Number(newItem.price) || 0;
      if (!newItem.name || parsedPrice <= 0) return;
      
      let finalDp = (newItem.DP || '').trim();
      if (finalDp.includes('photos.app.goo.gl') || finalDp.includes('photos.google.com/share')) {
        setResolvingItemDp(true);
        finalDp = await fetchDirectImageUrl(finalDp);
        setResolvingItemDp(false);
      }

      const itemRecipeCost = calculateMenuItemCost(itemRecipe, availableRawItems).totalCost;
      const parsedCost = itemRecipe.length > 0 ? itemRecipeCost : (Number(newItem.cost) >= 0 ? Number(newItem.cost) : 0);
      const rawItemValue = itemRecipe.length > 0 ? formatRecipeRawItemsString(itemRecipe, availableRawItems) : (newItem.rawItem?.trim() || '');
      const payload: any = {
          name: newItem.name.trim(),
          category: newItem.category,
          price: parsedPrice,
          Cost: parsedCost,
          'Raw Item': rawItemValue,
          DP: finalDp || null
      };
      if (newItem.nameBn && newItem.nameBn.trim()) {
        payload.name_bn = newItem.nameBn.trim();
      }

      setIsSavingAdd(true);

      let targetId = editingId;
      if (isEditMode && editingId) {
          const { error } = await supabase.from('Canteen_Menu').update(payload).eq('id', editingId);
          if (!error) {
              // Realtime update local state
              setItems(prev => prev.map(i => i.id === editingId ? { 
                ...i, 
                ...payload, 
                nameBn: newItem.nameBn?.trim(), 
                name_bn: newItem.nameBn?.trim() 
              } : i));
          } else {
              alert("Error updating item: " + error.message);
          }
      } else {
          const { data, error } = await supabase.from('Canteen_Menu').insert([payload]).select();
          
          if (!error) {
              if (data && data[0]) {
                targetId = data[0].id;
                setItems(prev => [{ 
                  ...data[0], 
                  nameBn: newItem.nameBn?.trim(), 
                  name_bn: newItem.nameBn?.trim() 
                }, ...prev]);
              } else {
                fetchItems();
              }
          } else {
              const generatedId = Math.random().toString();
              targetId = generatedId;
              setItems([{ 
                ...payload, 
                id: generatedId, 
                nameBn: newItem.nameBn?.trim(), 
                name_bn: newItem.nameBn?.trim() 
              }, ...items]);
          }
      }

      // Save Bengali name to dictionary, cloud sync & localStorage
      if (newItem.nameBn !== undefined) {
        saveMenuItemBanglaName(
          { id: targetId || undefined, name: newItem.name.trim() },
          newItem.nameBn.trim()
        );
      }

      // Save Recipe Ingredients
      if (targetId) {
        saveRecipeForMenuItem(targetId, itemRecipe, newItem.name.trim());
      } else {
        saveRecipeForMenuItem(newItem.name.trim(), itemRecipe, newItem.name.trim());
      }
      setRecipes(getMenuRecipes());

      setIsSavedAdd(true);
      setTimeout(() => {
        setIsSavedAdd(false);
        setIsSavingAdd(false);
        setShowAddModal(false);
        setNewItem({ name: '', category: 'SNACKS', price: 0, cost: 0, rawItem: '', DP: '' });
        setItemRecipe([]);
        setIsEditMode(false);
        setEditingId(null);
      }, 1050);
  };

  const confirmDelete = async (id: string) => {
      const { error } = await supabase.from('Canteen_Menu').delete().eq('id', id);
      if(!error) {
          fetchItems();
      } else {
          setItems(items.filter(i => i.id !== id));
      }
      setDeleteConfirmId(null);
      if (selectedItemForModal?.id === id) {
        setSelectedItemForModal(null);
      }
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Recipe Row Controls for Add/Edit Modal
  const handleAddIngredientRow = () => {
    setItemRecipe(prev => [
      ...prev,
      {
        rawItemId: '',
        rawItemName: '',
        quantity: '' as any,
        unit: 'pcs'
      }
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setItemRecipe(prev => prev.filter((_, i) => i !== index));
  };

  const handleIngredientRawItemChange = (index: number, rawId: string) => {
    const raw = availableRawItems.find(r => r.id === rawId);
    if (!raw) return;
    const rawUnit = (raw.hasSubUnits || (raw.packSize && raw.packSize > 1)) && raw.subUnit 
      ? raw.subUnit 
      : raw.unit;
    setItemRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit: rawUnit
        };
      }
      return ing;
    }));
  };

  const handleIngredientQtyChange = (index: number, qty: number) => {
    setItemRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return { ...ing, quantity: isNaN(qty) ? 0 : qty };
      }
      return ing;
    }));
  };

  // Quick Recipe Modal Controls
  const handleOpenQuickRecipe = (item: any) => {
    const rawList = getRawInventoryItems();
    setAvailableRawItems(rawList);
    setQuickRecipeItem(item);
    const existing = getRecipeForMenuItem(item.id, item.name);
    const normalized = existing.map(ing => {
      const raw = rawList.find(r => r.id === ing.rawItemId || (r.name && ing.rawItemName && r.name.toLowerCase() === ing.rawItemName.toLowerCase()));
      if (raw) {
        const sub = getRawItemSubUnitInfo(raw);
        const validUnits = [
          ...(sub.hasSubUnit && sub.subUnit ? [sub.subUnit.toLowerCase()] : []),
          ...(raw.unit ? [raw.unit.toLowerCase()] : [])
        ];
        let unit = (ing.unit || '').trim();
        if (sub.hasSubUnit && sub.subUnit) {
          if (!unit || !validUnits.includes(unit.toLowerCase()) || unit.toLowerCase() === (raw.unit || '').toLowerCase()) {
            unit = sub.subUnit;
          }
        } else if (!unit && raw.unit) {
          unit = raw.unit;
        }
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit
        };
      }
      return ing;
    });
    setQuickRecipeIngredients(normalized);
    setRecipeNotice('');
  };

  const handleAddQuickIngredientRow = () => {
    setQuickRecipeIngredients(prev => [
      ...prev,
      {
        rawItemId: '',
        rawItemName: '',
        quantity: '' as any,
        unit: 'pcs'
      }
    ]);
  };

  const handleRemoveQuickIngredientRow = (index: number) => {
    setQuickRecipeIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickIngredientRawChange = (index: number, rawId: string) => {
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    const raw = rawList.find(r => r.id === rawId);
    if (!raw) return;
    const sub = getRawItemSubUnitInfo(raw);
    const defaultUnit = sub.hasSubUnit && sub.subUnit ? sub.subUnit : (raw.unit || 'pcs');
    setQuickRecipeIngredients(prev => prev.map((ing, i) => {
      if (i === index) {
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit: defaultUnit
        };
      }
      return ing;
    }));
  };

  const handleQuickIngredientUnitChange = (index: number, newUnit: string) => {
    setQuickRecipeIngredients(prev => prev.map((ing, i) => {
      if (i === index) {
        return { ...ing, unit: newUnit };
      }
      return ing;
    }));
  };

  const handleQuickIngredientQtyChange = (index: number, qty: number) => {
    setQuickRecipeIngredients(prev => prev.map((ing, i) => {
      if (i === index) {
        return { ...ing, quantity: isNaN(qty) ? 0 : qty };
      }
      return ing;
    }));
  };

  const handleSaveQuickRecipe = async () => {
    if (!quickRecipeItem) return;
    setIsSavingQuick(true);
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    const costRes = calculateMenuItemCost(quickRecipeIngredients, rawList);
    const prodCost = costRes.totalCost;
    const rawItemValue = formatRecipeRawItemsString(quickRecipeIngredients, rawList);

    saveRecipeForMenuItem(quickRecipeItem.id, quickRecipeIngredients, quickRecipeItem.name);
    setRecipes(getMenuRecipes());

    try {
      await supabase.from('Canteen_Menu').update({
        Cost: prodCost,
        'Raw Item': rawItemValue
      }).eq('id', quickRecipeItem.id);
    } catch (e) {
      console.warn('Failed to sync quick recipe cost to DB:', e);
    }

    setItems(prev => prev.map(i => i.id === quickRecipeItem.id ? {
      ...i,
      cost: prodCost,
      Cost: prodCost,
      rawItem: rawItemValue,
      'Raw Item': rawItemValue
    } : i));

    setIsSavedQuick(true);
    setTimeout(() => {
      setIsSavedQuick(false);
      setIsSavingQuick(false);
      setQuickRecipeItem(null);
      setRecipeNotice('');
    }, 1050);
  };

  // Extract all categories dynamically
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('ALL');
    ['SNACKS', 'DRINK', 'LUNCH', 'BREAKFAST', 'DINNER'].forEach(c => {
      if (items.some(i => (i.category || '').toUpperCase() === c)) {
        cats.add(c);
      }
    });
    items.forEach(i => {
      if (i.category) {
        cats.add(i.category.trim().toUpperCase());
      }
    });
    return Array.from(cats);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        const bnName = (item.nameBn || item.name_bn || getMenuItemBanglaName(item) || '').toLowerCase();
        const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              bnName.includes(searchTerm.toLowerCase()) ||
                              (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());
        const itemCategory = (item.category || 'SNACKS').toUpperCase();
        const matchesCategory = selectedCategory === 'ALL' || itemCategory === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const nameA = getItemDisplayName(a, 'menu', canteenConfig).primary;
        const nameB = getItemDisplayName(b, 'menu', canteenConfig).primary;
        return nameA.localeCompare(nameB);
      });
  }, [items, searchTerm, selectedCategory, canteenConfig]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">CANTEEN MENU</h2>
            
         </div>
         <div className="flex items-center space-x-3">
            {!readOnly && (
               <button 
                  onClick={() => {
                     setIsEditMode(false);
                     setEditingId(null);
                     setNewItem({ name: "", category: "SNACKS", price: 0, cost: 0, rawItem: "", DP: "" });
                     setItemRecipe([]);
                     setShowAddModal(true);
                  }}
                  className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
               >
                  <Plus className="w-4 h-4" />
                  <span>ADD NEW ITEM</span>
               </button>
            )}
         </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
         <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
               type="text" 
               placeholder="Search menu..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
         </div>

         <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {availableCategories.map(cat => (
               <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                     selectedCategory === cat 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                        : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                  }`}
               >
                  {cat}
               </button>
            ))}
         </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {filteredItems.map(item => {
            const itemRecipe = getRecipeForMenuItem(item.id, item.name, recipes);
            const stockInfo = calculateMenuItemStockInfo(item.id, item.name, availableRawItems, recipes);
            // Realtime cost calculated directly from Recipe Formulation (20 Pax)
            const displayCost = calculateMenuPortionCostFrom20Pax(item, recipes20Pax, availableRawItems);
            const priceNum = Number(item.price) || 0;
            const profit = priceNum - displayCost;
            const profitPct = priceNum > 0 ? Math.round((profit / priceNum) * 100) : (profit > 0 ? 100 : (profit < 0 ? -100 : 0));

            const isOutOfStock = stockInfo.availableStock <= 0;
            const isLowStock = stockInfo.availableStock < 5;

            return (
               <div 
                  key={item.id} 
                  onClick={readOnly ? undefined : () => handleOpenItemModal(item)}
                  className={`relative rounded-3xl p-5 border-t border-x border-b-4 transition-all duration-300 group flex flex-col justify-between ${
                     readOnly ? 'cursor-default' : 'cursor-pointer hover:-translate-y-1.5'
                  } ${
                     isLowStock
                        ? "bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-950 border-rose-500/90 border-b-rose-950 shadow-[0_0_25px_rgba(239,68,68,0.45),inset_0_0_15px_rgba(239,68,68,0.18)] ring-2 ring-rose-500/50 hover:shadow-[0_0_35px_rgba(239,68,68,0.65)]"
                        : "bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-950 border-t-slate-600/60 border-x-slate-700/60 border-b-slate-950 shadow-[0_12px_24px_-4px_rgba(0,0,0,0.65),0_4px_8px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-2px_4px_0_rgba(0,0,0,0.4)] hover:shadow-[0_20px_35px_-6px_rgba(0,0,0,0.8),0_0_22px_0_rgba(79,70,229,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)] hover:border-b-indigo-900"
                  }`}
               >
                  <div>
                     {/* Top Row: Avatar & Category / Ingredients */}
                     <div className="flex items-start justify-between">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300 border ${
                           isLowStock ? "bg-rose-950/60 border-rose-500/40 text-rose-400" : "bg-indigo-950/70 border-indigo-500/30 text-indigo-400"
                        }`}>
                           {item.DP ? (
                              <img 
                                 src={resolveImageUrl(item.DP)} 
                                 alt={item.name} 
                                 className="w-full h-full object-cover"
                                 onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                 }}
                              />
                           ) : (
                              <span>{item.name ? item.name.trim().slice(0, 2).toUpperCase() : 'IT'}</span>
                           )}
                        </div>

                        <div className="flex flex-col items-end space-y-1.5">
                           <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 shadow-sm">
                              {item.category || "SNACKS"}
                           </span>
                           <div className="flex items-center space-x-1 text-slate-400 text-xs">
                              <ChefHat className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{displayCost > 0 ? "Recipe Formula (20 Pax)" : "রেসিপি নেই"}</span>
                           </div>
                        </div>
                     </div>

                     {/* Item Name & Live Available Stock Badge */}
                     <div className="mt-4 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                           {(() => {
                              const nameDisplay = getItemDisplayName(item, 'menu', canteenConfig);
                              return (
                                 <div className="flex items-baseline gap-2 flex-wrap">
                                    <h3 className="font-black text-white text-base sm:text-lg tracking-tight uppercase group-hover:text-indigo-300 transition-colors truncate" title={nameDisplay.full}>
                                       {nameDisplay.primary}
                                    </h3>
                                    {Boolean(nameDisplay.secondary) && (
                                       <span className="text-xs sm:text-sm text-emerald-400 font-bold truncate" title={nameDisplay.secondary}>
                                          ({nameDisplay.secondary})
                                       </span>
                                    )}
                                 </div>
                              );
                           })()}
                        </div>
                        <div className="shrink-0">
                           {/* 3D Box Shape Stock Badge */}
                           <div className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-black font-mono tracking-wider flex items-center gap-1.5 transition-all select-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_6px_-1px_rgba(0,0,0,0.6),0_2px_4px_-1px_rgba(0,0,0,0.4)] border-b-[3px] whitespace-nowrap ${
                              isLowStock 
                                 ? 'bg-gradient-to-b from-rose-500 via-rose-600 to-rose-800 text-white border-rose-400 border-b-rose-950 shadow-[0_4px_12px_rgba(244,63,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)]' 
                                 : 'bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 text-white border-emerald-400 border-b-emerald-950 shadow-[0_4px_10px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                           }`}>
                              <span className={`w-2 h-2 rounded-full shrink-0 shadow-xs ${isLowStock ? 'bg-white animate-ping' : 'bg-emerald-300'}`} />
                              <span>Stock: {stockInfo.availableStock}</span>
                              {isOutOfStock && (
                                 <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-black/50 text-rose-200 font-black tracking-normal">
                                    শেষ
                                 </span>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* Cost & Selling Price Box */}
                     <div className="mt-4 bg-[#0a101d]/90 rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
                        {!readOnly ? (
                           <>
                              <div className="space-y-0.5">
                                 <span className="text-slate-400 text-xs font-bold block">খরচ</span>
                                 <span className="text-amber-400 font-black text-lg font-mono">৳{displayCost.toFixed(1)}</span>
                              </div>
                              <div className="text-right space-y-0.5">
                                 <span className="text-slate-400 text-xs font-bold block">মূল্য</span>
                                 <span className="text-white font-black text-lg font-mono">৳{priceNum}</span>
                              </div>
                           </>
                        ) : (
                           <div className="w-full flex items-center justify-between">
                              <div className="space-y-0.5">
                                 <span className="text-slate-400 text-xs font-bold block">ক্যাফে মূল্য (Price)</span>
                                 <span className="text-white font-black text-xl font-mono">৳{priceNum}</span>
                              </div>
                              <span className="px-3 py-1 rounded-xl bg-indigo-600/20 text-indigo-300 text-xs font-black uppercase tracking-wider border border-indigo-500/30">
                                 Regular Price
                              </span>
                           </div>
                        )}
                     </div>

                     {/* Profit Pill - Manager Only */}
                     {!readOnly && (
                        <div className="mt-2.5 px-4 py-2 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                           <span className="text-emerald-400 text-xs font-bold">মুনাফা (Profit):</span>
                           <span className={`font-mono font-black text-xs ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {profit < 0 ? '-' : ''}৳{Math.abs(profit).toFixed(1)} ({profitPct >= 0 ? `+${profitPct}` : profitPct}%)
                           </span>
                        </div>
                     )}
                  </div>

                  {/* Card Footer - Manager Only */}
                  {!readOnly && (
                     <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-slate-400 text-xs font-medium">
                        <span>এডিট ও হিস্ট্রি দেখতে ক্লিক করুন</span>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                     </div>
                  )}
               </div>
            );
         })}
      </div>

      {filteredItems.length === 0 && (
         <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-white font-black text-sm uppercase tracking-wider mb-1">No Menu Items Found</h4>
            <p className="text-slate-400 text-xs">Try adjusting your search query or category filter.</p>
         </div>
      )}

      {/* Unified Item Details & Recipe Modal */}
      {selectedItemForModal && !readOnly && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh]">
               {/* Modal Header */}
               <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                  <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <UtensilsCrossed className="w-5 h-5" />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                           {(() => {
                              const display = getItemDisplayName({ ...selectedItemForModal, ...modalFormData }, 'menu', canteenConfig);
                              return display.full || modalFormData.name || selectedItemForModal.name;
                           })()}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400">
                           {selectedItemForModal.category} • PRICE: ৳{modalFormData.price}
                        </p>
                     </div>
                  </div>

                  <div className="flex items-center space-x-2">
                     <button
                        onClick={() => setSelectedItemForModal(null)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>
               </div>

               {/* Tabs */}
               <div className="flex items-center space-x-2 border-b border-slate-800 pt-3 pb-2 shrink-0">
                  <button
                     onClick={() => setModalTab("EDIT")}
                     className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        modalTab === "EDIT" 
                           ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" 
                           : "text-slate-400 hover:text-white hover:bg-slate-800"
                     }`}
                  >
                     <Edit2 className="w-3.5 h-3.5" />
                     <span>Details & Pricing</span>
                  </button>

                  <button
                     onClick={() => setModalTab("HISTORY")}
                     className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        modalTab === "HISTORY" 
                           ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" 
                           : "text-slate-400 hover:text-white hover:bg-slate-800"
                     }`}
                  >
                     <History className="w-3.5 h-3.5" />
                     <span>History ({itemSalesHistory.length})</span>
                  </button>
               </div>

               {/* Tab Content */}
               <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
                  {modalTab === "EDIT" ? (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: General Details */}
                        <div className="space-y-4">
                           

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Menu Name (EN) / নাম (ইংরেজি)
                                 </label>
                                 <input 
                                    type="text" 
                                    value={modalFormData.name ?? ""}
                                    onChange={(e) => {
                                       const newEn = e.target.value;
                                       setModalFormData(prev => ({ 
                                          ...prev, 
                                          name: newEn,
                                          nameBn: prev.nameBn || getMenuItemBanglaName(newEn)
                                       }));
                                    }}
                                    placeholder="e.g. SPECIAL SAMOSA"
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                 />
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex items-center justify-between">
                                    <span>Name (BN) / নাম (বাংলা)</span>
                                    <span className="text-[9px] text-emerald-400 font-semibold normal-case">স্বয়ংক্রিয় / সম্পাদনযোগ্য</span>
                                 </label>
                                 <input 
                                    type="text" 
                                    value={modalFormData.nameBn ?? ""}
                                    onChange={(e) => setModalFormData(prev => ({ ...prev, nameBn: e.target.value }))}
                                    placeholder="যেমন: স্পেশাল সমুচা"
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                 />
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-3">
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                                 <select 
                                    value={modalFormData.category ?? "SNACKS"}
                                    onChange={(e) => setModalFormData(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                 >
                                    <option value="SNACKS">SNACKS</option>
                                    <option value="DRINK">DRINK</option>
                                    <option value="BREAKFAST">BREAKFAST</option>
                                    <option value="LUNCH">LUNCH</option>
                                    <option value="DINNER">DINNER</option>
                                 </select>
                              </div>

                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Price (৳)</label>
                                 <input 
                                    type="number" 
                                    value={modalFormData.price ?? ""}
                                    onChange={(e) => setModalFormData(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                 />
                              </div>
                           </div>

                           {/* Photo Upload Section (Browse Gallery & Remove only - No Link Box) */}
                           <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Photo</label>
                              <div className="flex items-center space-x-4">
                                 <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                                    {modalFormData.DP ? (
                                       <img src={resolveImageUrl(modalFormData.DP)} alt="Item" className="w-full h-full object-cover" />
                                    ) : (
                                       <ImageIcon className="w-6 h-6 text-slate-500" />
                                    )}
                                 </div>

                                 <div className="flex-1 flex flex-wrap items-center gap-2">
                                    <label className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                                       <Upload className="w-3.5 h-3.5" />
                                       <span>Browse from Gallery</span>
                                       <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="hidden"
                                          onChange={async (e) => {
                                             const file = e.target.files?.[0];
                                             if (file) {
                                                try {
                                                   const base64 = await processGalleryImage(file);
                                                   setModalFormData(prev => ({ ...prev, DP: base64 }));
                                                } catch (err) {
                                                   console.error("Failed to load image from gallery:", err);
                                                }
                                             }
                                          }}
                                       />
                                    </label>

                                    {modalFormData.DP && (
                                       <button
                                          type="button"
                                          onClick={() => setModalFormData(prev => ({ ...prev, DP: "" }))}
                                          className="flex items-center space-x-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                          title="Remove photo"
                                       >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Remove</span>
                                       </button>
                                    )}
                                 </div>
                              </div>
                           </div>

                           {/* Financial Summary */}
                           {(() => {
                              const calcCost = calculateMenuPortionCostFrom20Pax(
                                 { id: selectedItemForModal.id, name: modalFormData.name || selectedItemForModal.name, cost: modalFormData.cost },
                                 recipes20Pax,
                                 availableRawItems
                              );
                              const selling = Number(modalFormData.price) || 0;
                              const profit = selling - calcCost;
                              const marginPct = selling > 0 ? ((profit / selling) * 100).toFixed(1) : "0";

                              return (
                                 <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center">
                                    <div>
                                       <span className="text-[10px] font-bold text-slate-400 block">PRICE</span>
                                       <span className="text-sm font-black text-white font-mono">৳{selling}</span>
                                    </div>
                                    <div>
                                       <span className="text-[10px] font-bold text-slate-400 block">COST (20 PAX)</span>
                                       <span className="text-sm font-black text-amber-400 font-mono">৳{calcCost.toFixed(1)}</span>
                                    </div>
                                    <div>
                                       <span className="text-[10px] font-bold text-slate-400 block">PROFIT ({marginPct}%)</span>
                                       <span className={`text-sm font-black font-mono ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                          ৳{profit.toFixed(1)}
                                       </span>
                                    </div>
                                 </div>
                              );
                           })()}

                           {/* Live Stock & Portions Breakdown Box */}
                           {(() => {
                              const stockInfo = calculateMenuItemStockInfo(
                                 selectedItemForModal.id, 
                                 modalFormData.name || selectedItemForModal.name, 
                                 availableRawItems, 
                                 recipes
                              );
                              return (
                                 <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                       <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                          <span className={`w-2 h-2 rounded-full ${stockInfo.availableStock > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                                          <span>Live Stock (Available Stock)</span>
                                       </span>
                                       <div className={`px-3 py-1 rounded-xl text-xs font-black font-mono tracking-wider shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_3px_5px_-1px_rgba(0,0,0,0.6)] border-b-2 ${
                                          stockInfo.availableStock < 5 
                                             ? 'bg-gradient-to-b from-rose-500 to-rose-800 text-white border-rose-400 border-b-rose-950 shadow-[0_3px_10px_rgba(244,63,94,0.45)]' 
                                             : 'bg-gradient-to-b from-emerald-600 to-emerald-900 text-white border-emerald-400 border-b-emerald-950 shadow-[0_3px_8px_rgba(16,185,129,0.35)]'
                                       }`}>
                                          <span>Stock: {stockInfo.availableStock}</span>
                                          {stockInfo.availableStock <= 0 && <span className="ml-1 text-[9px] px-1 rounded bg-black/50 text-rose-200">শেষ</span>}
                                       </div>
                                    </div>
                                    {stockInfo.limitingIngredient && stockInfo.isRecipeBased && (
                                       <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                                          <span className="font-bold">সীমিত কাঁচামাল: </span>
                                          <span className="font-mono font-black">{stockInfo.limitingIngredient.rawItemName}</span>
                                          <span> (Stock: {stockInfo.limitingIngredient.currentStock} {stockInfo.limitingIngredient.stockUnit} দিয়ে সর্বোচ্চ </span>
                                          <span className="font-bold text-amber-300">{stockInfo.limitingIngredient.portions} টি</span>
                                          <span> তৈরি করা যাবে)</span>
                                       </div>
                                    )}
                                    {stockInfo.ingredientsBreakdown.length > 0 && stockInfo.isRecipeBased && (
                                       <div className="space-y-1.5">
                                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">কাঁচামাল অনুযায়ী প্রাপ্যতা:</span>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                                             {stockInfo.ingredientsBreakdown.map((b, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                                                   <span className="text-slate-300 font-medium truncate max-w-[120px]" title={b.rawItemName}>{b.rawItemName}</span>
                                                   <div className="text-right">
                                                      <span className={`font-mono font-bold ${b.portionsPossible === stockInfo.availableStock ? 'text-amber-400 font-black' : 'text-slate-300'}`}>
                                                         {b.portionsPossible} টি
                                                      </span>
                                                      <span className="text-[9px] text-slate-500 ml-1">({b.currentStock}{b.stockUnit})</span>
                                                   </div>
                                                </div>
                                             ))}
                                          </div>
                                       </div>
                                    )}
                                 </div>
                              );
                           })()}
                        </div>

                        {/* Right: Recipe Formulation & Cost Info */}
                        <div className="space-y-4">
                           <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                              <div className="flex items-center space-x-2.5 text-emerald-400">
                                 <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <ChefHat className="w-5 h-5 text-emerald-400" />
                                 </div>
                                 <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                       Recipe Formulation
                                    </h4>
                                    <p className="text-[10px] text-slate-400">
                                       Standard 20-portion production matrix
                                    </p>
                                 </div>
                              </div>

                              {(() => {
                                 const displayModalCost = calculateMenuPortionCostFrom20Pax(
                                    { id: selectedItemForModal.id, name: modalFormData.name || selectedItemForModal.name },
                                    recipes20Pax,
                                    availableRawItems
                                 );
                                 const p = Number(modalFormData.price) || 0;
                                 const profit = p - displayModalCost;
                                 const marginPct = p > 0 ? Math.round((profit / p) * 100) : 0;

                                 return (
                                    <>
                                       <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                                          <div className="space-y-0.5">
                                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                                Live Portion Ready Cost (খরচ)
                                             </span>
                                             <span className="text-2xl font-black font-mono text-emerald-400">
                                                ৳{displayModalCost.toFixed(1)}
                                             </span>
                                          </div>
                                          <div className="text-right space-y-0.5">
                                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                                Selling Price (মূল্য)
                                             </span>
                                             <span className="text-2xl font-black font-mono text-white">
                                                ৳{p}
                                             </span>
                                          </div>
                                       </div>

                                       <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-1 text-xs text-indigo-200">
                                          <div className="flex items-center space-x-1.5 font-bold text-indigo-300">
                                             <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                             <span>Real-time Cost Synchronization</span>
                                          </div>
                                          <p className="text-[11px] text-slate-400 leading-relaxed">
                                             All raw material ingredients and 20-portion cooking formulas are centralized in <strong>Recipe Formulation</strong>. Whenever ingredient quantities or inventory rates change, this ready cost updates automatically in real-time.
                                          </p>
                                       </div>

                                       <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                                          <span className="text-xs font-bold text-slate-300">Estimated Gross Margin:</span>
                                          <span className={`font-mono font-bold text-xs ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                             ৳{profit.toFixed(1)} ({marginPct}%)
                                          </span>
                                       </div>
                                    </>
                                 );
                              })()}
                           </div>
                        </div>
                     </div>
                  ) : (
                     /* Tab 2: Sales & Issued History */
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                              <History className="w-4 h-4 text-indigo-400" />
                              <span>Sales & Consumption Log</span>
                           </h4>

                           <div className="relative w-64">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input 
                                 type="text" 
                                 placeholder="Search transactions..."
                                 value={historySearchTerm ?? ""}
                                 onChange={(e) => setHistorySearchTerm(e.target.value)}
                                 className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none"
                              />
                           </div>
                        </div>

                        {itemSalesHistory.length === 0 ? (
                           <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
                              <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                              <p className="text-xs font-bold text-slate-400">No sales transactions found for this item.</p>
                           </div>
                        ) : (
                           <div className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                 <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                                    <tr>
                                       <th className="py-2.5 px-3">Date</th>
                                       <th className="py-2.5 px-3">Member / Buyer</th>
                                       <th className="py-2.5 px-3 text-center">Qty</th>
                                       <th className="py-2.5 px-3 text-right">Total</th>
                                       <th className="py-2.5 px-3">Payment</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                    {itemSalesHistory
                                       .filter(tx => {
                                          if (!historySearchTerm) return true;
                                          const term = historySearchTerm.toLowerCase();
                                          return (tx.memberName || "").toLowerCase().includes(term) ||
                                                 (tx.memberBd || "").toLowerCase().includes(term) ||
                                                 (tx.date || "").includes(term);
                                       })
                                       .map((tx, idx) => (
                                          <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                                             <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{tx.date || tx.timestamp || "—"}</td>
                                             <td className="py-2 px-3 font-bold text-white">{tx.memberName || tx.memberBd || "Guest"}</td>
                                             <td className="py-2 px-3 text-center font-mono font-bold text-indigo-400">{tx.quantity || 1}</td>
                                             <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">৳{tx.totalAmount || tx.amount || 0}</td>
                                             <td className="py-2 px-3">
                                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                                                   {tx.paymentMethod || "Cash"}
                                                </span>
                                             </td>
                                          </tr>
                                       ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                     </div>
                  )}
               </div>

               {/* Modal Footer with SaveButton & Bottom-Left Delete Option */}
               {modalTab === "EDIT" && (
                  <div className="pt-4 border-t border-slate-800 shrink-0 flex items-center justify-between gap-3">
                     {/* Bottom Left Corner: Delete Item Option */}
                     <button
                        type="button"
                        onClick={() => {
                           if (selectedItemForModal?.id) {
                              setDeleteConfirmId(selectedItemForModal.id);
                           }
                        }}
                        className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
                        title="Delete this menu item"
                     >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Item</span>
                     </button>

                     {/* Bottom Right: Cancel & Save Changes */}
                     <div className="flex items-center space-x-3">
                        <button
                           type="button"
                           onClick={() => setSelectedItemForModal(null)}
                           className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                           Cancel
                        </button>
                        
                        <SaveButton 
                           type="button"
                           onClick={handleSaveModalChanges}
                           isSaving={isSavingModal}
                           isSaved={isSavedModal}
                           idleText="Save Changes"
                           savingText="Saving..."
                           savedText="SAVED CHANGES! ✓"
                           className="px-6 py-2.5"
                        />
                     </div>
                  </div>
               )}
            </div>
         </div>
      )}

      {/* Quick Recipe Modal */}
      {quickRecipeItem && !readOnly && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
               {/* Header */}
               <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                  <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <ChefHat className="w-5 h-5" />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                           {quickRecipeItem.name} — RECIPE
                        </h3>
                        
                     </div>
                  </div>

                  <button
                     onClick={() => setQuickRecipeItem(null)}
                     className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                     <X className="w-5 h-5" />
                  </button>
               </div>

               {/* Ingredients list */}
               <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Ingredients ({quickRecipeIngredients.length})</span>
                     <button
                        type="button"
                        onClick={handleAddQuickIngredientRow}
                        className="flex items-center space-x-1 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                     >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Row</span>
                     </button>
                  </div>

                  {quickRecipeIngredients.length === 0 ? (
                     <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center">
                        <p className="text-xs text-slate-400">No ingredients specified for this item.</p>
                     </div>
                  ) : (
                     <div className="space-y-2">
                        {quickRecipeIngredients.map((ing, idx) => {
                            const itemRaw = availableRawItems.find(r => r.id === ing.rawItemId);
                            const subInfo = itemRaw ? getRawItemSubUnitInfo(itemRaw) : null;
                            const unitOptions: string[] = [];
                            if (subInfo && subInfo.hasSubUnit && subInfo.subUnit) {
                               unitOptions.push(subInfo.subUnit);
                            }
                            if (itemRaw && itemRaw.unit && !unitOptions.includes(itemRaw.unit)) {
                               unitOptions.push(itemRaw.unit);
                            }

                            const currentUnit = (unitOptions.length > 0 && unitOptions.some(u => u.toLowerCase() === (ing.unit || '').toLowerCase()))
                               ? ing.unit
                               : (subInfo && subInfo.hasSubUnit && subInfo.subUnit ? subInfo.subUnit : (itemRaw?.unit || ing.unit || 'pcs'));

                            const ratio = itemRaw ? getIngredientToInventoryRatio(itemRaw, currentUnit) : 1;
                            const effectiveCost = itemRaw ? getEffectiveRawUnitCost(itemRaw) : 0;
                            const effectiveUnitPrice = ratio > 0 ? (effectiveCost / ratio) : effectiveCost;
                            const rowTotal = (Number(ing.quantity) || 0) * effectiveUnitPrice;

                            return (
                               <div key={idx} className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 flex items-center gap-2">
                                  {/* Compact Ingredient Select Box */}
                                  <div className="flex-1 min-w-0">
                                     <select
                                        value={ing.rawItemId ?? ""}
                                        onChange={(e) => handleQuickIngredientRawChange(idx, e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700/80 text-white rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                                     >
                                        <option value="" disabled className="bg-slate-900 text-slate-400">
                                           -- Select Ingredient --
                                        </option>
                                        {availableRawItems.map((r, rIdx) => (
                                           <option key={`${r.id}_${rIdx}`} value={r.id} className="bg-slate-900 text-white">
                                              {r.name}{r.nameBn && r.nameBn !== r.name ? ` (${r.nameBn})` : ''}
                                           </option>
                                        ))}
                                     </select>
                                  </div>

                                  {/* Compact Qty Box */}
                                  <div className="w-14 shrink-0">
                                     <input 
                                        type="number"
                                        step="any"
                                        value={ing.quantity ?? ""}
                                        onChange={(e) => handleQuickIngredientQtyChange(idx, parseFloat(e.target.value))}
                                        className="w-full bg-slate-900 border border-slate-700/80 text-white rounded-xl px-1.5 py-2 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Qty"
                                     />
                                  </div>

                                  {/* Compact Unit Badge / Select */}
                                  <div className="shrink-0">
                                     {unitOptions.length <= 1 ? (
                                        <span className="inline-block px-2 py-2 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-[11px] font-mono font-bold text-indigo-300 min-w-[42px] text-center">
                                           {currentUnit}
                                        </span>
                                     ) : (
                                        <select
                                           value={currentUnit}
                                           onChange={(e) => handleQuickIngredientUnitChange(idx, e.target.value)}
                                           className="bg-indigo-950/70 border border-indigo-500/40 text-[11px] font-mono font-bold text-indigo-300 rounded-xl px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                        >
                                           {unitOptions.map(u => (
                                              <option key={u} value={u} className="bg-slate-900 text-white font-mono">{u}</option>
                                           ))}
                                        </select>
                                     )}
                                  </div>

                                  {/* Row Cost */}
                                  <div className="text-right shrink-0 min-w-[50px] pr-1">
                                     <span className="text-xs font-mono font-black text-amber-400 block">
                                        ৳{rowTotal.toFixed(1)}
                                     </span>
                                  </div>

                                  {/* Delete Button */}
                                  <button
                                     type="button"
                                     onClick={() => handleRemoveQuickIngredientRow(idx)}
                                     className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-colors cursor-pointer shrink-0"
                                     title="Remove ingredient"
                                  >
                                     <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                               </div>
                            );
                         })}
                     </div>
                  )}

                  {/* Summary */}
                  {(() => {
                     const cost = calculateMenuItemCost(quickRecipeIngredients, availableRawItems).totalCost;
                     const price = Number(quickRecipeItem.price) || 0;
                     const profit = price - cost;

                     return (
                        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs">
                           <div>
                              <span className="text-slate-400 text-[10px] font-bold block">TOTAL COST</span>
                              <span className="font-mono font-black text-amber-400">৳{cost.toFixed(1)}</span>
                           </div>
                           <div className="text-right">
                              <span className="text-slate-400 text-[10px] font-bold block">PROFIT / ITEM</span>
                              <span className={`font-mono font-black ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                 ৳{profit.toFixed(1)}
                              </span>
                           </div>
                        </div>
                     );
                  })()}
               </div>

               {/* Footer with SaveButton */}
               <div className="pt-4 border-t border-slate-800 shrink-0 flex items-center justify-end space-x-3">
                  <button
                     type="button"
                     onClick={() => setQuickRecipeItem(null)}
                     className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                     Cancel
                  </button>

                  <SaveButton 
                     type="button"
                     onClick={handleSaveQuickRecipe}
                     isSaving={isSavingQuick}
                     isSaved={isSavedQuick}
                     idleText="Save Recipe"
                     savingText="Saving..."
                     savedText="RECIPE SAVED! ✓"
                     className="px-5 py-2.5"
                  />
               </div>
            </div>
         </div>
      )}

      {/* Add / Edit Item Modal */}
      {showAddModal && !readOnly && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
               <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0 mb-4">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                     {isEditMode ? "EDIT MENU ITEM" : "ADD NEW ENTRY"}
                  </h3>
                  <button
                     onClick={() => setShowAddModal(false)}
                     className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                           Menu Name (EN) / নাম (ইংরেজি)
                        </label>
                        <input 
                           type="text" 
                           value={newItem.name ?? ""}
                           onChange={(e) => {
                              const newEn = e.target.value;
                              setNewItem(prev => ({ 
                                 ...prev, 
                                 name: newEn,
                                 nameBn: prev.nameBn || getMenuItemBanglaName(newEn)
                              }));
                           }}
                           className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                           placeholder="e.g. SPECIAL SAMOSA"
                        />
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex items-center justify-between">
                           <span>Name (BN) / নাম (বাংলা)</span>
                           <span className="text-[9px] text-emerald-400 font-semibold normal-case">স্বয়ংক্রিয় / সম্পাদনযোগ্য</span>
                        </label>
                        <input 
                           type="text" 
                           value={newItem.nameBn ?? ""}
                           onChange={(e) => setNewItem(prev => ({ ...prev, nameBn: e.target.value }))}
                           className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                           placeholder="যেমন: স্পেশাল সমুচা"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                        <select 
                           value={newItem.category ?? "SNACKS"}
                           onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                           className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
                        >
                           <option value="SNACKS">SNACKS</option>
                           <option value="DRINK">DRINK</option>
                           <option value="BREAKFAST">BREAKFAST</option>
                           <option value="LUNCH">LUNCH</option>
                           <option value="DINNER">DINNER</option>
                        </select>
                     </div>

                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Price (৳)</label>
                        <input 
                           type="number" 
                           value={newItem.price ?? ""}
                           onChange={(e) => setNewItem(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                           className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none"
                           placeholder="0"
                        />
                     </div>
                  </div>

                  {/* Photo Upload (Browse Gallery only - No Link Box) */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Photo</label>
                     <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                           {newItem.DP ? (
                              <img src={resolveImageUrl(newItem.DP)} alt="Item" className="w-full h-full object-cover" />
                           ) : (
                              <ImageIcon className="w-6 h-6 text-slate-500" />
                           )}
                        </div>

                        <div className="flex-1 flex flex-wrap items-center gap-2">
                           <label className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Browse from Gallery</span>
                              <input 
                                 type="file" 
                                 accept="image/*" 
                                 className="hidden"
                                 onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                       try {
                                          const base64 = await processGalleryImage(file);
                                          setNewItem(prev => ({ ...prev, DP: base64 }));
                                       } catch (err) {
                                          console.error("Failed to load image from gallery:", err);
                                       }
                                    }
                                 }}
                              />
                           </label>

                           {newItem.DP && (
                              <button
                                 type="button"
                                 onClick={() => setNewItem(prev => ({ ...prev, DP: "" }))}
                                 className="flex items-center space-x-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                 <Trash2 className="w-3.5 h-3.5" />
                                 <span>Remove</span>
                              </button>
                           )}
                        </div>
                     </div>
                  </div>
               </div>

               {/* Footer with SaveButton */}
               <div className="pt-4 border-t border-slate-800 shrink-0">
                  <SaveButton 
                     onClick={handleAddItem}
                     isSaving={isSavingAdd}
                     isSaved={isSavedAdd}
                     idleText={isEditMode ? "UPDATE MENU ITEM" : "SAVE TO INVENTORY"}
                     savingText="SAVING..."
                     savedText={isEditMode ? "ITEM UPDATED! ✓" : "SAVED TO INVENTORY! ✓"}
                     className="w-full py-3.5"
                  />
               </div>
            </div>
         </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && !readOnly && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[70] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.88, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
              <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Trash2 className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Delete Item?</h3>
              <p className="text-xs font-bold text-slate-400 mb-6">Are you sure you want to delete this item?</p>
              
              <div className="flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setDeleteConfirmId(null)} 
                  className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-700 transition-colors cursor-pointer active:scale-95"
                >
                  CANCEL
                </button>
                <button 
                  type="button"
                  onClick={() => confirmDelete(deleteConfirmId)} 
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black tracking-widest transition-all shadow-md shadow-rose-600/30 cursor-pointer active:scale-95"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
