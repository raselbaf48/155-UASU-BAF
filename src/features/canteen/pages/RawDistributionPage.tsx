import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChefHat,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  Copy,
  Users,
  UtensilsCrossed,
  DollarSign,
  Scale,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  Info,
  Check,
  Package,
  BookOpen,
  Filter,
  Calculator
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { getCanteenMenuCache, fetchCanteenMenuOnce, CanteenMenuItem } from '../utils/canteenMenuData';
import {
  getRawInventoryItems,
  RawInventoryItem,
  getMenuRecipes,
  saveMenuRecipes,
  MenuRecipeMap,
  RecipeIngredient,
  INITIAL_RAW_ITEMS
} from '../utils/recipeManager';
import { resolveImageUrl } from '../utils/canteenSettings';
import { playCelebrationSound } from '../utils/audioFeedback';

export interface Recipe20PaxIngredient {
  rawItemId: string;
  rawItemName: string;
  quantityFor20: number; // Quantity needed for exactly 20 persons
  unit: string;
}

export type Recipe20PaxMap = Record<string, Recipe20PaxIngredient[]>;

export const RECIPES_20PAX_STORAGE_KEY = 'canteen_menu_recipes_20pax_v1';

// Standard baseline 20-person formulations for typical canteen dishes
export const DEFAULT_20PAX_RECIPES: Recipe20PaxMap = {
  // 1. Chicken Curry (চিকেন কারি - ২০ জন)
  'CHICKEN CURRY': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantityFor20: 3.5, unit: 'kg' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantityFor20: 500, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantityFor20: 250, unit: 'ml' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantityFor20: 80, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantityFor20: 80, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantityFor20: 50, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantityFor20: 30, unit: 'gm' },
    { rawItemId: 'raw-32', rawItemName: 'Chili Powder', quantityFor20: 30, unit: 'gm' },
    { rawItemId: 'raw-33', rawItemName: 'Cumin', quantityFor20: 25, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantityFor20: 50, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.04, unit: 'cylinder' }
  ],
  // 2. Chicken Biryani / Polao (চিকেন বিরিয়ানি / পোলাও - ২০ জন)
  'CHICKEN BIRYANI': [
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantityFor20: 3.0, unit: 'kg' },
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantityFor20: 3.5, unit: 'kg' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantityFor20: 300, unit: 'ml' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantityFor20: 600, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantityFor20: 100, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantityFor20: 100, unit: 'gm' },
    { rawItemId: 'raw-35', rawItemName: 'Biryani Masala', quantityFor20: 100, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantityFor20: 60, unit: 'gm' },
    { rawItemId: 'raw-20', rawItemName: 'Potato', quantityFor20: 1.0, unit: 'kg' },
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantityFor20: 80, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantityFor20: 60, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.05, unit: 'cylinder' }
  ],
  // 3. Egg Khichuri (ডিম খিচুড়ি - ২০ জন)
  'EGG KHICHURI': [
    { rawItemId: 'raw-2', rawItemName: 'Rice', quantityFor20: 2.5, unit: 'kg' },
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantityFor20: 600, unit: 'gm' },
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantityFor20: 20, unit: 'pcs' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantityFor20: 400, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantityFor20: 250, unit: 'ml' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantityFor20: 50, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantityFor20: 50, unit: 'gm' },
    { rawItemId: 'raw-31', rawItemName: 'Turmeric Powder', quantityFor20: 30, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantityFor20: 60, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantityFor20: 50, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.04, unit: 'cylinder' }
  ],
  // 4. Egg Noodles (ডিম নুডলস - ২০ জন)
  'EGG NOODLES': [
    { rawItemId: 'raw-6', rawItemName: 'Noodles', quantityFor20: 20, unit: 'pcs' },
    { rawItemId: 'raw-7', rawItemName: 'Egg', quantityFor20: 20, unit: 'pcs' },
    { rawItemId: 'raw-18', rawItemName: 'Maggi Masala', quantityFor20: 20, unit: 'pcs' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantityFor20: 400, unit: 'gm' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantityFor20: 80, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantityFor20: 200, unit: 'ml' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantityFor20: 40, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.03, unit: 'cylinder' }
  ],
  // 5. Halim (হালিম - ২০ জন)
  'HALIM': [
    { rawItemId: 'raw-1', rawItemName: 'Chicken', quantityFor20: 1.0, unit: 'kg' },
    { rawItemId: 'raw-15', rawItemName: 'Halim Mix', quantityFor20: 4, unit: 'pcs' },
    { rawItemId: 'raw-3', rawItemName: 'Dal', quantityFor20: 600, unit: 'gm' },
    { rawItemId: 'raw-14', rawItemName: 'Onion', quantityFor20: 500, unit: 'gm' },
    { rawItemId: 'raw-30', rawItemName: 'Ginger', quantityFor20: 80, unit: 'gm' },
    { rawItemId: 'raw-29', rawItemName: 'Garlic', quantityFor20: 80, unit: 'gm' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantityFor20: 250, unit: 'ml' },
    { rawItemId: 'raw-19', rawItemName: 'Green Chili', quantityFor20: 50, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantityFor20: 50, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.04, unit: 'cylinder' }
  ],
  // 6. Milk Tea (দুধ চা - ২০ কাপ)
  'MILK TEA': [
    { rawItemId: 'raw-5', rawItemName: 'Tea Bag', quantityFor20: 20, unit: 'pcs' },
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantityFor20: 200, unit: 'gm' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantityFor20: 200, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.02, unit: 'cylinder' }
  ],
  // 7. Milk Coffee (মিল্ক কফি - ২০ কাপ)
  'MILK COFFEE': [
    { rawItemId: 'raw-17', rawItemName: 'Coffee Powder', quantityFor20: 40, unit: 'gm' },
    { rawItemId: 'raw-4', rawItemName: 'Milk Powder', quantityFor20: 250, unit: 'gm' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantityFor20: 200, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.02, unit: 'cylinder' }
  ],
  // 8. Unit Porota (পরোটা - ২০ পিস)
  'POROTA': [
    { rawItemId: 'raw-21', rawItemName: 'Flour / Maida', quantityFor20: 1.2, unit: 'kg' },
    { rawItemId: 'raw-12', rawItemName: 'Soyabin Oil', quantityFor20: 200, unit: 'ml' },
    { rawItemId: 'raw-13', rawItemName: 'Sugar', quantityFor20: 40, unit: 'gm' },
    { rawItemId: 'raw-27', rawItemName: 'Salt', quantityFor20: 25, unit: 'gm' },
    { rawItemId: 'raw-16', rawItemName: 'Gas Cylinder', quantityFor20: 0.03, unit: 'cylinder' }
  ]
};

