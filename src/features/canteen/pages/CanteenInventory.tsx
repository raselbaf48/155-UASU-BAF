import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit2, Trash2, ImageIcon, Save, X, Loader2, 
  AlertTriangle, CheckCircle2, ChefHat, Sparkles, AlertCircle, 
  ShoppingBag, History, TrendingUp, DollarSign, Calendar, User, 
  Percent, ArrowRight, UtensilsCrossed, Info
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl } from '../utils/canteenSettings';
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
  groupRawItemsBySubCategory
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
  
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'SNACKS',
    price: 0,
    cost: 0,
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

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(false); // Instant load
    try {
        const { data, error } = await supabase.from('Canteen_Menu').select('*');
        console.log('CanteenInventory fetchItems:', { data, error });
        if (!error && data && data.length > 0) {
            setItems(data);
        } else {
            console.error('Failed or empty fetch:', error);
            // Fallback
            setItems([
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
        }
    } catch (e) {
        console.error('Exception fetching items:', e);
    }
    setLoading(false); console.log('Finished fetchItems, items array length:', items.length);
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Recipe & Raw Inventory states
  const [recipes, setRecipes] = useState<Record<string, RecipeIngredient[]>>(() => getMenuRecipes());
  const [availableRawItems, setAvailableRawItems] = useState<RawInventoryItem[]>(() => getRawInventoryItems());
  const groupedRawItems = useMemo(() => {
    return groupRawItemsBySubCategory(availableRawItems);
  }, [availableRawItems]);
  const [itemRecipe, setItemRecipe] = useState<RecipeIngredient[]>([]);

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
    setModalFormData({
      name: item.name || '',
      category: item.category || 'SNACKS',
      price: Number(item.price) || 0,
      DP: item.DP || ''
    });
    setModalRecipe(getRecipeForMenuItem(item.id, item.name));

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

  const handleModalIngredientQtyChange = (index: number, qty: number) => {
    setModalRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return { ...ing, quantity: isNaN(qty) ? 0 : qty };
      }
      return ing;
    }));
  };

  const handleSaveModalChanges = async () => {
    if (!selectedItemForModal || !modalFormData.name.trim() || modalFormData.price < 0) return;

    let finalDp = (modalFormData.DP || '').trim();
    if (finalDp.includes('photos.app.goo.gl') || finalDp.includes('photos.google.com/share')) {
      setResolvingModalDp(true);
      finalDp = await fetchDirectImageUrl(finalDp);
      setResolvingModalDp(false);
    }

    const finalRecipeWithCooking = ensureCookingIngredients(modalRecipe, availableRawItems);
    const modalRecipeCost = calculateMenuItemCost(finalRecipeWithCooking, availableRawItems).totalCost;
    const payload = {
      name: modalFormData.name.trim(),
      category: modalFormData.category,
      price: modalFormData.price,
      cost: modalRecipeCost || selectedItemForModal.cost || 0,
      DP: finalDp || null
    };

    try {
      await supabase.from('Canteen_Menu').update(payload).eq('id', selectedItemForModal.id);
    } catch (e) {
      console.warn('Supabase update warning:', e);
    }

    setItems(prev => prev.map(i => i.id === selectedItemForModal.id ? { ...i, ...payload } : i));

    saveRecipeForMenuItem(selectedItemForModal.id, finalRecipeWithCooking, modalFormData.name.trim());
    setRecipes(getMenuRecipes());

    setSelectedItemForModal(null);
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
    setNewItem({
      name: item.name,
      category: item.category,
      price: item.price,
      cost: item.cost || 0,
      DP: item.DP || ''
    });
    setItemRecipe(getRecipeForMenuItem(item.id, item.name));
    setShowAddModal(true);
  };

  const handleAddItem = async () => {
      if (!newItem.name || newItem.price <= 0) return;
      
      let finalDp = (newItem.DP || '').trim();
      if (finalDp.includes('photos.app.goo.gl') || finalDp.includes('photos.google.com/share')) {
        setResolvingItemDp(true);
        finalDp = await fetchDirectImageUrl(finalDp);
        setResolvingItemDp(false);
      }

      const itemRecipeCost = calculateMenuItemCost(itemRecipe, availableRawItems).totalCost;
      const payload = {
          name: newItem.name.trim(),
          category: newItem.category,
          price: newItem.price,
          cost: itemRecipeCost || newItem.cost || 0,
          DP: finalDp || null
      };

      let targetId = editingId;
      if (isEditMode && editingId) {
          const { error } = await supabase.from('Canteen_Menu').update(payload).eq('id', editingId);
          if (!error) {
              setShowAddModal(false);
              // Realtime update local state
              setItems(prev => prev.map(i => i.id === editingId ? { ...i, ...payload } : i));
          } else {
              alert("Error updating item: " + error.message);
          }
      } else {
          const { data, error } = await supabase.from('Canteen_Menu').insert([payload]).select();
          
          if (!error) {
              setShowAddModal(false);
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
              setShowAddModal(false);
          }
      }

      // Save Recipe Ingredients
      if (targetId) {
        saveRecipeForMenuItem(targetId, itemRecipe, newItem.name.trim());
      } else {
        saveRecipeForMenuItem(newItem.name.trim(), itemRecipe, newItem.name.trim());
      }
      setRecipes(getMenuRecipes());

      setNewItem({ name: '', category: 'SNACKS', price: 0, cost: 0, DP: '' });
      setItemRecipe([]);
      setIsEditMode(false);
      setEditingId(null);
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

  const handleSaveQuickRecipe = () => {
    if (!quickRecipeItem) return;
    saveRecipeForMenuItem(quickRecipeItem.id, quickRecipeIngredients, quickRecipeItem.name);
    setRecipes(getMenuRecipes());
    setRecipeNotice('কাঁচামাল রেসিপি সফলভাবে সংরক্ষণ করা হয়েছে!');
    setTimeout(() => {
      setQuickRecipeItem(null);
      setRecipeNotice('');
    }, 900);
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
         {!readOnly ? (
           <div className="flex items-center space-x-3">
              <button onClick={() => {
                 setIsEditMode(false);
                 setEditingId(null);
                 setNewItem({ name: '', category: 'SNACKS', price: 0, cost: 0, DP: '' });
                 setItemRecipe([]);
                 setShowAddModal(true);
              }} className="flex items-center space-x-2 px-5 py-3 bg-[#4f46e5] text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-[#4338ca] transition-colors shadow-md shadow-indigo-500/20 cursor-pointer">
                 <Plus className="w-4 h-4" />
                 <span>ADD NEW ENTRY</span>
              </button>
           </div>
         ) : (
           <div className="flex items-center space-x-2 px-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>VIEW ONLY MODE</span>
           </div>
         )}
      </div>

      {/* Search Bar */}
      <div className="relative">
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
         <input 
            type="text" 
            placeholder={`Filter ${items.length} items...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
         />
      </div>

      {/* Category / Meal Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
         {availableCategories.map((cat) => {
            const count = cat === 'ALL'
               ? items.length
               : items.filter(i => (i.category || 'SNACKS').toUpperCase() === cat).length;
            const isSelected = selectedCategory === cat;
            return (
               <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center space-x-2 border ${
                     isSelected
                        ? 'bg-[#4f46e5] text-white border-[#4f46e5] shadow-md shadow-indigo-500/25'
                        : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                  }`}
               >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                     isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
                  }`}>
                     {count}
                  </span>
               </button>
            );
         })}
      </div>

      {/* Grid */}
      {loading ? (
          <div className="text-center py-10 text-slate-400 font-bold animate-pulse">Loading inventory...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {filteredItems.map((item, i) => {
                const itemRec = getRecipeForMenuItem(item.id, item.name);
                const costResult = calculateMenuItemCost(itemRec, availableRawItems);
                const prodCost = costResult.totalCost;
                const salePrice = Number(item.price) || 0;
                const profit = Math.round((salePrice - prodCost) * 10) / 10;
                const marginPct = salePrice > 0 ? Math.round(((salePrice - prodCost) / salePrice) * 100) : 0;
                const hasWastageIng = costResult.breakdown.some(b => b.wastagePercentage > 0);

                return (
                <div 
                   key={item.id || i} 
                   onClick={() => {
                      if (!readOnly) handleOpenItemModal(item);
                   }}
                   className={`bg-slate-900 rounded-[2rem] p-5 border-2 shadow-sm transition-all duration-200 flex flex-col justify-between group select-none ${
                      !readOnly 
                         ? 'cursor-pointer hover:border-indigo-500/80 hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-[1.015] active:scale-[0.99]' 
                         : ''
                   } ${
                      item.active !== false 
                         ? 'border-slate-800 hover:border-indigo-500/60' 
                         : 'border-slate-800/60 opacity-60'
                   }`}
                   title="ক্লিক করে এই আইটেমের এডিট ও বিক্রয় হিস্ট্রি দেখুন"
                >
                   {/* Top Header */}
                   <div>
                      <div className="flex items-start justify-between mb-3.5">
                         <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                            {item.DP ? (
                               <img 
                                  src={resolveImageUrl(item.DP)} 
                                  alt={item.name} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                               />
                            ) : (
                               <div className="w-full h-full flex items-center justify-center font-black text-indigo-400 bg-indigo-500/10 text-sm">
                                  {item.name ? item.name.slice(0, 2).toUpperCase() : 'MI'}
                               </div>
                            )}
                         </div>

                         <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 tracking-wider uppercase">
                               {item.category || 'SNACKS'}
                            </span>
                            {itemRec.length > 0 ? (
                               <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                  <ChefHat className="w-3 h-3 text-indigo-400" />
                                  <span>{itemRec.length}টি উপকরণ</span>
                               </span>
                            ) : (
                               <span className="text-[10px] font-semibold text-slate-500">
                                  রেসিপি নেই
                               </span>
                            )}
                         </div>
                      </div>

                      {/* Item Name */}
                      <div className="mb-3">
                         <h3 className="font-black text-base leading-snug uppercase text-white group-hover:text-indigo-300 transition-colors truncate" title={item.name}>
                            {item.name}
                         </h3>
                         {itemRec.length > 0 ? (
                            <p className="text-[11px] font-medium text-slate-400 truncate mt-1" title={itemRec.map(r => r.rawItemName).join(', ')}>
                               {itemRec.map(r => r.rawItemName).join(', ')}
                            </p>
                         ) : (
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">রেসিপি কনফিগার করা নেই</p>
                         )}
                      </div>
                   </div>

                   {/* Cost & Price Comparison Financial Box */}
                   <div className="pt-3 border-t border-slate-800/80 space-y-2 mt-auto">
                      <div className="grid grid-cols-2 gap-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-2.5">
                         {/* Production Cost (With wastage adjustment) */}
                         <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                               <span>প্রস্তুত খরচ</span>
                               {hasWastageIng && (
                                  <span className="text-[9px] text-amber-400 font-bold" title="অপচয় বাদ দিয়ে নিট কার্যকর দর অনুযায়ী">*</span>
                               )}
                            </div>
                            <div className="text-sm font-black text-amber-300 mt-0.5">
                               {prodCost > 0 ? `৳${prodCost}` : '৳০.০'}
                            </div>
                         </div>

                         {/* Sale Price (Exact existing sale price) */}
                         <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                               বিক্রয় মূল্য
                            </div>
                            <div className="text-lg font-black text-white mt-0.5">
                               ৳{salePrice}
                            </div>
                         </div>
                      </div>

                      {/* Profit Margin Indicator */}
                      {prodCost > 0 && (
                         <div className="flex items-center justify-between px-2.5 py-1 bg-emerald-950/30 border border-emerald-500/25 rounded-xl text-[11px]">
                            <span className="text-emerald-400 font-medium">মুনাফা (Profit):</span>
                            <span className={`font-black ${profit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                               {profit >= 0 ? `+৳${profit}` : `-৳${Math.abs(profit)}`} ({marginPct}%)
                            </span>
                         </div>
                      )}

                      {/* Clean Hint */}
                      {!readOnly && (
                         <div className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-400 flex items-center justify-between transition-colors pt-0.5 px-1">
                            <span>এডিট ও হিস্ট্রি দেখতে ক্লিক করুন</span>
                            <span>→</span>
                         </div>
                      )}
                   </div>
                </div>
             )})}

          </div>
      )}

      {/* Unified Menu Item Modal: Edit Details & Recipe + Sales History */}
      {selectedItemForModal && (() => {
         const currentCost = calculateMenuItemCost(modalRecipe, availableRawItems);
         const currentSalePrice = Number(modalFormData.price) || 0;
         const currentProfit = Math.round((currentSalePrice - currentCost.totalCost) * 10) / 10;
         const currentMargin = currentSalePrice > 0 ? Math.round(((currentSalePrice - currentCost.totalCost) / currentSalePrice) * 100) : 0;

         // Sales stats
         const totalSoldUnits = itemSalesHistory.reduce((sum, tx) => {
            if (Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
               const itemRecInTx = tx.soldItems.find((s: any) => 
                  s.menuItemId === selectedItemForModal.id || 
                  (s.menuItemName && s.menuItemName.trim().toLowerCase() === selectedItemForModal.name.trim().toLowerCase())
               );
               return sum + (Number(itemRecInTx?.qty) || 0);
            }
            return sum + 1;
         }, 0);

         const totalRevenue = totalSoldUnits * currentSalePrice;
         const totalProdCost = Math.round(totalSoldUnits * currentCost.totalCost);
         const totalNetProfit = Math.round(totalRevenue - totalProdCost);

         const filteredHistory = itemSalesHistory.filter(tx => {
            if (!historySearchTerm) return true;
            const term = historySearchTerm.toLowerCase();
            return (
               (tx.memberName && tx.memberName.toLowerCase().includes(term)) ||
               (tx.bdNo && tx.bdNo.toLowerCase().includes(term)) ||
               (tx.date && tx.date.toLowerCase().includes(term)) ||
               (tx.gateway && tx.gateway.toLowerCase().includes(term))
            );
         });

         return (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
               <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                  {/* Modal Header */}
                  <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
                     <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/80 overflow-hidden flex items-center justify-center shrink-0">
                           {modalFormData.DP ? (
                              <img 
                                 src={resolveImageUrl(modalFormData.DP)} 
                                 alt={modalFormData.name} 
                                 referrerPolicy="no-referrer"
                                 className="w-full h-full object-cover"
                                 onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center font-black text-indigo-400 bg-indigo-500/10 text-base">
                                 {modalFormData.name ? modalFormData.name.slice(0, 2).toUpperCase() : 'MI'}
                              </div>
                           )}
                        </div>
                        <div className="min-w-0">
                           <div className="flex items-center gap-2">
                              <h2 className="text-lg font-black text-white uppercase tracking-tight truncate">
                                 {selectedItemForModal.name}
                              </h2>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                 {modalFormData.category}
                              </span>
                           </div>
                           <p className="text-xs text-slate-400 font-medium">
                              মেনু বিবরণ, অপচয় সমন্বিত উৎপাদন খরচ ও বিক্রয় হিস্ট্রি
                           </p>
                        </div>
                     </div>

                     <button 
                        onClick={() => setSelectedItemForModal(null)}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="বন্ধ করুন"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  {/* Tabs Switcher */}
                  <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-5 pt-2 gap-2 shrink-0">
                     <button
                        type="button"
                        onClick={() => setModalTab('EDIT')}
                        className={`px-5 py-3 text-xs font-black tracking-wider uppercase flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                           modalTab === 'EDIT'
                              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                     >
                        <ChefHat className="w-4 h-4" />
                        <span>তথ্য ও রেসিপি (Edit & Recipe)</span>
                     </button>

                     <button
                        type="button"
                        onClick={() => setModalTab('HISTORY')}
                        className={`px-5 py-3 text-xs font-black tracking-wider uppercase flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                           modalTab === 'HISTORY'
                              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                     >
                        <History className="w-4 h-4" />
                        <span>বিক্রয় হিস্ট্রি ({itemSalesHistory.length} টি অর্ডার)</span>
                     </button>
                  </div>

                  {/* Tab Body */}
                  <div className="p-5 flex-1 overflow-y-auto">
                     {modalTab === 'EDIT' ? (
                        <div className="space-y-5">
                           {/* Form fields */}
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="md:col-span-1">
                                 <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1.5 block">
                                    Item Name (নাম)
                                 </label>
                                 <input 
                                    type="text" 
                                    value={modalFormData.name}
                                    onChange={(e) => setModalFormData({ ...modalFormData, name: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                                    placeholder="e.g. CHICKEN BURGER"
                                 />
                              </div>

                              <div>
                                 <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1.5 block">
                                    Category (ক্যাটাগরি)
                                 </label>
                                 <select 
                                    value={modalFormData.category}
                                    onChange={(e) => setModalFormData({ ...modalFormData, category: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                 >
                                    <option value="SNACKS">SNACKS</option>
                                    <option value="DRINK">DRINK</option>
                                    <option value="LUNCH">LUNCH</option>
                                    <option value="BREAKFAST">BREAKFAST</option>
                                    <option value="DINNER">DINNER</option>
                                 </select>
                              </div>

                              <div>
                                 <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1.5 block">
                                    Sale Price (বিক্রয় মূল্য ৳)
                                 </label>
                                 <input 
                                    type="number" 
                                    value={modalFormData.price}
                                    onChange={(e) => setModalFormData({ ...modalFormData, price: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="0"
                                 />
                              </div>
                           </div>

                           {/* Photo URL */}
                           <div>
                              <div className="flex items-center justify-between mb-1.5">
                                 <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">
                                    Item Photo URL (ছবি লিংক)
                                 </label>
                                 <span className="text-[10px] font-bold text-indigo-400">
                                    {resolvingModalDp ? 'Resolving...' : 'Google Photos / Web Image'}
                                 </span>
                              </div>
                              <div className="relative">
                                 <input 
                                    type="text" 
                                    value={modalFormData.DP}
                                    onChange={(e) => {
                                       const val = e.target.value;
                                       setModalFormData({ ...modalFormData, DP: val });
                                       if (val.includes('photos.app.goo.gl') || val.includes('photos.google.com/share')) {
                                          handleAutoResolveModalDp(val);
                                       }
                                    }}
                                    onBlur={() => handleAutoResolveModalDp(modalFormData.DP)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-4 pr-12 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                                    placeholder="Paste Google Photos or Direct image link"
                                 />
                                 <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                    {resolvingModalDp ? (
                                       <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    ) : modalFormData.DP ? (
                                       <img 
                                          src={resolveImageUrl(modalFormData.DP)} 
                                          alt="Preview" 
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                       />
                                    ) : (
                                       <ImageIcon className="w-4 h-4 text-slate-500" />
                                    )}
                                 </div>
                              </div>
                           </div>

                           {/* Financial Summary Box */}
                           <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                              <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                                 <span>আর্থিক হিসাব (Financial Analysis)</span>
                                 <span className="text-[10px] text-amber-400 font-bold">
                                    *কাঁচামাল অপচয় বাদ দিয়ে নিট কার্যকর দর অনুযায়ী হিসাব
                                 </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                 <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">প্রস্তুত খরচ (Cost)</div>
                                    <div className="text-lg font-black text-amber-300 mt-1">৳{currentCost.totalCost}</div>
                                 </div>
                                 <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">বিক্রয় মূল্য (Sale)</div>
                                    <div className="text-lg font-black text-white mt-1">৳{currentSalePrice}</div>
                                 </div>
                                 <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">সার্ভিং প্রতি লাভ</div>
                                    <div className={`text-lg font-black mt-1 ${currentProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                       {currentProfit >= 0 ? `+৳${currentProfit}` : `-৳${Math.abs(currentProfit)}`}
                                    </div>
                                 </div>
                                 <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">লাভের মার্জিন</div>
                                    <div className={`text-lg font-black mt-1 ${currentMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                       {currentMargin}%
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* Recipe Ingredients Builder */}
                           <div className="space-y-3 pt-2">
                              <div className="flex items-center justify-between">
                                 <div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                       <ChefHat className="w-4 h-4 text-indigo-400" />
                                       <span>প্রয়োজনীয় কাঁচামাল উপকরণ ({modalRecipe.length} টি)</span>
                                    </h4>
                                    <p className="text-[11px] text-slate-400">
                                       বিক্রি হলে স্বয়ংক্রিয়ভাবে ইনভেন্টরি থেকে এই পরিমাণ কাঁচামাল কমে যাবে
                                    </p>
                                 </div>
                                 <button
                                    type="button"
                                    onClick={handleAddModalIngredientRow}
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center space-x-1.5 transition-colors shadow-md shadow-indigo-600/25 cursor-pointer"
                                 >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>কাঁচামাল যোগ করুন</span>
                                 </button>
                              </div>

                              {modalRecipe.length === 0 ? (
                                 <div className="p-8 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl">
                                    <ChefHat className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-300">কোনো রেসিপি উপাদান যুক্ত করা নেই</p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                       কাঁচামাল যোগ করলে স্বয়ংক্রিয়ভাবে উৎপাদন খরচ হিসাব হবে এবং বিক্রির সাথে সাথে কাঁচামাল কমে যাবে।
                                    </p>
                                 </div>
                              ) : (
                                 <div className="space-y-2.5">
                                    {modalRecipe.map((ing, idx) => {
                                       const raw = availableRawItems.find(r => r.id === ing.rawItemId) || availableRawItems.find(r => r.name.toLowerCase() === ing.rawItemName.toLowerCase());
                                       const baseRate = raw ? raw.unitCost : 0;
                                       const wastagePct = raw ? (raw.wastagePercentage || 0) : 0;
                                       const effectiveRate = raw ? getEffectiveRawUnitCost(raw) : baseRate;
                                       const costItem = currentCost.breakdown ? currentCost.breakdown[idx] : null;
                                       const lineCost = costItem ? costItem.lineCost : Math.round((Number(ing.quantity) || 0) * effectiveRate * 10) / 10;
                                       const displayUnitCost = costItem ? costItem.effectiveUnitCost : effectiveRate;
                                       const isSubUnitItem = Boolean(raw && (raw.hasSubUnits || (raw.packSize && raw.packSize > 1)));

                                       return (
                                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
                                             <div className="flex-1 min-w-0">
                                                <label className="text-[9px] font-bold text-slate-400 block mb-1">কাঁচামাল (Raw Item)</label>
                                                <select
                                                   value={ing.rawItemId}
                                                   onChange={(e) => handleModalIngredientRawChange(idx, e.target.value)}
                                                   className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 truncate"
                                                >
                                                   {availableRawItems.map(rawItem => (
                                                      <option key={rawItem.id} value={rawItem.id}>
                                                         {rawItem.name} ({rawItem.nameBn}) — স্টক: {rawItem.currentStock} {rawItem.unit} (৳{rawItem.unitCost}/{rawItem.unit}{rawItem.hasSubUnits && rawItem.packSize ? `, ১ ${rawItem.unit}=${rawItem.packSize} ${rawItem.subUnit || "pcs"}` : ""})
                                                      </option>
                                                   ))}
                                                </select>
                                             </div>

                                             <div className="w-36 shrink-0">
                                                 <label className="text-[9px] font-bold text-slate-400 block mb-1">পরিমাণ ও একক (Qty & Unit)</label>
                                                 <div className="flex items-center space-x-1.5">
                                                    <input
                                                       type="number"
                                                       step="any"
                                                       min="0.0001"
                                                       value={ing.quantity}
                                                       onChange={(e) => handleModalIngredientQtyChange(idx, parseFloat(e.target.value) || 0)}
                                                       className="w-16 bg-slate-900 border border-slate-700 text-white rounded-xl px-2 py-2 text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                                                    />
                                                    {isSubUnitItem && raw ? (
                                                       <select
                                                          value={ing.unit}
                                                          onChange={(e) => {
                                                             const newUnit = e.target.value;
                                                             setModalRecipe(prev => prev.map((item, i) => i === idx ? { ...item, unit: newUnit } : item));
                                                          }}
                                                          className="flex-1 bg-slate-900 border border-indigo-500/40 text-indigo-300 text-xs font-bold rounded-xl px-1.5 py-2 focus:outline-none focus:border-indigo-500"
                                                       >
                                                          <option value={raw.subUnit || "pcs"}>{raw.subUnit || "pcs"}</option>
                                                          <option value={raw.unit}>{raw.unit}</option>
                                                       </select>
                                                    ) : (
                                                       <span className="text-[11px] font-bold text-indigo-300 uppercase px-1">
                                                          {ing.unit}
                                                       </span>
                                                    )}
                                                 </div>
                                              </div>

                                              {/* Live line cost and effective rate */}
                                              <div className="w-40 shrink-0 bg-slate-900/90 border border-slate-800/80 px-2.5 py-1.5 rounded-xl">
                                                 <div className="text-[9px] font-bold text-slate-400">
                                                    খরচ: <span className="text-amber-300 font-black">৳{lineCost}</span>
                                                 </div>
                                                 <div className="text-[9px] text-slate-400 truncate" title={`দর: ৳${displayUnitCost} প্রতি ${ing.unit}`}>
                                                    দর: ৳{displayUnitCost}/{ing.unit}
                                                 </div>
                                                 {isSubUnitItem && raw && (
                                                    <div className="text-[8px] text-indigo-400/90 font-medium truncate">
                                                       ১ {raw.unit} = {raw.packSize} {raw.subUnit || "pcs"}
                                                    </div>
                                                 )}
                                              </div>

                                              <div className="shrink-0 text-right">
                                                <button
                                                   type="button"
                                                   onClick={() => handleRemoveModalIngredientRow(idx)}
                                                   className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                                                   title="মুছে ফেলুন"
                                                >
                                                   <Trash2 className="w-4 h-4" />
                                                </button>
                                             </div>
                                          </div>
                                       );
                                    })}
                                 </div>
                              )}
                           </div>
                        </div>
                     ) : (
                        /* Tab 2: Sales History */
                        <div className="space-y-4">
                           {/* Performance summary cards */}
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>মোট বিক্রি (Sold Qty)</span>
                                 </div>
                                 <div className="text-xl font-black text-white mt-1">
                                    {totalSoldUnits} টি
                                 </div>
                              </div>

                              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>মোট বিক্রয় আয়</span>
                                 </div>
                                 <div className="text-xl font-black text-emerald-400 mt-1">
                                    ৳{totalRevenue.toLocaleString()}
                                 </div>
                              </div>

                              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
                                    <span>মোট উৎপাদন খরচ</span>
                                 </div>
                                 <div className="text-xl font-black text-amber-300 mt-1">
                                    ৳{totalProdCost.toLocaleString()}
                                 </div>
                              </div>

                              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>মোট অর্জিত মুনাফা</span>
                                 </div>
                                 <div className={`text-xl font-black mt-1 ${totalNetProfit >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                                    {totalNetProfit >= 0 ? `+৳${totalNetProfit.toLocaleString()}` : `-৳${Math.abs(totalNetProfit).toLocaleString()}`}
                                 </div>
                              </div>
                           </div>

                           {/* Filter input */}
                           <div className="relative">
                              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                 type="text" 
                                 placeholder="খরিদ্দারের নাম, BD No বা তারিখ দিয়ে খুঁজুন..."
                                 value={historySearchTerm}
                                 onChange={(e) => setHistorySearchTerm(e.target.value)}
                                 className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                              />
                           </div>

                           {/* Sales Table */}
                           {filteredHistory.length === 0 ? (
                              <div className="text-center py-12 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl">
                                 <History className="w-9 h-9 text-slate-600 mx-auto mb-2" />
                                 <p className="text-sm font-bold text-slate-300">এখনো কোনো বিক্রয় হিস্ট্রি নেই</p>
                                 <p className="text-xs text-slate-500 mt-1">
                                    POS থেকে এই আইটেমটি বিক্রি করা হলে স্বয়ংক্রিয়ভাবে এখানে তালিকা ও খরিদ্দারের তথ্য যুক্ত হবে।
                                 </p>
                              </div>
                           ) : (
                              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                                 <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                                       <tr>
                                          <th className="py-3 px-4">তারিখ (Date)</th>
                                          <th className="py-3 px-4">সদস্য / খরিদ্দার (Member)</th>
                                          <th className="py-3 px-4 text-center">পরিমাণ</th>
                                          <th className="py-3 px-4 text-right">মূল্য (৳)</th>
                                          <th className="py-3 px-4 text-center">মাধ্যম</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                       {filteredHistory.map((tx, idx) => {
                                          let soldQty = 1;
                                          if (Array.isArray(tx.soldItems)) {
                                             const match = tx.soldItems.find((s: any) => 
                                                s.menuItemId === selectedItemForModal.id || 
                                                (s.menuItemName && s.menuItemName.trim().toLowerCase() === selectedItemForModal.name.trim().toLowerCase())
                                             );
                                             if (match) soldQty = Number(match.qty) || 1;
                                          }

                                          return (
                                             <tr key={tx.id || idx} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3 px-4 text-slate-300 whitespace-nowrap font-mono text-[11px]">
                                                   {tx.date || 'N/A'}
                                                </td>
                                                <td className="py-3 px-4">
                                                   <div className="font-bold text-white">
                                                      {tx.memberName || 'Guest / Counter'}
                                                   </div>
                                                   {tx.bdNo && (
                                                      <div className="text-[10px] text-slate-400 font-mono">
                                                         BD No: {tx.bdNo} {tx.rank ? `• ${tx.rank}` : ''}
                                                      </div>
                                                   )}
                                                </td>
                                                <td className="py-3 px-4 text-center font-black text-indigo-400">
                                                   {soldQty} টি
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-emerald-400">
                                                   ৳{soldQty * currentSalePrice}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                   <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                                      {tx.gateway || tx.type || 'DUE'}
                                                   </span>
                                                </td>
                                             </tr>
                                          );
                                       })}
                                    </tbody>
                                 </table>
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  {/* Modal Footer (for Edit tab) */}
                  {modalTab === 'EDIT' && (
                     <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                        <button
                           type="button"
                           onClick={() => {
                              setDeleteConfirmId(selectedItemForModal.id);
                              setSelectedItemForModal(null);
                           }}
                           className="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                           <Trash2 className="w-4 h-4" />
                           <span>Delete Menu Item</span>
                        </button>

                        <div className="flex items-center space-x-2.5">
                           <button
                              type="button"
                              onClick={() => setSelectedItemForModal(null)}
                              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                           >
                              Cancel
                           </button>
                           <button
                              type="button"
                              onClick={handleSaveModalChanges}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-colors shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 cursor-pointer"
                           >
                              <Save className="w-4 h-4" />
                              <span>Save Changes</span>
                           </button>
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
                  <button 
                     onClick={() => setQuickRecipeItem(null)} 
                     className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                     <X className="w-5 h-5" />
                  </button>
               </div>

               {/* Body */}
               <div className="py-4 space-y-3 flex-1 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-300">
                        কাঁচামাল তালিকা ({quickRecipeIngredients.length} টি উপাদান)
                     </span>
                     <button
                        type="button"
                        onClick={handleAddQuickIngredientRow}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
                     >
                        <Plus className="w-3.5 h-3.5" />
                        <span>কাঁচামাল যোগ করুন</span>
                     </button>
                  </div>

                  {quickRecipeIngredients.length === 0 ? (
                     <div className="p-8 text-center bg-slate-800/40 border border-dashed border-slate-700/80 rounded-2xl">
                        <ChefHat className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-300">কোনো কাঁচামাল যুক্ত করা হয়নি</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                           এই আইটেমটি বিক্রি হলে যাতে স্বয়ংক্রিয়ভাবে কাঁচামালের স্টক কমে যায়, সেজন্য কাঁচামাল যোগ করুন।
                        </p>
                     </div>
                  ) : (
                     <div className="space-y-2.5">
                        {quickRecipeIngredients.map((ing, idx) => (
                           <div key={idx} className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700/90 p-2.5 rounded-2xl shadow-sm">
                              <div className="flex-1 min-w-0">
                                 <label className="text-[9px] font-bold text-slate-400 block mb-1">কাঁচামাল (Raw Item)</label>
                                 <select
                                    value={ing.rawItemId}
                                    onChange={(e) => handleQuickIngredientRawChange(idx, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 truncate"
                                 >
                                    {availableRawItems.map(raw => (
                                       <option key={raw.id} value={raw.id}>
                                          {raw.name} ({raw.nameBn}) — বর্তমান স্টক: {raw.currentStock} {raw.unit}
                                       </option>
                                    ))}
                                 </select>
                              </div>
                              <div className="w-24 shrink-0">
                                 <label className="text-[9px] font-bold text-slate-400 block mb-1">পরিমাণ (Qty)</label>
                                 <input
                                    type="number"
                                    step="any"
                                    min="0.0001"
                                    value={ing.quantity}
                                    onChange={(e) => handleQuickIngredientQtyChange(idx, parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-2 py-2 text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                                 />
                              </div>
                              <div className="w-16 shrink-0 text-center">
                                 <label className="text-[9px] font-bold text-slate-400 block mb-1">একক</label>
                                 <span className="inline-block py-2 text-xs font-black text-indigo-300 uppercase">
                                    {ing.unit}
                                 </span>
                              </div>
                              <div className="pt-4 shrink-0">
                                 <button
                                    type="button"
                                    onClick={() => handleRemoveQuickIngredientRow(idx)}
                                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                                    title="মুছে ফেলুন"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {recipeNotice && (
                     <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{recipeNotice}</span>
                     </div>
                  )}
               </div>

               {/* Footer */}
               <div className="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
                  <span className="text-[11px] text-slate-400">
                     💡 বিক্রির সাথে সাথে কাঁচামালের স্টক বিয়োগ হবে
                  </span>
                  <div className="flex items-center space-x-2">
                     <button
                        type="button"
                        onClick={() => setQuickRecipeItem(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                     >
                        Cancel
                     </button>
                     <button
                        type="button"
                        onClick={handleSaveQuickRecipe}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-colors shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 cursor-pointer"
                     >
                        <Save className="w-4 h-4" />
                        <span>Save Recipe</span>
                     </button>
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
                  <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Item Name</label>
                     <input 
                        type="text" 
                        value={newItem.name}
                        onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                        placeholder="e.g. MILK TEA"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Category</label>
                         <select 
                            value={newItem.category}
                            onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                         >
                             <option value="SNACKS">SNACKS</option>
                             <option value="DRINK">DRINK</option>
                             <option value="LUNCH">LUNCH</option>
                             <option value="BREAKFAST">BREAKFAST</option>
                             <option value="DINNER">DINNER</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Price (৳)</label>
                         <input 
                            type="number" 
                            value={newItem.price || ''}
                            onChange={(e) => setNewItem({...newItem, price: parseInt(e.target.value) || 0})}
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="0"
                         />
                      </div>
                  </div>

                  {/* Recipe / Raw Materials Builder */}
                  <div className="pt-3 pb-2 border-t border-slate-800 space-y-3">
                     <div className="flex items-center justify-between">
                        <div>
                           <label className="text-[11px] font-black text-indigo-300 tracking-wider uppercase flex items-center gap-1.5">
                              <ChefHat className="w-4 h-4 text-indigo-400" />
                              <span>Required Raw Materials (প্রয়োজনীয় কাঁচামাল)</span>
                           </label>
                           <p className="text-[9px] text-slate-400 mt-0.5">এই মেনু তৈরি করতে প্রতি ইউনিটে কী পরিমাণ কাঁচামাল লাগে</p>
                        </div>
                        <button
                           type="button"
                           onClick={handleAddIngredientRow}
                           className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                           <Plus className="w-3 h-3" />
                           <span>+ Add Raw Item</span>
                        </button>
                     </div>

                     {itemRecipe.length === 0 ? (
                        <div className="p-4 bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl text-center text-slate-400">
                           <p className="text-xs font-semibold text-slate-300">কোনো কাঁচামাল এখনো যুক্ত করা হয়নি</p>
                           <p className="text-[10px] text-slate-500 mt-0.5">মেনু বিক্রির সাথে সাথে কাঁচামালের স্টক কমাতে "+ Add Raw Item" বাটনে ক্লিক করুন</p>
                        </div>
                     ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                           {itemRecipe.map((ing, idx) => (
                              <div key={idx} className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-xl">
                                 <div className="flex-1 min-w-0">
                                    <select
                                       value={ing.rawItemId}
                                       onChange={(e) => handleIngredientRawItemChange(idx, e.target.value)}
                                       className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500 truncate"
                                    >
                                       {availableRawItems.map(raw => (
                                          <option key={raw.id} value={raw.id}>
                                             {raw.name} ({raw.nameBn}) - Stock: {raw.currentStock} {raw.unit}
                                          </option>
                                       ))}
                                    </select>
                                 </div>
                                 <div className="w-24 shrink-0">
                                    <input
                                       type="number"
                                       step="any"
                                       min="0.0001"
                                       value={ing.quantity}
                                       onChange={(e) => handleIngredientQtyChange(idx, parseFloat(e.target.value) || 0)}
                                       placeholder="Qty"
                                       className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                                    />
                                 </div>
                                 <span className="text-[11px] font-bold text-slate-400 w-14 shrink-0 text-center uppercase">
                                    {ing.unit}
                                 </span>
                                 <button
                                    type="button"
                                    onClick={() => handleRemoveIngredientRow(idx)}
                                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Remove ingredient"
                                 >
                                    <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>

                  {/* DP URL input with preview and auto-resolution */}
                  <div>
                     <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">
                           ITEM PHOTO URL (DP)
                        </label>
                        <span className="text-[9px] font-bold text-indigo-400">
                           {resolvingItemDp ? 'Resolving...' : 'Google Photos / Web'}
                        </span>
                     </div>
                     <div className="relative">
                        <input 
                           type="text" 
                           value={newItem.DP}
                           onChange={(e) => {
                              const val = e.target.value;
                              setNewItem({ ...newItem, DP: val });
                              if (val.includes('photos.app.goo.gl') || val.includes('photos.google.com/share')) {
                                 handleAutoResolveItemDp(val);
                              }
                           }}
                           onBlur={() => handleAutoResolveItemDp(newItem.DP)}
                           className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-4 pr-12 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                           placeholder="https://... (Google Photos or Web link)"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                           {resolvingItemDp ? (
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                           ) : newItem.DP ? (
                              <img 
                                 src={resolveImageUrl(newItem.DP)} 
                                 alt="Preview" 
                                 referrerPolicy="no-referrer"
                                 className="w-full h-full object-cover"
                                 onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                           ) : (
                              <ImageIcon className="w-4 h-4 text-slate-500" />
                           )}
                        </div>
                     </div>
                     <p className="text-[9px] text-slate-400 mt-1">
                        💡 Google Photos লিঙ্ক দিলে স্বয়ংক্রিয়ভাবে ছবিতে পরিণত হবে।
                     </p>
                  </div>
               </div>

               <div className="pt-4 border-t border-slate-800 shrink-0">
                  <button 
                     onClick={handleAddItem}
                     className="w-full flex items-center justify-center space-x-2 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/30 cursor-pointer"
                  >
                     <Save className="w-4 h-4" />
                     <span>SAVE TO INVENTORY</span>
                  </button>
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
