import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit2, Trash2, ImageIcon, Save, X, Loader2, 
  AlertTriangle, CheckCircle2, ChefHat, Sparkles, AlertCircle, 
  ShoppingBag, History, TrendingUp, DollarSign, Calendar, User, 
  Percent, ArrowRight, UtensilsCrossed, Info, Lock, Eye, EyeOff,
  Upload
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl } from '../utils/canteenSettings';
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
  RAW_ITEMS_STORAGE_KEY
} from '../utils/recipeManager';

export const CanteenInventory: React.FC<{readOnly?: boolean}> = ({readOnly = false}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([
  {
    "id": "28d0782c-1bdf-42f6-a616-683a9d5038f1",
    "name": "EGG MUMLET",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "bcb8b137-36b8-4fd0-9e11-0e9502859618",
    "name": "EGG NOODLES",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "da73d5ab-f0e9-4df1-b3bd-89ed86a1da4f",
    "name": "GREEN TEA",
    "category": "SNACKS",
    "price": 8,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c6ca22ca-0a4a-4a2b-8b48-0d839d240e7b",
    "name": "HALIM",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "3d86a07a-2c53-416a-abb6-52b0b448ca63",
    "name": "LEMON JUICE",
    "category": "DRINK",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "0e5511c2-9014-4aeb-8e57-624d6994986a",
    "name": "LIQUOR TEA",
    "category": "DRINK",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "02d2b676-3b4b-4e7d-9b58-477c53ede8ae",
    "name": "MILK COFFEE",
    "category": "DRINK",
    "price": 25,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "136e714f-1272-4723-a0a5-2048cb81e94f",
    "name": "MILK TEA",
    "category": "DRINK",
    "price": 12,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "5db26171-f6dc-4268-8d64-a5b53140e368",
    "name": "NOODLES",
    "category": "SNACKS",
    "price": 30,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "0a1f36fc-aad0-4d45-a0d8-9222ca1ca07e",
    "name": "NORMAL BISCUIT",
    "category": "SNACKS",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "38bc5293-57ed-4e5a-b817-cbdcb37bfebd",
    "name": "ONE TIME BOX",
    "category": "SNACKS",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "3dde1a4e-9b62-49a9-8b24-d758c2afc24a",
    "name": "PASTA",
    "category": "SNACKS",
    "price": 35,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "98b60d30-301c-49ea-9e99-7661e30fca39",
    "name": "PORATA",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "cebd3bcc-1802-4f63-90f3-0bb2fa27e121",
    "name": "PORATA (HOTEL)",
    "category": "SNACKS",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "b83a0120-d891-481a-a27f-9c7834bc48ee",
    "name": "PORATA (UNIT)",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "eb34adaf-7ae0-4a52-8a90-291cc88b1a1f",
    "name": "SOSA",
    "category": "SNACKS",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "dc82a6b4-6cea-4188-b6f1-7e176ec26cff",
    "name": "SWARMA",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "4b63bf8e-cedb-4d4b-b25c-fd9451df7a49",
    "name": "BOILED EGG",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "089a215f-20f3-47b2-983b-5a0a94cba18e",
    "name": "CHICKEN BIRIYANI",
    "category": "SNACKS",
    "price": 65,
    "stock": 10,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "5cc854fa-cdf0-43e9-a4cf-339f8a1dcbd3",
    "name": "CHICKEN CURRY",
    "category": "SNACKS",
    "price": 50,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c149451c-7fe4-4531-9984-0addc2742fdb",
    "name": "CHICKEN KHICHURI",
    "category": "SNACKS",
    "price": 65,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c5d4c577-81ab-43cf-88ca-d0e431661a2f",
    "name": "CHICKEN ONION",
    "category": "SNACKS",
    "price": 45,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "2a22e09c-cc55-4528-8a73-225de8456c1c",
    "name": "CHICKEN PASTA",
    "category": "SNACKS",
    "price": 55,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "b3785b27-f250-4000-85bf-3fbaf804cc63",
    "name": "CHICKEN PULAW",
    "category": "SNACKS",
    "price": 65,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "e37bb8e1-db3f-464a-8968-74bec924ac87",
    "name": "CHOTPOTI",
    "category": "SNACKS",
    "price": 30,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c06d9508-2367-404d-b7ca-b5c9670a4b6c",
    "name": "COLD COFFEE",
    "category": "DRINK",
    "price": 40,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "7bb1b308-130a-4ee5-b2c4-bff0a5e25c49",
    "name": "DRY CAKE",
    "category": "SNACKS",
    "price": 12,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "2cb63ae0-6f65-48c7-92f5-77add415f5ea",
    "name": "EGG FRY",
    "category": "SNACKS",
    "price": 18,
    "stock": 0,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "51d5db48-1160-468c-a55a-ef21b7e4b81d",
    "name": "EGG KHICURI",
    "category": "SNACKS",
    "price": 45,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  }
]);
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
          return {
            ...r,
            subUnit: sub,
            packSize: pSize,
            hasSubUnits: r.hasSubUnits ?? meta.hasSubUnits ?? Boolean(sub && sub !== r.unit)
          };
        });
        setAvailableRawItems(parsedRaw);
        try {
          localStorage.setItem(RAW_ITEMS_STORAGE_KEY, JSON.stringify(parsedRaw));
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to load raw items from DB in CanteenInventory:', e);
    }
  };

  const fetchItems = async () => {
    setLoading(false); // Instant load
    try {
        const { data, error } = await supabase.from('Canteen_Menu').select('*');
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
            setItems(formatted);
        } else {
            console.error('Failed or empty fetch:', error);
        }
    } catch (err) {
        console.error('Exception fetching items:', err);
    }
  };

  useEffect(() => {
    fetchRawItems().then(() => fetchItems());

    // Realtime channel for Canteen_Menu
    const menuChannel = supabase
      .channel('canteen_menu_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Menu' }, () => {
        fetchItems();
      })
      .subscribe();

    // Realtime channel for Canteen_Inventory
    const inventoryChannel = supabase
      .channel('canteen_inventory_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Inventory' }, () => {
        fetchRawItems().then(() => fetchItems());
      })
      .subscribe();

    return () => {
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
    setSelectedItemForModal(item);
    setModalTab('EDIT');
    setModalNotice('');
    setHistorySearchTerm('');
    const existingRecipe = getRecipeForMenuItem(item.id, item.name);
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    const recipeCost = calculateMenuItemCost(existingRecipe, rawList).totalCost;
    const initialCost = existingRecipe.length > 0 ? recipeCost : Number(item.Cost ?? item.cost ?? 0);
    const initialRawItem = existingRecipe.length > 0 
      ? formatRecipeRawItemsString(existingRecipe, rawList) 
      : (item['Raw Item'] ?? item.rawItem ?? '');
    setModalFormData({
      name: item.name || '',
      category: item.category || 'SNACKS',
      price: Number(item.price) || 0,
      cost: initialCost,
      rawItem: initialRawItem,
      DP: item.DP || ''
    });
    setModalRecipe(existingRecipe);

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
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    if (rawList.length === 0) return;
    const defaultRaw = rawList[0];
    setModalRecipe(prev => [
      ...prev,
      {
        rawItemId: defaultRaw.id,
        rawItemName: defaultRaw.name,
        quantity: 1,
        unit: (defaultRaw.hasSubUnits || (defaultRaw.packSize && defaultRaw.packSize > 1)) && defaultRaw.subUnit ? defaultRaw.subUnit : defaultRaw.unit
      }
    ]);
  };

  const handleRemoveModalIngredientRow = (index: number) => {
    setModalRecipe(prev => prev.filter((_, i) => i !== index));
  };

  const handleModalIngredientRawChange = (index: number, rawId: string) => {
    const raw = availableRawItems.find(r => r.id === rawId);
    if (!raw) return;
    setModalRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit: (raw.hasSubUnits || (raw.packSize && raw.packSize > 1)) && raw.subUnit ? raw.subUnit : raw.unit
        };
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

    const sanitizedRecipe = modalRecipe.map(r => ({
      ...r,
      quantity: (r.quantity !== '' && r.quantity !== undefined && !isNaN(Number(r.quantity))) ? Number(r.quantity) : 0
    }));
    const finalRecipe = sanitizedRecipe;
    const modalRecipeCost = calculateMenuItemCost(finalRecipe, availableRawItems).totalCost;
    const parsedCost = finalRecipe.length > 0 
      ? modalRecipeCost 
      : (Number(modalFormData.cost) >= 0 ? Number(modalFormData.cost) : 0);
    const rawItemValue = finalRecipe.length > 0
      ? formatRecipeRawItemsString(finalRecipe, availableRawItems)
      : (modalFormData.rawItem !== undefined ? modalFormData.rawItem.trim() : '');
    const payload = {
      name: modalFormData.name.trim(),
      category: modalFormData.category,
      price: parsedPrice,
      Cost: parsedCost,
      'Raw Item': rawItemValue,
      DP: finalDp || null
    };

    setIsSavingModal(true);

    try {
      await supabase.from('Canteen_Menu').update(payload).eq('id', selectedItemForModal.id);
    } catch (e) {
      console.warn('Supabase update warning:', e);
    }

    setItems(prev => prev.map(i => i.id === selectedItemForModal.id ? { 
      ...i, 
      ...payload,
      cost: parsedCost,
      rawItem: rawItemValue
    } : i));

    saveRecipeForMenuItem(selectedItemForModal.id, finalRecipe, modalFormData.name.trim());
    setRecipes(getMenuRecipes());

    setIsSavedModal(true);
    setTimeout(() => {
      setIsSavedModal(false);
      setIsSavingModal(false);
      setSelectedItemForModal(null);
    }, 1050);
  };


  // Sync recipes and raw inventory
  useEffect(() => {
    const handleSync = () => {
      setRecipes(getMenuRecipes());
      setAvailableRawItems(getRawInventoryItems());
    };
    window.addEventListener('canteen_menu_recipes_updated', handleSync);
    window.addEventListener('canteen_raw_inventory_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
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
    setNewItem({
      name: item.name,
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
      const payload = {
          name: newItem.name.trim(),
          category: newItem.category,
          price: parsedPrice,
          Cost: parsedCost,
          'Raw Item': rawItemValue,
          DP: finalDp || null
      };

      setIsSavingAdd(true);

      let targetId = editingId;
      if (isEditMode && editingId) {
          const { error } = await supabase.from('Canteen_Menu').update(payload).eq('id', editingId);
          if (!error) {
              // Realtime update local state
              setItems(prev => prev.map(i => i.id === editingId ? { ...i, ...payload } : i));
          } else {
              alert("Error updating item: " + error.message);
          }
      } else {
          const { data, error } = await supabase.from('Canteen_Menu').insert([payload]).select();
          
          if (!error) {
              if (data && data[0]) {
                targetId = data[0].id;
                setItems(prev => [data[0], ...prev]);
              } else {
                fetchItems();
              }
          } else {
              const generatedId = Math.random().toString();
              targetId = generatedId;
              setItems([{ ...payload, id: generatedId }, ...items]);
          }
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
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Recipe Row Controls for Add/Edit Modal
  const handleAddIngredientRow = () => {
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    if (rawList.length === 0) return;
    const defaultRaw = rawList[0];
    const defaultUnit = (defaultRaw.hasSubUnits || (defaultRaw.packSize && defaultRaw.packSize > 1)) && defaultRaw.subUnit 
      ? defaultRaw.subUnit 
      : defaultRaw.unit;
    setItemRecipe(prev => [
      ...prev,
      {
        rawItemId: defaultRaw.id,
        rawItemName: defaultRaw.name,
        quantity: 1,
        unit: defaultUnit
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
    setQuickRecipeItem(item);
    const existing = getRecipeForMenuItem(item.id, item.name);
    setQuickRecipeIngredients([...existing]);
    setRecipeNotice('');
  };

  const handleAddQuickIngredientRow = () => {
    const rawList = availableRawItems.length > 0 ? availableRawItems : getRawInventoryItems();
    if (rawList.length === 0) return;
    const defaultRaw = rawList[0];
    const defaultUnit = (defaultRaw.hasSubUnits || (defaultRaw.packSize && defaultRaw.packSize > 1)) && defaultRaw.subUnit 
      ? defaultRaw.subUnit 
      : defaultRaw.unit;
    setQuickRecipeIngredients(prev => [
      ...prev,
      {
        rawItemId: defaultRaw.id,
        rawItemName: defaultRaw.name,
        quantity: 1,
        unit: defaultUnit
      }
    ]);
  };

  const handleRemoveQuickIngredientRow = (index: number) => {
    setQuickRecipeIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickIngredientRawChange = (index: number, rawId: string) => {
    const raw = availableRawItems.find(r => r.id === rawId);
    if (!raw) return;
    const rawUnit = (raw.hasSubUnits || (raw.packSize && raw.packSize > 1)) && raw.subUnit 
      ? raw.subUnit 
      : raw.unit;
    setQuickRecipeIngredients(prev => prev.map((ing, i) => {
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

  const filteredItems = items.filter(item => {
      const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const itemCategory = (item.category || 'SNACKS').toUpperCase();
      const matchesCategory = selectedCategory === 'ALL' || itemCategory === selectedCategory;
      return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">CANTEEN MENU</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CLOUD INTEGRATED MENU & RECIPES</p>
         </div>
         <div className="flex items-center space-x-3">
            <SaveButton
   type="button"
   onClick={handleSaveModalChanges}
   isSaving={isSavingModal}
   isSaved={isSavedModal}
   idleText="Save Changes"
   savingText="Saving..."
   savedText="SAVED CHANGES! ✓"
   className="px-5 py-2.5"
/>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         );
      })()}


      {/* Quick Recipe Modal */}
      {quickRecipeItem && (
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
                        <p className="text-[11px] font-bold text-slate-400">
                           মেনু আইটেম তৈরিতে প্রয়োজনীয় কাঁচামাল ও পরিমাণ নির্ধারণ করুন
                        </p>
                     </div>
                  </div>
                  <SaveButton
   type="button"
   onClick={handleSaveQuickRecipe}
   isSaving={isSavingQuick}
   isSaved={isSavedQuick}
   idleText="Save Recipe"
   savingText="Saving..."
   savedText="RECIPE SAVED! ✓"
   className="px-5 py-2"
/>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Add / Edit Item Modal */}
      {showAddModal && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
               <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 shrink-0">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">{isEditMode ? "EDIT MENU ITEM" : "ADD NEW ENTRY"}</h3>
                  <SaveButton 
   onClick={handleAddItem}
   isSaving={isSavingAdd}
   isSaved={isSavedAdd}
   idleText="SAVE TO INVENTORY"
   savingText="SAVING..."
   savedText="SAVED TO INVENTORY! ✓"
   className="w-full py-3.5"
/>
               </div>
            </div>
         </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 text-center">
               <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
               </div>
               <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Delete Item?</h3>
               <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
               
               <div className="flex space-x-3">
                  <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-200 transition-colors">
                     CANCEL
                  </button>
                  <button onClick={() => confirmDelete(deleteConfirmId)} className="flex-1 py-3 bg-rose-900/300 text-white rounded-xl text-xs font-black tracking-widest hover:bg-rose-600 transition-colors shadow-md shadow-rose-500/30">
                     DELETE
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

const BoltIcon: React.FC<{className?: string}> = ({className}) => (
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>
);