// Helper: load 20-pax recipes from local and cloud storage
export const get20PaxRecipes = (): Recipe20PaxMap => {
  try {
    const raw = localStorage.getItem(RECIPES_20PAX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_20PAX_RECIPES, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Error reading 20-pax recipes:', e);
  }
  return { ...DEFAULT_20PAX_RECIPES };
};

// Helper: save 20-pax recipes locally and push to cloud
export const save20PaxRecipes = async (recipes: Recipe20PaxMap): Promise<void> => {
  try {
    localStorage.setItem(RECIPES_20PAX_STORAGE_KEY, JSON.stringify(recipes));
    window.dispatchEvent(new CustomEvent('canteen_recipes_20pax_updated', { detail: recipes }));

    // Non-blocking background sync to Supabase app_settings
    Promise.resolve(
      supabase
        .from('app_settings')
        .upsert({ key: RECIPES_20PAX_STORAGE_KEY, value: recipes }, { onConflict: 'key' })
    ).catch((err) => console.warn('Supabase app_settings save note for 20-pax recipes:', err));

    // Also auto-sync 1-person recipes into canteen_menu_recipes_v3 for POS deduction!
    try {
      const current1Pax = getMenuRecipes();
      const updated1Pax: MenuRecipeMap = { ...current1Pax };
      Object.entries(recipes).forEach(([menuKey, ingredients]) => {
        if (Array.isArray(ingredients)) {
          updated1Pax[menuKey] = ingredients.map((ing) => ({
            rawItemId: ing.rawItemId,
            rawItemName: ing.rawItemName,
            quantity: Math.round((ing.quantityFor20 / 20) * 1000) / 1000,
            unit: ing.unit
          }));
        }
      });
      saveMenuRecipes(updated1Pax);
    } catch (e) {
      console.warn('Auto sync 1-pax recipe error:', e);
    }
  } catch (e) {
    console.warn('Error saving 20-pax recipes:', e);
  }
};

export const RawDistributionPage: React.FC = () => {
  const [menuItems, setMenuItems] = useState<CanteenMenuItem[]>(() => getCanteenMenuCache());
  const [rawItems, setRawItems] = useState<RawInventoryItem[]>(() => getRawInventoryItems());
  const [recipes20Pax, setRecipes20Pax] = useState<Recipe20PaxMap>(() => get20PaxRecipes());

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIGURED' | 'UNCONFIGURED'>('ALL');

  // Recipe Editor Modal State
  const [activeEditingMenu, setActiveEditingMenu] = useState<CanteenMenuItem | null>(null);
  const [editingIngredients, setEditingIngredients] = useState<Recipe20PaxIngredient[]>([]);
  const [selectedRawItemToAdd, setSelectedRawItemToAdd] = useState<string>('');
  const [addQuantity, setAddQuantity] = useState<string>('1');
  const [addUnit, setAddUnit] = useState<string>('kg');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Scaler / Party Calculator Modal State
  const [scalerMenu, setScalerMenu] = useState<CanteenMenuItem | null>(null);
  const [scalerPaxCount, setScalerPaxCount] = useState<number>(20);
  const [copiedMarketList, setCopiedMarketList] = useState(false);

  useEffect(() => {
    fetchCanteenMenuOnce().then((items) => {
      if (items && items.length > 0) setMenuItems(items);
    });

    // Check cloud app_settings for any newer recipes
    Promise.resolve(
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', RECIPES_20PAX_STORAGE_KEY)
        .single()
    )
      .then((res: any) => {
        const data = res?.data;
        if (data && data.value && typeof data.value === 'object') {
          const merged = { ...DEFAULT_20PAX_RECIPES, ...data.value };
          setRecipes20Pax(merged);
          localStorage.setItem(RECIPES_20PAX_STORAGE_KEY, JSON.stringify(merged));
        }
      })
      .catch(() => {});

    const handleMenuUpdate = (e: any) => {
      if (e.detail) setMenuItems(e.detail);
      else setMenuItems(getCanteenMenuCache());
    };
    const handleRawUpdate = () => {
      setRawItems(getRawInventoryItems());
    };

    window.addEventListener('canteen_menu_updated', handleMenuUpdate);
    window.addEventListener('canteen_raw_inventory_updated', handleRawUpdate);
    window.addEventListener('storage', handleRawUpdate);

    return () => {
      window.removeEventListener('canteen_menu_updated', handleMenuUpdate);
      window.removeEventListener('canteen_raw_inventory_updated', handleRawUpdate);
      window.removeEventListener('storage', handleRawUpdate);
    };
  }, []);

  // Compute unit cost map for raw items (in Taka per unit)
  const rawItemPriceMap = useMemo(() => {
    const map = new Map<string, { cost: number; unit: string; name: string; nameBn: string }>();
    rawItems.forEach((r) => {
      map.set(r.id, {
        cost: Number(r.unitCost || 0),
        unit: r.unit || 'kg',
        name: r.name,
        nameBn: r.nameBn || r.name
      });
    });
    return map;
  }, [rawItems]);

  // Categories list for pills
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category.toUpperCase().trim());
    });
    return ['ALL', ...Array.from(set)];
  }, [menuItems]);

  // Normalize lookup key for a menu item
  const getRecipeKey = (menu: CanteenMenuItem): string => {
    return menu.name ? menu.name.trim().toUpperCase() : menu.id;
  };

  // Check if a menu item has ingredients configured
  const getIngredientsForMenu = (menu: CanteenMenuItem): Recipe20PaxIngredient[] => {
    const key = getRecipeKey(menu);
    if (recipes20Pax[key] && recipes20Pax[key].length > 0) {
      return recipes20Pax[key];
    }
    // Fallback: check by ID or loose matching
    if (recipes20Pax[menu.id] && recipes20Pax[menu.id].length > 0) {
      return recipes20Pax[menu.id];
    }
    const cleanName = (menu.name || '').trim().toUpperCase();
    for (const [k, ingList] of Object.entries(recipes20Pax)) {
      if (cleanName.includes(k) || k.includes(cleanName)) {
        return ingList as Recipe20PaxIngredient[];
      }
    }
    return [];
  };

  // Calculate estimated total raw cost for 20 persons
  const calculateCostFor20 = (ingredients: Recipe20PaxIngredient[]): number => {
    let total = 0;
    ingredients.forEach((ing) => {
      const rawInfo = rawItemPriceMap.get(ing.rawItemId);
      const unitCost = rawInfo ? rawInfo.cost : 0;
      const ingUnit = (ing.unit || '').toLowerCase().trim();
      const rawUnit = (rawInfo?.unit || '').toLowerCase().trim();

      let effectiveQty = ing.quantityFor20;
      // Convert gm to kg if raw unit is kg
      if (['gm', 'gram', 'গ্রাম'].includes(ingUnit) && ['kg', 'কেজি'].includes(rawUnit)) {
        effectiveQty = ing.quantityFor20 / 1000;
      }
      // Convert ml to liter if raw unit is ltr
      if (['ml', 'মিলি'].includes(ingUnit) && ['liter', 'ltr', 'l', 'লিটার'].includes(rawUnit)) {
        effectiveQty = ing.quantityFor20 / 1000;
      }

      total += effectiveQty * unitCost;
    });
    return Math.round(total * 100) / 100;
  };

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((m) => {
      if (selectedCategory !== 'ALL' && m.category?.toUpperCase().trim() !== selectedCategory) {
        return false;
      }
      const ings = getIngredientsForMenu(m);
      const isConfigured = ings.length > 0;
      if (statusFilter === 'CONFIGURED' && !isConfigured) return false;
      if (statusFilter === 'UNCONFIGURED' && isConfigured) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const nameEn = (m.name || m.name_en || '').toLowerCase();
      const nameBn = (m.name_bn || m.nameBn || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      return nameEn.includes(term) || nameBn.includes(term) || cat.includes(term);
    });
  }, [menuItems, selectedCategory, statusFilter, searchTerm, recipes20Pax, rawItemPriceMap]);

  // Overall Statistics
  const stats = useMemo(() => {
    let configuredCount = 0;
    menuItems.forEach((m) => {
      if (getIngredientsForMenu(m).length > 0) configuredCount++;
    });
    return {
      totalMenu: menuItems.length,
      configuredCount,
      unconfiguredCount: menuItems.length - configuredCount,
      totalRawItems: rawItems.length
    };
  }, [menuItems, recipes20Pax, rawItems]);

  // Open Recipe Editor Modal
  const handleOpenEditor = (menu: CanteenMenuItem) => {
    setActiveEditingMenu(menu);
    const existing = getIngredientsForMenu(menu);
    if (existing.length > 0) {
      setEditingIngredients([...existing]);
    } else {
      // Suggest from default if matched by name
      const key = getRecipeKey(menu);
      if (DEFAULT_20PAX_RECIPES[key]) {
        setEditingIngredients([...DEFAULT_20PAX_RECIPES[key]]);
      } else {
        setEditingIngredients([]);
      }
    }
    // Set default raw item picker to first available raw item
    if (rawItems.length > 0) {
      setSelectedRawItemToAdd(rawItems[0].id);
      setAddUnit(rawItems[0].unit || 'kg');
    }
    setSaveSuccessMsg(null);
  };

  // Add raw ingredient to currently edited recipe
  const handleAddIngredient = () => {
    if (!selectedRawItemToAdd) return;
    const qty = parseFloat(addQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('সঠিক পরিমাণ দিন (Valid quantity is required)');
      return;
    }

    const raw = rawItems.find((r) => r.id === selectedRawItemToAdd);
    if (!raw) return;

    // Check if ingredient already exists in current list
    const existingIndex = editingIngredients.findIndex((ing) => ing.rawItemId === raw.id);
    if (existingIndex >= 0) {
      const updated = [...editingIngredients];
      updated[existingIndex].quantityFor20 += qty;
      setEditingIngredients(updated);
    } else {
      setEditingIngredients([
        ...editingIngredients,
        {
          rawItemId: raw.id,
          rawItemName: raw.name,
          quantityFor20: qty,
          unit: addUnit || raw.unit || 'kg'
        }
      ]);
    }

    setAddQuantity('1');
  };

  // Remove ingredient row
  const handleRemoveIngredient = (index: number) => {
    setEditingIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // Update ingredient quantity
  const handleUpdateIngredientQuantity = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty < 0) return;
    setEditingIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantityFor20: newQty };
      return updated;
    });
  };

  // Save Recipe for 20 Persons
  const handleSaveRecipe = async () => {
    if (!activeEditingMenu) return;
    const key = getRecipeKey(activeEditingMenu);
    const updatedMap: Recipe20PaxMap = {
      ...recipes20Pax,
      [key]: editingIngredients,
      [activeEditingMenu.id]: editingIngredients
    };

    setRecipes20Pax(updatedMap);
    await save20PaxRecipes(updatedMap);
    playCelebrationSound();

    setSaveSuccessMsg(`'${activeEditingMenu.name}' এর ২০ জনের কাঁচামাল বণ্টন তালিকা সফলভাবে সংরক্ষিত হয়েছে!`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setActiveEditingMenu(null);
    }, 1200);
  };

  // Reset to default suggestion
  const handleLoadDefaultRecipe = () => {
    if (!activeEditingMenu) return;
    const key = getRecipeKey(activeEditingMenu);
    if (DEFAULT_20PAX_RECIPES[key]) {
      setEditingIngredients([...DEFAULT_20PAX_RECIPES[key]]);
    } else {
      alert('এই মেনুর জন্য কোনো ডিফল্ট প্রি-সেট নেই। আপনি নিজের প্রয়োজনমতো কাঁচামাল যোগ করতে পারেন।');
    }
  };

  // Open Scaler / Party Calculator Modal
  const handleOpenScaler = (menu: CanteenMenuItem) => {
    setScalerMenu(menu);
    setScalerPaxCount(20);
    setCopiedMarketList(false);
  };

  // Compute scaled quantities for X persons
  const scaledIngredients = useMemo(() => {
    if (!scalerMenu) return [];
    const baseIngredients = getIngredientsForMenu(scalerMenu);
    const ratio = scalerPaxCount / 20;

    return baseIngredients.map((ing) => {
      const scaledQty = Math.round(ing.quantityFor20 * ratio * 100) / 100;
      const rawInfo = rawItemPriceMap.get(ing.rawItemId);
      const unitCost = rawInfo ? rawInfo.cost : 0;
      let effectiveQty = scaledQty;
      const ingUnit = (ing.unit || '').toLowerCase().trim();
      const rawUnit = (rawInfo?.unit || '').toLowerCase().trim();

      if (['gm', 'gram', 'গ্রাম'].includes(ingUnit) && ['kg', 'কেজি'].includes(rawUnit)) {
        effectiveQty = scaledQty / 1000;
      }
      if (['ml', 'মিলি'].includes(ingUnit) && ['liter', 'ltr', 'l', 'লিটার'].includes(rawUnit)) {
        effectiveQty = scaledQty / 1000;
      }

      const totalCost = Math.round(effectiveQty * unitCost);

      return {
        ...ing,
        rawNameBn: rawInfo?.nameBn || ing.rawItemName,
        scaledQty,
        totalCost
      };
    });
  }, [scalerMenu, scalerPaxCount, recipes20Pax, rawItemPriceMap]);

  // Scaled total cost
  const totalScaledCost = useMemo(() => {
    return scaledIngredients.reduce((sum, item) => sum + item.totalCost, 0);
  }, [scaledIngredients]);

  // Copy Scaled Market List text for WhatsApp / Kitchen Staff
  const handleCopyMarketList = () => {
    if (!scalerMenu) return;
    const lines = [
      `📋 *রান্নাঘরের কাঁচামাল চাহিদা তালিকা (Kitchen Requisition)*`,
      `🏢 ১৫৫ ইউএএসইউ ক্যান্টিন (CAFE UAV)`,
      `🍲 *মেনু:* ${scalerMenu.name} ${scalerMenu.name_bn ? `(${scalerMenu.name_bn})` : ''}`,
      `👥 *লোক সংখ্যা:* ${scalerPaxCount} জন`,
      `📅 *তারিখ:* ${new Date().toLocaleDateString('en-GB')}`,
      `----------------------------------------`,
      `*প্রয়োজনীয় কাঁচামাল ও পরিমাণ:*`,
      ...scaledIngredients.map(
        (it, idx) => `${idx + 1}. ${it.rawNameBn || it.rawItemName} : *${it.scaledQty} ${it.unit}*`
      ),
      `----------------------------------------`,
      `💰 *আনুমানিক মোট কাঁচামাল খরচ:* ৳${totalScaledCost.toLocaleString()}`,
      `👤 *জনপ্রতি খরচ:* ৳${Math.round(totalScaledCost / (scalerPaxCount || 1))}`,
      `\n_অনুরোধক্রমে: ক্যান্টিন ম্যানেজার_`
    ];
    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedMarketList(true);
    setTimeout(() => setCopiedMarketList(false), 3000);
  };

  // Print scaled kitchen slip
  const handlePrintMarketSlip = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans text-white">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 text-xs font-black uppercase tracking-wider">
              <ChefHat className="w-3.5 h-3.5 text-indigo-400" />
              <span>Menu Formulation & Raw Item Allocation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-3">
              <span>মেনু ভিত্তিক কাঁচামাল বণ্টন</span>
              <span className="text-sm font-bold font-mono px-2.5 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                প্রতি ২০ জন (Per 20 Pax)
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              যেকোনো মেনু ২০ জনের জন্য রান্না করতে মোট কোন কোন কাঁচামাল কী পরিমাণ লাগবে তা এখান থেকে নির্ধারণ করুন।
              পরবর্তীতে পার্টি বা অর্ডারে যেকোনো সংখ্যক মানুষের জন্য স্বয়ংক্রিয়ভাবে বাজার তালিকা হিসাব করা যাবে।
            </p>
          </div>

          <div className="flex items-center space-x-2 self-stretch sm:self-auto">
            <button
              onClick={() => {
                setRecipes20Pax(get20PaxRecipes());
                setRawItems(getRawInventoryItems());
                fetchCanteenMenuOnce().then((items) => items && setMenuItems(items));
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-sm active:scale-95"
              title="তথ্য রিফ্রেশ করুন"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিফ্রেশ</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">মোট মেনু আইটেম</p>
              <p className="text-lg font-black font-mono text-white">{stats.totalMenu}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">রেসিপি সেট করা</p>
              <p className="text-lg font-black font-mono text-emerald-400">{stats.configuredCount}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">মজুত কাঁচামাল</p>
              <p className="text-lg font-black font-mono text-amber-300">{stats.totalRawItems} টি</p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">স্ট্যান্ডার্ড বেঞ্চমার্ক</p>
              <p className="text-lg font-black font-mono text-purple-300">২০ জন (20 Pax)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Row */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="মেনু খুঁজুন (যেমন: Chicken Curry, বিরিয়ানি, খিচুড়ি, চা...)"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সকল ({menuItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('CONFIGURED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === 'CONFIGURED'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সেট করা ({stats.configuredCount})
            </button>
            <button
              onClick={() => setStatusFilter('UNCONFIGURED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === 'UNCONFIGURED'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সেট নেই ({stats.unconfiguredCount})
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 shadow-xs'
                  : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'সকল ক্যাটাগরি' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Cards Grid */}
      {filteredMenuItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <UtensilsCrossed className="w-10 h-10 text-slate-500 mx-auto" />
          <p className="text-slate-300 font-bold text-sm">কোনো মেনু আইটেম পাওয়া যায়নি।</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('ALL');
              setStatusFilter('ALL');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMenuItems.map((menu) => {
            const ingredients = getIngredientsForMenu(menu);
            const isConfigured = ingredients.length > 0;
            const costFor20 = calculateCostFor20(ingredients);
            const priceFor20 = Number(menu.price || 0) * 20;
            const profitFor20 = priceFor20 - costFor20;
            const profitMargin = priceFor20 > 0 ? Math.round((profitFor20 / priceFor20) * 100) : 0;
            const menuImg = resolveImageUrl(menu.DP || menu.img || menu.image);

            return (
              <div
                key={menu.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between group"
              >
                {/* Top Info */}
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                        {menuImg ? (
                          <img
                            src={menuImg}
                            alt={menu.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <UtensilsCrossed className="w-5 h-5 text-indigo-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                            {menu.category || 'MENU'}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-white truncate leading-snug mt-0.5">
                          {menu.name}
                        </h3>
                        {menu.name_bn && (
                          <p className="text-xs font-bold text-emerald-400 truncate">
                            {menu.name_bn}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                        isConfigured
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                      }`}
                    >
                      {isConfigured ? `${ingredients.length} কাঁচামাল` : 'সেট নেই'}
                    </span>
                  </div>

                  {/* 20 Pax Financial Box */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        বিক্রয় মূল্য (২০ জন)
                      </p>
                      <p className="text-sm font-black font-mono text-white">
                        ৳{priceFor20.toLocaleString()}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          (@৳{menu.price})
                        </span>
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        কাঁচামাল খরচ (২০ জন)
                      </p>
                      <p className="text-sm font-black font-mono text-amber-400">
                        {isConfigured ? `৳${costFor20.toLocaleString()}` : '—'}
                        {isConfigured && (
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            (@৳{Math.round((costFor20 / 20) * 10) / 10})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Ingredients Preview */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>২০ জনের কাঁচামাল তালিকা:</span>
                      {isConfigured && profitMargin > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          সম্ভাব্য মার্জিন: +{profitMargin}%
                        </span>
                      )}
                    </p>

                    {isConfigured ? (
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-2.5 max-h-32 overflow-y-auto space-y-1 text-xs">
                        {ingredients.slice(0, 4).map((ing, idx) => {
                          const rInfo = rawItemPriceMap.get(ing.rawItemId);
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-slate-300 py-0.5"
                            >
                              <span className="truncate pr-2">
                                • {rInfo?.nameBn || ing.rawItemName}
                              </span>
                              <span className="font-mono font-bold text-emerald-300 shrink-0">
                                {ing.quantityFor20} {ing.unit}
                              </span>
                            </div>
                          );
                        })}
                        {ingredients.length > 4 && (
                          <p className="text-[10px] font-bold text-indigo-400 text-center pt-1">
                            + আরও {ingredients.length - 4} টি কাঁচামাল অন্তর্ভুক্ত
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-3 text-center text-xs text-slate-500">
                        এখনো ২০ জনের কাঁচামাল বণ্টন নির্ধারণ করা হয়নি।
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-4 mt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenEditor(menu)}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isConfigured ? 'এডিট করুন' : 'সেট করুন'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenScaler(menu)}
                    disabled={!isConfigured}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="যেকোনো মানুষ সংখ্যার জন্য বাজার হিসাব"
                  >
                    <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                    <span>হিসাব স্কেলার</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. RECIPE EDITOR MODAL (২০ জনের কাঁচামাল নির্ধারণ)      */}
      {/* ======================================================== */}
      <AnimatePresence>
        {activeEditingMenu && (
          <div
            onClick={() => setActiveEditingMenu(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <ChefHat className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      কাঁচামাল বণ্টন নির্ধারণ (প্রতি ২০ জন)
                    </h2>
                    <p className="text-xs text-indigo-300 font-medium">
                      মেনু: <span className="font-bold text-white">{activeEditingMenu.name}</span>{' '}
                      {activeEditingMenu.name_bn && `(${activeEditingMenu.name_bn})`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveEditingMenu(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Success Banner */}
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* 20 Pax Formula Explainer */}
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-start space-x-3 text-xs leading-relaxed text-indigo-200">
                  <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white mb-0.5">২০ জন মানুষের মানসম্মত স্ট্যান্ডার্ড:</p>
                    <p>
                      এখানে নির্ধারণ করা পরিমাণ হবে ঠিক **২০ জন ব্যক্তির এক বেলার খাবারের জন্য**।
                      উদাহরণস্বরূপ, ২০ জনের চিকেন কারির জন্য মুরগি ৩.৫ কেজি, পেঁয়াজ ৫০০ গ্রাম, তেল ২৫০ মিলি
                      ইত্যাদি। সেভ করলে এটি অটোমেটিকালি প্রতিটি বিক্রয়ের সাথে স্টক সমন্বয়েও কাজ করবে।
                    </p>
                  </div>
                </div>

                {/* Add New Raw Ingredient Row */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center space-x-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>নতুন কাঁচামাল যোগ করুন</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Raw Item Selector */}
                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        কাঁচামাল নির্বাচন
                      </label>
                      <select
                        value={selectedRawItemToAdd}
                        onChange={(e) => {
                          setSelectedRawItemToAdd(e.target.value);
                          const chosen = rawItems.find((r) => r.id === e.target.value);
                          if (chosen) setAddUnit(chosen.unit || 'kg');
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                      >
                        {rawItems.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nameBn ? `${r.nameBn} (${r.name})` : r.name} — স্টক: {r.currentStock}{' '}
                            {r.unit} (@৳{r.unitCost})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity for 20 Pax */}
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        ২০ জনের জন্য পরিমাণ
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={addQuantity}
                        onChange={(e) => setAddQuantity(e.target.value)}
                        placeholder="যেমন: 3.5 বা 500"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Unit Selector */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">একক</label>
                      <select
                        value={addUnit}
                        onChange={(e) => setAddUnit(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="kg">kg (কেজি)</option>
                        <option value="gm">gm (গ্রাম)</option>
                        <option value="liter">liter (লিটার)</option>
                        <option value="ml">ml (মিলি)</option>
                        <option value="pcs">pcs (পিস)</option>
                        <option value="cylinder">cylinder</option>
                        <option value="packet">packet</option>
                      </select>
                    </div>

                    {/* Add Button */}
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>যুক্ত করুন</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ingredients List Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider">
                      নির্ধারিত কাঁচামাল সমূহ ({editingIngredients.length} টি)
                    </h4>
                    <button
                      type="button"
                      onClick={handleLoadDefaultRecipe}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      ডিফল্ট রেসিপি প্রি-সেট লোড করুন
                    </button>
                  </div>

                  {editingIngredients.length === 0 ? (
                    <div className="p-8 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                      কোনো কাঁচামাল যোগ করা হয়নি। উপরের ফরম থেকে কাঁচামাল যোগ করুন।
                    </div>
                  ) : (
                    <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-3">কাঁচামাল</th>
                            <th className="px-3 py-3 text-center">২০ জনের পরিমাণ</th>
                            <th className="px-3 py-3 text-center">একক</th>
                            <th className="px-3 py-3 text-right">একক দর</th>
                            <th className="px-3 py-3 text-right">২০ জনের খরচ</th>
                            <th className="px-3 py-3 text-center">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {editingIngredients.map((ing, idx) => {
                            const rawInfo = rawItemPriceMap.get(ing.rawItemId);
                            const unitCost = rawInfo ? rawInfo.cost : 0;
                            const ingUnit = (ing.unit || '').toLowerCase().trim();
                            const rawUnit = (rawInfo?.unit || '').toLowerCase().trim();

                            let effectiveQty = ing.quantityFor20;
                            if (
                              ['gm', 'gram', 'গ্রাম'].includes(ingUnit) &&
                              ['kg', 'কেজি'].includes(rawUnit)
                            ) {
                              effectiveQty = ing.quantityFor20 / 1000;
                            }
                            if (
                              ['ml', 'মিলি'].includes(ingUnit) &&
                              ['liter', 'ltr', 'l', 'লিটার'].includes(rawUnit)
                            ) {
                              effectiveQty = ing.quantityFor20 / 1000;
                            }
                            const rowCost = Math.round(effectiveQty * unitCost);

                            return (
                              <tr key={idx} className="hover:bg-slate-900/50">
                                <td className="px-4 py-2.5 font-bold text-white">
                                  {rawInfo?.nameBn ? `${rawInfo.nameBn} (${ing.rawItemName})` : ing.rawItemName}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={ing.quantityFor20}
                                    onChange={(e) =>
                                      handleUpdateIngredientQuantity(idx, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-emerald-400 focus:outline-none focus:border-indigo-500"
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                                  {ing.unit}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                                  ৳{unitCost}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-400">
                                  ৳{rowCost}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredient(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                    title="মুছে ফেলুন"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 20 Pax Financial Summary */}
                {editingIngredients.length > 0 && (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        মোট কাঁচামাল খরচ (২০ জন)
                      </p>
                      <p className="text-base font-black font-mono text-amber-400">
                        ৳{calculateCostFor20(editingIngredients).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        জনপ্রতি কাঁচামাল খরচ
                      </p>
                      <p className="text-base font-black font-mono text-indigo-300">
                        ৳{Math.round((calculateCostFor20(editingIngredients) / 20) * 10) / 10}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        মোট বিক্রয় মূল্য (২০ জন)
                      </p>
                      <p className="text-base font-black font-mono text-white">
                        ৳{(Number(activeEditingMenu.price || 0) * 20).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        সম্ভাব্য লাভ (২০ জন)
                      </p>
                      {(() => {
                        const cost = calculateCostFor20(editingIngredients);
                        const rev = Number(activeEditingMenu.price || 0) * 20;
                        const profit = rev - cost;
                        return (
                          <p
                            className={`text-base font-black font-mono ${
                              profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            ৳{profit.toLocaleString()}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveEditingMenu(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                >
                  বাতিল
                </button>

                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>২০ জনের রেসিপি সংরক্ষণ করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 2. PARTY SCALER / MARKET LIST MODAL                      */}
      {/* ======================================================== */}
      <AnimatePresence>
        {scalerMenu && (
          <div
            onClick={() => setScalerMenu(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      কাঁচামাল বাজার তালিকা স্কেলার
                    </h2>
                    <p className="text-xs text-slate-400">
                      মেনু: <span className="font-bold text-white">{scalerMenu.name}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setScalerMenu(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* Person Count Slider & Quick Pills */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase text-slate-300 tracking-wider">
                      কত জনের জন্য রান্না করা হবে?
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-2xl font-black font-mono text-emerald-400">
                        {scalerPaxCount}
                      </span>
                      <span className="text-xs font-bold text-slate-400">জন</span>
                    </div>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min="5"
                    max="300"
                    step="5"
                    value={scalerPaxCount}
                    onChange={(e) => setScalerPaxCount(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />

                  {/* Quick Select Buttons */}
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    {[10, 20, 30, 50, 75, 100, 150, 200].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setScalerPaxCount(num)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                          scalerPaxCount === num
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {num} জন
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scaled Ingredients Requisition Table */}
                <div className="space-y-2" id="printable-kitchen-requisition">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider">
                      {scalerPaxCount} জনের প্রয়োজনীয় কাঁচামাল ও বাজার তালিকা
                    </h4>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      আনুমানিক খরচ: ৳{totalScaledCost.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">ক্র.</th>
                          <th className="px-3 py-2.5">কাঁচামালের নাম</th>
                          <th className="px-3 py-2.5 text-center">২০ জনের মাপ</th>
                          <th className="px-3 py-2.5 text-center">
                            {scalerPaxCount} জনের প্রয়োজন
                          </th>
                          <th className="px-4 py-2.5 text-right">খরচ (আনুমানিক)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-medium">
                        {scaledIngredients.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="px-4 py-2 text-slate-500 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-bold text-white">{it.rawNameBn}</td>
                            <td className="px-3 py-2 text-center text-slate-400 font-mono">
                              {it.quantityFor20} {it.unit}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-black text-emerald-400 text-sm">
                              {it.scaledQty} {it.unit}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-amber-400">
                              ৳{it.totalCost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setScalerMenu(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  বন্ধ করুন
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyMarketList}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    {copiedMarketList ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">কপি সম্পন্ন!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>বাজার লিস্ট কপি</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintMarketSlip}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>প্রিন্ট স্লিপ</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
