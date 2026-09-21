import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, ImageIcon, Save, X, Loader2, AlertTriangle, CheckCircle2, ChefHat, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl } from '../utils/canteenSettings';
import { 
  RecipeIngredient, 
  getRecipeForMenuItem, 
  saveRecipeForMenuItem, 
  getRawInventoryItems, 
  RawInventoryItem, 
  getMenuRecipes 
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
    stock: 0,
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
        const { data, error } = await supabase.from('Canteen_Inventory').select('*');
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
  const [itemRecipe, setItemRecipe] = useState<RecipeIngredient[]>([]);

  // Quick Recipe Modal for an individual menu item
  const [quickRecipeItem, setQuickRecipeItem] = useState<any | null>(null);
  const [quickRecipeIngredients, setQuickRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeNotice, setRecipeNotice] = useState<string>('');

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
      stock: item.stock || 99999,
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

      const payload = {
          name: newItem.name.trim(),
          category: newItem.category,
          price: newItem.price,
          stock: 99999, // Stock is managed by raw materials
          DP: finalDp || null
      };

      let targetId = editingId;
      if (isEditMode && editingId) {
          const { error } = await supabase.from('Canteen_Inventory').update(payload).eq('id', editingId);
          if (!error) {
              setShowAddModal(false);
              // Realtime update local state
              setItems(prev => prev.map(i => i.id === editingId ? { ...i, ...payload } : i));
          } else {
              alert("Error updating item: " + error.message);
          }
      } else {
          const { data, error } = await supabase.from('Canteen_Inventory').insert([payload]).select();
          
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

      setNewItem({ name: '', category: 'SNACKS', price: 0, stock: 99999, DP: '' });
      setItemRecipe([]);
      setIsEditMode(false);
      setEditingId(null);
  };

  const confirmDelete = async (id: string) => {
      const { error } = await supabase.from('Canteen_Inventory').delete().eq('id', id);
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
    setItemRecipe(prev => [
      ...prev,
      {
        rawItemId: defaultRaw.id,
        rawItemName: defaultRaw.name,
        quantity: 1,
        unit: defaultRaw.unit
      }
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setItemRecipe(prev => prev.filter((_, i) => i !== index));
  };

  const handleIngredientRawItemChange = (index: number, rawId: string) => {
    const raw = availableRawItems.find(r => r.id === rawId);
    if (!raw) return;
    setItemRecipe(prev => prev.map((ing, i) => {
      if (i === index) {
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit: raw.unit
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
    setQuickRecipeIngredients(prev => [
      ...prev,
      {
        rawItemId: defaultRaw.id,
        rawItemName: defaultRaw.name,
        quantity: 1,
        unit: defaultRaw.unit
      }
    ]);
  };

  const handleRemoveQuickIngredientRow = (index: number) => {
    setQuickRecipeIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickIngredientRawChange = (index: number, rawId: string) => {
    const raw = availableRawItems.find(r => r.id === rawId);
    if (!raw) return;
    setQuickRecipeIngredients(prev => prev.map((ing, i) => {
      if (i === index) {
        return {
          ...ing,
          rawItemId: raw.id,
          rawItemName: raw.name,
          unit: raw.unit
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
                 setNewItem({ name: '', category: 'SNACKS', price: 0, stock: 99999, DP: '' });
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

                return (
                <div 
                   key={i} 
                   className={`bg-slate-900 rounded-[2rem] p-6 border-2 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                      item.active 
                         ? 'border-[#4f46e5] shadow-indigo-500/10' 
                         : 'border-slate-800'
                   }`}
                >
                   <div>
                      <div className="flex items-start justify-between mb-4">
                         <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                            {item.DP ? (
                               <img 
                                  src={resolveImageUrl(item.DP)} 
                                  alt={item.name} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                               />
                            ) : (
                               <ImageIcon className="w-6 h-6 text-indigo-400" />
                            )}
                         </div>
                         {!readOnly && (
                           <div className="flex items-center space-x-1.5">
                              <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenQuickRecipe(item);
                                 }} 
                                 className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                                 title="Recipe / Raw Materials (কাঁচামাল রেসিপি)"
                              >
                                 <ChefHat className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer" title="Edit Item">
                                 <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(item.id)} className="p-1.5 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer" title="Delete Item">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                         )}
                      </div>

                      <div className="mb-4">
                         <p className="text-[8px] font-black text-[#4f46e5] tracking-widest uppercase mb-1">{item.category}</p>
                         <h3 className="font-black text-sm leading-tight uppercase text-white">
                            {item.name}
                         </h3>
                         {itemRec.length > 0 ? (
                            <p className="text-[9px] font-semibold text-slate-400 truncate mt-1.5 flex items-center gap-1.5">
                               <span className="text-slate-500">Raw:</span>
                               <span className="text-slate-300 truncate">
                                  {itemRec.map(r => `${r.rawItemName} (${r.quantity} ${r.unit})`).join(', ')}
                               </span>
                            </p>
                         ) : (
                            <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">NO RECIPE CONFIGURED</p>
                         )}
                      </div>
                   </div>

                   {/* Price and Recipe Button Box */}
                   <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800/80">
                      <div className="flex items-center space-x-2">
                         <span className="text-2xl font-black tracking-tighter text-white">৳{item.price}</span>
                      </div>
                      
                      <button
                         onClick={(e) => {
                            e.stopPropagation();
                            handleOpenQuickRecipe(item);
                         }}
                         className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 transition-all cursor-pointer group/rec ${
                            itemRec.length > 0 
                               ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50 hover:border-indigo-400 shadow-sm' 
                               : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
                         }`}
                         title="View / Edit Raw Ingredients (কাঁচামাল রেসিপি)"
                      >
                         <ChefHat className="w-3.5 h-3.5 text-indigo-400 group-hover/rec:rotate-12 transition-transform" />
                         <span className="text-[10px] font-black tracking-wider uppercase">
                            {itemRec.length > 0 ? `${itemRec.length} RAW ITEMS` : '+ RECIPE'}
                         </span>
                      </button>
                   </div>
                </div>
             )})}
          </div>
      )}

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
